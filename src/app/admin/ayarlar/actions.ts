"use server";

import { revalidatePath } from "next/cache";

import { logAudit } from "@/lib/admin/audit";
import { requireRole } from "@/lib/admin/auth";
import {
  DAYS_OF_WEEK,
  getSettings,
  updateSettings,
  type DayOfWeek,
  type WeeklyHours,
} from "@/lib/admin/store";

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
 * It used to fall back to 0, which turned "₺75" — a perfectly natural thing to
 * type into a price box — into free courier delivery for every order that
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

function parseTime(raw: unknown): string {
  const s = String(raw ?? "").trim();
  // Allow HH:MM or H:MM (00:00–24:00). Return normalized or fallback.
  const m = /^(\d{1,2}):(\d{2})$/.exec(s);
  if (!m) return "00:00";
  const h = Math.min(24, Math.max(0, parseInt(m[1], 10)));
  const min = Math.min(59, Math.max(0, parseInt(m[2], 10)));
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
  const weekly: WeeklyHours = {} as WeeklyHours;
  const summary: string[] = [];
  for (const day of DAYS_OF_WEEK) {
    const closed = formData.get(`${day}-closed`) === "on";
    const open = parseTime(formData.get(`${day}-open`));
    const close = parseTime(formData.get(`${day}-close`));
    weekly[day as DayOfWeek] = { open, close, closed };
    summary.push(closed ? `${day} Kapalı` : `${day} ${open}–${close}`);
  }
  const before = await getSettings();
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
  // Cafe delivery (mobile app): a flat courier fee, never free — the
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
  const before = await getSettings();
  await updateSettings({
    karaokeHourlyMinor: hourlyMinor,
    karaokeCapacity: capacity,
  });
  revalidateAll();
  return ok("karaoke", "Karaoke ayarları kaydedildi.", {
    before: {
      karaokeHourlyMinor: before.karaokeHourlyMinor,
      karaokeCapacity: before.karaokeCapacity,
    },
    after: { karaokeHourlyMinor: hourlyMinor, karaokeCapacity: capacity },
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

export async function saveNotificationsAction(
  _prev: SettingsState,
  formData: FormData,
): Promise<SettingsState> {
  await requireRole("settings");
  const email = String(formData.get("notificationEmail") ?? "").trim();
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { error: "Geçerli bir e-posta gir." };
  }
  await updateSettings({ notificationEmail: email });
  revalidateAll();
  return ok("notifications", "Bildirim ayarları kaydedildi.");
}
