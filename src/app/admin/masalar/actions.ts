"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  actionError,
  actionOk,
  fieldErrorsFromIssues,
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
import {
  CAFE_TABLES_PATH,
  cafeTableHref,
  cafeTablePrintHref,
} from "@/lib/admin/cafe-tables-panel";

// Every export here is a public POST endpoint (CLAUDE.md rule 27): each one
// checks the session and the role itself. Nothing deletes - a table leaves
// service by being deactivated, and its code by being rotated.

/**
 * A refused form: the first problem as the form's message, each field's
 * own under it. The form (ActionForm) keeps what was typed (admin audit
 * KAR-14: the old `<form action>` emptied the name on every refusal).
 */
function refused(
  issues: ReadonlyArray<{ path: ReadonlyArray<PropertyKey>; message: string }>,
): ActionResult {
  return actionError(
    issues[0]?.message ?? "Form geçersiz.",
    fieldErrorsFromIssues(issues),
  );
}

/** The store's own refusal; a bad name is the name field's. */
function storeRefusal(res: { error: string; message: string }): ActionResult {
  return res.error === "invalid_name"
    ? actionError(res.message, { name: res.message })
    : actionError(res.message);
}

function revalidateTables(id?: string) {
  revalidatePath(CAFE_TABLES_PATH);
  revalidatePath(cafeTablePrintHref());
  if (id) revalidatePath(cafeTableHref(id));
}

/**
 * "Masayı ekle". A database error throws: the form turns it into "Bir hata
 * oldu…" with the name still typed (runPanelAction), not the error screen.
 */
export async function createCafeTableAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  await requireRole("tables");
  const parsed = createCafeTableSchema.safeParse({
    name: String(formData.get("name") ?? ""),
  });
  if (!parsed.success) return refused(parsed.error.issues);
  const res = await createCafeTable(parsed.data.name);
  if (!res.ok) return storeRefusal(res);
  await logAudit({
    action: "create",
    entity: "cafe_table",
    entityId: res.value.id,
    payload: { name: res.value.name },
  });
  revalidateTables(res.value.id);
  await setAdminFlash(
    `${res.value.name} eklendi. Kartını yazdırıp masaya koy.`,
  );
  // The new table's page: its QR, "Kartı yazdır" and the link.
  redirect(cafeTableHref(res.value.id));
}

export async function updateCafeTableAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  await requireRole("tables");
  const parsed = updateCafeTableSchema.safeParse({
    id: String(formData.get("id") ?? ""),
    name: String(formData.get("name") ?? ""),
    sortOrder: String(formData.get("sortOrder") ?? "0"),
  });
  if (!parsed.success) return refused(parsed.error.issues);
  const res = await updateCafeTable(parsed.data.id, {
    name: parsed.data.name,
    sortOrder: parsed.data.sortOrder,
  });
  if (!res.ok) return storeRefusal(res);
  await logAudit({
    action: "update",
    entity: "cafe_table",
    entityId: res.value.id,
    payload: { name: res.value.name, sortOrder: res.value.sortOrder },
  });
  revalidateTables(res.value.id);
  await setAdminFlash(`${res.value.name} kaydedildi.`);
  redirect(cafeTableHref(res.value.id));
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
  revalidateTables(res.value.id);
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
  revalidateTables(res.value.id);
  return actionOk(
    `${res.value.name} için yeni kod hazır. Yeni kartı yazdır, eskisini masadan hemen kaldır.`,
    "warning",
  );
}
