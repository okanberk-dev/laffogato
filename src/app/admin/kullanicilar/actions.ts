"use server";

import { revalidatePath } from "next/cache";

import { logAudit } from "@/lib/admin/audit";
import { requireRole } from "@/lib/admin/auth";
import { grantBarista, revokeBarista } from "@/lib/admin/staff-members";
import { staffEmailSchema } from "@/lib/admin/staff-schema";
import {
  createAdminUser,
  deleteAdminUser,
  normalizeAdminEmail,
  setAdminPassword,
  updateAdminUser,
  type AdminUserResult,
  type PublicAdminUser,
} from "@/lib/admin/users";

/**
 * Every action opens its own role gate.
 *
 * The page's `requireRole` does NOT protect them: a Server Action is a POST
 * endpoint that can be called without the page. Without the gate here,
 * somebody who never opened the panel could give themselves an owner account.
 *
 * A password is written to NO audit payload and to no log - it reaches the
 * database only as a bcrypt hash.
 */

export interface AdminUserState {
  message?: string;
  error?: string;
}

function failed(result: AdminUserResult<PublicAdminUser>): AdminUserState {
  return result.ok ? {} : { error: result.message };
}

export async function createAdminUserAction(
  _prev: AdminUserState,
  formData: FormData,
): Promise<AdminUserState> {
  const session = await requireRole("adminUsers");
  const result = await createAdminUser({
    email: String(formData.get("email") ?? ""),
    name: String(formData.get("name") ?? ""),
    role: String(formData.get("role") ?? ""),
    password: String(formData.get("password") ?? ""),
    createdBy: session.email,
  });
  if (!result.ok) return failed(result);

  await logAudit({
    action: "create",
    entity: "admin_user",
    entityId: result.value.email,
    payload: { role: result.value.role, name: result.value.name },
  });
  revalidatePath("/admin/kullanicilar");
  return { message: `${result.value.email} eklendi.` };
}

export async function saveAdminUserAction(
  _prev: AdminUserState,
  formData: FormData,
): Promise<AdminUserState> {
  await requireRole("adminUsers");
  const email = normalizeAdminEmail(String(formData.get("email") ?? ""));
  const result = await updateAdminUser(email, {
    name: String(formData.get("name") ?? ""),
    role: String(formData.get("role") ?? ""),
    isActive: formData.get("isActive") === "on",
  });
  if (!result.ok) return failed(result);

  await logAudit({
    action: "update",
    entity: "admin_user",
    entityId: result.value.email,
    payload: { role: result.value.role, isActive: result.value.isActive },
  });
  revalidatePath("/admin/kullanicilar");
  return { message: "Kaydedildi." };
}

export async function resetAdminPasswordAction(
  _prev: AdminUserState,
  formData: FormData,
): Promise<AdminUserState> {
  await requireRole("adminUsers");
  const email = normalizeAdminEmail(String(formData.get("email") ?? ""));
  const result = await setAdminPassword(
    email,
    String(formData.get("password") ?? ""),
  );
  if (!result.ok) return failed(result);

  await logAudit({
    action: "update",
    entity: "admin_user",
    entityId: result.value.email,
    // The new password is deliberately absent - an audit trail that quotes
    // credentials is a credential store.
    payload: { passwordReset: true },
  });
  revalidatePath("/admin/kullanicilar");
  return { message: "Parola değiştirildi." };
}

export async function deleteAdminUserAction(
  _prev: AdminUserState,
  formData: FormData,
): Promise<AdminUserState> {
  await requireRole("adminUsers");
  const email = normalizeAdminEmail(String(formData.get("email") ?? ""));
  const result = await deleteAdminUser(email);
  if (!result.ok) return failed(result);

  await logAudit({
    action: "delete",
    entity: "admin_user",
    entityId: result.value.email,
    payload: { role: result.value.role },
  });
  revalidatePath("/admin/kullanicilar");
  return { message: `${result.value.email} silindi.` };
}

// ─── Uygulamadan kasa (barista) ─────────────────────────────────────────
//
// A barista is an APP member allowed to scan a member's QR from their own
// phone (POST /api/mobile/v1/staff/stamp). Handing out the till is handing
// out stamps, so it sits behind the same `adminUsers` gate as panel accounts.

function staffEmail(formData: FormData): string | null {
  const parsed = staffEmailSchema.safeParse({
    email: String(formData.get("email") ?? ""),
  });
  return parsed.success ? parsed.data.email : null;
}

export async function grantBaristaAction(
  _prev: AdminUserState,
  formData: FormData,
): Promise<AdminUserState> {
  const session = await requireRole("adminUsers");
  const email = staffEmail(formData);
  if (!email) return { error: "Geçerli bir e-posta gir." };

  const result = await grantBarista({ email, grantedBy: session.email });
  if (!result.ok) return { error: result.message };

  await logAudit({
    action: "create",
    entity: "staff_member",
    entityId: result.value.email,
    payload: { role: result.value.role },
  });
  revalidatePath("/admin/kullanicilar");
  return {
    message: `${result.value.email} artık uygulamadan kasa yapabilir.`,
  };
}

export async function revokeBaristaAction(
  _prev: AdminUserState,
  formData: FormData,
): Promise<AdminUserState> {
  await requireRole("adminUsers");
  const email = staffEmail(formData);
  if (!email) return { error: "Geçerli bir e-posta gir." };

  const result = await revokeBarista(email);
  if (!result.ok) return { error: result.message };

  await logAudit({
    action: "delete",
    entity: "staff_member",
    entityId: result.value.email,
    payload: { role: result.value.role },
  });
  revalidatePath("/admin/kullanicilar");
  return { message: `${result.value.email} kasa yetkisi kaldırıldı.` };
}
