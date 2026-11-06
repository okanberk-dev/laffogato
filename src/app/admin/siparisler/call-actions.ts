"use server";

import { revalidatePath } from "next/cache";

import {
  actionError,
  actionOk,
  type ActionResult,
} from "@/lib/admin/action-result";
import { requireRole } from "@/lib/admin/auth";
import { ackTableCallAsAdmin } from "@/lib/admin/table-calls";
import { isTableCallId } from "@/lib/admin/table-calls-core";

/**
 * "Gördüm" on a table call ("Garson çağır", 6 Kas 2026), from the order
 * alert's card or the "Masa çağrıları" list on Siparişler. Answers the call
 * itself, not only this browser: it leaves the bar screen and every other
 * panel tab (the write pings, src/lib/admin/table-calls.ts), and the
 * guest's app reads it as `acked`. `ackedBy` is "admin:<name>".
 *
 * Its own file, not siparisler/actions.ts: every export of a "use server"
 * file is a public POST endpoint (CLAUDE.md rule 27), so it checks the
 * session and the Siparişler role itself.
 */
export async function ackTableCallAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const session = await requireRole("orders");
  const raw = formData.get("id");
  const id = typeof raw === "string" ? raw : "";
  if (!isTableCallId(id)) return actionError("Geçersiz çağrı.");
  const result = await ackTableCallAsAdmin(id, session.email);
  revalidatePath("/admin/siparisler");
  if (!result.ok) return actionError("Çağrı bulunamadı.");
  return actionOk(
    result.already ? "Bu çağrı zaten görülmüştü." : "Çağrı görüldü.",
  );
}
