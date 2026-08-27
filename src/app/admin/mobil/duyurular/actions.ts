"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { logAudit } from "@/lib/admin/audit";
import {
  createAppAnnouncement,
  deleteAppAnnouncement,
  updateAppAnnouncement,
  type AppAnnouncementInput,
  type AppAnnouncementKind,
} from "@/lib/admin/store";

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
  redirect("/admin/mobil/duyurular");
}

export async function updateAnnouncementAction(id: string, formData: FormData) {
  const input = parseInput(formData);
  await updateAppAnnouncement(id, input);
  await logAudit({
    action: "update",
    entity: "app_announcement",
    entityId: id,
    payload: { title: input.title, isActive: input.isActive },
  });
  revalidatePath("/admin/mobil/duyurular");
  redirect("/admin/mobil/duyurular");
}

export async function deleteAnnouncementAction(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await deleteAppAnnouncement(id);
  await logAudit({ action: "delete", entity: "app_announcement", entityId: id });
  revalidatePath("/admin/mobil/duyurular");
}
