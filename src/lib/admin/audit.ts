import "server-only";

import { COLLECTIONS } from "@/lib/mongodb/collections";
import { getDb } from "@/lib/mongodb/client";
import { nextSeq } from "@/lib/mongodb/counters";

import { getAdminSession } from "./auth";

/**
 * Append-only event log of admin mutations. MongoDB collection'a yazılır.
 * Eski kayıtların temizlenmesi için TTL index'i konabilir (build-time'da
 * `audit_logs.createIndex({createdAt: 1}, {expireAfterSeconds: ...})`).
 */

export type AuditEntity =
  | "product"
  | "menu_item"
  | "category"
  | "shop_hero_slide"
  | "order"
  | "order_item"
  | "promo"
  | "settings"
  | "stock"
  | "auth"
  | "2fa";

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
  | "2fa_disable";

export interface AdminAuditLog {
  id: string;
  actor: string;
  action: AuditAction;
  entity: AuditEntity;
  entityId: string;
  /** Free-form structured payload — keep small, JSON-serialisable. */
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
  const db = await getDb();
  await db.collection<AdminAuditLog>(COLLECTIONS.auditLogs).insertOne(row);
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
  const db = await getDb();
  const query: Record<string, unknown> = {};
  if (filter.actor) {
    query.actor = { $regex: filter.actor.toLowerCase(), $options: "i" };
  }
  if (filter.entity) query.entity = filter.entity;
  if (filter.action) query.action = filter.action;
  const docs = await db
    .collection<AdminAuditLog>(COLLECTIONS.auditLogs)
    .find(query)
    .sort({ createdAt: -1 })
    .limit(filter.limit ?? 500)
    .toArray();
  return docs.map(({ _id, ...rest }) => {
    void _id;
    return rest as AdminAuditLog;
  });
}
