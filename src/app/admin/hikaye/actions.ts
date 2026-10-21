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
  createStoryEvent,
  updateStoryEvent,
  deleteStoryEvent,
} from "@/lib/admin/store";
import { parseStoryForm } from "@/lib/admin/story-press-form";

function revalidate() {
  revalidatePath("/admin/hikaye");
  revalidatePath("/", "layout");
}

/** Every save and delete answers an ActionResult: a toast, or the error. */
export async function createStoryAction(
  _prev: ActionResult | null,
  fd: FormData,
): Promise<ActionResult> {
  await requireRole("story");
  const { input, fieldErrors } = parseStoryForm(fd);
  if (Object.keys(fieldErrors).length > 0) {
    return actionError("Formdaki uyarıları gider.", fieldErrors);
  }
  const created = await createStoryEvent(input);
  await logAudit({
    action: "create",
    entity: "story",
    entityId: created.id,
    payload: { year: created.year },
  });
  revalidate();
  return actionOk(`"${created.title}" eklendi.`);
}

export async function updateStoryAction(
  id: string,
  _prev: ActionResult | null,
  fd: FormData,
): Promise<ActionResult> {
  await requireRole("story");
  const { input, fieldErrors } = parseStoryForm(fd);
  if (Object.keys(fieldErrors).length > 0) {
    return actionError("Formdaki uyarıları gider.", fieldErrors);
  }
  const updated = await updateStoryEvent(id, input);
  if (!updated) return actionError("Bu dönem silinmiş; sayfayı yenile.");
  await logAudit({ action: "update", entity: "story", entityId: id });
  revalidate();
  return actionOk(`"${updated.title}" kaydedildi.`);
}

/** "Sil", behind a confirm. It used to delete on the first click, silently. */
export async function deleteStoryAction(
  _prev: ActionResult | null,
  fd: FormData,
): Promise<ActionResult> {
  await requireRole("story");
  const id = String(fd.get("id") ?? "");
  if (!id) return actionError("Dönem seçilmedi.");
  const removed = await deleteStoryEvent(id);
  revalidate();
  if (!removed) return actionError("Dönem zaten silinmiş.");
  await logAudit({ action: "delete", entity: "story", entityId: id });
  return actionOk("Dönem silindi.");
}
