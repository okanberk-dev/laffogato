import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * `/odeme/donus` for a karaoke reference (docs/API-MOBILE.md §7).
 *
 * The bank posts the browser back without a cookie, and the post can be
 * forged for any sequential id. So the return may only BOOK what the POS
 * confirms, never cancel; never mints a signed link; lands where the ROW
 * says (app or web); and tells nobody whether some other id was paid.
 */

const h = vi.hoisted(() => ({
  confirm: vi.fn(),
  apply: vi.fn(),
  applyOrder: vi.fn(),
  remember: vi.fn(),
  row: null as null | Record<string, unknown>,
  cancelled: vi.fn(),
}));

vi.mock("@/lib/payment", () => ({
  getPaymentProvider: () => ({ name: "paynkolay", confirmReturn: h.confirm }),
}));
vi.mock("@/lib/admin/store", () => ({
  applyPaymentSucceeded: h.applyOrder,
  getOrder: async () => null,
  orderChannel: () => "web",
}));
vi.mock("@/lib/customer/auth", () => ({ getActiveCustomer: async () => null }));
vi.mock("@/lib/customer/store", () => ({ rememberCardUserKey: h.remember }));
vi.mock("@/lib/mobile/orders", () => ({
  isIssuedCheckoutRef: async () => false,
}));
vi.mock("@/lib/mobile/checkout-ref", () => ({
  isIssuedCheckoutRef: async () => false,
}));
vi.mock("@/lib/mobile/karaoke", () => ({
  getReservation: async () => h.row,
}));
vi.mock("@/lib/mobile/karaoke-payment", () => ({
  applyKaraokePaymentSucceeded: h.apply,
  cancelKaraokeReservation: h.cancelled,
  expireUnpaidReservations: h.cancelled,
}));

const { POST } = await import("@/app/odeme/donus/route");

function bankPost(fields: Record<string, string>) {
  const body = new URLSearchParams(fields);
  return POST(
    new NextRequest("https://laffogato.net/odeme/donus", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body,
    }),
  );
}

const PAID = {
  id: "krk-00042",
  status: "confirmed",
  paymentStatus: "paid",
  channel: "web",
  guest: false,
  customerEmail: "eda@example.com",
};

beforeEach(() => {
  h.confirm.mockReset();
  h.apply.mockReset();
  h.applyOrder.mockReset();
  h.remember.mockReset();
  h.cancelled.mockReset();
  h.row = { ...PAID };
});

describe("a karaoke return the POS confirmed", () => {
  it("books it through the karaoke path, never the order path", async () => {
    h.confirm.mockResolvedValue({
      status: "succeeded",
      orderId: "krk-00042",
      providerRef: "krk-00042",
      amountMinor: 200_000,
      currency: "TRY",
      raw: {},
      trxDate: "2026-10-16",
    });
    h.apply.mockResolvedValue({ ok: true, outcome: "paid", reservation: PAID });
    const res = await bankPost({ CLIENT_REFERENCE_CODE: "krk-00042" });
    expect(res.status).toBe(303);
    expect(h.apply).toHaveBeenCalledWith(
      expect.objectContaining({
        reservationId: "krk-00042",
        provider: "paynkolay",
        amountMinor: 200_000,
      }),
    );
    expect(h.applyOrder).not.toHaveBeenCalled();
    const to = res.headers.get("location")!;
    expect(to).toBe(
      "https://laffogato.net/rezervasyon?ref=krk-00042&odeme=basarili",
    );
    // No signed link is ever handed out by the return.
    expect(to).not.toMatch(/[?&]t=/);
  });

  it("an app booking goes back to the app's karaoke screen with the row's verdict", async () => {
    h.row = { ...PAID, channel: "app" };
    h.confirm.mockResolvedValue({
      status: "succeeded",
      orderId: "krk-00042",
      providerRef: "krk-00042",
      amountMinor: 200_000,
      currency: "TRY",
      raw: {},
    });
    h.apply.mockResolvedValue({
      ok: true,
      outcome: "paid",
      reservation: h.row,
    });
    const res = await bankPost({ CLIENT_REFERENCE_CODE: "krk-00042" });
    expect(res.headers.get("location")).toBe(
      "laffogato://karaoke?status=success&ref=krk-00042",
    );
  });

  it("keeps a member's card key, never a guest's", async () => {
    const ok = {
      status: "succeeded",
      orderId: "krk-00042",
      providerRef: "krk-00042",
      amountMinor: 1,
      currency: "TRY",
      raw: {},
      cardUserKey: "KEY",
    };
    h.confirm.mockResolvedValue(ok);
    h.apply.mockResolvedValueOnce({
      ok: true,
      outcome: "paid",
      reservation: PAID,
    });
    await bankPost({ CLIENT_REFERENCE_CODE: "krk-00042" });
    expect(h.remember).toHaveBeenCalledWith("eda@example.com", "KEY");
    h.remember.mockReset();
    h.apply.mockResolvedValueOnce({
      ok: true,
      outcome: "paid",
      reservation: { ...PAID, guest: true },
    });
    await bankPost({ CLIENT_REFERENCE_CODE: "krk-00042" });
    expect(h.remember).not.toHaveBeenCalled();
  });
});

describe("a karaoke return that did not settle", () => {
  it("a declined card books nothing and cancels nothing (rule 29)", async () => {
    h.row = { ...PAID, status: "requested", paymentStatus: "pending" };
    h.confirm.mockResolvedValue({
      status: "failed",
      orderId: "krk-00042",
      providerRef: "",
      amountMinor: 0,
      currency: "TRY",
      raw: {},
    });
    const res = await bankPost({ CLIENT_REFERENCE_CODE: "krk-00042" });
    expect(h.apply).not.toHaveBeenCalled();
    expect(h.cancelled).not.toHaveBeenCalled();
    expect(res.headers.get("location")).toBe(
      "https://laffogato.net/rezervasyon?ref=krk-00042&odeme=sonuc",
    );
  });

  it("a forged post for a paid booking learns nothing: a failed confirm never lets the row speak", async () => {
    h.row = { ...PAID, channel: "app" };
    h.confirm.mockResolvedValue({
      status: "failed",
      orderId: "krk-00042",
      providerRef: "",
      amountMinor: 0,
      currency: "TRY",
      raw: {},
    });
    const res = await bankPost({ CLIENT_REFERENCE_CODE: "krk-00042" });
    expect(res.headers.get("location")).toBe(
      "laffogato://karaoke?status=failed&ref=krk-00042",
    );
    h.row = { ...PAID, channel: "web" };
    const web = await bankPost({ CLIENT_REFERENCE_CODE: "krk-00042" });
    expect(web.headers.get("location")).toContain("odeme=sonuc");
  });

  it("when the POS could not be asked, the app is never told 'paid' (no oracle over ids)", async () => {
    h.row = { ...PAID, channel: "app" };
    h.confirm.mockRejectedValue(new Error("timeout"));
    const res = await bankPost({ CLIENT_REFERENCE_CODE: "krk-00042" });
    expect(res.headers.get("location")).toBe(
      "laffogato://karaoke?status=failed&ref=krk-00042",
    );
    expect(h.apply).not.toHaveBeenCalled();
  });

  it("branches on the reference the POS confirmed, not the posted one", async () => {
    h.confirm.mockResolvedValue({
      status: "failed",
      orderId: "ord-0007",
      providerRef: "",
      amountMinor: 0,
      currency: "TRY",
      raw: {},
    });
    const res = await bankPost({ CLIENT_REFERENCE_CODE: "krk-00042" });
    expect(res.headers.get("location")).toContain("/odeme?error=payment");
  });
});
