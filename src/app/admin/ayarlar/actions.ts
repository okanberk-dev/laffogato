"use server";

import { revalidatePath } from "next/cache";

import { logAudit } from "@/lib/admin/audit";
import { requireRole } from "@/lib/admin/auth";
import {
  DAYS_OF_WEEK,
  updateSettings,
  type DayOfWeek,
  type WeeklyHours,
} from "@/lib/admin/store";

export interface SettingsState {
  message?: string;
  error?: string;
}

async function ok(section: string, message: string): Promise<SettingsState> {
  await logAudit({
    action: "update",
    entity: "settings",
    entityId: section,
  });
  return { message };
}

function revalidateAll() {
  revalidatePath("/admin/ayarlar");
  revalidatePath("/admin");
  revalidatePath("/");
}

function parseMoneyMinor(raw: unknown): number {
  const s = String(raw ?? "")
    .replace(",", ".")
    .trim();
  if (!s) return 0;
  const v = parseFloat(s);
  if (!Number.isFinite(v) || v < 0) return 0;
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
  await updateSettings({
    weeklyHours: weekly,
    openingHours: summary.join(" · "),
  });
  revalidateAll();
  return ok("hours", "Çalışma saatleri kaydedildi.");
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
  await updateSettings({ taxRatePct: Math.round(v * 100) / 100 });
  revalidateAll();
  return ok("tax", "Vergi oranı kaydedildi.");
}

export async function saveShippingAction(
  _prev: SettingsState,
  formData: FormData,
): Promise<SettingsState> {
  await requireRole("settings");
  await updateSettings({
    shippingFlatMinor: parseMoneyMinor(formData.get("shippingFlat")),
    shippingFreeThresholdMinor: parseMoneyMinor(
      formData.get("shippingFreeThreshold"),
    ),
  });
  revalidateAll();
  return ok("shipping", "Kargo ayarları kaydedildi.");
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
