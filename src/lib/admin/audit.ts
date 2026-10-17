import "server-only";

import { getDb, TABLES } from "@/lib/db";
import { nextSeq } from "@/lib/db/counters";

import { getAdminSession } from "./auth";

/**
 * Append-only event log of admin mutations. Persisted to the Postgres
 * `audit_logs` table. Old rows can later be pruned by a scheduled job.
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
  | "cafe_table";

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
  | "send_test";

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
}

export async function listAuditLogs(
  filter: AuditFilter = {},
): Promise<AdminAuditLog[]> {
  const sb = getDb();
  let q = sb.from(TABLES.auditLogs).select("*");
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
  const { data, error } = await q
    .order("createdAt", { ascending: false })
    .limit(filter.limit ?? 500);
  if (error) throw new Error(`listAuditLogs: ${error.message}`);
  return (data ?? []) as AdminAuditLog[];
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
