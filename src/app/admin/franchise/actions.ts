"use server";

import { revalidatePath } from "next/cache";

import { logAudit } from "@/lib/admin/audit";
import { requireRole } from "@/lib/admin/auth";
import {
  createFranchisePackage,
  updateFranchisePackage,
  deleteFranchisePackage,
  createFranchiseStep,
  updateFranchiseStep,
  deleteFranchiseStep,
  type FranchisePackageInput,
  type FranchiseStepInput,
} from "@/lib/admin/store";

function revalidate() {
  revalidatePath("/admin/franchise");
  revalidatePath("/", "layout");
}

// ── Packages ──
function parsePackage(fd: FormData): FranchisePackageInput {
  return {
    name: String(fd.get("name") ?? "")
      .trim()
      .slice(0, 60),
    area: String(fd.get("area") ?? "")
      .trim()
      .slice(0, 40),
    seats: String(fd.get("seats") ?? "")
      .trim()
      .slice(0, 40),
    invest: String(fd.get("invest") ?? "")
      .trim()
      .slice(0, 60),
    monthly: String(fd.get("monthly") ?? "")
      .trim()
      .slice(0, 60),
    ideal: String(fd.get("ideal") ?? "")
      .trim()
      .slice(0, 120),
    includes: String(fd.get("includes") ?? "")
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 20),
    featured: fd.get("featured") === "on",
    sortOrder: parseInt(String(fd.get("sortOrder") ?? "0"), 10) || 0,
    isActive: fd.get("isActive") === "on",
  };
}

export async function createPackageAction(fd: FormData) {
  await requireRole("franchise");
  const input = parsePackage(fd);
  if (!input.name) return;
  const created = await createFranchisePackage(input);
  await logAudit({
    action: "create",
    entity: "franchise",
    entityId: created.id,
    payload: { name: created.name },
  });
  revalidate();
}

export async function updatePackageAction(id: string, fd: FormData) {
  await requireRole("franchise");
  await updateFranchisePackage(id, parsePackage(fd));
  await logAudit({ action: "update", entity: "franchise", entityId: id });
  revalidate();
}

export async function deletePackageAction(fd: FormData) {
  await requireRole("franchise");
  const id = String(fd.get("id") ?? "");
  if (!id) return;
  await deleteFranchisePackage(id);
  await logAudit({ action: "delete", entity: "franchise", entityId: id });
  revalidate();
}

// ── Process steps ──
function parseStep(fd: FormData): FranchiseStepInput {
  return {
    step: String(fd.get("step") ?? "")
      .trim()
      .slice(0, 8),
    title: String(fd.get("title") ?? "")
      .trim()
      .slice(0, 80),
    body: String(fd.get("body") ?? "")
      .trim()
      .slice(0, 300),
    sortOrder: parseInt(String(fd.get("sortOrder") ?? "0"), 10) || 0,
    isActive: fd.get("isActive") === "on",
  };
}

export async function createStepAction(fd: FormData) {
  await requireRole("franchise");
  const input = parseStep(fd);
  if (!input.title) return;
  const created = await createFranchiseStep(input);
  await logAudit({
    action: "create",
    entity: "franchise",
    entityId: created.id,
    payload: { step: created.step },
  });
  revalidate();
}

export async function updateStepAction(id: string, fd: FormData) {
  await requireRole("franchise");
  await updateFranchiseStep(id, parseStep(fd));
  await logAudit({ action: "update", entity: "franchise", entityId: id });
  revalidate();
}

export async function deleteStepAction(fd: FormData) {
  await requireRole("franchise");
  const id = String(fd.get("id") ?? "");
  if (!id) return;
  await deleteFranchiseStep(id);
  await logAudit({ action: "delete", entity: "franchise", entityId: id });
  revalidate();
}
