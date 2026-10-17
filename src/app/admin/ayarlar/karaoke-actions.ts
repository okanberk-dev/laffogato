"use server";

import { requireRole } from "@/lib/admin/auth";
import { getSettings, updateSettings } from "@/lib/admin/store";
import { MONEY_TOO_LARGE_ERROR } from "@/lib/utils/format";

import {
  changedKeys,
  EMAIL_RE,
  NO_CHANGE,
  ok,
  readMoney,
  readWholeNumber,
  refuse,
  revalidateAll,
} from "./action-helpers";
import type { SettingsState } from "./settings-core";

export async function saveKaraokeAction(
  _prev: SettingsState,
  formData: FormData,
): Promise<SettingsState> {
  await requireRole("settings");
  const hourly = readMoney(formData.get("karaokeHourly"));
  if (!hourly.ok || hourly.minor <= 0) {
    return refuse(
      !hourly.ok && hourly.tooLarge
        ? MONEY_TOO_LARGE_ERROR
        : "Karaoke saatlik ücreti sıfırdan büyük bir sayı olmalı.",
      "karaokeHourly",
    );
  }
  // Digits only: parseInt read "8.5" as 8 and "8 kişi" as 8 without a word.
  const capacity = readWholeNumber(formData.get("karaokeCapacity"));
  if (capacity === null || capacity < 1 || capacity > 50) {
    return refuse(
      "Karaoke kapasitesi 1 ile 50 arasında tam sayı olmalı.",
      "karaokeCapacity",
    );
  }
  const notifyEmail = String(formData.get("karaokeNotifyEmail") ?? "").trim();
  if (
    notifyEmail &&
    (!EMAIL_RE.test(notifyEmail) || notifyEmail.length > 254)
  ) {
    return refuse(
      "Talep bildirimi için geçerli bir e-posta gir.",
      "karaokeNotifyEmail",
    );
  }
  // The online-prepayment switch (16 Eki 2026). A checkbox: absent = off.
  const prepay = formData.get("karaokePrepay") === "on";
  const next = {
    karaokeHourlyMinor: hourly.minor,
    karaokeCapacity: capacity,
    karaokeNotifyEmail: notifyEmail,
    karaokePrepay: prepay,
  };
  const before = await getSettings();
  const moved = changedKeys(before, next);
  if (!moved) return NO_CHANGE;
  await updateSettings(next);
  revalidateAll();
  return ok("karaoke", "Karaoke ayarları kaydedildi.", moved);
}
