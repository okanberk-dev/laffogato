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
import { deletedAnswer } from "@/lib/admin/delete-answer";
import { appContentFieldErrors } from "@/lib/admin/app-content-schema";
import { setAdminFlash } from "@/lib/admin/flash";
import {
  moveAnswer,
  readActiveForm,
  readMoveForm,
} from "@/lib/admin/list-order";
import {
  createAppAnnouncement,
  deleteAppAnnouncement,
  moveAppAnnouncement,
  setAppAnnouncementActive,
  updateAppAnnouncement,
  type AppAnnouncementInput,
  type AppAnnouncementKind,
} from "@/lib/admin/store";

const PANEL = "/admin/mobil/duyurular";
const REFUSED = "Formdaki uyarıları gider.";
const GONE = "Bu duyuru silinmiş; listeye dön.";

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

/**
 * Answers with an ActionResult for ActionForm (field errors under their
 * fields); a save that went through redirects with its toast. It used to
 * return nothing on a blank title, so "Kaydet" looked dead.
 */
export async function createAnnouncementAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  await requireRole("mobileApp");
  const input = parseInput(formData);
  // The HTML `required` attribute is not a guard on a Server Action, and the
  // store only trims the title - a titleless row renders as an empty card on
  // every phone.
  const fieldErrors = appContentFieldErrors(input);
  if (Object.keys(fieldErrors).length) return actionError(REFUSED, fieldErrors);
  const created = await createAppAnnouncement(input);
  await logAudit({
    action: "create",
    entity: "app_announcement",
    entityId: created.id,
    payload: { title: created.title, kind: created.kind },
  });
  revalidatePath(PANEL);
  await setAdminFlash(`"${created.title}" duyurusu eklendi.`);
  redirect(PANEL);
}

export async function updateAnnouncementAction(
  id: string,
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  await requireRole("mobileApp");
  const input = parseInput(formData);
  const fieldErrors = appContentFieldErrors(input);
  if (Object.keys(fieldErrors).length) return actionError(REFUSED, fieldErrors);
  const updated = await updateAppAnnouncement(id, input);
  // The row was deleted while this form was open; without the check the audit
  // log claims an update that never happened.
  if (!updated) return actionError(GONE);
  await logAudit({
    action: "update",
    entity: "app_announcement",
    entityId: id,
    payload: { title: input.title, isActive: input.isActive },
  });
  revalidatePath(PANEL);
  await setAdminFlash(`"${updated.title}" kaydedildi.`);
  redirect(PANEL);
}

/**
 * "Sil", behind a confirm. It used to delete on the first click, silently.
 * Not "kalktı": phones read the home content through a shared cache, so it
 * takes a few minutes to leave every phone (see the slide delete).
 */
export async function deleteAnnouncementAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  await requireRole("mobileApp");
  const id = String(formData.get("id") ?? "");
  if (!id) return actionError("Duyuru seçilmedi.");
  const removed = await deleteAppAnnouncement(id);
  revalidatePath(PANEL);
  if (!removed) return actionError("Duyuru zaten silinmiş.");
  await logAudit({
    action: "delete",
    entity: "app_announcement",
    entityId: id,
  });
  return deletedAnswer(
    formData,
    "Duyuru silindi; uygulamadan birkaç dakika içinde kalkar.",
    PANEL,
  );
}

/**
 * "Yayına al" / "Yayından kaldır" from the list: one click, reversible. Not
 * "hemen": phones read the home content through a shared cache.
 */
export async function setAnnouncementActiveAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  await requireRole("mobileApp");
  const form = readActiveForm(formData);
  if (!form.ok) return actionError(form.error);
  const found = await setAppAnnouncementActive(form.id, form.isActive);
  revalidatePath(PANEL);
  if (!found) return actionError(GONE);
  await logAudit({
    action: "update",
    entity: "app_announcement",
    entityId: form.id,
    payload: { isActive: form.isActive },
  });
  return actionOk(
    form.isActive
      ? "Duyuru yayına alındı; telefonlara birkaç dakika içinde ulaşır."
      : "Duyuru yayından kaldırıldı; uygulamadan birkaç dakika içinde kalkar.",
  );
}

/** The ↑ / ↓ beside each row (the list unfiltered). */
export async function moveAnnouncementAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  await requireRole("mobileApp");
  const form = readMoveForm(formData);
  if (!form.ok) return actionError(form.error);
  const outcome = await moveAppAnnouncement(form.id, form.direction);
  if (outcome === "moved") {
    await logAudit({
      action: "update",
      entity: "app_announcement",
      entityId: form.id,
      payload: { move: form.direction },
    });
    revalidatePath(PANEL);
  }
  return moveAnswer(outcome, form.direction, "Duyuru", GONE);
}
