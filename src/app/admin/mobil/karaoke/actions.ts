"use server";

import { revalidatePath } from "next/cache";

import { logAudit } from "@/lib/admin/audit";
import { requireRole } from "@/lib/admin/auth";
import {
  setReservationStatus,
  type SetReservationStatusFailure,
} from "@/lib/mobile/karaoke";

export interface ReservationActionState {
  error?: string;
  message?: string;
}

const FAILURE_MESSAGE: Record<SetReservationStatusFailure, string> = {
  not_found: "Rezervasyon bulunamadı. Silinmiş olabilir; sayfayı yenile.",
  wrong_status:
    "Rezervasyonun durumu bu arada değişmiş. Sayfayı yenileyip tekrar bak.",
  slot_taken:
    "Bu saat başka bir onaylı rezervasyonda. Onaylamak için önce diğerini iptal et.",
  raced: "Bu rezervasyonu az önce başka biri değiştirdi. Sayfayı yenile.",
};

/**
 * Rol kapısı her action'da ayrıca açılır: sayfadaki `requireRole` bir Server
 * Action'ı korumaz — action, sayfadan bağımsız çağrılabilen bir POST ucudur.
 */
async function transition(
  formData: FormData,
  status: "confirmed" | "cancelled",
): Promise<ReservationActionState> {
  await requireRole("mobileApp");
  const id = String(formData.get("id") ?? "").trim();
  if (!id) return { error: "Rezervasyon numarası eksik." };
  const result = await setReservationStatus(id, status);
  if (!result.ok) {
    // Each reason asks something different of the staff member, so the page
    // says which one it was instead of listing every possibility.
    return { error: FAILURE_MESSAGE[result.reason] };
  }
  const updated = result.reservation;
  await logAudit({
    action: "transition",
    entity: "karaoke_reservation",
    entityId: id,
    payload: { status, date: updated.date, startHour: updated.startHour },
  });
  revalidatePath("/admin/mobil/karaoke");
  return {
    message:
      status === "confirmed"
        ? "Rezervasyon onaylandı."
        : "Rezervasyon iptal edildi.",
  };
}

export async function confirmReservationAction(
  _prev: ReservationActionState,
  formData: FormData,
): Promise<ReservationActionState> {
  return transition(formData, "confirmed");
}

export async function cancelReservationAction(
  _prev: ReservationActionState,
  formData: FormData,
): Promise<ReservationActionState> {
  return transition(formData, "cancelled");
}
