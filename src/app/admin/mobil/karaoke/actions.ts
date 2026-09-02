"use server";

import { revalidatePath } from "next/cache";

import { logAudit } from "@/lib/admin/audit";
import { requireRole } from "@/lib/admin/auth";
import { setReservationStatus } from "@/lib/mobile/karaoke";

/**
 * Rol kapısı her action'da ayrıca açılır: sayfadaki `requireRole` bir Server
 * Action'ı korumaz — action, sayfadan bağımsız çağrılabilen bir POST ucudur.
 */
async function transition(
  formData: FormData,
  status: "confirmed" | "cancelled",
): Promise<void> {
  await requireRole("mobileApp");
  const id = String(formData.get("id") ?? "").trim();
  if (!id) return;
  const updated = await setReservationStatus(id, status);
  if (updated) {
    await logAudit({
      action: "transition",
      entity: "karaoke_reservation",
      entityId: id,
      payload: { status, date: updated.date, startHour: updated.startHour },
    });
  }
  revalidatePath("/admin/mobil/karaoke");
}

export async function confirmReservationAction(formData: FormData) {
  await transition(formData, "confirmed");
}

export async function cancelReservationAction(formData: FormData) {
  await transition(formData, "cancelled");
}
