"use server";

import { revalidatePath } from "next/cache";

import { logAudit } from "@/lib/admin/audit";
import { requireRole } from "@/lib/admin/auth";
import {
  createPress,
  updatePress,
  deletePress,
  type PressInput,
} from "@/lib/admin/store";

function parse(fd: FormData): PressInput {
  return {
    name: String(fd.get("name") ?? "").trim().slice(0, 80),
    quote: String(fd.get("quote") ?? "").trim().slice(0, 300),
    sortOrder: parseInt(String(fd.get("sortOrder") ?? "0"), 10) || 0,
    isActive: fd.get("isActive") === "on",
  };
}

function revalidate() {
  revalidatePath("/admin/basin");
  revalidatePath("/", "layout");
}

export async function createPressAction(fd: FormData) {
  await requireRole("press");
  const input = parse(fd);
  if (!input.name) return;
  const created = await createPress(input);
  await logAudit({ action: "create", entity: "press", entityId: created.id, payload: { name: created.name } });
  revalidate();
}

export async function updatePressAction(id: string, fd: FormData) {
  await requireRole("press");
  await updatePress(id, parse(fd));
  await logAudit({ action: "update", entity: "press", entityId: id });
  revalidate();
}

export async function deletePressAction(fd: FormData) {
  await requireRole("press");
  const id = String(fd.get("id") ?? "");
  if (!id) return;
  await deletePress(id);
  await logAudit({ action: "delete", entity: "press", entityId: id });
  revalidate();
}
