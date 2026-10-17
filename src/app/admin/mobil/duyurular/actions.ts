"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  actionError,
  actionOk,
  type ActionResult,
} from "@/lib/admin/action-result";
import { logAudit } from "@/lib/admin/audit";
import { requireRole } from "@/lib/admin/auth";
import { setAdminFlash } from "@/lib/admin/flash";
import {
  createAppAnnouncement,
  deleteAppAnnouncement,
  updateAppAnnouncement,
  type AppAnnouncementInput,
  type AppAnnouncementKind,
} from "@/lib/admin/store";

/**
 * Her action kendi rol kapısını açar.
 *
 * Sayfadaki `requireRole` bunları KORUMAZ: bir Server Action, sayfadan
 * bağımsız olarak çağrılabilen bir POST uç noktasıdır. Kapı burada yoksa,
 * panelin kendisini hiç açmamış biri de her telefona düşen ana sayfa
 * içeriğini değiştirebilir.
 */
function parseInput(formData: FormData): AppAnnouncementInput {
  return {
    // The store normalises an unknown kind to "info"; this cast shapes the
    // argument, it does not trust it.
    kind: String(formData.get("kind") ?? "info") as AppAnnouncementKind,
    title: String(formData.get("title") ?? ""),
    body: String(formData.get("body") ?? ""),
    sortOrder: parseInt(String(formData.get("sortOrder") ?? "0"), 10) || 0,
    isActive: formData.get("isActive") === "on",
    startsAt: String(formData.get("startsAt") ?? ""),
    endsAt: String(formData.get("endsAt") ?? ""),
  };
}

export async function createAnnouncementAction(formData: FormData) {
  await requireRole("mobileApp");
  const input = parseInput(formData);
  if (!input.title.trim()) return;
  const created = await createAppAnnouncement(input);
  await logAudit({
    action: "create",
    entity: "app_announcement",
    entityId: created.id,
    payload: { title: created.title, kind: created.kind },
  });
  revalidatePath("/admin/mobil/duyurular");
  await setAdminFlash(`"${created.title}" duyurusu eklendi.`);
  redirect("/admin/mobil/duyurular");
}

export async function updateAnnouncementAction(id: string, formData: FormData) {
  await requireRole("mobileApp");
  const input = parseInput(formData);
  // Same guard as the create action: the HTML `required` attribute is not a
  // guard on a Server Action, and the store only trims the title - a titleless
  // row renders as an empty card on every phone.
  if (!input.title.trim()) return;
  const updated = await updateAppAnnouncement(id, input);
  // The row was deleted while this form was open; without the check the audit
  // log claims an update that never happened.
  if (!updated) return;
  await logAudit({
    action: "update",
    entity: "app_announcement",
    entityId: id,
    payload: { title: input.title, isActive: input.isActive },
  });
  revalidatePath("/admin/mobil/duyurular");
  await setAdminFlash(`"${updated.title}" kaydedildi.`);
  redirect("/admin/mobil/duyurular");
}

/** "Sil", behind a confirm. It used to delete on the first click, silently. */
export async function deleteAnnouncementAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  await requireRole("mobileApp");
  const id = String(formData.get("id") ?? "");
  if (!id) return actionError("Duyuru seçilmedi.");
  const removed = await deleteAppAnnouncement(id);
  revalidatePath("/admin/mobil/duyurular");
  if (!removed) return actionError("Duyuru zaten silinmiş.");
  await logAudit({
    action: "delete",
    entity: "app_announcement",
    entityId: id,
  });
  return actionOk("Duyuru silindi, uygulamadan kalktı.");
}
