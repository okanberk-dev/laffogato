"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { logAudit } from "@/lib/admin/audit";
import {
  createAppPost,
  deleteAppPost,
  updateAppPost,
  type AppPostInput,
  type AppPostKind,
} from "@/lib/admin/store";

function parseInput(formData: FormData): AppPostInput {
  return {
    // The store normalises an unknown kind to "campaign"; this cast shapes the
    // argument, it does not trust it.
    kind: String(formData.get("kind") ?? "campaign") as AppPostKind,
    title: String(formData.get("title") ?? ""),
    body: String(formData.get("body") ?? ""),
    image: String(formData.get("image") ?? ""),
    linkUrl: String(formData.get("linkUrl") ?? ""),
    linkLabel: String(formData.get("linkLabel") ?? ""),
    sortOrder: parseInt(String(formData.get("sortOrder") ?? "0"), 10) || 0,
    isActive: formData.get("isActive") === "on",
    startsAt: String(formData.get("startsAt") ?? ""),
    endsAt: String(formData.get("endsAt") ?? ""),
  };
}

export async function createPostAction(formData: FormData) {
  const input = parseInput(formData);
  if (!input.title.trim()) return;
  const created = await createAppPost(input);
  await logAudit({
    action: "create",
    entity: "app_post",
    entityId: created.id,
    payload: { title: created.title, kind: created.kind },
  });
  revalidatePath("/admin/mobil/gonderiler");
  redirect("/admin/mobil/gonderiler");
}

export async function updatePostAction(id: string, formData: FormData) {
  const input = parseInput(formData);
  await updateAppPost(id, input);
  await logAudit({
    action: "update",
    entity: "app_post",
    entityId: id,
    payload: { title: input.title, isActive: input.isActive },
  });
  revalidatePath("/admin/mobil/gonderiler");
  redirect("/admin/mobil/gonderiler");
}

export async function deletePostAction(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await deleteAppPost(id);
  await logAudit({ action: "delete", entity: "app_post", entityId: id });
  revalidatePath("/admin/mobil/gonderiler");
}
