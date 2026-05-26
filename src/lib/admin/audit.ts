import "server-only";

import { getAdminSession } from "./auth";

/**
 * Append-only event log of admin mutations. Read-only from the UI;
 * only the server-side helper logAudit() writes to it.
 *
 * In-memory and bounded — the oldest entries fall off once we hit
 * 5000 rows. Swap the body for an `audit_log` table when Supabase
 * lands; the call sites stay identical.
 */

export type AuditEntity =
  | "product"
  | "menu_item"
  | "category"
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

const entries: AdminAuditLog[] = [];
let counter = 0;
const CAP = 5000;

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
  counter += 1;
  const row: AdminAuditLog = {
    id: `aud-${String(counter).padStart(7, "0")}`,
    actor,
    action: input.action,
    entity: input.entity,
    entityId: input.entityId ?? "",
    payload: input.payload ?? {},
    createdAt: new Date().toISOString(),
  };
  entries.unshift(row);
  if (entries.length > CAP) entries.length = CAP;
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
  let out = entries;
  if (filter.actor) {
    const needle = filter.actor.toLowerCase();
    out = out.filter((e) => e.actor.toLowerCase().includes(needle));
  }
  if (filter.entity) out = out.filter((e) => e.entity === filter.entity);
  if (filter.action) out = out.filter((e) => e.action === filter.action);
  return out.slice(0, filter.limit ?? 500);
}
