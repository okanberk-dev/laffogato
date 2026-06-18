"use server";

import { revalidatePath } from "next/cache";

import { logAudit } from "@/lib/admin/audit";
import { requireRole } from "@/lib/admin/auth";
import { CONTENT_FIELDS } from "@/lib/admin/content-fields";
import { updateSiteContent } from "@/lib/admin/site-content";

export interface ContentState {
  message?: string;
  error?: string;
}

export async function saveContentAction(
  _prev: ContentState,
  formData: FormData,
): Promise<ContentState> {
  await requireRole("content");
  const entries: Record<string, string> = {};
  for (const field of CONTENT_FIELDS) {
    const v = formData.get(field.key);
    if (typeof v === "string") entries[field.key] = v;
  }
  try {
    await updateSiteContent(entries);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Kaydedilemedi." };
  }
  await logAudit({
    action: "update",
    entity: "content",
    payload: { count: Object.keys(entries).length },
  });
  revalidatePath("/admin/icerik");
  revalidatePath("/", "layout");
  return { message: "Site metinleri kaydedildi." };
}
