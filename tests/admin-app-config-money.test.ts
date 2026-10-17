import { beforeEach, describe, expect, it, vi } from "vitest";

import { DEFAULT_MOBILE_APP_CONFIG } from "@/lib/mobile/app-config";

/**
 * Mobil → Ayarlar → Sadakat: the reward coupon's value. It was read with
 * parseFloat after one comma swap, so "1.000" (how the panel prints a
 * thousand lira) became a 1,00 TL coupon and "12abc" became 12 TL. It now
 * goes through parseMoneyInput like every other amount in the panel.
 */

const updateSettings = vi.fn(async () => ({}));
vi.mock("@/lib/admin/auth", () => ({ requireRole: vi.fn(async () => ({})) }));
vi.mock("@/lib/admin/audit", () => ({ logAudit: vi.fn(async () => {}) }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/admin/store", () => ({
  getSettings: vi.fn(async () => ({ mobileApp: DEFAULT_MOBILE_APP_CONFIG })),
  updateSettings,
}));

const { saveLoyaltyAction } = await import("@/app/admin/mobil/ayarlar/actions");

function loyalty(rewardValue: string): FormData {
  const fd = new FormData();
  fd.set("stampTarget", "10");
  fd.set("rewardTitle", "Bir kahve bizden");
  fd.set("rewardValue", rewardValue);
  fd.set("rewardTtlDays", "30");
  return fd;
}

function savedRewardMinor(): number {
  const calls = updateSettings.mock.calls as unknown as Array<
    [{ mobileApp: { loyalty: { rewardValueMinor: number } } }]
  >;
  return calls[calls.length - 1][0].mobileApp.loyalty.rewardValueMinor;
}

beforeEach(() => {
  updateSettings.mockClear();
});

describe("saveLoyaltyAction reward value", () => {
  it("reads 1.000 as a thousand lira, not one", async () => {
    const res = await saveLoyaltyAction({}, loyalty("1.000"));
    expect(res.error).toBeUndefined();
    expect(savedRewardMinor()).toBe(100_000);
  });

  it("reads 85, 85,50 and the form's own 85.50", async () => {
    for (const [typed, minor] of [
      ["85", 8500],
      ["85,50", 8550],
      ["85.50", 8550],
    ] as const) {
      await saveLoyaltyAction({}, loyalty(typed));
      expect(savedRewardMinor(), typed).toBe(minor);
    }
  });

  it("refuses what it cannot read instead of keeping the digits in front", async () => {
    for (const typed of ["12abc", "1,250.00", ""]) {
      const res = await saveLoyaltyAction({}, loyalty(typed));
      expect(res.error, typed).toBeTruthy();
    }
    expect(updateSettings).not.toHaveBeenCalled();
  });
});
