import { describe, expect, it, vi } from "vitest";

import type { CustomerCoupon } from "@/lib/customer/coupons";

/**
 * Review of 16 Eki 2026: a coupon taken back because its stamps were
 * refunded (`isActive: false`, still unused) must not reach the app as a
 * live one. The wire shape has no status, so `GET /coupons` leaves it out.
 */

function coupon(over: Partial<CustomerCoupon>): CustomerCoupon {
  return {
    id: "cpn-0001",
    customerEmail: "eda@example.com",
    code: "SD-AAAAAA",
    title: "Ücretsiz içecek",
    kind: "fixed",
    value: 28000,
    minSubtotalMinor: 0,
    source: "loyalty",
    expiresAt: "2026-11-15T12:00:00.000Z",
    redeemedAt: "",
    redeemedOrderNo: 0,
    isActive: true,
    createdAt: "2026-10-16T09:00:00.000Z",
    updatedAt: "2026-10-16T09:00:00.000Z",
    ...over,
  } as CustomerCoupon;
}

const COUPONS = [
  coupon({ id: "cpn-0003", code: "SD-WITHDRAWN", isActive: false }),
  coupon({ id: "cpn-0002", code: "SD-LIVE" }),
  coupon({
    id: "cpn-0001",
    code: "SD-USED",
    redeemedAt: "2026-10-16T10:00:00.000Z",
    redeemedOrderNo: 20001,
  }),
];

vi.mock("@/lib/mobile/auth", () => ({
  requireMobileCustomer: vi.fn(async () => ({
    ok: true,
    customer: { email: "eda@example.com" },
  })),
}));
vi.mock("@/lib/customer/coupons", () => ({
  listCustomerCoupons: vi.fn(async () => COUPONS),
}));

const { GET } = await import("@/app/api/mobile/v1/coupons/route");

describe("GET /coupons", () => {
  it("leaves out a coupon that was taken back, keeps live and used ones", async () => {
    const res = await GET(
      new Request("https://laffogato.net/api/mobile/v1/coupons", {
        headers: { authorization: "Bearer t" },
      }),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      coupons: { code: string; usedAt: string | null }[];
    };
    expect(body.coupons.map((c) => c.code)).toEqual(["SD-LIVE", "SD-USED"]);
    expect(body.coupons[1].usedAt).toBe("2026-10-16T10:00:00.000Z");
  });
});
