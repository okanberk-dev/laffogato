import { describe, expect, it } from "vitest";

import { promoFormSchema } from "@/lib/admin/promo-schema";

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
      expiresAt: "2026-09-30T23:59",
    });
    expect(out.expiresAt).toBe("2026-09-30T20:59:00.000Z");
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
