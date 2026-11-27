import { NextResponse } from "next/server";

import { ackTableCall } from "@/lib/admin/table-calls";
import {
  PANEL_CALL_ACK_MAX_BODY_BYTES,
  panelCallAckedBy,
  parsePanelCallAck,
} from "@/lib/panel/calls-ack-core";
import { chooseBranch, splitBranch } from "@/lib/panel/branches";
import {
  signedBy,
  signedCallerKeys,
  signedKeyHeader,
  type SignedCaller,
} from "@/lib/panel/signed-callers";

/**
 * `POST /api/panel/calls/ack` - the köşk panel's bar screen answering a
 * table call ("Gördüm"; src/lib/panel/calls-ack-core.ts,
 * docs/PANEL-ORDERS.md "Masa çağrıları"). The call came to the screen in
 * `GET /api/panel/orders` (`calls`).
 *
 * Body `{id, actor}`, at most 1 KB. Signed exactly like
 * `POST /api/panel/orders/stage`: the shared `KARAOKE_SYNC_SECRET`, or
 * LafPOS with its own `LAFPOS_SYNC_SECRET` (signed-callers.ts).
 *
 * - 200 `{ok: true, call: {id, status: "acked"}}`: answered now, or it
 *   already was (here, in this site's panel, or by a replay inside the
 *   signature's five minutes): the same answer, nothing written twice.
 *   `ackedBy` says "panel:<actor>" ("lafpos:<actor>" for LafPOS).
 * - 404 `{error: "not_found"}`: no such call.
 * - 409 `{error: "wrong_branch"}` (21 Kas 2026): another branch's call
 *   (src/lib/panel/branches.ts; `branch` in the body, else the caller's
 *   own); nothing written.
 * - 400 `{error: "invalid", field}`, 403 `forbidden` (`field: "branch"`),
 *   401, 413, 503 as the stage route.
 *
 * The answer's write pings the panel (`orders.changed`), so every screen
 * drops the call.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" } as const;

/** The panel, and LafPOS with its own key: the stage route's callers. */
const CALLERS: readonly SignedCaller[] = ["panel", "lafpos"];

function deny(status: number, error: string, extra: object = {}) {
  return NextResponse.json({ error, ...extra }, { status, headers: NO_STORE });
}

export async function POST(request: Request) {
  const keys = signedCallerKeys(process.env, CALLERS);
  if (!keys) return deny(503, "not_configured");
  const declared = Number(request.headers.get("content-length") ?? "0");
  if (declared > PANEL_CALL_ACK_MAX_BODY_BYTES) return deny(413, "too_large");
  const body = await request.text();
  if (Buffer.byteLength(body, "utf8") > PANEL_CALL_ACK_MAX_BODY_BYTES) {
    return deny(413, "too_large");
  }
  const url = new URL(request.url);
  const signer = signedBy(keys, request, "POST", url, body);
  if (!signer) return deny(401, "unauthorized");
  const { caller } = signer;
  let raw: unknown;
  try {
    raw = JSON.parse(body);
  } catch {
    return deny(400, "invalid", { field: "body" });
  }
  const split = splitBranch(raw);
  const parsed = parsePanelCallAck(split.rest);
  if (!parsed.ok) return deny(400, "invalid", { field: parsed.field });
  const { ack } = parsed;
  const choice = chooseBranch(process.env, caller, split.branch);
  if (!choice.ok) {
    return deny(choice.status, choice.error, { field: choice.field });
  }

  try {
    const result = await ackTableCall(
      ack.id,
      panelCallAckedBy(ack.actor, caller),
      new Date(),
      choice.branch,
    );
    if (!result.ok) {
      return result.reason === "wrong_branch"
        ? deny(409, "wrong_branch")
        : deny(404, "not_found");
    }
    return NextResponse.json(
      { ok: true, call: { id: result.call.id, status: "acked" } },
      { headers: { ...NO_STORE, ...signedKeyHeader(signer) } },
    );
  } catch (err) {
    console.error("[panel-calls] ack could not be written", err);
    return deny(503, "unavailable");
  }
}
