"use server";

import { revalidatePath } from "next/cache";

import { logAudit } from "@/lib/admin/audit";
import { requireRole } from "@/lib/admin/auth";
import {
  deleteFranchiseApplication,
  setFranchiseApplicationStatus,
  FRANCHISE_STATUSES,
  type FranchiseStatus,
} from "@/lib/franchise/store";

export async function setFranchiseStatusAction(formData: FormData) {
  await requireRole("leads");
  const id = String(formData.get("id") ?? "");
  const status = String(formData.get("status") ?? "") as FranchiseStatus;
  if (!id || !FRANCHISE_STATUSES.includes(status)) return;
  await setFranchiseApplicationStatus(id, status);
  await logAudit({
    action: "update",
    entity: "franchise_application",
    entityId: id,
    payload: { status },
  });
  revalidatePath("/admin/franchise-basvurulari");
}

export async function deleteFranchiseApplicationAction(formData: FormData) {
  await requireRole("leads");
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  const removed = await deleteFranchiseApplication(id);
  if (removed) {
    await logAudit({
      action: "delete",
      entity: "franchise_application",
      entityId: id,
    });
  }
  revalidatePath("/admin/franchise-basvurulari");
}
