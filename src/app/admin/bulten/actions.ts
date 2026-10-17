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
  deactivateNewsletterSubscriber,
  deleteNewsletterSubscriber,
} from "@/lib/newsletter/store";

/**
 * Takes a subscriber off the list, behind a confirm. There is no
 * "Aktifleştir" any more: turning someone back on from the panel reused
 * consent they had withdrawn. Only the person can subscribe again, confirming
 * from their own inbox (6563).
 */
export async function deactivateNewsletterAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  await requireRole("newsletter");
  const id = String(formData.get("id") ?? "");
  if (!id) return actionError("Abone seçilmedi.");
  const changed = await deactivateNewsletterSubscriber(id);
  revalidatePath("/admin/bulten");
  if (!changed) return actionError("Abone bulunamadı; silinmiş olabilir.");
  await logAudit({
    action: "update",
    entity: "newsletter",
    entityId: id,
    payload: { isActive: false },
  });
  return actionOk("Abone pasif, artık bülten gitmez.");
}

/** "Sil", behind a confirm. It used to delete on the first click, silently. */
export async function deleteNewsletterSubscriberAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  await requireRole("newsletter");
  const id = String(formData.get("id") ?? "");
  if (!id) return actionError("Abone seçilmedi.");
  const removed = await deleteNewsletterSubscriber(id);
  revalidatePath("/admin/bulten");
  if (!removed) return actionError("Abone zaten silinmiş.");
  await logAudit({ action: "delete", entity: "newsletter", entityId: id });
  return actionOk("Abone silindi.");
}
