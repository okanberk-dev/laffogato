"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  actionError,
  actionOk,
  type ActionResult,
} from "@/lib/admin/action-result";
import { logAudit } from "@/lib/admin/audit";
import { parseMoneyInput } from "@/lib/utils/format";
import { requireRole } from "@/lib/admin/auth";
import { customerEditSchema } from "@/lib/admin/customer-schema";
import { setAdminFlash } from "@/lib/admin/flash";
import {
  grantCoupon,
  revokeCustomerCoupon,
  type CouponKind,
} from "@/lib/customer/coupons";
import {
  adminUpdateCustomer,
  createVerificationToken,
  getCustomerByEmail,
  setCustomerActive,
} from "@/lib/customer/store";
import { sendVerificationEmail } from "@/lib/email/send";
import { deleteMe, type DeleteMeResult } from "@/lib/mobile/me";
import { SITE } from "@/lib/seo/site";
import { hasServiceRole } from "@/lib/supabase/admin";

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
  await setAdminFlash("Üye bilgileri kaydedildi.");
  redirect(`/admin/musteriler/${encodeURIComponent(email)}`);
}

/**
 * "Hesabı pasifleştir" (behind a confirm) and "Hesabı yeniden aktifleştir".
 * It used to answer nothing at all, so a refused or failed toggle looked
 * exactly like a slow page.
 */
export async function setCustomerActiveAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  await requireRole("customers");
  const email = String(formData.get("email") ?? "");
  const active = String(formData.get("active") ?? "") === "1";
  if (!email) return actionError("E-posta eksik.");
  const updated = await setCustomerActive(email, active);
  if (!updated) return actionError("Üye hesabı bulunamadı.");
  await logAudit({
    action: "update",
    entity: "customer",
    entityId: email,
    payload: { isActive: active },
  });
  revalidateCustomer(email);
  return actionOk(
    active
      ? "Hesap yeniden aktif."
      : "Hesap pasifleştirildi. Üye artık giriş yapamaz.",
  );
}

export interface ResendVerificationState {
  error?: string;
  message?: string;
  /** The verification link - surfaced so the admin can share it directly. */
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

/**
 * Ceiling for a hand-granted fixed-value coupon, in TL.
 *
 * Not a business rule so much as a fat-finger guard: the panel had none, and a
 * mistyped amount is spendable the moment the member opens the app.
 */
const FIXED_COUPON_MAX_MAJOR = 2000;

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
  // parseMoneyInput, not parseFloat(replace(",", ".")): that read "1.250,00"
  // as 1.25. Values are compared in major units below, hence the /100.
  const valueMinor = parseMoneyInput(String(formData.get("value") ?? ""));
  const rawValue = valueMinor === null ? NaN : valueMinor / 100;
  const minText = String(formData.get("minSubtotal") ?? "").trim();
  const minMinor = minText === "" ? 0 : parseMoneyInput(minText);
  if (minMinor === null) {
    return {
      error: "Geçerli bir alt sepet tutarı gir (ör. 250 ya da 1.250,00).",
    };
  }
  const rawMin = minMinor / 100;
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
  // A fixed coupon was only checked for "> 0", so a slipped zero granted a
  // 100.000 TL credit that the next order would happily spend. Nothing the
  // café hands out at the counter is worth more than this.
  if (kind === "fixed" && rawValue > FIXED_COUPON_MAX_MAJOR) {
    return {
      error: `Tutar indirimi en fazla ${FIXED_COUPON_MAX_MAJOR} TL olabilir.`,
    };
  }
  const value =
    kind === "pct" ? Math.round(rawValue) : Math.round(rawValue * 100);
  const minSubtotalMinor =
    Number.isFinite(rawMin) && rawMin > 0 ? Math.round(rawMin * 100) : 0;

  let expiresAt = "";
  if (expiresRaw) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(expiresRaw);
    if (!m) return { error: "Geçersiz son kullanma tarihi." };
    // End of the chosen ISTANBUL day.
    //
    // `new Date(y, m, d, 23, 59, 59)` is the process timezone, and the
    // functions run in UTC, so the coupon printed "31 Ağustos'a kadar" stayed
    // alive until 02:59 on 1 September Istanbul time. Türkiye has been on a
    // fixed UTC+3 since 2016, so the offset is a constant, not a lookup.
    expiresAt = `${m[1]}-${m[2]}-${m[3]}T20:59:59.000Z`;
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

/**
 * Remove a coupon from a member (admin), behind a confirm. A stamp-card or
 * milestone coupon is deactivated rather than deleted (revokeCustomerCoupon).
 */
export async function revokeCustomerCouponAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  await requireRole("customers");
  const id = String(formData.get("id") ?? "");
  const email = String(formData.get("email") ?? "");
  if (!id) return actionError("Kupon seçilmedi.");
  const removed = await revokeCustomerCoupon(id);
  if (email) revalidateCustomer(email);
  if (!removed) {
    return actionError("Bu kupon zaten kullanılmış ya da kaldırılmış.");
  }
  await logAudit({ action: "delete", entity: "coupon", entityId: id });
  return actionOk("Kupon kaldırıldı, artık kullanılamaz.");
}

/**
 * "Hesabı sil": the same closure the member's own deletion runs (`deleteMe`,
 * shared by the app's `DELETE /me` and the site's /uye/hesap/sil).
 *
 * It used to delete the `customers` row and nothing else: a paid future
 * karaoke booking stayed held for a member who no longer existed, the
 * barista grant on the address survived for whoever registered it next, and
 * the orders, stamps, coupons and invites kept the live address. `deleteMe`
 * cancels (and refunds) future karaoke, removes the barista grant and every
 * other keyed row, anonymises the account and its records, deletes the saved
 * cards at the POS and the Supabase identity. Like the member's own route it
 * waits for an order in flight (Üyelik Sözleşmesi §14).
 *
 * Irreversible, so the member's e-mail has to be typed (`confirm`), checked
 * here as well as in the dialog. The audit row names the account by its id:
 * the address is the very thing being erased.
 */
export async function closeCustomerAccountAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  await requireRole("customers");
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  if (!email) return actionError("E-posta eksik.");
  const typed = String(formData.get("confirm") ?? "")
    .trim()
    .toLowerCase();
  if (typed !== email) {
    return actionError("Onay için üyenin e-posta adresini birebir yaz.");
  }
  const customer = await getCustomerByEmail(email);
  if (!customer) return actionError("Üye hesabı bulunamadı.");

  let result: DeleteMeResult;
  try {
    result = await deleteMe(customer, { by: "admin" });
  } catch (err) {
    // deleteMe throws only before the member row is rewritten (reading the
    // orders, or that write itself): the account is still open and a retry
    // runs every step again safely. The future karaoke may already be
    // cancelled and refunded and the saved cards dropped at the POS; both
    // leave their own record, this row says the closure did not finish.
    console.error(
      `[admin] account closure failed ${customer.id}: ${err instanceof Error ? err.message : "unknown error"}`,
    );
    try {
      await logAudit({
        action: "update",
        entity: "customer",
        entityId: customer.id,
        payload: { closedBy: "admin", closure: "failed" },
      });
    } catch {
      // The database that just failed may refuse this row too; the answer
      // below still tells the operator.
    }
    return actionError(
      "Hesap kapatılamadı, üye kaydı değişmedi. Gelecekteki karaoke rezervasyonları iptal edilip iade edilmiş, kayıtlı kartlar silinmiş olabilir. Biraz sonra yeniden dene.",
    );
  }
  if (!result.ok) {
    return actionError(
      `Bu üyenin devam eden ${result.count} siparişi var. Siparişler tamamlanınca ya da iptal edilince hesabı kapatabilirsin.`,
    );
  }
  await logAudit({
    action: "delete",
    entity: "customer",
    entityId: customer.id,
    payload: { closedBy: "admin", identity: result.identity },
  });
  revalidatePath("/admin/musteriler");
  revalidatePath("/admin/kullanicilar");
  revalidatePath("/admin/mobil/karaoke");
  revalidatePath("/admin");
  if (result.identity === "failed") {
    // Supabase refused or did not answer in time: the account is closed and
    // anonymised here, the sign-in identity (e-mail and name) may still
    // exist there.
    await setAdminFlash(
      "Hesap kapatıldı ve kişisel veriler anonimleştirildi, ama Supabase'deki giriş kimliği silinemedi (hata ya da yanıt yok). Supabase'de elle sil.",
      "warning",
    );
  } else if (result.identity === "skipped" && !hasServiceRole()) {
    // Without the service-role key every closure skips the identity: an
    // app member's e-mail and name stay in Supabase. Saying only "closed"
    // here read as if nothing of them was left.
    await setAdminFlash(
      "Hesap kapatıldı ve kişisel veriler anonimleştirildi. Supabase anahtarı tanımlı değil: üyenin uygulama giriş kimliği varsa Supabase'de duruyor, orada elle sil.",
      "warning",
    );
  } else {
    await setAdminFlash(
      result.identity === "deleted"
        ? "Hesap kapatıldı. Kişisel veriler anonimleştirildi, giriş kimliği silindi."
        : "Hesap kapatıldı. Kişisel veriler anonimleştirildi.",
    );
  }
  redirect("/admin/musteriler");
}
