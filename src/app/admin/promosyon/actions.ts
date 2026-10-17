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
  buildPromoFormSchema,
  promoFormSchema,
} from "@/lib/admin/promo-schema";
import {
  createPromo,
  deletePromo,
  getPromo,
  setPromoActive,
  updatePromo,
} from "@/lib/admin/store";

export interface PromoActionState {
  error?: string;
  fieldErrors?: Record<string, string>;
}

function readForm(formData: FormData): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of formData.entries()) {
    if (typeof v === "string") out[k] = v;
  }
  return out;
}

function revalidatePromos() {
  revalidatePath("/admin/promosyon");
  revalidatePath("/admin");
}

export async function createPromoAction(
  _prev: PromoActionState,
  formData: FormData,
): Promise<PromoActionState> {
  await requireRole("promos");
  const parsed = promoFormSchema.safeParse(readForm(formData));
  if (!parsed.success) {
    const fe: Record<string, string> = {};
    for (const i of parsed.error.issues) {
      const k = i.path.join(".") || "form";
      if (!fe[k]) fe[k] = i.message;
    }
    return { error: "Formdaki uyarıları gider.", fieldErrors: fe };
  }
  const r = await createPromo(parsed.data);
  if (!r.ok) return { error: r.error };
  await logAudit({
    action: "create",
    entity: "promo",
    entityId: r.promo.id,
    payload: { code: r.promo.code, kind: r.promo.kind, value: r.promo.value },
  });
  revalidatePromos();
  await setAdminFlash(`${r.promo.code} eklendi.`);
  redirect("/admin/promosyon");
}

export async function updatePromoAction(
  id: string,
  _prev: PromoActionState,
  formData: FormData,
): Promise<PromoActionState> {
  await requireRole("promos");
  const existing = await getPromo(id);
  if (!existing) return { error: "Kod bulunamadı; sayfayı yenile." };
  // The code's own expiry may come back untouched even when it has passed:
  // an expired code stays expired through an edit of its limit or text.
  const parsed = buildPromoFormSchema(existing.expiresAt).safeParse(
    readForm(formData),
  );
  if (!parsed.success) {
    const fe: Record<string, string> = {};
    for (const i of parsed.error.issues) {
      const k = i.path.join(".") || "form";
      if (!fe[k]) fe[k] = i.message;
    }
    return { error: "Formdaki uyarıları gider.", fieldErrors: fe };
  }
  const r = await updatePromo(id, parsed.data);
  if (!r.ok) return { error: r.error };
  await logAudit({
    action: "update",
    entity: "promo",
    entityId: id,
    payload: { code: r.promo.code, kind: r.promo.kind, value: r.promo.value },
  });
  revalidatePromos();
  await setAdminFlash(`${r.promo.code} kaydedildi.`);
  redirect("/admin/promosyon");
}

/**
 * The list's "Aktif" / "Pasif" switch: a code is paused without opening the
 * edit form. `isActive` is the state asked for, not a flip, so a double click
 * or a stale tab cannot turn it back.
 */
export async function setPromoActiveAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  await requireRole("promos");
  const id = String(formData.get("id") ?? "");
  const raw = String(formData.get("isActive") ?? "");
  if (!id || (raw !== "true" && raw !== "false")) {
    return actionError("Geçersiz istek.");
  }
  const isActive = raw === "true";
  const promo = await setPromoActive(id, isActive);
  if (!promo) return actionError("Kod bulunamadı; sayfayı yenile.");
  await logAudit({
    action: "update",
    entity: "promo",
    entityId: id,
    payload: { code: promo.code, isActive },
  });
  revalidatePromos();
  return actionOk(
    isActive
      ? `${promo.code} yeniden aktif.`
      : `${promo.code} pasif, sepette kabul edilmez.`,
  );
}

/** "Sil", behind a confirm. It used to delete on the first click, silently. */
export async function deletePromoAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  await requireRole("promos");
  const id = String(formData.get("id") ?? "");
  if (!id) return actionError("Kod seçilmedi.");
  const promo = await getPromo(id);
  const removed = await deletePromo(id);
  revalidatePromos();
  if (!removed) return actionError("Kod zaten silinmiş.");
  await logAudit({
    action: "delete",
    entity: "promo",
    entityId: id,
    payload: promo ? { code: promo.code } : {},
  });
  return actionOk(`${promo?.code ?? "Kod"} silindi.`);
}
