"use server";

import { redirect } from "next/navigation";

import { safeAudit } from "@/lib/admin/audit";
import { getAdminSession, signOutAdmin } from "@/lib/admin/auth";

/**
 * Çıkış. The cookie goes first and unconditionally: the audit row used to be
 * written before it, and `logAudit` throws when its insert fails, so with the
 * database down the operator pressed Çıkış, saw an error and the panel stayed
 * signed in on a shared köşk device. The row is the record of the logout, not
 * a condition of it.
 */
export async function logoutAction() {
  // Who is leaving, read while the cookie is still there. A lookup that cannot
  // reach the database leaves the row out; it never keeps the session open.
  let email: string | null = null;
  try {
    email = (await getAdminSession())?.email ?? null;
  } catch {
    email = null;
  }
  await signOutAdmin();
  if (email) {
    await safeAudit({
      action: "logout",
      entity: "auth",
      // Lower-case, as the sign-in's row: Kullanıcılar reads both by address.
      entityId: email.toLowerCase(),
      actor: email,
    });
  }
  redirect("/admin/giris");
}
