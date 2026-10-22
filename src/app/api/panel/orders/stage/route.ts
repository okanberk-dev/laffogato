import { NextResponse } from "next/server";

import { safeAudit } from "@/lib/admin/audit";
import { orderFulfillment } from "@/lib/admin/order-channel";
import { getOrder, transitionOrder, type AdminOrder } from "@/lib/admin/store";
import {
  panelSyncConfig,
  SIGNATURE_HEADER,
  TIMESTAMP_HEADER,
  verifySignature,
} from "@/lib/panel/karaoke-sync-core";
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
 * - 400 `{error:"invalid", field}`, 401, 413, 503 as the other panel routes.
 *
 * Server to server, signed with the shared `KARAOKE_SYNC_SECRET` (CLAUDE.md
 * rule 7). A replay inside the signature's five minutes meets the
 * conditional move and gets 409, never a second move.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" } as const;

function deny(status: number, error: string, extra: object = {}) {
  return NextResponse.json({ error, ...extra }, { status, headers: NO_STORE });
}

function shape(order: AdminOrder | null, now: Date) {
  return order ? toPanelOrder(order, now) : null;
}

export async function POST(request: Request) {
  const config = panelSyncConfig(process.env);
  if (!config) return deny(503, "not_configured");
  const declared = Number(request.headers.get("content-length") ?? "0");
  if (declared > PANEL_STAGE_MAX_BODY_BYTES) return deny(413, "too_large");
  const body = await request.text();
  if (Buffer.byteLength(body, "utf8") > PANEL_STAGE_MAX_BODY_BYTES) {
    return deny(413, "too_large");
  }
  const url = new URL(request.url);
  const signed = verifySignature(config.secret, {
    method: "POST",
    url,
    body,
    timestamp: request.headers.get(TIMESTAMP_HEADER),
    signature: request.headers.get(SIGNATURE_HEADER),
  });
  if (!signed) return deny(401, "unauthorized");
  let raw: unknown;
  try {
    raw = JSON.parse(body);
  } catch {
    return deny(400, "invalid", { field: "body" });
  }
  const parsed = parsePanelStageChange(raw);
  if (!parsed.ok) return deny(400, "invalid", { field: parsed.field });
  const { change } = parsed;

  try {
    const now = new Date();
    const order = await getOrder(change.id);
    if (!order || !isBarScreenOrder(order)) return deny(404, "not_found");
    const fulfillment = orderFulfillment(order) as PanelOrderFulfillment;
    const move = panelStageMove(change.action, change.from, fulfillment);
    if (!move || order.status !== move.expectStatus) {
      return deny(409, "stale", { order: shape(order, now) });
    }
    const actor = panelStageActor(change.actor);
    const moved = await transitionOrder(change.id, move.transition, {
      actor,
      expectStatus: move.expectStatus,
    });
    if (!moved.ok || !moved.order) {
      return deny(409, "stale", { order: shape(await getOrder(change.id), now) });
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
        via: "panel",
      },
    });
    return NextResponse.json(
      { order: shape(moved.order, now) },
      { headers: NO_STORE },
    );
  } catch (err) {
    console.error("[panel-orders] stage could not be written", err);
    return deny(503, "unavailable");
  }
}
