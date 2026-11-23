import { NextResponse } from "next/server";

import { safeAudit } from "@/lib/admin/audit";
import { orderFulfillment } from "@/lib/admin/order-channel";
import {
  getOrder,
  listPanelTillPaidOrderIds,
  transitionOrder,
  type AdminOrder,
} from "@/lib/admin/store";
import {
  toPanelOrder,
  type PanelOrderFulfillment,
} from "@/lib/panel/orders-feed-core";
import {
  isBarScreenOrder,
  PANEL_STAGE_MAX_BODY_BYTES,
  panelStageActor,
  panelStageMove,
  parsePanelStageChange,
} from "@/lib/panel/orders-stage-core";
import { branchOf, chooseBranch, splitBranch } from "@/lib/panel/branches";
import {
  signedCaller,
  signedCallerKeys,
  type SignedCaller,
} from "@/lib/panel/signed-callers";

/**
 * `POST /api/panel/orders/stage` - the köşk panel's bar screen moving a
 * café order one step: "Hazırlanıyor", "Hazır" (masaya götürüldü, kuryeye
 * verildi) or "Teslim edildi" (src/lib/panel/orders-stage-core.ts,
 * docs/PANEL-ORDERS.md "Aşama").
 *
 * Body `{id, action, from, actor}`. The move goes through this site's own
 * `transitionOrder`, conditional on the status `from` stands for: stock,
 * loyalty, the e-mails and the member's phone notification follow exactly
 * as when the move is made in this panel, and the audit row says
 * "panel:<actor>". The answer is the order as the bar screen shows it
 * (`toPanelOrder`), or null when it left the screen.
 *
 * - 200 `{order}`: moved.
 * - 409 `{error:"stale", order}`: it had moved meanwhile, or the tap does not
 *   fit its stage; `order` is where it is now (null: off the screen).
 * - 404 `{error:"not_found"}`: no such order, or not a bar-screen order.
 * - 409 `{error:"wrong_branch"}` (21 Kas 2026): another branch's order
 *   (src/lib/panel/branches.ts; `branch` in the body, else the caller's
 *   own); nothing moved, nothing about it said.
 * - 400 `{error:"invalid", field}` (`branch` too), 403 `{error:"forbidden",
 *   field:"branch"}`, 401, 413, 503 as the other panel routes.
 *
 * Server to server, signed with the shared `KARAOKE_SYNC_SECRET` (CLAUDE.md
 * rule 7), or by LafPOS, the café's till, with its own `LAFPOS_SYNC_SECRET`
 * (signed-callers.ts, docs/LAFPOS.md): its moves are audited
 * "lafpos:<actor>". A replay inside the signature's five minutes meets the
 * conditional move and gets 409, never a second move.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" } as const;

/** The panel, and LafPOS with its own key. */
const CALLERS: readonly SignedCaller[] = ["panel", "lafpos"];

function deny(status: number, error: string, extra: object = {}) {
  return NextResponse.json({ error, ...extra }, { status, headers: NO_STORE });
}

function shape(order: AdminOrder | null, now: Date, paidAtTill: boolean) {
  return order ? toPanelOrder(order, now, paidAtTill) : null;
}

export async function POST(request: Request) {
  const keys = signedCallerKeys(process.env, CALLERS);
  if (!keys) return deny(503, "not_configured");
  const declared = Number(request.headers.get("content-length") ?? "0");
  if (declared > PANEL_STAGE_MAX_BODY_BYTES) return deny(413, "too_large");
  const body = await request.text();
  if (Buffer.byteLength(body, "utf8") > PANEL_STAGE_MAX_BODY_BYTES) {
    return deny(413, "too_large");
  }
  const url = new URL(request.url);
  const caller = signedCaller(keys, request, "POST", url, body);
  if (!caller) return deny(401, "unauthorized");
  let raw: unknown;
  try {
    raw = JSON.parse(body);
  } catch {
    return deny(400, "invalid", { field: "body" });
  }
  const split = splitBranch(raw);
  const parsed = parsePanelStageChange(split.rest);
  if (!parsed.ok) return deny(400, "invalid", { field: parsed.field });
  const { change } = parsed;
  const choice = chooseBranch(process.env, caller, split.branch);
  if (!choice.ok) {
    return deny(choice.status, choice.error, { field: choice.field });
  }

  try {
    const now = new Date();
    const order = await getOrder(change.id);
    if (!order || !isBarScreenOrder(order)) return deny(404, "not_found");
    // Another branch's order is not this bar's to move (Marina's till on
    // a Tuzla order the köşk panel's screen shows).
    if (branchOf(order) !== choice.branch) return deny(409, "wrong_branch");
    // `paidAtTill` of the answer, read before the move: a stage move writes
    // no payment row, and nothing after the move may turn it into an error.
    const atTill = (await listPanelTillPaidOrderIds([order.id])).has(order.id);
    const fulfillment = orderFulfillment(order) as PanelOrderFulfillment;
    const move = panelStageMove(change.action, change.from, fulfillment);
    if (!move || order.status !== move.expectStatus) {
      return deny(409, "stale", { order: shape(order, now, atTill) });
    }
    const actor = panelStageActor(change.actor, caller);
    const moved = await transitionOrder(change.id, move.transition, {
      actor,
      expectStatus: move.expectStatus,
    });
    if (!moved.ok || !moved.order) {
      return deny(409, "stale", {
        order: shape(await getOrder(change.id), now, atTill),
      });
    }
    // From here the move is done: nothing below may turn it into an error,
    // or the bar screen would show the old stage beside the site's new one.
    await safeAudit({
      action: "transition",
      entity: "order",
      entityId: change.id,
      actor,
      payload: {
        transition: move.transition,
        from: order.status,
        to: moved.order.status,
        via: caller,
      },
    });
    return NextResponse.json(
      { order: shape(moved.order, now, atTill) },
      { headers: NO_STORE },
    );
  } catch (err) {
    console.error("[panel-orders] stage could not be written", err);
    return deny(503, "unavailable");
  }
}
