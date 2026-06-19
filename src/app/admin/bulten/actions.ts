"use server";

import { revalidatePath } from "next/cache";

import { logAudit } from "@/lib/admin/audit";
import { requireRole } from "@/lib/admin/auth";
import {
  deleteNewsletterSubscriber,
  setNewsletterSubscriberActive,
} from "@/lib/newsletter/store";

export async function setNewsletterActiveAction(formData: FormData) {
  await requireRole("newsletter");
  const id = String(formData.get("id") ?? "");
  const active = String(formData.get("active") ?? "") === "1";
  if (!id) return;
  await setNewsletterSubscriberActive(id, active);
  await logAudit({
    action: "update",
    entity: "newsletter",
    entityId: id,
    payload: { isActive: active },
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
