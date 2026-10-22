import { z } from "zod";

import type { AdminOrderStatus, OrderTransition } from "@/lib/admin/store";
import { orderFulfillment, orderKind } from "@/lib/admin/order-channel";

import type { PanelOrderFulfillment, PanelOrderStage } from "./orders-feed-core";

/**
 * The köşk panel's bar screen moving a café order one step
 * (`POST /api/panel/orders/stage`, docs/PANEL-ORDERS.md "Aşama").
 *
 * The panel says what the barista tapped and which stage the card showed;
 * this site decides, and moves the order through its own state machine
 * (`transitionOrder`), so payment, stock, loyalty, the e-mails and the
 * phone notification all happen exactly as when the move is made here.
 * The panel never writes an order row, and it cannot cancel, refund or
 * reopen anything: three forward steps, nothing else.
 *
 *   preparing   new → preparing                  "Hazırlanıyor"
 *   ready       new | preparing → shipped        pickup "Hazır",
 *                                                table "Masaya götürüldü",
 *                                                courier "Kuryeye verildi"
 *   delivered   ready → completed (pickup only)  "Teslim edildi"
 *
 * `from` is the stage the card showed. The move is conditional on it (the
 * order's status must still be the one that stage stands for), so a tap on
 * a stale screen, or the same request replayed inside the signature's five
 * minutes, is refused as `stale` instead of moving the order twice.
 *
 * Pure: the route and the tests share it.
 */

export const PANEL_STAGE_MAX_BODY_BYTES = 1024;

export const PANEL_STAGE_ACTIONS = ["preparing", "ready", "delivered"] as const;
export type PanelStageAction = (typeof PANEL_STAGE_ACTIONS)[number];

const STAGES = ["new", "preparing", "ready"] as const;

/** The panel's order ids, the same rule the panel validates them with. */
const ORDER_ID = /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/;

export const PANEL_STAGE_ACTOR_MAX = 80;

const schema = z
  .object({
    id: z.string().regex(ORDER_ID),
    action: z.enum(PANEL_STAGE_ACTIONS),
    from: z.enum(STAGES),
    actor: z.string().trim().min(1).max(PANEL_STAGE_ACTOR_MAX),
  })
  .strict();

export interface PanelStageChange {
  id: string;
  action: PanelStageAction;
  from: PanelOrderStage;
  actor: string;
}

export function parsePanelStageChange(
  raw: unknown,
): { ok: true; change: PanelStageChange } | { ok: false; field: string } {
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    const path = parsed.error.issues[0]?.path[0];
    return { ok: false, field: typeof path === "string" ? path : "body" };
  }
  return { ok: true, change: parsed.data };
}

/** The status a bar-screen stage stands for. */
const STATUS_OF_STAGE: Record<PanelOrderStage, AdminOrderStatus> = {
  new: "paid",
  preparing: "preparing",
  ready: "shipped",
};

export interface PanelStageMove {
  transition: OrderTransition;
  /** The status the order must still have for the move to happen. */
  expectStatus: AdminOrderStatus;
}

/**
 * The move a tap means, or null when the pair makes no sense (the panel
 * only offers sensible ones; a forged or stale pair is refused here too).
 */
export function panelStageMove(
  action: PanelStageAction,
  from: PanelOrderStage,
  fulfillment: PanelOrderFulfillment,
): PanelStageMove | null {
  if (action === "preparing") {
    return from === "new"
      ? { transition: "start_preparing", expectStatus: STATUS_OF_STAGE.new }
      : null;
  }
  if (action === "ready") {
    return from === "new" || from === "preparing"
      ? { transition: "mark_shipped", expectStatus: STATUS_OF_STAGE[from] }
      : null;
  }
  // `delivered`: a pickup order handed over at the counter. Table and
  // courier orders left the bar screen at `ready`.
  return from === "ready" && fulfillment === "pickup"
    ? { transition: "complete", expectStatus: STATUS_OF_STAGE.ready }
    : null;
}

/**
 * Is this an order the bar screen deals with at all: a café order, not
 * typed in at the till, not a parcel. Anything else is `not_found` to the
 * panel, whatever its id.
 */
export function isBarScreenOrder(order: {
  kind?: string;
  source?: string;
  fulfillment?: string;
}): boolean {
  if (orderKind(order) !== "cafe") return false;
  if (order.source === "manual") return false;
  return orderFulfillment(order) !== "shipping";
}

/** The audit actor, the menu link's convention: "panel:<name>". */
export function panelStageActor(actor: string): string {
  return `panel:${actor.trim().slice(0, PANEL_STAGE_ACTOR_MAX)}`;
}
