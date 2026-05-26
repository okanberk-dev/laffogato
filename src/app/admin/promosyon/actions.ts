"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { promoFormSchema } from "@/lib/admin/promo-schema";
import { createPromo, deletePromo, updatePromo } from "@/lib/admin/store";

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
  revalidatePromos();
  redirect("/admin/promosyon");
}

export async function updatePromoAction(
  id: string,
  _prev: PromoActionState,
  formData: FormData,
): Promise<PromoActionState> {
  const parsed = promoFormSchema.safeParse(readForm(formData));
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
  revalidatePromos();
  redirect("/admin/promosyon");
}

export async function deletePromoAction(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await deletePromo(id);
  revalidatePromos();
}
