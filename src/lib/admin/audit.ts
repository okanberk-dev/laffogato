import "server-only";

import { getDb, TABLES } from "@/lib/db";
import { nextSeq } from "@/lib/db/counters";

import { getAdminSession } from "./auth";

/**
 * Append-only event log of admin mutations. Persisted to the Postgres
 * `audit_logs` table, where a trigger refuses UPDATE, TRUNCATE and any
 * DELETE of a row younger than the ten-year retention
 * (db/migrations/20261019170000_audit_logs_append_only.sql); the periodic
 * destruction (src/lib/retention.ts) is the only thing that removes rows,
 * and each of its applied runs leaves a row here too (entity `retention`).
 */

export type AuditEntity =
  | "product"
  | "menu_item"
  | "category"
  | "shop_hero_slide"
  | "home_hero_slide"
  | "app_hero_slide"
  | "app_announcement"
  | "app_post"
  | "reel"
  | "press"
  | "story"
  | "content"
  | "order"
  | "order_item"
  | "promo"
  | "coupon"
  | "settings"
  | "stock"
  | "customer"
  | "newsletter"
  | "legal_doc"
  | "auth"
  | "2fa"
  | "venue_status"
  | "karaoke_reservation"
  | "mobile_app_config"
  | "admin_user"
  | "counter_token"
  | "staff_member"
  | "campaign_email"
  | "cafe_table"
  // The İYS outbox (/admin/iys): a file downloaded or confirmed, an event
  // İYS refused, an import of İYS's list, the operator's check. Counts
  // only, never an address.
  | "iys"
  // An e-Arşiv invoice row (src/lib/invoice/); entityId is the row's id,
  // "run" for a run started from the panel, "carriers" for the carrier list.
  | "invoice"
  // The log itself, for its own CSV export.
  | "audit_log"
  // One periodic destruction run (src/lib/retention.ts), written by the
  // system: entityId is the run's instant, the payload its counts.
  | "retention";

export type AuditAction =
  | "create"
  | "update"
  | "delete"
  | "bulk_update"
  | "bulk_delete"
  | "transition"
  | "refund"
  | "note"
  | "login_success"
  | "login_fail"
  | "logout"
  | "2fa_enable"
  | "2fa_disable"
  // Campaign e-mail: "send" queues the audience and starts the batches,
  // "send_test" is the one real message to the operator's own inbox.
  | "send"
  | "send_test"
  // A file of personal data left the panel (order CSV, audit log CSV): who
  // took it, with which filters, how many rows (admin audit ORD-15).
  | "export";

export interface AdminAuditLog {
  id: string;
  actor: string;
  action: AuditAction;
  entity: AuditEntity;
  entityId: string;
  /** Free-form structured payload - keep small, JSON-serialisable. */
  payload: Record<string, unknown>;
  createdAt: string;
}

export interface LogAuditInput {
  action: AuditAction;
  entity: AuditEntity;
  entityId?: string;
  payload?: Record<string, unknown>;
  /** Override actor (e.g. "system", "customer"); defaults to session email. */
  actor?: string;
}

export async function logAudit(input: LogAuditInput): Promise<void> {
  let actor = input.actor;
  if (!actor) {
    const session = await getAdminSession();
    actor = session?.email ?? "anonymous";
  }
  const seq = await nextSeq("aud");
  const row: AdminAuditLog = {
    id: `aud-${String(seq).padStart(7, "0")}`,
    actor,
    action: input.action,
    entity: input.entity,
    entityId: input.entityId ?? "",
    payload: input.payload ?? {},
    createdAt: new Date().toISOString(),
  };
  const sb = getDb();
  const { error } = await sb.from(TABLES.auditLogs).insert(row);
  if (error) throw new Error(`logAudit: ${error.message}`);
}

/**
 * `logAudit` for the moment AFTER something irreversible happened - money
 * moved, a status changed, a mail went out. It never throws: the audit row is
 * the record of the write, not a condition of it.
 *
 * `logAudit` throws when its insert fails. After a refund that turned the
 * operator's success into the error page; they retried, and the second
 * refund passed because money was still "left". The failure is logged loudly
 * instead, with the row it could not write, and the answer is `false`.
 */
export async function safeAudit(input: LogAuditInput): Promise<boolean> {
  try {
    await logAudit(input);
    return true;
  } catch (err) {
    console.error(
      `[audit] row not written ${input.entity}:${input.entityId ?? ""} ${input.action}`,
      JSON.stringify(input.payload ?? {}),
      err,
    );
    return false;
  }
}

export interface AuditFilter {
  actor?: string;
  entity?: AuditEntity;
  action?: AuditAction;
  /** Exact record id ("prd-0001"), as the row's own link writes it. */
  entityId?: string;
  /** ISO instants: from (inclusive) and to (exclusive). */
  from?: string;
  to?: string;
  limit?: number;
  /** Rows to skip, for a numbered page (newest first). */
  offset?: number;
}

/** The part of a select chain the filters use (each step returns the chain). */
interface FilterChain {
  eq(column: string, value: unknown): this;
  ilike(column: string, value: string): this;
  gte(column: string, value: unknown): this;
  lt(column: string, value: unknown): this;
}

/** The filters as SQL, shared by the page read and its count. */
function filtered<Q extends FilterChain>(q: Q, filter: AuditFilter): Q {
  if (filter.actor) {
    // Literal match: `%` and `_` are wildcards and `\` is ILIKE's escape
    // character, so a typed backslash is escaped too (it used to turn the
    // closing `%` into a literal one).
    const escaped = filter.actor
      .toLowerCase()
      .replace(/[%_\\]/g, (c) => `\\${c}`);
    q = q.ilike("actor", `%${escaped}%`);
  }
  if (filter.entity) q = q.eq("entity", filter.entity);
  if (filter.action) q = q.eq("action", filter.action);
  if (filter.entityId) q = q.eq("entityId", filter.entityId);
  // `createdAt` is ISO-8601 text: string order is time order.
  if (filter.from) q = q.gte("createdAt", filter.from);
  if (filter.to) q = q.lt("createdAt", filter.to);
  return q;
}

/**
 * The log, newest first. `id` breaks a tie on `createdAt` (zero-padded
 * counter ids sort in write order), so a page boundary never splits or
 * repeats two rows written in the same millisecond.
 */
export async function listAuditLogs(
  filter: AuditFilter = {},
): Promise<AdminAuditLog[]> {
  const sb = getDb();
  let q = filtered(sb.from(TABLES.auditLogs).select("*"), filter)
    .order("createdAt", { ascending: false })
    .order("id", { ascending: false })
    .limit(filter.limit ?? 500);
  if (filter.offset && filter.offset > 0) q = q.offset(filter.offset);
  const { data, error } = await q;
  if (error) throw new Error(`listAuditLogs: ${error.message}`);
  return (data ?? []) as AdminAuditLog[];
}

/** How many rows the filters match, across every page. */
export async function countAuditLogs(
  filter: AuditFilter = {},
): Promise<number> {
  const sb = getDb();
  const { count, error } = await filtered(
    sb.from(TABLES.auditLogs).select("*", { count: "exact", head: true }),
    filter,
  );
  if (error) throw new Error(`countAuditLogs: ${error.message}`);
  return count ?? 0;
}

/** One row by its id (the event's own page), or null. */
export async function getAuditLog(id: string): Promise<AdminAuditLog | null> {
  const { data, error } = await getDb()
    .from(TABLES.auditLogs)
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`getAuditLog: ${error.message}`);
  return (data ?? null) as AdminAuditLog | null;
}

/**
 * An order's own rows, newest first: the order's (`entityId` = its id) and
 * its lines' (`<id>#<index>`), for the order page's Zaman çizelgesi. Both
 * read `audit_logs_entity_id_idx`.
 */
export async function listOrderAuditLogs(
  orderId: string,
  limit = 100,
): Promise<AdminAuditLog[]> {
  const sb = getDb();
  const linePattern = `${orderId.replace(/[\\%_]/g, (c) => `\\${c}`)}#%`;
  const [own, lines] = await Promise.all([
    sb
      .from(TABLES.auditLogs)
      .select("*")
      .eq("entity", "order")
      .eq("entityId", orderId)
      .order("createdAt", { ascending: false })
      .limit(limit),
    sb
      .from(TABLES.auditLogs)
      .select("*")
      .eq("entity", "order_item")
      .ilike("entityId", linePattern)
      .order("createdAt", { ascending: false })
      .limit(limit),
  ]);
  if (own.error) throw new Error(`listOrderAuditLogs: ${own.error.message}`);
  if (lines.error)
    throw new Error(`listOrderAuditLogs: ${lines.error.message}`);
  return [
    ...((own.data ?? []) as AdminAuditLog[]),
    ...((lines.data ?? []) as AdminAuditLog[]),
  ]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, limit);
}

/**
 * Each panel user's last sign-in (Kullanıcılar, Innex: "3 saat önce" in the
 * row), by address: the newest `login_success` row filed under it. That
 * row is written when the password is right; an account with 2FA then
 * still enters its code, which writes no row of its own. A handful of
 * accounts: one small read each (audit_logs_entity_id_idx), all at once.
 * An address with no sign-in on record is missing from the map.
 */
export async function lastSignIns(
  emails: readonly string[],
): Promise<Map<string, string>> {
  const rows = await Promise.all(
    emails.map((email) =>
      listAuditLogs({
        action: "login_success",
        entity: "auth",
        entityId: email.toLowerCase(),
        limit: 1,
      }),
    ),
  );
  const out = new Map<string, string>();
  emails.forEach((email, i) => {
    const at = rows[i][0]?.createdAt;
    if (at) out.set(email, at);
  });
  return out;
}
