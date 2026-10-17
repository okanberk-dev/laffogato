"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  actionError,
  actionOk,
  type ActionResult,
} from "@/lib/admin/action-result";
import { logAudit } from "@/lib/admin/audit";
import { requireRole } from "@/lib/admin/auth";
import {
  cafeTableIdSchema,
  createCafeTableSchema,
  setCafeTableActiveSchema,
  updateCafeTableSchema,
} from "@/lib/admin/cafe-table-schema";
import { setAdminFlash } from "@/lib/admin/flash";
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
  await setAdminFlash(
    `${res.value.name} eklendi. Kartını yazdırıp masaya koy.`,
  );
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
  await setAdminFlash(`${res.value.name} kaydedildi.`);
  redirect("/admin/masalar");
}

/**
 * "Pasifleştir" (behind a confirm) and "Etkinleştir". Both used to answer
 * nothing, so a refused or failed toggle looked like a slow page.
 * `isActive` is the state asked for, not a flip.
 */
export async function setCafeTableActiveAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  await requireRole("tables");
  const parsed = setCafeTableActiveSchema.safeParse({
    id: String(formData.get("id") ?? ""),
    isActive: String(formData.get("isActive") ?? ""),
  });
  if (!parsed.success) return actionError("Geçersiz istek; sayfayı yenile.");
  const isActive = parsed.data.isActive === "true";
  const res = await setCafeTableActive(parsed.data.id, isActive);
  if (!res.ok) return actionError(res.message);
  await logAudit({
    action: "update",
    entity: "cafe_table",
    entityId: res.value.id,
    payload: { isActive },
  });
  revalidateTables();
  return actionOk(
    isActive
      ? `${res.value.name} yeniden siparişe açık.`
      : `${res.value.name} pasif, bu masaya sipariş verilemez.`,
  );
}

/**
 * A new code for the table, behind a confirm. The printed QR stops resolving
 * at once; the codes themselves stay out of the audit row (the old one is
 * dead, the new one is on the panel), only the fact that it changed is kept.
 */
export async function rotateCafeTableCodeAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  await requireRole("tables");
  const parsed = cafeTableIdSchema.safeParse(String(formData.get("id") ?? ""));
  if (!parsed.success) return actionError("Geçersiz istek; sayfayı yenile.");
  const res = await rotateCafeTableCode(parsed.data);
  if (!res.ok) return actionError(res.message);
  await logAudit({
    action: "update",
    entity: "cafe_table",
    entityId: res.value.id,
    payload: { event: "code_rotated", rotatedAt: res.value.rotatedAt },
  });
  revalidateTables();
  return actionOk(
    `${res.value.name} için yeni kod hazır. Yeni kartı yazdır, eskisini masadan hemen kaldır.`,
    "warning",
  );
}
