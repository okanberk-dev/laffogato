"use server";

import { redirect } from "next/navigation";

import { logAudit } from "@/lib/admin/audit";
import { getAdminSession, signOutAdmin } from "@/lib/admin/auth";

export async function logoutAction() {
  const session = await getAdminSession();
  if (session) {
    await logAudit({
      action: "logout",
      entity: "auth",
      entityId: session.email,
    });
  }
  await signOutAdmin();
  redirect("/admin/giris");
}
