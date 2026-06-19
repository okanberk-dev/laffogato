"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { logAudit } from "@/lib/admin/audit";
import { requireRole } from "@/lib/admin/auth";
import { legalDocSchema } from "@/lib/admin/legal-schema";
import { findLegalDoc } from "@/lib/legal/documents";
import { resetLegalDoc, upsertLegalDoc } from "@/lib/legal/store";

export interface LegalActionState {
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

function revalidateLegal(slug: string) {
  revalidatePath("/admin/hukuk");
  revalidatePath(`/admin/hukuk/${slug}`);
  revalidatePath(`/hukuk/${slug}`);
  revalidatePath("/hukuk");
}

export async function updateLegalDocAction(
  slug: string,
  _prev: LegalActionState,
  formData: FormData,
): Promise<LegalActionState> {
  await requireRole("legal");
  if (!findLegalDoc(slug)) return { error: "Belge bulunamadı." };
  const parsed = legalDocSchema.safeParse(readForm(formData));
  if (!parsed.success) {
    const fe: Record<string, string> = {};
    for (const i of parsed.error.issues) {
      const k = i.path.join(".") || "form";
      if (!fe[k]) fe[k] = i.message;
    }
    return { error: "Formdaki uyarıları gider.", fieldErrors: fe };
  }
  await upsertLegalDoc(slug, parsed.data);
  await logAudit({
    action: "update",
    entity: "legal_doc",
    entityId: slug,
    payload: { published: parsed.data.isPublished },
  });
  revalidateLegal(slug);
  redirect("/admin/hukuk");
}

export async function resetLegalDocAction(formData: FormData) {
  await requireRole("legal");
  const slug = String(formData.get("slug") ?? "");
  if (!slug) return;
  const removed = await resetLegalDoc(slug);
  if (removed) {
    await logAudit({
      action: "delete",
      entity: "legal_doc",
      entityId: slug,
      payload: { reset: true },
    });
  }
  revalidateLegal(slug);
}
