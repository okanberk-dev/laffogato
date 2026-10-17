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
  createAppSlide,
  deleteAppSlide,
  updateAppSlide,
  type AppSlideInput,
  type AppSlideTone,
} from "@/lib/admin/store";

/**
 * Her action kendi rol kapısını açar.
 *
 * Sayfadaki `requireRole` bunları KORUMAZ: bir Server Action, sayfadan
 * bağımsız olarak çağrılabilen bir POST uç noktasıdır. Kapı burada yoksa,
 * panelin kendisini hiç açmamış biri de her telefona düşen ana sayfa
 * içeriğini değiştirebilir.
 */
function parseInput(formData: FormData): AppSlideInput {
  return {
    eyebrow: String(formData.get("eyebrow") ?? ""),
    title: String(formData.get("title") ?? ""),
    body: String(formData.get("body") ?? ""),
    ctaLabel: String(formData.get("ctaLabel") ?? ""),
    ctaRoute: String(formData.get("ctaRoute") ?? ""),
    // The store normalises an unknown tone to "paper"; this cast only shapes
    // the argument, it does not trust it.
    tone: String(formData.get("tone") ?? "paper") as AppSlideTone,
    // https-only; the store's `safeHttpsUrl` parse stores anything else as "".
    image: String(formData.get("image") ?? ""),
    sortOrder: parseInt(String(formData.get("sortOrder") ?? "0"), 10) || 0,
    isActive: formData.get("isActive") === "on",
    startsAt: String(formData.get("startsAt") ?? ""),
    endsAt: String(formData.get("endsAt") ?? ""),
  };
}

export async function createSlideAction(formData: FormData) {
  await requireRole("mobileApp");
  const input = parseInput(formData);
  if (!input.title.trim()) return;
  const created = await createAppSlide(input);
  await logAudit({
    action: "create",
    entity: "app_hero_slide",
    entityId: created.id,
    payload: { title: created.title, tone: created.tone },
  });
  revalidatePath("/admin/mobil/slaytlar");
  await setAdminFlash(`"${created.title}" slaytı eklendi.`);
  redirect("/admin/mobil/slaytlar");
}

export async function updateSlideAction(id: string, formData: FormData) {
  await requireRole("mobileApp");
  const input = parseInput(formData);
  // Same guard as the create action: the HTML `required` attribute is not a
  // guard on a Server Action, and the store only trims the title - a titleless
  // row renders as an empty card on every phone.
  if (!input.title.trim()) return;
  const updated = await updateAppSlide(id, input);
  // The row was deleted while this form was open; without the check the audit
  // log claims an update that never happened.
  if (!updated) return;
  await logAudit({
    action: "update",
    entity: "app_hero_slide",
    entityId: id,
    payload: { title: input.title, isActive: input.isActive },
  });
  revalidatePath("/admin/mobil/slaytlar");
  await setAdminFlash(`"${updated.title}" kaydedildi.`);
  redirect("/admin/mobil/slaytlar");
}

/** "Sil", behind a confirm. It used to delete on the first click, silently. */
export async function deleteSlideAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  await requireRole("mobileApp");
  const id = String(formData.get("id") ?? "");
  if (!id) return actionError("Slayt seçilmedi.");
  const removed = await deleteAppSlide(id);
  revalidatePath("/admin/mobil/slaytlar");
  if (!removed) return actionError("Slayt zaten silinmiş.");
  await logAudit({ action: "delete", entity: "app_hero_slide", entityId: id });
  return actionOk("Slayt silindi, uygulamadan kalktı.");
}
