import "server-only";

import { randomBytes } from "node:crypto";

import { applyIysRefusal } from "@/lib/customer/unsubscribe";
import { getDb, TABLES, type DbError } from "@/lib/db";
import { raiseDbError } from "@/lib/db/health";

import {
  addIstanbulBusinessDays,
  IYS_SOURCE_MAP,
  iysCheckFreshness,
  maskIysEmail,
  newIysExportId,
  type IysCheckFreshness,
  type IysEventState,
  type IysListRow,
  type IysStatus,
} from "./iys-core";

/**
 * The İYS outbox (db/migrations/20261022180000_iys_consent_sync.sql): what
 * /admin/iys reads and writes, the daily reconcile, and the import of İYS's
 * consent list. The rules that need no database are in ./iys-core.ts; the
 * send gate is ./gate.ts.
 *
 * Addresses never reach a log in full (CLAUDE.md rule 9), and the audit
 * rows the panel writes carry counts, never addresses.
 */

function checkErr(error: DbError | null, ctx: string): void {
  if (error) raiseDbError(ctx, error, error.code === "" ? 0 : 400);
}

const str = (v: unknown): string => (typeof v === "string" ? v : "");
const num = (v: unknown): number => {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
};

export interface IysEvent {
  id: string;
  email: string;
  status: IysStatus;
  source: string;
  consentDate: string;
  dueAt: string;
  state: IysEventState;
  exportId: string;
  exportedAt: string;
  settledAt: string;
  settledBy: string;
  note: string;
  legacy: boolean;
  createdAt: string;
}

function toEvent(row: Record<string, unknown>): IysEvent {
  return {
    id: String(row.id ?? ""),
    email: str(row.email),
    status: row.status === "RET" ? "RET" : "ONAY",
    source: str(row.source),
    consentDate: str(row.consentDate),
    dueAt: str(row.dueAt),
    state: (str(row.state) || "pending") as IysEventState,
    exportId: str(row.exportId),
    exportedAt: str(row.exportedAt),
    settledAt: str(row.settledAt),
    settledBy: str(row.settledBy),
    note: str(row.note),
    legacy: row.legacy === true,
    createdAt: str(row.createdAt),
  };
}

export interface IysState {
  launchedAt: string;
  lastCheckAt: string;
  lastCheckBy: string;
  lastCheckKind: "" | "import" | "attest";
  lastImport: Record<string, unknown>;
  lastReconcileAt: string;
  lastReconcile: Record<string, unknown>;
}

const EMPTY_STATE: IysState = {
  launchedAt: "",
  lastCheckAt: "",
  lastCheckBy: "",
  lastCheckKind: "",
  lastImport: {},
  lastReconcileAt: "",
  lastReconcile: {},
};

const obj = (v: unknown): Record<string, unknown> =>
  v && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : {};

/** The single state row; the empty state when it is not there yet. */
export async function getIysState(): Promise<IysState> {
  const { data, error } = await getDb()
    .from(TABLES.iysState)
    .select("*")
    .eq("id", "iys")
    .maybeSingle();
  checkErr(error, "getIysState");
  if (!data) return { ...EMPTY_STATE };
  const row = data as Record<string, unknown>;
  const kind = str(row.lastCheckKind);
  return {
    launchedAt: str(row.launchedAt),
    lastCheckAt: str(row.lastCheckAt),
    lastCheckBy: str(row.lastCheckBy),
    lastCheckKind: kind === "import" || kind === "attest" ? kind : "",
    lastImport: obj(row.lastImport),
    lastReconcileAt: str(row.lastReconcileAt),
    lastReconcile: obj(row.lastReconcile),
  };
}

/** How fresh the last İYS refusal check is, now. */
export async function iysCheckNow(
  now: Date = new Date(),
): Promise<IysCheckFreshness & { state: IysState }> {
  const state = await getIysState();
  return { ...iysCheckFreshness(state.lastCheckAt, now), state };
}

export interface IysReconcileResult {
  onay: number;
  ret: number;
  superseded: number;
}

/**
 * Recomputes what İYS should hold for every address and adds or supersedes
 * outbox events (`iys_reconcile`). Run by the daily cron, when /admin/iys
 * opens and right before a campaign is queued. Idempotent; one run at a
 * time in the database.
 */
export async function reconcileIys(
  now: Date = new Date(),
): Promise<IysReconcileResult> {
  const { data, error } = await getDb().rpc<unknown>("iys_reconcile", {
    p_now: now.toISOString(),
    p_sources: IYS_SOURCE_MAP,
  });
  checkErr(error, "iys_reconcile");
  const r = obj(data);
  return { onay: num(r.onay), ret: num(r.ret), superseded: num(r.superseded) };
}

/** Every event still to upload or to confirm, nearest deadline first. */
export async function listOpenIysEvents(): Promise<IysEvent[]> {
  const { data, error } = await getDb()
    .from(TABLES.iysEvents)
    .select("*")
    .in("state", ["pending", "exported"])
    .order("dueAt", { ascending: true })
    .order("id", { ascending: true });
  checkErr(error, "listOpenIysEvents");
  return ((data as Record<string, unknown>[] | null) ?? []).map(toEvent);
}

/** The latest settled events (registered, rejected, superseded). */
export async function listSettledIysEvents(limit = 50): Promise<IysEvent[]> {
  const { data, error } = await getDb()
    .from(TABLES.iysEvents)
    .select("*")
    .in("state", ["registered", "rejected", "superseded"])
    .order("settledAt", { ascending: false })
    .order("id", { ascending: false })
    .limit(limit);
  checkErr(error, "listSettledIysEvents");
  return ((data as Record<string, unknown>[] | null) ?? []).map(toEvent);
}

export interface IysCounts {
  /** Addresses İYS holds ONAY for, as far as we know: the sendable ones. */
  registered: number;
  /** Consents İYS refused (H467 and the like): out until a new consent. */
  rejected: number;
}

export async function iysCounts(): Promise<IysCounts> {
  const db = getDb();
  const [registered, rejected] = await Promise.all([
    db
      .from(TABLES.iysRecipients)
      .select("*", { count: "exact", head: true })
      .eq("iysStatus", "ONAY"),
    db
      .from(TABLES.iysEvents)
      .select("*", { count: "exact", head: true })
      .eq("state", "rejected")
      .eq("status", "ONAY"),
  ]);
  checkErr(registered.error, "iysCounts.registered");
  checkErr(rejected.error, "iysCounts.rejected");
  return { registered: registered.count ?? 0, rejected: rejected.count ?? 0 };
}

/**
 * "İYS dosyasını indir": every pending event and every one downloaded
 * earlier but not yet confirmed goes into ONE new file. They are all
 * stamped with the new batch id in one statement, so a file always holds
 * whatever is still open and the batch to confirm is the latest one.
 */
export async function exportIysEvents(
  now: Date = new Date(),
): Promise<{ exportId: string; events: IysEvent[] }> {
  const exportId = newIysExportId(now, randomBytes(2).toString("hex"));
  const { data, error } = await getDb()
    .from(TABLES.iysEvents)
    .update({
      state: "exported",
      exportId,
      exportedAt: now.toISOString(),
    })
    .in("state", ["pending", "exported"])
    .select("*");
  checkErr(error, "exportIysEvents");
  const events = ((data as Record<string, unknown>[] | null) ?? []).map(
    toEvent,
  );
  return { exportId, events };
}

/** "İYS'ye yüklendi" for a file: its open events become registered. */
export async function settleIysExport(
  exportId: string,
  by: string,
  now: Date = new Date(),
): Promise<number> {
  const { data, error } = await getDb().rpc<unknown>("iys_settle_export", {
    p_export_id: exportId,
    p_by: by,
    p_now: now.toISOString(),
  });
  checkErr(error, "iys_settle_export");
  return num(data);
}

/**
 * "İYS reddetti" for one event, with İYS's code or a note (H467, H178...).
 * A refused ONAY keeps the address out of campaigns until the person
 * consents again; a refused RET leaves the address off our list anyway.
 */
export async function rejectIysEvent(
  id: string,
  note: string,
  by: string,
  now: Date = new Date(),
): Promise<IysEvent | null> {
  const { data, error } = await getDb()
    .from(TABLES.iysEvents)
    .update({
      state: "rejected",
      note: note.slice(0, 300),
      settledAt: now.toISOString(),
      settledBy: by,
    })
    .eq("id", id)
    .in("state", ["pending", "exported"])
    .select("*");
  checkErr(error, "rejectIysEvent");
  const rows = (data as Record<string, unknown>[] | null) ?? [];
  return rows[0] ? toEvent(rows[0]) : null;
}

/** The operator's "İYS'yi kontrol ettim, yeni ret yok". */
export async function attestIysCheck(
  by: string,
  now: Date = new Date(),
): Promise<void> {
  const { error } = await getDb().rpc<null>("iys_record_check", {
    p_kind: "attest",
    p_by: by,
    p_now: now.toISOString(),
    p_summary: {},
  });
  checkErr(error, "iys_record_check");
}

export interface IysImportResult {
  onayListed: number;
  /** ONAY rows for addresses with no consent trace here: left alone. */
  onayIgnored: number;
  retListed: number;
  /** New İYS refusals applied to the consent stores here. */
  refusalsApplied: number;
  /** Downloaded events İYS's list showed as done. */
  registered: number;
  superseded: number;
}

const CHUNK = 500;

function chunks<T>(list: readonly T[]): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < list.length; i += CHUNK)
    out.push(list.slice(i, i + CHUNK));
  return out;
}

/**
 * Which listed refusals are NEWS: İYS shows RET and we did not already know
 * it (our record says ONAY or nothing), or an ONAY of ours is in a
 * downloaded file and may have reached İYS before the person refused there.
 * A RET we already knew of is the old one: a consent the person gave here
 * after it is a new consent, not to be wiped by a list that predates it.
 */
async function newRefusals(emails: readonly string[]): Promise<string[]> {
  const known = new Map<string, string>();
  const exportedOnay = new Set<string>();
  for (const part of chunks(emails)) {
    const [recipients, events] = await Promise.all([
      getDb()
        .from(TABLES.iysRecipients)
        .select("email, iysStatus")
        .in("email", part),
      getDb()
        .from(TABLES.iysEvents)
        .select("email")
        .in("email", part)
        .eq("status", "ONAY")
        .eq("state", "exported"),
    ]);
    checkErr(recipients.error, "newRefusals.recipients");
    checkErr(events.error, "newRefusals.events");
    for (const r of (recipients.data as Record<string, unknown>[] | null) ??
      []) {
      known.set(str(r.email), str(r.iysStatus));
    }
    for (const e of (events.data as Record<string, unknown>[] | null) ?? []) {
      exportedOnay.add(str(e.email));
    }
  }
  return emails.filter(
    (email) => known.get(email) !== "RET" || exportedOnay.has(email),
  );
}

/**
 * An import of İYS's consent list (rows from `parseIysConsentList`).
 *
 * Every NEW refusal is applied here first, through the same consent
 * functions the unsubscribe link uses (`applyIysRefusal`: preferences off,
 * a ledger row with source `iys`, the bulletin row off), so the person gets
 * no more commercial mail. Only then is İYS's state recorded and the outbox
 * settled against the list (`iys_apply_list`), with the check stamped
 * (kind `import`). A failure half way leaves the stamp unwritten: the same
 * file imported again re-applies nothing that is already off and finishes
 * the rest.
 *
 * An ONAY row never creates a consent here: consent comes from the person,
 * through our own forms.
 */
export async function importIysConsentList(
  rows: readonly IysListRow[],
  meta: { by: string; skipped: number; fileName: string },
  now: Date = new Date(),
): Promise<IysImportResult> {
  const onay = rows.filter((r) => r.status === "ONAY").map((r) => r.email);
  const ret = rows.filter((r) => r.status === "RET").map((r) => r.email);

  let refusalsApplied = 0;
  for (const email of await newRefusals(ret)) {
    try {
      const done = await applyIysRefusal(email);
      if (done.member || done.subscriber) refusalsApplied += 1;
    } catch (err) {
      console.error(`[iys] ret uygulanamadı ${maskIysEmail(email)}`, err);
      throw err;
    }
  }

  const { data, error } = await getDb().rpc<unknown>("iys_apply_list", {
    p_onay: onay,
    p_ret: ret,
    p_by: meta.by,
    p_now: now.toISOString(),
    p_summary: {
      refusalsApplied,
      skipped: meta.skipped,
      fileName: meta.fileName.slice(0, 120),
    },
  });
  checkErr(error, "iys_apply_list");
  const r = obj(data);
  const onayListed = num(r.onayListed);
  return {
    onayListed,
    onayIgnored: Math.max(0, onayListed - num(r.onayKnown)),
    retListed: num(r.retListed),
    refusalsApplied,
    registered: num(r.registered),
    superseded: num(r.superseded),
  };
}

// ── For the dashboard ───────────────────────────────────────────────────────

export interface IysAttention {
  /** Open events past their deadline. */
  overdue: number;
  /** Open events due within one business day. */
  dueSoon: number;
  /** The check is stale (or never made) while a campaign waits to go. */
  staleWithPendingCampaign: boolean;
}

/**
 * What the dashboard should say about İYS, or null when nothing needs a
 * person. Reads only: no reconcile on a dashboard view (the daily cron and
 * /admin/iys run it).
 */
export async function loadIysAttention(
  now: Date = new Date(),
): Promise<IysAttention | null> {
  const db = getDb();
  const nowIso = now.toISOString();
  const soonIso = addIstanbulBusinessDays(nowIso, 1);
  const [openRes, check, queuedRes, scheduledRes] = await Promise.all([
    db
      .from(TABLES.iysEvents)
      .select("dueAt")
      .in("state", ["pending", "exported"])
      .lt("dueAt", soonIso),
    iysCheckNow(now),
    db
      .from(TABLES.campaignEmails)
      .select("*", { count: "exact", head: true })
      .in("status", ["queued", "sending"]),
    db
      .from(TABLES.campaignEmails)
      .select("*", { count: "exact", head: true })
      .eq("status", "draft")
      .neq("scheduledAt", ""),
  ]);
  checkErr(openRes.error, "loadIysAttention.events");
  checkErr(queuedRes.error, "loadIysAttention.queued");
  checkErr(scheduledRes.error, "loadIysAttention.scheduled");
  let overdue = 0;
  let dueSoon = 0;
  for (const row of (openRes.data as Record<string, unknown>[] | null) ?? []) {
    if (str(row.dueAt) <= nowIso) overdue += 1;
    else dueSoon += 1;
  }
  const pendingCampaigns = (queuedRes.count ?? 0) + (scheduledRes.count ?? 0);
  const staleWithPendingCampaign = !check.fresh && pendingCampaigns > 0;
  if (overdue === 0 && dueSoon === 0 && !staleWithPendingCampaign) return null;
  return { overdue, dueSoon, staleWithPendingCampaign };
}
