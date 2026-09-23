"use server";

import { revalidatePath } from "next/cache";

import { logAudit } from "@/lib/admin/audit";
import { requireRole } from "@/lib/admin/auth";
import {
  deactivateNewsletterSubscriber,
  deleteNewsletterSubscriber,
} from "@/lib/newsletter/store";

/**
 * Takes a subscriber off the list. There is no "Aktifleştir" any more: turning
 * someone back on from the panel reused consent they had withdrawn. Only the
 * person can subscribe again, confirming from their own inbox (6563).
 */
export async function deactivateNewsletterAction(formData: FormData) {
  await requireRole("newsletter");
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await deactivateNewsletterSubscriber(id);
  await logAudit({
    action: "update",
    entity: "newsletter",
    entityId: id,
    payload: { isActive: false },
  });
  revalidatePath("/admin/bulten");
}

export async function deleteNewsletterSubscriberAction(formData: FormData) {
  await requireRole("newsletter");
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  const removed = await deleteNewsletterSubscriber(id);
  if (removed) {
    await logAudit({ action: "delete", entity: "newsletter", entityId: id });
  }
  revalidatePath("/admin/bulten");
}
