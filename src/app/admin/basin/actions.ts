"use server";

import { revalidatePath } from "next/cache";

import {
  actionError,
  actionOk,
  type ActionResult,
} from "@/lib/admin/action-result";
import { logAudit } from "@/lib/admin/audit";
import { requireRole } from "@/lib/admin/auth";
import { createPress, updatePress, deletePress } from "@/lib/admin/store";
import { parsePressForm } from "@/lib/admin/story-press-form";

function revalidate() {
  revalidatePath("/admin/basin");
  revalidatePath("/", "layout");
}

/** Every save and delete answers an ActionResult: a toast, or the error. */
export async function createPressAction(
  _prev: ActionResult | null,
  fd: FormData,
): Promise<ActionResult> {
  await requireRole("press");
  const { input, fieldErrors } = parsePressForm(fd);
  if (Object.keys(fieldErrors).length > 0) {
    return actionError("Formdaki uyarıları gider.", fieldErrors);
  }
  const created = await createPress(input);
  await logAudit({
    action: "create",
    entity: "press",
    entityId: created.id,
    payload: { name: created.name },
  });
  revalidate();
  return actionOk(`${created.name} alıntısı eklendi.`);
}

export async function updatePressAction(
  id: string,
  _prev: ActionResult | null,
  fd: FormData,
): Promise<ActionResult> {
  await requireRole("press");
  const { input, fieldErrors } = parsePressForm(fd);
  if (Object.keys(fieldErrors).length > 0) {
    return actionError("Formdaki uyarıları gider.", fieldErrors);
  }
  const updated = await updatePress(id, input);
  if (!updated) return actionError("Bu alıntı silinmiş; sayfayı yenile.");
  await logAudit({ action: "update", entity: "press", entityId: id });
  revalidate();
  return actionOk(`${updated.name} kaydedildi.`);
}

/** "Sil", behind a confirm. It used to delete on the first click, silently. */
export async function deletePressAction(
  _prev: ActionResult | null,
  fd: FormData,
): Promise<ActionResult> {
  await requireRole("press");
  const id = String(fd.get("id") ?? "");
  if (!id) return actionError("Alıntı seçilmedi.");
  const removed = await deletePress(id);
  revalidate();
  if (!removed) return actionError("Alıntı zaten silinmiş.");
  await logAudit({ action: "delete", entity: "press", entityId: id });
  return actionOk("Alıntı silindi.");
}
