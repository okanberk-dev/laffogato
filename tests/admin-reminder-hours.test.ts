import { describe, expect, it, vi } from "vitest";

import {
  APP_CONFIG_LIMITS,
  DEFAULT_MOBILE_APP_CONFIG,
} from "@/lib/mobile/app-config";

const updateSettings = vi.fn(async () => ({}));
vi.mock("@/lib/admin/auth", () => ({ requireRole: vi.fn(async () => ({})) }));
vi.mock("@/lib/admin/audit", () => ({ logAudit: vi.fn(async () => {}) }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/admin/store", () => ({
  getSettings: vi.fn(async () => ({ mobileApp: DEFAULT_MOBILE_APP_CONFIG })),
  updateSettings,
}));

const { saveRemindersAction } =
  await import("@/app/admin/mobil/ayarlar/actions");

function form(hour: string): FormData {
  const fd = new FormData();
  fd.set("remindersEnabled", "on");
  fd.set("reminder-0-id", "morning");
  fd.set("reminder-0-hour", hour);
  fd.set("reminder-0-minute", "30");
  fd.set("reminder-0-title", "Günaydın");
  fd.set("reminder-0-body", "Sabah kahven köşkte hazır.");
  return fd;
}

/**
 * The app drops a reminder outside 08-21 on read (lafmobil REMINDER_HOURS),
 * so one the panel saved for 07:30 or 22:00 was never scheduled and nobody
 * was told. The panel now refuses it with a message under the field.
 */
describe("reminder hours", () => {
  it("match the app's quiet-hour window", () => {
    expect(APP_CONFIG_LIMITS.reminderHourMin).toBe(8);
    expect(APP_CONFIG_LIMITS.reminderHourMax).toBe(21);
    for (const it of DEFAULT_MOBILE_APP_CONFIG.reminders.items) {
      expect(it.hour).toBeGreaterThanOrEqual(8);
      expect(it.hour).toBeLessThanOrEqual(21);
    }
  });

  it("refuses a reminder the app would silently drop", async () => {
    for (const hour of ["7", "22", "3"]) {
      const res = await saveRemindersAction({}, form(hour));
      expect(res.error, hour).toMatch(/Hatırlatma saati/);
    }
    expect(updateSettings).not.toHaveBeenCalled();
  });

  it("saves one inside the window", async () => {
    const res = await saveRemindersAction({}, form("21"));
    expect(res.error).toBeUndefined();
    expect(updateSettings).toHaveBeenCalled();
  });
});
