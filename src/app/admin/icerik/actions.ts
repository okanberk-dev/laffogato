"use server";

import { revalidatePath } from "next/cache";

import {
  actionError,
  actionOk,
  type ActionResult,
} from "@/lib/admin/action-result";
import { safeAudit } from "@/lib/admin/audit";
import { requireRole } from "@/lib/admin/auth";
import { CONTENT_FIELDS, planContentSave } from "@/lib/admin/content-fields";
import { saveSiteContent } from "@/lib/admin/site-content";
import { isDbUnreachable } from "@/lib/db/health";

/**
 * "Tümünü kaydet" on Site Metinleri. Answers an ActionResult: refusals sit
 * under their fields, a database failure is a plain Turkish sentence (it
 * used to show the function name and Postgres's English message).
 */
export async function saveContentAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  await requireRole("content");
  const form: Record<string, string> = {};
  for (const field of CONTENT_FIELDS) {
    const v = formData.get(field.key);
    if (typeof v === "string") form[field.key] = v;
  }
  const plan = planContentSave(form);
  if (Object.keys(plan.fieldErrors).length > 0) {
    return actionError("Formdaki uyarıları gider.", plan.fieldErrors);
  }
  try {
    await saveSiteContent(plan);
  } catch (err) {
    console.error("[icerik] site metinleri kaydedilemedi", err);
    return actionError(
      isDbUnreachable(err)
        ? "Veritabanına şu an ulaşılamıyor. Kısa süre içinde tekrar dene."
        : "Kaydedilemedi. Biraz sonra tekrar dene.",
    );
  }
  await safeAudit({
    action: "update",
    entity: "content",
    payload: { saved: Object.keys(plan.upserts), toDefault: plan.deletes },
  });
  revalidatePath("/admin/icerik");
  revalidatePath("/", "layout");
  return actionOk("Site metinleri kaydedildi.");
}
