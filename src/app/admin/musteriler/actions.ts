"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { logAudit } from "@/lib/admin/audit";
import { requireRole } from "@/lib/admin/auth";
import { customerEditSchema } from "@/lib/admin/customer-schema";
import {
  grantCoupon,
  revokeCustomerCoupon,
  type CouponKind,
} from "@/lib/customer/coupons";
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

export interface CouponGrantState {
  error?: string;
  message?: string;
}

/** Hand-grant a single-use coupon to a member (admin "Kupon tanımla" form). */
export async function grantCustomerCouponAction(
  email: string,
  _prev: CouponGrantState,
  formData: FormData,
): Promise<CouponGrantState> {
  await requireRole("customers");
  if (!email) return { error: "E-posta eksik." };

  const kind: CouponKind =
    String(formData.get("kind") ?? "pct") === "fixed" ? "fixed" : "pct";
  const rawValue = parseFloat(
    String(formData.get("value") ?? "").replace(",", "."),
  );
  const rawMin = parseFloat(
    String(formData.get("minSubtotal") ?? "0").replace(",", "."),
  );
  const title = String(formData.get("title") ?? "")
    .trim()
    .slice(0, 80);
  const expiresRaw = String(formData.get("expiresAt") ?? "").trim();

  if (!Number.isFinite(rawValue) || rawValue <= 0) {
    return { error: "Geçerli bir indirim değeri gir." };
  }
  if (kind === "pct" && (rawValue < 1 || rawValue > 100)) {
    return { error: "Yüzde indirimi 1-100 arası olmalı." };
  }
  const value =
    kind === "pct" ? Math.round(rawValue) : Math.round(rawValue * 100);
  const minSubtotalMinor =
    Number.isFinite(rawMin) && rawMin > 0 ? Math.round(rawMin * 100) : 0;

  let expiresAt = "";
  if (expiresRaw) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(expiresRaw);
    if (!m) return { error: "Geçersiz son kullanma tarihi." };
    // End of the chosen local day.
    expiresAt = new Date(
      Number(m[1]),
      Number(m[2]) - 1,
      Number(m[3]),
      23,
      59,
      59,
    ).toISOString();
  }

  const coupon = await grantCoupon({
    email,
    kind,
    value,
    minSubtotalMinor,
    title: title || (kind === "pct" ? `%${value} indirim` : "İndirim kuponu"),
    source: "manual",
    expiresAt,
  });
  await logAudit({
    action: "create",
    entity: "coupon",
    entityId: coupon.code,
    payload: { customer: email, kind, value },
  });
  revalidateCustomer(email);
  return { message: `Kupon tanımlandı: ${coupon.code}` };
}

/** Remove a coupon from a member (admin). */
export async function revokeCustomerCouponAction(formData: FormData) {
  await requireRole("customers");
  const id = String(formData.get("id") ?? "");
  const email = String(formData.get("email") ?? "");
  if (!id) return;
  const removed = await revokeCustomerCoupon(id);
  if (removed) {
    await logAudit({ action: "delete", entity: "coupon", entityId: id });
  }
  if (email) revalidateCustomer(email);
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
