"use server";

import { revalidatePath } from "next/cache";

import {
  actionError,
  actionOk,
  type ActionResult,
} from "@/lib/admin/action-result";
import { logAudit } from "@/lib/admin/audit";
import { listEnvAdminContacts, requireRole } from "@/lib/admin/auth";
import { grantBarista, revokeBarista } from "@/lib/admin/staff-members";
import { staffEmailSchema } from "@/lib/admin/staff-schema";
import { disable2FA } from "@/lib/admin/twofa";
import {
  createAdminUser,
  deleteAdminUser,
  listAdminUsers,
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

/**
 * An env (break-glass) account's address. Its 2FA row is keyed by the same
 * address as a panel account would be (admin_2fa has no owner column), so
 * the panel must not drop it while removing or re-creating a panel account
 * of that address.
 */
function isEnvAccount(email: string): boolean {
  return listEnvAdminContacts().some(
    (u) => normalizeAdminEmail(u.email) === email,
  );
}

/**
 * Drops the address's 2FA row after an account write. The account is
 * already written by then, so a failing delete must not stop its audit
 * row: it is logged (without the address, rule 9) and answered as false.
 */
async function dropAccount2FA(email: string): Promise<boolean> {
  if (isEnvAccount(email)) return true;
  try {
    await disable2FA(email);
    return true;
  } catch (err) {
    console.error(
      "[admin/kullanicilar] 2FA row not dropped:",
      err instanceof Error ? err.message : "unknown error",
    );
    return false;
  }
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

  // A 2FA row left by an earlier account of this address (deleted before
  // deletes dropped it) would challenge the new person for a code from
  // someone else's phone.
  const twoFactorDropped = await dropAccount2FA(result.value.email);

  await logAudit({
    action: "create",
    entity: "admin_user",
    entityId: result.value.email,
    payload: { role: result.value.role, name: result.value.name },
  });
  revalidatePath("/admin/kullanicilar");
  return {
    message: twoFactorDropped
      ? `${result.value.email} eklendi.`
      : `${result.value.email} eklendi. Bu adresin eski 2FA kaydı silinemedi; giriş kod isterse 2FA'yı sıfırla.`,
  };
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

/**
 * "Kullanıcıyı sil", behind a confirm (it used to delete on the first
 * click). Answers an ActionResult for ConfirmButton's toast.
 */
export async function deleteAdminUserAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  await requireRole("adminUsers");
  const email = normalizeAdminEmail(String(formData.get("email") ?? ""));
  const result = await deleteAdminUser(email);
  if (!result.ok) return actionError(result.message);
  // The authenticator goes with the account: admin_2fa is keyed by the
  // address with no foreign key, so a re-created account inherited it.
  const twoFactorDropped = await dropAccount2FA(result.value.email);

  await logAudit({
    action: "delete",
    entity: "admin_user",
    entityId: result.value.email,
    payload: { role: result.value.role },
  });
  revalidatePath("/admin/kullanicilar");
  return twoFactorDropped
    ? actionOk(`${result.value.email} silindi.`)
    : actionOk(
        `${result.value.email} silindi. 2FA kaydı silinemedi; bu adresle hesap yeniden açılınca silinir.`,
        "warning",
      );
}

/**
 * "2FA'yı sıfırla": for a user who lost or replaced the phone. Turning 2FA
 * off was only possible from the signed-in user's own 2FA page, with a code
 * from that phone, so a locked-out cashier or manager needed a SQL console.
 *
 * Owner-only (`adminUsers`), behind the user's address typed out, and
 * never for the signed-in owner's own account: there the 2FA page asks for
 * a code, so a stolen session cannot strip it (2fa-kurulum/actions.ts).
 * Not for an env (break-glass) account either, which this page does not
 * manage. The audit row is written first and names no secret; the user
 * sets 2FA up again after the next sign-in.
 */
export async function reset2FAAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const session = await requireRole("adminUsers");
  const email = normalizeAdminEmail(String(formData.get("email") ?? ""));
  if (!email) return actionError("Kullanıcı seçilmedi.");
  if (email === normalizeAdminEmail(session.email)) {
    return actionError(
      "Kendi 2FA'nı buradan sıfırlayamazsın; 2FA kurulumu sayfasından telefonundaki kodla kapat.",
    );
  }
  if (isEnvAccount(email)) {
    return actionError(
      "Bu adres ortam değişkenindeki acil giriş hesabının; 2FA'sı buradan sıfırlanmaz.",
    );
  }
  const typed = normalizeAdminEmail(String(formData.get("confirm") ?? ""));
  if (typed !== email) {
    return actionError("Onay için kullanıcının e-posta adresini birebir yaz.");
  }
  const users = await listAdminUsers();
  if (!users.some((u) => u.email === email)) {
    return actionError("Kullanıcı bulunamadı; sayfayı yenile.");
  }

  await logAudit({
    action: "2fa_disable",
    entity: "2fa",
    entityId: email,
    payload: { reset: "owner" },
  });
  await disable2FA(email);
  revalidatePath("/admin/kullanicilar");
  return actionOk(
    `${email} için 2FA sıfırlandı. Kullanıcı bir sonraki girişte yalnız parolasıyla girer; 2FA'yı yeniden kurmasını söyle.`,
    "warning",
  );
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

/** "Yetkiyi kaldır", behind a confirm; the answer is ConfirmButton's toast. */
export async function revokeBaristaAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  await requireRole("adminUsers");
  const email = staffEmail(formData);
  if (!email) return actionError("Geçerli bir e-posta gir.");

  const result = await revokeBarista(email);
  if (!result.ok) return actionError(result.message);

  await logAudit({
    action: "delete",
    entity: "staff_member",
    entityId: result.value.email,
    payload: { role: result.value.role },
  });
  revalidatePath("/admin/kullanicilar");
  return actionOk(`${result.value.email} kasa yetkisi kaldırıldı.`);
}
