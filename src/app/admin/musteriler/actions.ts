"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { logAudit } from "@/lib/admin/audit";
import { requireRole } from "@/lib/admin/auth";
import { customerEditSchema } from "@/lib/admin/customer-schema";
import {
  adminDeleteCustomer,
  adminUpdateCustomer,
  createVerificationToken,
  setCustomerActive,
} from "@/lib/customer/store";
import { sendVerificationEmail } from "@/lib/email/send";
import { SITE } from "@/lib/seo/site";

function verifyUrl(token: string): string {
  return `${SITE.url}/uye/dogrula?token=${encodeURIComponent(token)}`;
}

function readForm(formData: FormData): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of formData.entries()) {
    if (typeof v === "string") out[k] = v;
  }
  return out;
}

function revalidateCustomer(email: string) {
  revalidatePath("/admin/musteriler");
  revalidatePath(`/admin/musteriler/${encodeURIComponent(email)}`);
  revalidatePath("/admin");
}

export interface CustomerActionState {
  error?: string;
  fieldErrors?: Record<string, string>;
}

export async function updateCustomerAction(
  email: string,
  _prev: CustomerActionState,
  formData: FormData,
): Promise<CustomerActionState> {
  await requireRole("customers");
  const parsed = customerEditSchema.safeParse(readForm(formData));
  if (!parsed.success) {
    const fe: Record<string, string> = {};
    for (const i of parsed.error.issues) {
      const k = i.path.join(".") || "form";
      if (!fe[k]) fe[k] = i.message;
    }
    return { error: "Formdaki uyarıları gider.", fieldErrors: fe };
  }
  const updated = await adminUpdateCustomer(email, parsed.data);
  if (!updated) return { error: "Üye bulunamadı." };
  await logAudit({
    action: "update",
    entity: "customer",
    entityId: email,
    payload: { name: parsed.data.name },
  });
  revalidateCustomer(email);
  redirect(`/admin/musteriler/${encodeURIComponent(email)}`);
}

export async function setCustomerActiveAction(formData: FormData) {
  await requireRole("customers");
  const email = String(formData.get("email") ?? "");
  const active = String(formData.get("active") ?? "") === "1";
  if (!email) return;
  const updated = await setCustomerActive(email, active);
  if (!updated) return;
  await logAudit({
    action: "update",
    entity: "customer",
    entityId: email,
    payload: { isActive: active },
  });
  revalidateCustomer(email);
}

export interface ResendVerificationState {
  error?: string;
  message?: string;
  /** The verification link — surfaced so the admin can share it directly. */
  url?: string;
}

export async function resendVerificationAction(
  _prev: ResendVerificationState,
  formData: FormData,
): Promise<ResendVerificationState> {
  await requireRole("customers");
  const email = String(formData.get("email") ?? "");
  if (!email) return { error: "E-posta eksik." };
  const result = await createVerificationToken(email);
  if (!result.ok) {
    return result.alreadyVerified
      ? { message: "E-posta zaten doğrulanmış." }
      : { error: result.error };
  }
  const url = verifyUrl(result.token);
  // Best-effort send; if no provider is configured the link is logged.
  await sendVerificationEmail(result.email, result.name, url);
  await logAudit({
    action: "update",
    entity: "customer",
    entityId: email,
    payload: { verification: "resent" },
  });
  return { message: "Yeni doğrulama bağlantısı oluşturuldu.", url };
}

export async function deleteCustomerAction(formData: FormData) {
  await requireRole("customers");
  const email = String(formData.get("email") ?? "");
  if (!email) return;
  const removed = await adminDeleteCustomer(email);
  // Only record real deletions — a no-op delete shouldn't muddy the audit log.
  if (removed) {
    await logAudit({
      action: "delete",
      entity: "customer",
      entityId: email,
    });
  }
  revalidatePath("/admin/musteriler");
  revalidatePath("/admin");
  redirect("/admin/musteriler");
}
