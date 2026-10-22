import "server-only";

import { randomBytes } from "node:crypto";

import type { AdminOrder } from "@/lib/admin/store";
import { couponSourcesForOrders } from "@/lib/customer/coupons";
import { getDb, TABLES, type DbError } from "@/lib/db";
import { raiseDbError } from "@/lib/db/health";
import type { KaraokeReservation } from "@/lib/mobile/karaoke-core";

import type {
  CarrierEntry,
  InvoicePayment,
  InvoiceRow,
  InvoiceSourceKind,
  InvoiceStatus,
} from "./invoice-core";
import type { TokenStore } from "./parasut-client";

/**
 * The e-Arşiv tables (20261022190000_earsiv_invoices.sql), and the order
 * and booking reads the invoices are planned from. Every write the runner
 * makes to a row it holds is guarded by the claim (`status = 'working'`
 * and its own `claimedAt`), so a run that lost its row (taken over after
 * 15 minutes) cannot overwrite the run that took it. Writes from the sync
 * and the panel are guarded by the row's `updatedAt` (compare and set).
 */

type Res<T> = { data: T | null; error: DbError | null; status: number };

function rowsOf<T>(res: Res<T[]>, ctx: string): T[] {
  if (res.error) raiseDbError(ctx, res.error, res.status);
  return res.data ?? [];
}

function checked(
  res: { error: DbError | null; status: number },
  ctx: string,
): void {
  if (res.error) raiseDbError(ctx, res.error, res.status);
}

const INT_FIELDS = [
  "amountMinor",
  "attempts",
  "emailAttempts",
  "formalizePosts",
] as const;

/** A row as Postgres hands it, with numbers and the jsonb made sure. */
export function invoiceFromDb(raw: Record<string, unknown>): InvoiceRow {
  const row = { ...raw } as Record<string, unknown>;
  for (const f of INT_FIELDS) row[f] = Number(row[f] ?? 0) || 0;
  if (!Array.isArray(row.kdvRows)) row.kdvRows = [];
  return row as unknown as InvoiceRow;
}

export function newInvoiceId(): string {
  return `inv_${randomBytes(8).toString("hex")}`;
}

/** The columns a new row starts with, besides its plan. */
export function blankInvoice(
  kind: InvoiceSourceKind,
  sourceId: string,
  nowIso: string,
): InvoiceRow {
  return {
    id: newInvoiceId(),
    sourceKind: kind,
    sourceId,
    sourceLabel: "",
    route: "",
    status: "waiting",
    dueAt: "",
    deadlineAt: "",
    amountMinor: 0,
    kdvRows: [],
    billingCity: "",
    billingDistrict: "",
    billingAddress: "",
    billingEditedBy: "",
    contactId: "",
    salesInvoiceId: "",
    createStartedAt: "",
    jobId: "",
    jobPostedAt: "",
    formalizePosts: 0,
    eDocumentId: "",
    eDocumentType: "",
    invoiceNo: "",
    uuid: "",
    issuedAt: "",
    emailedAt: "",
    emailError: "",
    emailAttempts: 0,
    attempts: 0,
    lastError: "",
    nextAttemptAt: "",
    claimedAt: "",
    manualReason: "",
    manualCode: "",
    actor: "",
    refundNotedAt: "",
    createdAt: nowIso,
    updatedAt: nowIso,
  };
}

export type InvoicePatch = Partial<
  Omit<InvoiceRow, "id" | "sourceKind" | "sourceId" | "createdAt">
>;

/** What the runner and the sync need from the database (faked in tests). */
export interface InvoiceStore {
  recentPaidOrders(sinceIso: string): Promise<AdminOrder[]>;
  ordersByIds(ids: readonly string[]): Promise<AdminOrder[]>;
  recentPaidBookings(sinceDay: string): Promise<KaraokeReservation[]>;
  bookingsByIds(ids: readonly string[]): Promise<KaraokeReservation[]>;
  paymentsFor(ids: readonly string[]): Promise<Map<string, InvoicePayment[]>>;
  couponSources(orders: readonly AdminOrder[]): Promise<Map<number, string>>;
  rowsForSources(
    kind: InvoiceSourceKind,
    ids: readonly string[],
  ): Promise<InvoiceRow[]>;
  openRows(): Promise<InvoiceRow[]>;
  insertRow(row: InvoiceRow): Promise<boolean>;
  /** Compare-and-set on `updatedAt`; false when the row moved meanwhile. */
  updateRow(
    row: Pick<InvoiceRow, "id" | "updatedAt">,
    patch: InvoicePatch,
  ): Promise<boolean>;
  claim(
    nowIso: string,
    staleBeforeIso: string,
    live: boolean,
    limit: number,
  ): Promise<InvoiceRow[]>;
  /** A held row's write; false when the claim was lost. */
  updateClaimed(
    id: string,
    claimedAt: string,
    patch: InvoicePatch,
  ): Promise<boolean>;
  carriers(): Promise<CarrierEntry[]>;
  readState<T>(key: string): Promise<T | null>;
  writeState(key: string, value: unknown): Promise<void>;
  contact(
    companyId: string,
    email: string,
  ): Promise<{ contactId: string; fingerprint: string } | null>;
  saveContact(
    companyId: string,
    email: string,
    contactId: string,
    fingerprint: string,
  ): Promise<void>;
  /** Puts the "faturalı siparişte iade" flag on an order nobody flagged yet. */
  flagOrderRefund(orderId: string): Promise<boolean>;
  tokens: TokenStore;
}

const OPEN_STATUSES: InvoiceStatus[] = [
  "waiting",
  "due",
  "working",
  "draft",
  "formalizing",
  "failed",
  "manual",
];

async function readState<T>(key: string): Promise<T | null> {
  const res = await getDb()
    .from(TABLES.invoiceState)
    .select("value")
    .eq("key", key)
    .maybeSingle();
  if (res.error) raiseDbError("invoice.readState", res.error, res.status);
  const value = (res.data as { value?: unknown } | null)?.value;
  return value === undefined || value === null ? null : (value as T);
}

async function writeState(key: string, value: unknown): Promise<void> {
  checked(
    await getDb()
      .from(TABLES.invoiceState)
      .upsert(
        { key, value, updatedAt: new Date().toISOString() },
        { onConflict: "key" },
      ),
    "invoice.writeState",
  );
}

export const CARRIERS_KEY = "carriers";
export const LAST_RUN_KEY = "run.last";

function cleanCarriers(value: unknown): CarrierEntry[] {
  const list = (value as { list?: unknown } | null)?.list;
  if (!Array.isArray(list)) return [];
  return list
    .map((c) => ({
      name: String((c as CarrierEntry)?.name ?? "").trim(),
      title: String((c as CarrierEntry)?.title ?? "").trim(),
      vkn: String((c as CarrierEntry)?.vkn ?? "").trim(),
    }))
    .filter((c) => c.name);
}

export async function readCarriers(): Promise<CarrierEntry[]> {
  return cleanCarriers(await readState(CARRIERS_KEY));
}

export async function writeCarriers(
  list: readonly CarrierEntry[],
): Promise<void> {
  await writeState(CARRIERS_KEY, { list });
}

export const dbInvoiceStore: InvoiceStore = {
  async recentPaidOrders(sinceIso) {
    return rowsOf<AdminOrder>(
      await getDb()
        .from(TABLES.orders)
        .select("*")
        .gte("paidAt", sinceIso)
        .neq("source", "manual")
        .order("paidAt", { ascending: true })
        .limit(1000),
      "invoice.recentPaidOrders",
    );
  },
  async ordersByIds(ids) {
    if (ids.length === 0) return [];
    return rowsOf<AdminOrder>(
      await getDb().from(TABLES.orders).select("*").in("id", ids.slice(0, 500)),
      "invoice.ordersByIds",
    );
  },
  async recentPaidBookings(sinceDay) {
    return rowsOf<KaraokeReservation>(
      await getDb()
        .from(TABLES.karaokeReservations)
        .select("*")
        .gte("date", sinceDay)
        .in("paymentStatus", ["paid", "refunding", "refunded"])
        .limit(1000),
      "invoice.recentPaidBookings",
    );
  },
  async bookingsByIds(ids) {
    if (ids.length === 0) return [];
    return rowsOf<KaraokeReservation>(
      await getDb()
        .from(TABLES.karaokeReservations)
        .select("*")
        .in("id", ids.slice(0, 500)),
      "invoice.bookingsByIds",
    );
  },
  async paymentsFor(ids) {
    const out = new Map<string, InvoicePayment[]>();
    for (let i = 0; i < ids.length; i += 500) {
      const part = rowsOf<{
        orderId: string;
        provider: string;
        status: string;
      }>(
        await getDb()
          .from(TABLES.paymentTransactions)
          .select("orderId, provider, status")
          .in("orderId", ids.slice(i, i + 500)),
        "invoice.paymentsFor",
      );
      for (const p of part) {
        const list = out.get(p.orderId) ?? [];
        list.push({ provider: String(p.provider), status: String(p.status) });
        out.set(p.orderId, list);
      }
    }
    return out;
  },
  async couponSources(orders) {
    const map = await couponSourcesForOrders(orders);
    return new Map([...map].map(([no, source]) => [no, String(source)]));
  },
  async rowsForSources(kind, ids) {
    if (ids.length === 0) return [];
    const out: InvoiceRow[] = [];
    for (let i = 0; i < ids.length; i += 500) {
      out.push(
        ...rowsOf<Record<string, unknown>>(
          await getDb()
            .from(TABLES.invoices)
            .select("*")
            .eq("sourceKind", kind)
            .in("sourceId", ids.slice(i, i + 500)),
          "invoice.rowsForSources",
        ).map(invoiceFromDb),
      );
    }
    return out;
  },
  async openRows() {
    return rowsOf<Record<string, unknown>>(
      await getDb()
        .from(TABLES.invoices)
        .select("*")
        .in("status", OPEN_STATUSES)
        .limit(2000),
      "invoice.openRows",
    ).map(invoiceFromDb);
  },
  async insertRow(row) {
    const res = await getDb()
      .from(TABLES.invoices)
      .upsert(row, {
        onConflict: "sourceKind,sourceId",
        ignoreDuplicates: true,
      })
      .select("id");
    return rowsOf<{ id: string }>(res, "invoice.insertRow").length > 0;
  },
  async updateRow(row, patch) {
    const res = await getDb()
      .from(TABLES.invoices)
      .update({
        ...patch,
        updatedAt: patch.updatedAt ?? new Date().toISOString(),
      })
      .eq("id", row.id)
      .eq("updatedAt", row.updatedAt)
      .select("id");
    return rowsOf<{ id: string }>(res, "invoice.updateRow").length > 0;
  },
  async claim(nowIso, staleBeforeIso, live, limit) {
    const res = await getDb().rpcRows<Record<string, unknown>>(
      "invoice_claim",
      {
        p_now: nowIso,
        p_stale_before: staleBeforeIso,
        p_live: live,
        p_limit: limit,
      },
    );
    return rowsOf(res, "invoice.claim").map(invoiceFromDb);
  },
  async updateClaimed(id, claimedAt, patch) {
    const res = await getDb()
      .from(TABLES.invoices)
      .update({
        ...patch,
        updatedAt: patch.updatedAt ?? new Date().toISOString(),
      })
      .eq("id", id)
      .eq("status", "working")
      .eq("claimedAt", claimedAt)
      .select("id");
    return rowsOf<{ id: string }>(res, "invoice.updateClaimed").length > 0;
  },
  carriers: readCarriers,
  readState,
  writeState,
  async contact(companyId, email) {
    const res = await getDb()
      .from(TABLES.invoiceContacts)
      .select("contactId, fingerprint")
      .eq("companyId", companyId)
      .eq("email", email.trim().toLowerCase())
      .maybeSingle();
    if (res.error) raiseDbError("invoice.contact", res.error, res.status);
    return (
      (res.data as { contactId: string; fingerprint: string } | null) ?? null
    );
  },
  async saveContact(companyId, email, contactId, fingerprint) {
    checked(
      await getDb().from(TABLES.invoiceContacts).upsert(
        {
          companyId,
          email: email.trim().toLowerCase(),
          contactId,
          fingerprint,
          updatedAt: new Date().toISOString(),
        },
        { onConflict: "companyId,email" },
      ),
      "invoice.saveContact",
    );
  },
  async flagOrderRefund(orderId) {
    const res = await getDb()
      .from(TABLES.orders)
      .update({ attention: "invoice_refund" })
      .eq("id", orderId)
      .eq("attention", "")
      .select("id");
    return rowsOf<{ id: string }>(res, "invoice.flagOrderRefund").length > 0;
  },
  tokens: {
    async read(key) {
      const v = await readState<{ sealed?: string }>(key);
      return typeof v?.sealed === "string" ? v.sealed : null;
    },
    async write(key, sealed) {
      await writeState(key, { sealed });
    },
    async lease(key, owner, nowIso, untilIso) {
      const res = await getDb().rpc<boolean>("invoice_state_lease", {
        p_key: key,
        p_owner: owner,
        p_now: nowIso,
        p_until: untilIso,
      });
      if (res.error) raiseDbError("invoice.lease", res.error, res.status);
      return res.data === true;
    },
  },
};

// ─── The panel's reads and writes ─────────────────────────────────────────

export async function getInvoice(id: string): Promise<InvoiceRow | null> {
  const res = await getDb()
    .from(TABLES.invoices)
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (res.error) raiseDbError("invoice.get", res.error, res.status);
  return res.data ? invoiceFromDb(res.data as Record<string, unknown>) : null;
}

export async function getInvoiceForSource(
  kind: InvoiceSourceKind,
  sourceId: string,
): Promise<InvoiceRow | null> {
  const res = await getDb()
    .from(TABLES.invoices)
    .select("*")
    .eq("sourceKind", kind)
    .eq("sourceId", sourceId)
    .maybeSingle();
  if (res.error) raiseDbError("invoice.getForSource", res.error, res.status);
  return res.data ? invoiceFromDb(res.data as Record<string, unknown>) : null;
}

/** The panel's list: newest first, at most `limit`. */
export async function listInvoices(limit = 500): Promise<InvoiceRow[]> {
  return rowsOf<Record<string, unknown>>(
    await getDb()
      .from(TABLES.invoices)
      .select("*")
      .order("createdAt", { ascending: false })
      .limit(limit),
    "invoice.list",
  ).map(invoiceFromDb);
}

/**
 * Rows that need a person, for the dashboard: open rows (deadline badges
 * read them) and every issued row with a refund after it.
 */
export async function listAttentionInvoices(): Promise<InvoiceRow[]> {
  const open = await dbInvoiceStore.openRows();
  const refunded = rowsOf<Record<string, unknown>>(
    await getDb()
      .from(TABLES.invoices)
      .select("*")
      .eq("status", "issued")
      .neq("refundNotedAt", "")
      .limit(200),
    "invoice.refundedAfterIssue",
  ).map(invoiceFromDb);
  return [...open, ...refunded];
}

export async function readLastRun<T>(): Promise<T | null> {
  return readState<T>(LAST_RUN_KEY);
}

/**
 * "Elle kesilecek" by a person (a corporate invoice asked for, or anything
 * the operator wants out of the automation): before anything is formalised
 * only. Creates the row when the order or booking has none yet.
 */
export async function markInvoiceManual(
  kind: InvoiceSourceKind,
  sourceId: string,
  label: string,
  reason: string,
  actor: string,
): Promise<{ ok: true; row: InvoiceRow } | { ok: false; error: string }> {
  const now = new Date().toISOString();
  let row = await getInvoiceForSource(kind, sourceId);
  if (!row) {
    const fresh = {
      ...blankInvoice(kind, sourceId, now),
      sourceLabel: label,
      status: "manual" as const,
      manualCode: "corporate",
      manualReason: reason,
      actor,
    };
    if (await dbInvoiceStore.insertRow(fresh)) return { ok: true, row: fresh };
    row = await getInvoiceForSource(kind, sourceId);
    if (!row) return { ok: false, error: "Kayıt oluşturulamadı. Tekrar dene." };
  }
  if (
    row.eDocumentId ||
    ["issued", "manual_done", "working", "formalizing"].includes(row.status)
  ) {
    return {
      ok: false,
      error:
        "Bu faturanın işlemi başladı ya da bitti; elle kesilecek diye işaretlenemez.",
    };
  }
  if (row.salesInvoiceId) {
    return {
      ok: false,
      error:
        "Paraşüt'te bu kayıt için taslak fatura var. Önce Paraşüt'te taslağı sil, sonra işaretle.",
    };
  }
  const patch = {
    status: "manual" as const,
    manualCode: "corporate",
    manualReason: reason,
    actor,
    nextAttemptAt: "",
    updatedAt: now,
  };
  if (!(await dbInvoiceStore.updateRow(row, patch))) {
    return {
      ok: false,
      error: "Kayıt bu arada değişti. Sayfayı yenileyip tekrar dene.",
    };
  }
  return { ok: true, row: { ...row, ...patch } };
}

/** "Paraşüt'te elle kestim": the invoice number a person cut it under. */
export async function markInvoiceManualDone(
  id: string,
  invoiceNo: string,
  actor: string,
): Promise<{ ok: true; row: InvoiceRow } | { ok: false; error: string }> {
  const row = await getInvoice(id);
  if (!row) return { ok: false, error: "Fatura kaydı bulunamadı." };
  if (row.eDocumentId || row.status === "issued" || row.status === "working") {
    return {
      ok: false,
      error: "Bu fatura otomatik kesildi ya da şu an kesiliyor.",
    };
  }
  const now = new Date().toISOString();
  const patch = {
    status: "manual_done" as const,
    invoiceNo,
    actor,
    issuedAt: now,
    nextAttemptAt: "",
    updatedAt: now,
  };
  if (!(await dbInvoiceStore.updateRow(row, patch))) {
    return {
      ok: false,
      error: "Kayıt bu arada değişti. Sayfayı yenileyip tekrar dene.",
    };
  }
  return { ok: true, row: { ...row, ...patch } };
}

/** "Yeniden dene": back to the queue, attempts from zero. */
export async function retryInvoice(
  id: string,
): Promise<{ ok: true; row: InvoiceRow } | { ok: false; error: string }> {
  const row = await getInvoice(id);
  if (!row) return { ok: false, error: "Fatura kaydı bulunamadı." };
  const now = new Date().toISOString();
  let patch: InvoicePatch;
  if (row.status === "issued" && !row.emailedAt) {
    // The PDF mail only.
    patch = {
      nextAttemptAt: now,
      emailAttempts: 0,
      emailError: "",
      updatedAt: now,
    };
  } else if (
    ["manual", "failed", "draft", "waiting", "due"].includes(row.status)
  ) {
    patch = {
      status: "due",
      attempts: 0,
      lastError: "",
      nextAttemptAt: "",
      manualCode: "",
      manualReason: "",
      actor: "",
      dueAt: row.dueAt || now,
      updatedAt: now,
    };
  } else {
    return { ok: false, error: "Bu durumdaki fatura yeniden denenemez." };
  }
  if (!(await dbInvoiceStore.updateRow(row, patch))) {
    return {
      ok: false,
      error: "Kayıt bu arada değişti. Sayfayı yenileyip tekrar dene.",
    };
  }
  return { ok: true, row: { ...row, ...patch } };
}

/** The billing province, district and address a person typed. */
export async function setInvoiceBilling(
  id: string,
  billing: { city: string; district: string; address: string },
  actor: string,
): Promise<{ ok: true; row: InvoiceRow } | { ok: false; error: string }> {
  const row = await getInvoice(id);
  if (!row) return { ok: false, error: "Fatura kaydı bulunamadı." };
  if (row.salesInvoiceId || row.eDocumentId || FINAL_OR_BUSY.has(row.status)) {
    return {
      ok: false,
      error:
        "Fatura Paraşüt'e gönderildikten sonra adres buradan değiştirilemez.",
    };
  }
  const now = new Date().toISOString();
  const patch: InvoicePatch = {
    billingCity: billing.city,
    billingDistrict: billing.district,
    billingAddress: billing.address,
    billingEditedBy: actor,
    updatedAt: now,
  };
  if (!(await dbInvoiceStore.updateRow(row, patch))) {
    return {
      ok: false,
      error: "Kayıt bu arada değişti. Sayfayı yenileyip tekrar dene.",
    };
  }
  return { ok: true, row: { ...row, ...patch } };
}

const FINAL_OR_BUSY: ReadonlySet<string> = new Set([
  "issued",
  "manual_done",
  "skipped",
  "working",
  "formalizing",
]);
