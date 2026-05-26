"use server";

import { redirect } from "next/navigation";

import { signOutAdmin } from "@/lib/admin/auth";

export async function logoutAction() {
  await signOutAdmin();
  redirect("/admin/giris");
}
