import { afterEach, describe, expect, it, vi } from "vitest";

import {
  PROMO_FIXED_MAX_MINOR,
  PROMO_USAGE_LIMIT_MAX,
  promoFormSchema,
} from "@/lib/admin/promo-schema";

/** The field the first refusal names, and its message. */
function refusal(input: Record<string, string>): [string, string] | null {
  const res = promoFormSchema.safeParse(input);
  if (res.success) return null;
  const issue = res.error.issues[0];
  return [issue.path.join("."), issue.message];
}

const base = {
  code: "YAZ25",
  kind: "fixed",
  valueFixed: "50",
  minSubtotal: "",
  usageLimit: "",
  expiresAt: "",
  isActive: "on",
};

describe("promo form", () => {
  it("stores expiry as the UTC instant of the Istanbul time typed", () => {
    // datetime-local has no offset; on a UTC server "23:59" meant 23:59 UTC
    // and the promo stayed valid until 02:59 the next morning in Tuzla.
    const out = promoFormSchema.parse({
      ...base,
      expiresAt: "2036-09-30T23:59",
    });
    expect(out.expiresAt).toBe("2036-09-30T20:59:00.000Z");
  });

  it("reads Turkish amounts the way the admin means them", () => {
    const out = promoFormSchema.parse({
      ...base,
      valueFixed: "1.250,00",
      minSubtotal: "2.000",
    });
    expect(out.value).toBe(125000);
    expect(out.minSubtotalMinor).toBe(200000);
  });

  it("refuses a minimum it cannot read instead of storing 0", () => {
    const res = promoFormSchema.safeParse({ ...base, minSubtotal: "1,250.00" });
    expect(res.success).toBe(false);
  });

  it("refuses an expiry that is not a time", () => {
    const res = promoFormSchema.safeParse({ ...base, expiresAt: "30.09.2026" });
    expect(res.success).toBe(false);
  });
});

describe("promo ceilings (a slipped key is refused under its field)", () => {
  it("caps a fixed discount at 2.000 TL", () => {
    expect(PROMO_FIXED_MAX_MINOR).toBe(200_000);
    expect(refusal({ ...base, valueFixed: "2.000" })).toBeNull();
    // "5000" typed for "50": every basket up to 5.000 TL free.
    expect(refusal({ ...base, valueFixed: "5000" })).toEqual([
      "valueFixed",
      "Sabit indirim en fazla 2.000 TL olabilir.",
    ]);
  });

  it("caps the minimum basket where the catalog caps a price", () => {
    // 2.500.000.000 kuruş died on Postgres 22003 and took the form along.
    expect(refusal({ ...base, minSubtotal: "25.000.000" })).toEqual([
      "minSubtotal",
      "Tutar en fazla 1.000.000 TL olabilir.",
    ]);
    expect(refusal({ ...base, minSubtotal: "1.000.000" })).toBeNull();
  });

  it("caps the usage limit and refuses one it cannot read", () => {
    expect(PROMO_USAGE_LIMIT_MAX).toBe(1_000_000);
    expect(refusal({ ...base, usageLimit: "99999999999" })).toEqual([
      "usageLimit",
      "Kullanım limiti en fazla 1.000.000 olabilir.",
    ]);
    // "-5" and "abc" used to become 0: an unlimited code.
    for (const usageLimit of ["-5", "abc", "1,5"]) {
      expect(refusal({ ...base, usageLimit })?.[0], usageLimit).toBe(
        "usageLimit",
      );
    }
    expect(promoFormSchema.parse({ ...base, usageLimit: "" }).usageLimit).toBe(
      0,
    );
    expect(
      promoFormSchema.parse({ ...base, usageLimit: " 250 " }).usageLimit,
    ).toBe(250);
  });
});

describe("promo expiry", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("refuses a time already past in Istanbul", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    // 17 Eki 2026 12:00 in Tuzla.
    vi.setSystemTime(new Date("2026-10-17T09:00:00.000Z"));
    expect(refusal({ ...base, expiresAt: "2026-10-16T23:59" })).toEqual([
      "expiresAt",
      "Bu tarih geçmişte kaldı. İleri bir tarih seç ya da süresiz için boş bırak.",
    ]);
    // 11:59 Istanbul is 08:59 UTC: already gone at 09:00 UTC.
    expect(refusal({ ...base, expiresAt: "2026-10-17T11:59" })?.[0]).toBe(
      "expiresAt",
    );
    expect(refusal({ ...base, expiresAt: "2026-10-17T12:30" })).toBeNull();
    // Blank stays "never".
    expect(refusal({ ...base, expiresAt: "" })).toBeNull();
  });
});
