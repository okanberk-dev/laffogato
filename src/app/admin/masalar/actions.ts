"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { logAudit } from "@/lib/admin/audit";
import { requireRole } from "@/lib/admin/auth";
import {
  cafeTableIdSchema,
  createCafeTableSchema,
  setCafeTableActiveSchema,
  updateCafeTableSchema,
} from "@/lib/admin/cafe-table-schema";
import {
  createCafeTable,
  rotateCafeTableCode,
  setCafeTableActive,
  updateCafeTable,
} from "@/lib/admin/cafe-tables";

// Every export here is a public POST endpoint (CLAUDE.md rule 27): each one
// checks the session and the role itself. Nothing deletes - a table leaves
// service by being deactivated, and its code by being rotated.

export interface CafeTableFormState {
  error?: string;
}

function firstIssue(issues: { message: string }[]): CafeTableFormState {
  return { error: issues[0]?.message ?? "Form geçersiz." };
}

function revalidateTables() {
  revalidatePath("/admin/masalar");
  revalidatePath("/admin/masalar/yazdir");
}

export async function createCafeTableAction(
  _prev: CafeTableFormState,
  formData: FormData,
): Promise<CafeTableFormState> {
  await requireRole("tables");
  const parsed = createCafeTableSchema.safeParse({
    name: String(formData.get("name") ?? ""),
  });
  if (!parsed.success) return firstIssue(parsed.error.issues);
  const res = await createCafeTable(parsed.data.name);
  if (!res.ok) return { error: res.message };
  await logAudit({
    action: "create",
    entity: "cafe_table",
    entityId: res.value.id,
    payload: { name: res.value.name },
  });
  revalidateTables();
  redirect("/admin/masalar");
}

export async function updateCafeTableAction(
  _prev: CafeTableFormState,
  formData: FormData,
): Promise<CafeTableFormState> {
  await requireRole("tables");
  const parsed = updateCafeTableSchema.safeParse({
    id: String(formData.get("id") ?? ""),
    name: String(formData.get("name") ?? ""),
    sortOrder: String(formData.get("sortOrder") ?? "0"),
  });
  if (!parsed.success) return firstIssue(parsed.error.issues);
  const res = await updateCafeTable(parsed.data.id, {
    name: parsed.data.name,
    sortOrder: parsed.data.sortOrder,
  });
  if (!res.ok) return { error: res.message };
  await logAudit({
    action: "update",
    entity: "cafe_table",
    entityId: res.value.id,
    payload: { name: res.value.name, sortOrder: res.value.sortOrder },
  });
  revalidateTables();
  redirect("/admin/masalar");
}

export async function setCafeTableActiveAction(
  formData: FormData,
): Promise<void> {
  await requireRole("tables");
  const parsed = setCafeTableActiveSchema.safeParse({
    id: String(formData.get("id") ?? ""),
    isActive: String(formData.get("isActive") ?? ""),
  });
  if (!parsed.success) return;
  const isActive = parsed.data.isActive === "true";
  const res = await setCafeTableActive(parsed.data.id, isActive);
  if (!res.ok) return;
  await logAudit({
    action: "update",
    entity: "cafe_table",
    entityId: res.value.id,
    payload: { isActive },
  });
  revalidateTables();
}

/**
 * A new code for the table. The printed QR stops resolving at once; the
 * codes themselves stay out of the audit row (the old one is dead, the new
 * one is on the panel), only the fact that it changed is kept.
 */
export async function rotateCafeTableCodeAction(
  formData: FormData,
): Promise<void> {
  await requireRole("tables");
  const parsed = cafeTableIdSchema.safeParse(String(formData.get("id") ?? ""));
  if (!parsed.success) return;
  const res = await rotateCafeTableCode(parsed.data);
  if (!res.ok) return;
  await logAudit({
    action: "update",
    entity: "cafe_table",
    entityId: res.value.id,
    payload: { event: "code_rotated", rotatedAt: res.value.rotatedAt },
  });
  revalidateTables();
}
