import { z } from "zod";

import { PANEL_STAGE_ACTOR_MAX, panelStageActor } from "./orders-stage-core";
import type { SignedCaller } from "./signed-callers";

/**
 * The köşk panel's bar screen answering a table call ("Gördüm";
 * `POST /api/panel/calls/ack`, docs/PANEL-ORDERS.md "Masa çağrıları").
 *
 * Body exactly `{id, actor}`, at most 1 KB, signed like the stage tap. The
 * site writes `ackedBy` as "panel:<actor>" (LafPOS: "lafpos:<actor>", the
 * stage's convention). Answering twice, or after this panel answered, is
 * the same 200: the call is answered either way.
 *
 * Pure: the route and the tests share it.
 */

export const PANEL_CALL_ACK_MAX_BODY_BYTES = 1024;

/** The ids the panel sends, the stage's rule (the store decides 404). */
const CALL_ID = /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/;

const schema = z
  .object({
    id: z.string().regex(CALL_ID),
    actor: z.string().trim().min(1).max(PANEL_STAGE_ACTOR_MAX),
  })
  .strict();

export interface PanelCallAck {
  id: string;
  actor: string;
}

export function parsePanelCallAck(
  raw: unknown,
): { ok: true; ack: PanelCallAck } | { ok: false; field: string } {
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    const path = parsed.error.issues[0]?.path[0];
    return { ok: false, field: typeof path === "string" ? path : "body" };
  }
  return { ok: true, ack: parsed.data };
}

/** "panel:<name>" or "lafpos:<name>", as the stage tap's audit actor. */
export function panelCallAckedBy(
  actor: string,
  caller: SignedCaller = "panel",
): string {
  return panelStageActor(actor, caller);
}
