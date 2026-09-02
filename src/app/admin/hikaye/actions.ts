"use server";

import { revalidatePath } from "next/cache";

import { logAudit } from "@/lib/admin/audit";
import { requireRole } from "@/lib/admin/auth";
import {
  createStoryEvent,
  updateStoryEvent,
  deleteStoryEvent,
  type StoryEventInput,
} from "@/lib/admin/store";

function parse(fd: FormData): StoryEventInput {
  return {
    year: String(fd.get("year") ?? "")
      .trim()
      .slice(0, 12),
    title: String(fd.get("title") ?? "")
      .trim()
      .slice(0, 120),
    body: String(fd.get("body") ?? "")
      .trim()
      .slice(0, 500),
    sortOrder: parseInt(String(fd.get("sortOrder") ?? "0"), 10) || 0,
    isActive: fd.get("isActive") === "on",
  };
}

function revalidate() {
  revalidatePath("/admin/hikaye");
  revalidatePath("/", "layout");
}

export async function createStoryAction(fd: FormData) {
  await requireRole("story");
  const input = parse(fd);
  if (!input.title) return;
  const created = await createStoryEvent(input);
  await logAudit({
    action: "create",
    entity: "story",
    entityId: created.id,
    payload: { year: created.year },
  });
  revalidate();
}

export async function updateStoryAction(id: string, fd: FormData) {
  await requireRole("story");
  await updateStoryEvent(id, parse(fd));
  await logAudit({ action: "update", entity: "story", entityId: id });
  revalidate();
}

export async function deleteStoryAction(fd: FormData) {
  await requireRole("story");
  const id = String(fd.get("id") ?? "");
  if (!id) return;
  await deleteStoryEvent(id);
  await logAudit({ action: "delete", entity: "story", entityId: id });
  revalidate();
}
