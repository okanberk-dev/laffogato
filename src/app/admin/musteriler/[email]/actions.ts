"use server";

import { revalidatePath } from "next/cache";

import { logAudit } from "@/lib/admin/audit";
import { requireRole } from "@/lib/admin/auth";
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
 * "Damga ekle (kasa)": the member paid at the counter and showed their QR;
 * the shift staff presses this instead of the app earning the stamp itself.
 * Gated on the orders section — the same people who take an order at the
 * till — rather than customers, which is a management view.
 */
export async function addCounterStampAction(
  email: string,
  _prev: CounterStampState,
  formData: FormData,
): Promise<CounterStampState> {
  const session = await requireRole("orders");
  const owner = email.trim().toLowerCase();
  if (!owner) return { error: "E-posta eksik." };
  const note = String(formData.get("note") ?? "")
    .trim()
    .slice(0, 120);

  // A counter stamp carries no orderId, so the partial unique index that keeps
  // an app order from earning twice does not apply to it: a double click or a
  // retried POST simply inserts a second stamp. Refuse a repeat inside the
  // window unless the operator explicitly asks for it ("tekrar" checkbox) —
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
  await logAudit({
    action: "update",
    entity: "customer",
    entityId: owner,
    payload: { stamp: stamp.id, source: "counter", note },
  });
  revalidatePath(`/admin/musteriler/${encodeURIComponent(owner)}`);
  revalidatePath("/admin/kasa");
  return { message: "Damga eklendi." };
}

/**
 * "−1 düzeltme": takes back a stamp the till gave by mistake.
 *
 * Gated on `customers` (owner/manager) rather than `orders`, which is what
 * /admin/kasa tells the shift staff — the person who can give a stamp is not
 * the person who can take one away.
 */
export async function reverseCounterStampAction(
  email: string,
  _prev: CounterStampState,
  formData: FormData,
): Promise<CounterStampState> {
  const session = await requireRole("customers");
  const owner = email.trim().toLowerCase();
  if (!owner) return { error: "E-posta eksik." };
  const note = String(formData.get("note") ?? "")
    .trim()
    .slice(0, 120);

  const result = await reverseCounterStamp(owner, session.email, note);
  if (!result.ok) {
    return { error: "Bu üyenin geri alınacak damgası yok." };
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
  return { message: "Damga geri alındı." };
}
