"use server";

import { revalidatePath } from "next/cache";

import { logAudit } from "@/lib/admin/audit";
import { requireRole } from "@/lib/admin/auth";
import {
  createReel,
  updateReel,
  deleteReel,
  type ReelInput,
} from "@/lib/admin/store";

function parse(fd: FormData): ReelInput {
  return {
    caption: String(fd.get("caption") ?? "").trim().slice(0, 160),
    meta: String(fd.get("meta") ?? "").trim().slice(0, 60),
    accent: String(fd.get("accent") ?? "caramel"),
    videoUrl: String(fd.get("videoUrl") ?? "").trim().slice(0, 400),
    sortOrder: parseInt(String(fd.get("sortOrder") ?? "0"), 10) || 0,
    isActive: fd.get("isActive") === "on",
  };
}

function revalidate() {
  revalidatePath("/admin/reels");
  revalidatePath("/", "layout");
}

export async function createReelAction(fd: FormData) {
  await requireRole("reels");
  const input = parse(fd);
  if (!input.caption) return;
  const created = await createReel(input);
  await logAudit({ action: "create", entity: "reel", entityId: created.id, payload: { caption: created.caption } });
  revalidate();
}

export async function updateReelAction(id: string, fd: FormData) {
  await requireRole("reels");
  await updateReel(id, parse(fd));
  await logAudit({ action: "update", entity: "reel", entityId: id });
  revalidate();
}

export async function deleteReelAction(fd: FormData) {
  await requireRole("reels");
  const id = String(fd.get("id") ?? "");
  if (!id) return;
  await deleteReel(id);
  await logAudit({ action: "delete", entity: "reel", entityId: id });
  revalidate();
}
