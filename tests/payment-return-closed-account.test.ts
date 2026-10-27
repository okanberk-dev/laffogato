import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * A charge that completes after the member deleted the account (27 Oct 2026,
 * handoff (g)): the bank's 3-D Secure page was still open when `DELETE /me`
 * cancelled the unpaid order and rewrote its address to the closed row's
 * placeholder.
 *
 * The order is not revived - `applyPaymentSucceeded` advances only a
 * `pending_payment` row and flags a cancelled one `order_not_open` for a
 * refund (its own tests) - and the return must not write the saved-card key
 * onto the closed account either: the closure blanked it and dropped the
 * cards at the POS. A live member's key is still remembered.
 */

const h = vi.hoisted(() => ({
  confirm: vi.fn(),
  apply: vi.fn(),
  remember: vi.fn(),
  order: null as null | Record<string, unknown>,
}));

vi.mock("@/lib/payment", () => ({
  getPaymentProvider: () => ({ name: "paynkolay", confirmReturn: h.confirm }),
}));
vi.mock("@/lib/admin/store", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/admin/store")>();
  return {
    applyPaymentSucceeded: h.apply,
    getOrder: async () => h.order,
    isClosedAccountEmail: real.isClosedAccountEmail,
    orderChannel: () => "app",
  };
});
vi.mock("@/lib/customer/auth", () => ({ getActiveCustomer: async () => null }));
vi.mock("@/lib/customer/store", () => ({ rememberCardUserKey: h.remember }));
vi.mock("@/lib/mobile/orders", () => ({
  isIssuedCheckoutRef: async () => false,
}));
vi.mock("@/lib/mobile/karaoke-return", () => ({
  karaokeReturnDestination: vi.fn(),
  settleKaraokeMockReturn: vi.fn(),
  settleKaraokeReturn: vi.fn(),
}));

const { POST } = await import("@/app/odeme/donus/route");

function bankPost() {
  return POST(
    new NextRequest("https://laffogato.net/odeme/donus", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ CLIENT_REFERENCE_CODE: "ord-0101" }),
    }),
  );
}

const CONFIRMED = {
  status: "succeeded",
  orderId: "ord-0101",
  providerRef: "REF-1",
  amountMinor: 24500,
  currency: "TRY",
  raw: {},
  trxDate: "2026-10-27",
  cardUserKey: "KEY11CHARS0",
};

beforeEach(() => {
  h.confirm.mockReset();
  h.apply.mockReset();
  h.remember.mockReset();
  h.confirm.mockResolvedValue(CONFIRMED);
});

describe("/odeme/donus after the account was closed", () => {
  it("books the money through applyPaymentSucceeded and cancels nothing", async () => {
    h.order = {
      id: "ord-0101",
      status: "cancelled",
      customerEmail: "deleted-cst-42@anon.local",
      channel: "app",
    };
    h.apply.mockResolvedValue({ ok: true, reconcile: "order_not_open" });
    const res = await bankPost();
    expect(res.status).toBe(303);
    expect(h.apply).toHaveBeenCalledWith(
      expect.objectContaining({ orderId: "ord-0101", providerRef: "REF-1" }),
    );
  });

  it("does not write the card key onto the closed row", async () => {
    h.order = {
      id: "ord-0101",
      status: "cancelled",
      customerEmail: "deleted-cst-42@anon.local",
      channel: "app",
    };
    h.apply.mockResolvedValue({ ok: true, reconcile: "order_not_open" });
    await bankPost();
    expect(h.remember).not.toHaveBeenCalled();
  });

  it("still remembers a live member's card key", async () => {
    h.order = {
      id: "ord-0101",
      status: "paid",
      customerEmail: "eda@example.com",
      channel: "app",
    };
    h.apply.mockResolvedValue({ ok: true });
    await bankPost();
    expect(h.remember).toHaveBeenCalledWith("eda@example.com", "KEY11CHARS0");
  });
});
