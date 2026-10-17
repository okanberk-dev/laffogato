"use server";

import { requireRole } from "@/lib/admin/auth";
import { getSettings, updateSettings } from "@/lib/admin/store";

import { ok, parseMoneyMinor, revalidateAll } from "./action-helpers";
import type { SettingsState } from "./settings-core";

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
  // The online-prepayment switch (16 Eki 2026). A checkbox: absent = off.
  const prepay = formData.get("karaokePrepay") === "on";
  const before = await getSettings();
  await updateSettings({
    karaokeHourlyMinor: hourlyMinor,
    karaokeCapacity: capacity,
    karaokeNotifyEmail: notifyEmail,
    karaokePrepay: prepay,
  });
  revalidateAll();
  return ok("karaoke", "Karaoke ayarları kaydedildi.", {
    before: {
      karaokeHourlyMinor: before.karaokeHourlyMinor,
      karaokeCapacity: before.karaokeCapacity,
      karaokeNotifyEmail: before.karaokeNotifyEmail,
      karaokePrepay: before.karaokePrepay,
    },
    after: {
      karaokeHourlyMinor: hourlyMinor,
      karaokeCapacity: capacity,
      karaokeNotifyEmail: notifyEmail,
      karaokePrepay: prepay,
    },
  });
}
