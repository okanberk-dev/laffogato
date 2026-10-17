// Client-safe (no server-only): who may change what on an order's customer
// card. The order page draws the editor with it and saveOrderDetailsAction
// asks it again about the order as stored (admin audit ORD-16, karar D2).
//
// A member's order history is read by the order's e-mail (the app's
// Siparişlerim, /uye/siparisler). Changing it moves the order, with its
// address and phone, into another member's account, so it is an owner or
// manager decision on an open order, confirmed, and the audit row keeps the
// old address so it can be put back.

import { OPEN_ORDER_STATUSES } from "./order-filters";
import { canAccess, type AdminRole } from "./roles";
import type { AdminOrderStatus } from "./store";

export interface OrderDetailsFields {
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  shippingAddress: string;
}

export interface OrderDetailsRules {
  /** Name, phone and address may be edited. */
  editable: boolean;
  /** Why not, when not. */
  reason: string | null;
  /** The e-mail may be edited (with a confirm). */
  emailEditable: boolean;
  emailReason: string | null;
}

export const ORDER_DETAILS_MESSAGES = {
  closed:
    "Kapanmış siparişin müşteri bilgisini yalnız sahip ya da yönetici düzeltebilir.",
  emailRole:
    "E-postayı yalnız sahip ya da yönetici değiştirebilir: sipariş o adresin üye geçmişine taşınır.",
  emailClosed: "Kapanmış siparişin e-postası değişmez.",
  emailConfirm:
    "E-posta değişikliğini onayla: sipariş eski adresin üye geçmişinden çıkar, yeni adresinkine girer.",
} as const;

function isOpen(status: AdminOrderStatus): boolean {
  return OPEN_ORDER_STATUSES.includes(status);
}

/** What `role` may change on `order`'s customer card. */
export function orderDetailsRules(
  order: { status: AdminOrderStatus },
  role: AdminRole,
): OrderDetailsRules {
  const manages = canAccess("customers", role);
  const open = isOpen(order.status);
  const editable = open || manages;
  const emailEditable = editable && manages && open;
  return {
    editable,
    reason: editable ? null : ORDER_DETAILS_MESSAGES.closed,
    emailEditable,
    emailReason: emailEditable
      ? null
      : !manages
        ? ORDER_DETAILS_MESSAGES.emailRole
        : ORDER_DETAILS_MESSAGES.emailClosed,
  };
}

/** Whether `next` names a different e-mail than the stored one. */
export function emailChanges(
  stored: string,
  next: string | undefined,
): boolean {
  return next !== undefined && next.trim() !== String(stored ?? "").trim();
}

/**
 * Why this save may not be written, or null. `input.customerEmail` is
 * absent when the form did not offer the field: the stored one stays.
 */
export function orderDetailsRefusal(
  order: { status: AdminOrderStatus; customerEmail: string },
  input: { customerEmail?: string },
  role: AdminRole,
  emailConfirmed: boolean,
): string | null {
  const rules = orderDetailsRules(order, role);
  if (!rules.editable) return rules.reason;
  if (emailChanges(order.customerEmail, input.customerEmail)) {
    if (!rules.emailEditable) return rules.emailReason;
    if (!emailConfirmed) return ORDER_DETAILS_MESSAGES.emailConfirm;
  }
  return null;
}

const FIELDS: readonly (keyof OrderDetailsFields)[] = [
  "customerName",
  "customerEmail",
  "customerPhone",
  "shippingAddress",
];

/**
 * The fields a save changed, with their old and new values: the audit
 * payload. The audit log is owner-only, and the old values are the only
 * copy left once the row is overwritten.
 */
export function orderDetailsChange(
  before: OrderDetailsFields,
  after: OrderDetailsFields,
): {
  changed: (keyof OrderDetailsFields)[];
  before: Partial<OrderDetailsFields>;
  after: Partial<OrderDetailsFields>;
} {
  const changed = FIELDS.filter(
    (k) => String(before[k] ?? "") !== String(after[k] ?? ""),
  );
  return {
    changed,
    before: Object.fromEntries(changed.map((k) => [k, before[k] ?? ""])),
    after: Object.fromEntries(changed.map((k) => [k, after[k] ?? ""])),
  };
}
