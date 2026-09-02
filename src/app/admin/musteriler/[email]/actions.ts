"use server";

import { revalidatePath } from "next/cache";

import { logAudit } from "@/lib/admin/audit";
import { requireRole } from "@/lib/admin/auth";
import { addCounterStamp } from "@/lib/mobile/loyalty";

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

  const stamp = await addCounterStamp(owner, session.email, note);
  await logAudit({
    action: "update",
    entity: "customer",
    entityId: owner,
    payload: { stamp: stamp.id, source: "counter", note },
  });
  revalidatePath(`/admin/musteriler/${encodeURIComponent(owner)}`);
  return { message: "Damga eklendi." };
}
