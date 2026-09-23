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
  | "campaign_email";

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

export interface AuditFilter {
  actor?: string;
  entity?: AuditEntity;
  action?: AuditAction;
  limit?: number;
}

export async function listAuditLogs(
  filter: AuditFilter = {},
): Promise<AdminAuditLog[]> {
  const sb = getDb();
  let q = sb.from(TABLES.auditLogs).select("*");
  if (filter.actor) {
    const escaped = filter.actor
      .toLowerCase()
      .replace(/[%_]/g, (c) => `\\${c}`);
    q = q.ilike("actor", `%${escaped}%`);
  }
  if (filter.entity) q = q.eq("entity", filter.entity);
  if (filter.action) q = q.eq("action", filter.action);
  const { data, error } = await q
    .order("createdAt", { ascending: false })
    .limit(filter.limit ?? 500);
  if (error) throw new Error(`listAuditLogs: ${error.message}`);
  return (data ?? []) as AdminAuditLog[];
}
