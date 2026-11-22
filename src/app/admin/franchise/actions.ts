"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import {
  actionError,
  actionOk,
  type ActionResult,
} from "@/lib/admin/action-result";
import { logAudit } from "@/lib/admin/audit";
import { requireRole } from "@/lib/admin/auth";
import { setAdminFlash } from "@/lib/admin/flash";
import {
  FRANCHISE_STATUS_LABELS,
  FRANCHISE_STATUSES,
} from "@/lib/franchise/franchise-core";
import {
  deleteFranchiseApplication,
  setFranchiseApplicationStatus,
} from "@/lib/franchise/store";

const LIST_PATH = "/admin/franchise";

const idSchema = z
  .string()
  .trim()
  .regex(/^frn-\d{4,}$/, { error: "Başvuru seçilmedi." });

const statusSchema = z.object({
  id: idSchema,
  status: z.enum(FRANCHISE_STATUSES, { error: "Durum geçersiz." }),
});

/**
 * Moves an application between Yeni, Görüşüldü and Arşiv. Reversible, so no
 * confirm. Section `leads` (owner and manager): the rows are people's
 * contact details, the same trust as Müşteriler.
 */
export async function setFranchiseStatusAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  await requireRole("leads");
  const parsed = statusSchema.safeParse({
    id: formData.get("id"),
    status: formData.get("status"),
  });
  if (!parsed.success) return actionError("Başvuru ya da durum geçersiz.");
  const { id, status } = parsed.data;
  const changed = await setFranchiseApplicationStatus(id, status);
  revalidatePath(LIST_PATH);
  revalidatePath(`${LIST_PATH}/${id}`);
  if (!changed) return actionError("Başvuru bulunamadı; sayfayı yenile.");
  await logAudit({
    action: "update",
    entity: "franchise_application",
    entityId: id,
    payload: { status },
  });
  return actionOk(`Başvuru "${FRANCHISE_STATUS_LABELS[status]}" oldu.`);
}

/**
 * "Sil", behind a confirm: the applicant asked to be forgotten, or the row
 * was spam. The retention run deletes the rest at twelve months. From the
 * application's own page (`back=list`) it returns to the list, which says
 * so; from the list's ⋯ menu it answers in place.
 */
export async function deleteFranchiseApplicationAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  await requireRole("leads");
  const parsed = idSchema.safeParse(formData.get("id"));
  if (!parsed.success) return actionError("Başvuru seçilmedi.");
  const id = parsed.data;
  const removed = await deleteFranchiseApplication(id);
  revalidatePath(LIST_PATH);
  if (!removed) return actionError("Başvuru zaten silinmiş.");
  await logAudit({
    action: "delete",
    entity: "franchise_application",
    entityId: id,
  });
  if (formData.get("back") === "list") {
    await setAdminFlash("Başvuru silindi.");
    redirect(LIST_PATH);
  }
  return actionOk("Başvuru silindi.");
}
