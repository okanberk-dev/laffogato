"use server";

import { revalidatePath } from "next/cache";

import {
  actionError,
  actionOk,
  type ActionResult,
} from "@/lib/admin/action-result";
import { logAudit } from "@/lib/admin/audit";
import { requireRole } from "@/lib/admin/auth";
import {
  STAMP_CORRECTION_REASON_ERROR,
  stampCorrectionNote,
  stampCorrectionReason,
} from "@/lib/admin/stamp-correction";
import { getCustomerByEmail } from "@/lib/customer/store";
import {
  addCounterStamp,
  listStamps,
  reverseCounterStamp,
} from "@/lib/mobile/loyalty";

/** Two counter stamps for the same member inside this window is a double submit. */
const REPEAT_WINDOW_MS = 3 * 60 * 1000;

export interface CounterStampState {
  error?: string;
  message?: string;
}

/**
 * "Damga düzelt (+1)" on the member page: a stamp the till missed, put right
 * by an owner or a manager at the member's own request.
 *
 * Since 21 Ekim 2026 (decision ASK-LOYALTY) the till stamps only a member
 * who shows their own code; this is the one place a stamp is still given by
 * address, so it asks why. The reason (at least ten characters: who asked
 * and how it was checked) is required, and the ledger note starts with
 * "Düzeltme · " so the member's history says what it was.
 *
 * Gated on `customers` (owner, manager), the gate of the only page that
 * offers it. It was `orders`, so shift staff could post it with any address
 * the client bound, for an account that did not exist or was closed, and get
 * ledger rows under it. The till (/admin/kasa) is the shift's way to stamp,
 * with its own gate.
 */
export async function addCounterStampAction(
  email: string,
  _prev: CounterStampState,
  formData: FormData,
): Promise<CounterStampState> {
  const session = await requireRole("customers");
  const owner = email.trim().toLowerCase();
  if (!owner) return { error: "E-posta eksik." };
  // Before any read or write: no reason, no stamp.
  const reason = stampCorrectionReason(formData.get("note"));
  if (!reason) return { error: STAMP_CORRECTION_REASON_ERROR };
  const note = stampCorrectionNote(reason);

  // The account has to exist and be open: a stamp there is one nobody can
  // spend.
  const member = await getCustomerByEmail(owner);
  if (!member) return { error: "Bu adrese ait üye hesabı yok." };
  if (!member.isActive) {
    return { error: "Bu üye hesabı kapalı; damga işlenmez." };
  }

  // A counter stamp carries no orderId, so the partial unique index that keeps
  // an app order from earning twice does not apply to it: a double click or a
  // retried POST simply inserts a second stamp. Refuse a repeat inside the
  // window unless the operator explicitly asks for it ("tekrar" checkbox) -
  // two members are never served by the same till in the same minute.
  if (formData.get("force") !== "on") {
    const recent = await listStamps(owner);
    const last = recent.find(
      (s) => s.kind === "earn" && s.source === "counter",
    );
    if (last && Date.now() - Date.parse(last.createdAt) < REPEAT_WINDOW_MS) {
      return {
        error:
          "Bu üyeye az önce kasa damgası verildi. Gerçekten ikinci bir damga gerekiyorsa “tekrar” kutusunu işaretle.",
      };
    }
  }

  const stamp = await addCounterStamp(owner, session.email, note);
  // The stamp is in: a failed audit row must not turn it into the error
  // page (the operator would press again and stamp twice). Logged without
  // the address (rule 9).
  try {
    await logAudit({
      action: "update",
      entity: "customer",
      entityId: owner,
      payload: { stamp: stamp.id, source: "counter", note },
    });
  } catch (err) {
    console.error(
      `[audit] row not written customer stamp ${stamp.id}:`,
      err instanceof Error ? err.message : "unknown error",
    );
  }
  revalidatePath(`/admin/musteriler/${encodeURIComponent(owner)}`);
  revalidatePath("/admin/kasa");
  return { message: "Damga eklendi." };
}

/**
 * "−1 düzeltme": takes back a stamp the till gave by mistake, behind a
 * confirm (the reason goes in as the note).
 *
 * Gated on `customers` (owner/manager) rather than `orders`, which is what
 * /admin/kasa tells the shift staff - the person who can give a stamp is not
 * the person who can take one away.
 */
export async function reverseCounterStampAction(
  email: string,
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const session = await requireRole("customers");
  const owner = email.trim().toLowerCase();
  if (!owner) return actionError("E-posta eksik.");
  const note = String(formData.get("note") ?? "")
    .trim()
    .slice(0, 120);

  const result = await reverseCounterStamp(owner, session.email, note);
  if (!result.ok) {
    return actionError("Bu üyenin geri alınacak damgası yok.");
  }
  await logAudit({
    action: "update",
    entity: "customer",
    entityId: owner,
    payload: {
      stamp: result.stamp.id,
      source: "admin",
      kind: "reversal",
      note,
    },
  });
  revalidatePath(`/admin/musteriler/${encodeURIComponent(owner)}`);
  revalidatePath("/admin/kasa");
  return actionOk("Damga geri alındı.");
}
