"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { logAudit } from "@/lib/admin/audit";
import { requireRole } from "@/lib/admin/auth";
import {
  DAYS_OF_WEEK,
  getSettings,
  updateSettings,
  type DayOfWeek,
  type WeeklyHours,
} from "@/lib/admin/store";
import { ADMIN_ROLES } from "@/lib/admin/roles";
import { sendTestEmail } from "@/lib/email/send";
import {
  MAX_ORDER_NOTIFY_EMAILS,
  parseNotifyEmails,
} from "@/lib/email/staff-order-notice-core";
import { forgetEmailHealth } from "@/lib/email/health";

export interface SettingsState {
  message?: string;
  error?: string;
}

/**
 * Audit row for a settings change.
 *
 * `payload` carries the before/after of the keys that actually moved: the
 * section name alone ("shipping") does not let anyone reconstruct what a
 * courier fee was yesterday, which is the whole point of Olay kaydı for
 * numbers that price live orders.
 */
async function ok(
  section: string,
  message: string,
  payload?: Record<string, unknown>,
): Promise<SettingsState> {
  await logAudit({
    action: "update",
    entity: "settings",
    entityId: section,
    payload: payload ? { section, ...payload } : { section },
  });
  return { message };
}

function revalidateAll() {
  revalidatePath("/admin/ayarlar");
  revalidatePath("/admin");
  revalidatePath("/");
}

/**
 * Money in kuruş, or null when the field is not a plain non-negative number.
 *
 * It used to fall back to 0, which turned "₺75" - a perfectly natural thing to
 * type into a price box - into free courier delivery for every order that
 * evening, silently. A bad number is now an error the operator sees.
 */
function parseMoneyMinor(raw: unknown): number | null {
  const s = String(raw ?? "")
    .replace(",", ".")
    .trim();
  if (!s) return null;
  // parseFloat("75 TL") is 75; require the whole field to be a number.
  if (!/^\d+(\.\d+)?$/.test(s)) return null;
  const v = parseFloat(s);
  if (!Number.isFinite(v) || v < 0) return null;
  return Math.round(v * 100);
}

/**
 * "HH:MM" (or "H:MM") within 00:00-23:59, normalised; null for anything
 * else, which the action turns into the form's error.
 *
 * It used to clamp: "24:00", "99:99" or a hand-made POST came out as a
 * stored "24:00" / "24:59", and garbage became "00:00" - a midnight close
 * the operator never typed. A close at midnight is "00:00": the hours
 * reader treats a close not later than the open as running past midnight.
 */
function parseTime(raw: unknown): string | null {
  const s = String(raw ?? "").trim();
  const m = /^(\d{1,2}):(\d{2})$/.exec(s);
  if (!m) return null;
  const h = parseInt(m[1], 10);
  const min = parseInt(m[2], 10);
  if (h > 23 || min > 59) return null;
  return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
}

export async function saveGeneralAction(
  _prev: SettingsState,
  formData: FormData,
): Promise<SettingsState> {
  await requireRole("settings");
  const name = String(formData.get("name") ?? "").trim();
  if (name.length < 2) return { error: "Kafe adı en az 2 karakter olmalı." };

  await updateSettings({
    name,
    tagline: String(formData.get("tagline") ?? "").trim(),
    phone: String(formData.get("phone") ?? "").trim(),
    email: String(formData.get("email") ?? "").trim(),
    address: String(formData.get("address") ?? "").trim(),
    heroImageUrl: String(formData.get("heroImageUrl") ?? "").trim(),
    isShopOpen: formData.get("isShopOpen") === "on",
  });
  revalidateAll();
  return ok("general", "Genel bilgiler kaydedildi.");
}

export async function saveHoursAction(
  _prev: SettingsState,
  formData: FormData,
): Promise<SettingsState> {
  await requireRole("settings");
  const before = await getSettings();
  const weekly: WeeklyHours = {} as WeeklyHours;
  const summary: string[] = [];
  for (const day of DAYS_OF_WEEK) {
    const closed = formData.get(`${day}-closed`) === "on";
    const rawOpen = String(formData.get(`${day}-open`) ?? "").trim();
    const rawClose = String(formData.get(`${day}-close`) ?? "").trim();
    // A day ticked "Kapalı" may have its time boxes cleared; it keeps the
    // hours it had rather than failing the whole form over them.
    const kept = before.weeklyHours?.[day as DayOfWeek];
    const open =
      closed && !rawOpen ? (kept?.open ?? "00:00") : parseTime(rawOpen);
    const close =
      closed && !rawClose ? (kept?.close ?? "00:00") : parseTime(rawClose);
    if (open === null || close === null) {
      return {
        error:
          "Saatler 00:00 ile 23:59 arasında olmalı (ss:dd). Gece yarısı kapanış için 00:00 yaz.",
      };
    }
    weekly[day as DayOfWeek] = { open, close, closed };
    summary.push(closed ? `${day} Kapalı` : `${day} ${open}-${close}`);
  }
  await updateSettings({
    weeklyHours: weekly,
    openingHours: summary.join(" · "),
  });
  revalidateAll();
  return ok("hours", "Çalışma saatleri kaydedildi.", {
    before: { openingHours: before.openingHours },
    after: { openingHours: summary.join(" · ") },
  });
}

export async function saveTaxAction(
  _prev: SettingsState,
  formData: FormData,
): Promise<SettingsState> {
  await requireRole("settings");
  const raw = String(formData.get("taxRatePct") ?? "")
    .replace(",", ".")
    .trim();
  const v = parseFloat(raw);
  if (!Number.isFinite(v) || v < 0 || v > 100) {
    return { error: "Vergi oranı 0 ile 100 arasında olmalı." };
  }
  const taxRatePct = Math.round(v * 100) / 100;
  const before = await getSettings();
  await updateSettings({ taxRatePct });
  revalidateAll();
  return ok("tax", "Vergi oranı kaydedildi.", {
    before: { taxRatePct: before.taxRatePct },
    after: { taxRatePct },
  });
}

export async function saveShippingAction(
  _prev: SettingsState,
  formData: FormData,
): Promise<SettingsState> {
  await requireRole("settings");
  const shippingFlatMinor = parseMoneyMinor(formData.get("shippingFlat"));
  if (shippingFlatMinor === null) {
    return { error: "Kargo ücreti sayı olmalı (örn. 49 ya da 49,90)." };
  }
  const shippingFreeThresholdMinor = parseMoneyMinor(
    formData.get("shippingFreeThreshold"),
  );
  if (shippingFreeThresholdMinor === null) {
    return { error: "Ücretsiz kargo eşiği sayı olmalı (0 = kapalı)." };
  }
  // Cafe delivery (mobile app): a flat courier fee, never free - the
  // free-shipping threshold above applies to shop parcels only. Zero would
  // make every kurye order ship free, so it is rejected rather than stored.
  const courierFeeMinor = parseMoneyMinor(formData.get("courierFee"));
  if (courierFeeMinor === null || courierFeeMinor <= 0) {
    return { error: "Kurye ücreti sıfırdan büyük bir sayı olmalı." };
  }

  const before = await getSettings();
  await updateSettings({
    shippingFlatMinor,
    shippingFreeThresholdMinor,
    courierFeeMinor,
  });
  revalidateAll();
  return ok("shipping", "Kargo ve kurye ayarları kaydedildi.", {
    before: {
      shippingFlatMinor: before.shippingFlatMinor,
      shippingFreeThresholdMinor: before.shippingFreeThresholdMinor,
      courierFeeMinor: before.courierFeeMinor,
    },
    after: {
      shippingFlatMinor,
      shippingFreeThresholdMinor,
      courierFeeMinor,
    },
  });
}

export async function saveKaraokeAction(
  _prev: SettingsState,
  formData: FormData,
): Promise<SettingsState> {
  await requireRole("settings");
  const hourlyMinor = parseMoneyMinor(formData.get("karaokeHourly"));
  if (hourlyMinor === null || hourlyMinor <= 0) {
    return { error: "Karaoke saatlik ücreti sıfırdan büyük bir sayı olmalı." };
  }
  const capacity = parseInt(String(formData.get("karaokeCapacity") ?? ""), 10);
  if (!Number.isFinite(capacity) || capacity < 1 || capacity > 50) {
    return { error: "Karaoke kapasitesi 1 ile 50 arasında olmalı." };
  }
  const notifyEmail = String(formData.get("karaokeNotifyEmail") ?? "").trim();
  if (notifyEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(notifyEmail)) {
    return { error: "Talep bildirimi için geçerli bir e-posta gir." };
  }
  const before = await getSettings();
  await updateSettings({
    karaokeHourlyMinor: hourlyMinor,
    karaokeCapacity: capacity,
    karaokeNotifyEmail: notifyEmail,
  });
  revalidateAll();
  return ok("karaoke", "Karaoke ayarları kaydedildi.", {
    before: {
      karaokeHourlyMinor: before.karaokeHourlyMinor,
      karaokeCapacity: before.karaokeCapacity,
      karaokeNotifyEmail: before.karaokeNotifyEmail,
    },
    after: {
      karaokeHourlyMinor: hourlyMinor,
      karaokeCapacity: capacity,
      karaokeNotifyEmail: notifyEmail,
    },
  });
}

export async function saveSeoAction(
  _prev: SettingsState,
  formData: FormData,
): Promise<SettingsState> {
  await requireRole("settings");
  const seoTitle = String(formData.get("seoTitle") ?? "").trim();
  const ogImage = String(formData.get("seoOgImageUrl") ?? "").trim();
  if (ogImage && !/^https?:\/\//i.test(ogImage)) {
    return { error: "Open Graph görseli http(s) URL olmalı." };
  }
  await updateSettings({
    seoTitle,
    seoOgImageUrl: ogImage,
    seoIndexable: formData.get("seoIndexable") === "on",
  });
  revalidateAll();
  return ok("seo", "SEO ayarları kaydedildi.");
}

const notificationsSchema = z.object({
  notificationEmail: z
    .string()
    .trim()
    .max(254, { error: "Operasyon e-postası çok uzun." })
    .refine((v) => !v || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), {
      error: "Geçerli bir e-posta gir.",
    }),
  orderNotifyEnabled: z.boolean(),
  orderNotifyRoles: z
    .array(z.enum(ADMIN_ROLES as [string, ...string[]]), {
      error: "Rol seçimi geçersiz.",
    })
    .max(ADMIN_ROLES.length),
  orderNotifyEmails: z
    .string()
    .max(4000, { error: "Ek adres listesi çok uzun." })
    .transform((raw, ctx) => {
      const { valid, invalid } = parseNotifyEmails(raw);
      if (invalid.length > 0) {
        ctx.addIssue({
          code: "custom",
          message: `Geçersiz e-posta: ${invalid.slice(0, 3).join(", ")}`,
        });
        return z.NEVER;
      }
      if (valid.length > MAX_ORDER_NOTIFY_EMAILS) {
        ctx.addIssue({
          code: "custom",
          message: `En fazla ${MAX_ORDER_NOTIFY_EMAILS} ek adres yazılabilir.`,
        });
        return z.NEVER;
      }
      // Stored one per line, normalised, so the panel shows what is used.
      return valid.join("\n");
    }),
});

/**
 * Ayarlar → Bildirimler: the operations address and who gets the staff
 * "yeni sipariş" mail (`src/lib/email/staff-order-notice.ts`). Owner only,
 * like every settings tab. The audit row keeps the before/after of the
 * switch and the roles. The addresses are not logged as text, but enough of
 * them is to see a redirect: whether the operations address and the extra
 * list changed, how many addresses were added and removed, and the domains
 * on each side - so "kasa@laffogato.net" swapped for an outside inbox shows
 * as a new domain rather than as a no-op save of one address.
 */
export async function saveNotificationsAction(
  _prev: SettingsState,
  formData: FormData,
): Promise<SettingsState> {
  await requireRole("settings");
  const parsed = notificationsSchema.safeParse({
    notificationEmail: String(formData.get("notificationEmail") ?? ""),
    orderNotifyEnabled: formData.get("orderNotifyEnabled") === "on",
    orderNotifyRoles: formData
      .getAll("orderNotifyRoles")
      .map((v) => String(v)),
    orderNotifyEmails: String(formData.get("orderNotifyEmails") ?? ""),
  });
  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "Bildirim ayarları geçersiz.",
    };
  }
  const roles = ADMIN_ROLES.filter((r) =>
    parsed.data.orderNotifyRoles.includes(r),
  );
  const before = await getSettings();
  await updateSettings({
    notificationEmail: parsed.data.notificationEmail,
    orderNotifyEnabled: parsed.data.orderNotifyEnabled,
    orderNotifyRoles: roles,
    orderNotifyEmails: parsed.data.orderNotifyEmails,
  });
  revalidateAll();
  const list = (s: string) => parseNotifyEmails(s).valid;
  const beforeList = list(before.orderNotifyEmails ?? "");
  const afterList = list(parsed.data.orderNotifyEmails);
  const beforeOps = (before.notificationEmail ?? "").trim().toLowerCase();
  const afterOps = parsed.data.notificationEmail.trim().toLowerCase();
  return ok("notifications", "Bildirim ayarları kaydedildi.", {
    before: {
      orderNotifyEnabled: before.orderNotifyEnabled,
      orderNotifyRoles: before.orderNotifyRoles,
      orderNotifyEmailCount: beforeList.length,
      orderNotifyEmailDomains: notifyDomains(beforeList),
      notificationEmailDomain: notifyDomains([beforeOps])[0] ?? "",
    },
    after: {
      orderNotifyEnabled: parsed.data.orderNotifyEnabled,
      orderNotifyRoles: roles,
      orderNotifyEmailCount: afterList.length,
      orderNotifyEmailDomains: notifyDomains(afterList),
      notificationEmailDomain: notifyDomains([afterOps])[0] ?? "",
    },
    changed: {
      notificationEmail: beforeOps !== afterOps,
      orderNotifyEmails:
        beforeList.length !== afterList.length ||
        beforeList.some((e) => !afterList.includes(e)),
      orderNotifyEmailsAdded: afterList.filter((e) => !beforeList.includes(e))
        .length,
      orderNotifyEmailsRemoved: beforeList.filter((e) => !afterList.includes(e))
        .length,
    },
  });
}

/** The sorted, distinct domains of a list of addresses - never the local part. */
function notifyDomains(emails: readonly string[]): string[] {
  const out = new Set<string>();
  for (const e of emails) {
    const at = e.lastIndexOf("@");
    if (at > 0) out.add(e.slice(at + 1).toLowerCase());
  }
  return [...out].sort();
}

/**
 * Who transactional mail comes from.
 *
 * Resend refuses any address whose domain is not verified on the account, and
 * which domain that is changes outside this codebase - a DNS record added on
 * a Tuesday. Compiling the address in would mean a deploy each time; this is
 * the panel field that avoids one.
 */
export async function saveEmailSenderAction(
  _prev: SettingsState,
  formData: FormData,
): Promise<SettingsState> {
  await requireRole("settings");
  const emailFromName = String(formData.get("emailFromName") ?? "").trim();
  const emailFromAddress = String(formData.get("emailFromAddress") ?? "")
    .trim()
    .toLowerCase();
  const emailReplyTo = String(formData.get("emailReplyTo") ?? "")
    .trim()
    .toLowerCase();
  const looksLikeEmail = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
  if (emailFromAddress && !looksLikeEmail(emailFromAddress)) {
    return { error: "Gönderen adresi geçerli bir e-posta olmalı." };
  }
  if (emailReplyTo && !looksLikeEmail(emailReplyTo)) {
    return { error: "Yanıt adresi geçerli bir e-posta olmalı." };
  }
  await updateSettings({ emailFromName, emailFromAddress, emailReplyTo });
  // The banner is about the address that was just changed; a two-minute cache
  // would show the operator the old verdict on the new sender.
  forgetEmailHealth();
  revalidateAll();
  return ok("email", "E-posta gönderim ayarları kaydedildi.", {
    emailFromAddress,
  });
}

/**
 * Sends one mail and reports what the provider said.
 *
 * Every other path swallows a delivery failure on purpose - a customer must
 * not lose an order because mail bounced - so without this the operator's
 * only signal that nothing is arriving is that nothing is arriving.
 */
export async function sendTestEmailAction(
  _prev: SettingsState,
  formData: FormData,
): Promise<SettingsState> {
  await requireRole("settings");
  const to = String(formData.get("testEmailTo") ?? "")
    .trim()
    .toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
    return { error: "Test için geçerli bir e-posta gir." };
  }
  forgetEmailHealth();
  const result = await sendTestEmail(to);
  if (!result.ok) return { error: `Gönderilemedi - ${result.error}` };
  // The address is the point of the audit row: it is the one place a test
  // mail's recipient is recorded, and it left the building.
  return ok("email-test", `Test e-postası ${to} adresine gönderildi.`, { to });
}
