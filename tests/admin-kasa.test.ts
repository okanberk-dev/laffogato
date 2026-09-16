import { readFileSync } from "node:fs";

import { beforeEach, describe, expect, it, vi } from "vitest";

import { DbUnreachableError } from "@/lib/db/health";

/**
 * The till action.
 *
 * A Server Action is a POST endpoint that can be called without ever opening
 * the page, so the page's own `requireRole` protects nothing here: the gate
 * has to be in the action, and it has to be `till` rather than `orders` or the
 * cashier the whole feature exists for is locked out of it.
 */

const requireRole = vi.fn();
const logAudit = vi.fn();
const redeemCounterToken = vi.fn();
const getCustomerByEmail = vi.fn();

vi.mock("@/lib/admin/auth", () => ({ requireRole }));
vi.mock("@/lib/admin/audit", () => ({ logAudit }));
vi.mock("@/lib/customer/store", () => ({ getCustomerByEmail }));
vi.mock("@/lib/mobile/counter", async () => {
  const actual = await vi.importActual<typeof import("@/lib/mobile/counter")>(
    "@/lib/mobile/counter",
  );
  return {
    MIN_COUNTER_STAMPS: actual.MIN_COUNTER_STAMPS,
    MAX_COUNTER_STAMPS: actual.MAX_COUNTER_STAMPS,
    redeemCounterToken,
  };
});

const { redeemCounterTokenAction } = await import("@/app/admin/kasa/actions");

function granted(redemption: Record<string, unknown> = {}) {
  redeemCounterToken.mockResolvedValue({
    ok: true,
    redemption: {
      name: "Eda",
      memberLabel: "e***@ornek.com",
      code: "K7P42M9X",
      stampsGiven: 1,
      loyalty: { stamps: 4, stampTarget: 6, rewardsReady: 0 },
      ...redemption,
    },
  });
}

beforeEach(() => {
  requireRole.mockReset();
  requireRole.mockResolvedValue({ email: "kasa@laffogato.net" });
  logAudit.mockReset();
  redeemCounterToken.mockReset();
  getCustomerByEmail.mockReset();
  getCustomerByEmail.mockResolvedValue({ email: "eda@ornek.com", isActive: true });
  granted();
});

describe("role gate", () => {
  it("opens the till section, not the order list", async () => {
    await redeemCounterTokenAction({
      kind: "code",
      value: "K7P42M9X",
      stamps: 1,
    });
    expect(requireRole).toHaveBeenCalledWith("till");
  });

  it("is checked before a single stamp is handed out", async () => {
    requireRole.mockRejectedValue(new Error("NEXT_REDIRECT"));
    await expect(
      redeemCounterTokenAction({ kind: "code", value: "K7P42M9X", stamps: 5 }),
    ).rejects.toThrow();
    expect(redeemCounterToken).not.toHaveBeenCalled();
  });

  it("is on the page as well, so a cashier is not bounced from it", () => {
    const page = readFileSync("src/app/admin/kasa/page.tsx", "utf8");
    expect(page).toContain('requireRole("till")');
    expect(page).not.toContain('requireRole("orders")');
  });
});

describe("redeemCounterTokenAction", () => {
  it("stamps on behalf of the signed-in cashier", async () => {
    await redeemCounterTokenAction({
      kind: "token",
      value: "jeton",
      stamps: 2,
      note: "Cappuccino",
    });
    expect(redeemCounterToken).toHaveBeenCalledWith({
      kind: "token",
      value: "jeton",
      stamps: 2,
      actor: "kasa@laffogato.net",
      note: "Cappuccino",
    });
  });

  it("hands the till the new balance, not the raw ledger", async () => {
    const state = await redeemCounterTokenAction({
      kind: "code",
      value: "K7P42M9X",
      stamps: 1,
    });
    expect(state.result).toEqual({
      name: "Eda",
      memberLabel: "e***@ornek.com",
      code: "K7P42M9X",
      stampsGiven: 1,
      stamps: 4,
      stampTarget: 6,
      rewardsReady: 0,
    });
  });

  it("logs the redemption under the code, never the member's address", async () => {
    granted({ stampsGiven: 3 });
    await redeemCounterTokenAction({
      kind: "code",
      value: "K7P42M9X",
      stamps: 3,
    });
    expect(logAudit).toHaveBeenCalledWith({
      action: "update",
      entity: "counter_token",
      entityId: "K7P42M9X",
      payload: { kind: "code", stamps: 3 },
    });
  });

  it("passes a hand-crafted stamp count on to be refused, not clamped", async () => {
    // Clamping 99 to 5 would quietly grant the largest allowed reward to a
    // request nobody's UI could have made.
    await redeemCounterTokenAction({
      kind: "code",
      value: "K7P42M9X",
      stamps: 99,
    });
    expect(redeemCounterToken).toHaveBeenCalledWith(
      expect.objectContaining({ stamps: 99 }),
    );
  });

  it("refuses a path that is not one of the three", async () => {
    const state = await redeemCounterTokenAction({
      kind: "sql",
      value: "K7P42M9X",
      stamps: 1,
    });
    expect(state.error).toBeTruthy();
    expect(redeemCounterToken).not.toHaveBeenCalled();
  });

  it("shows the Turkish refusal as-is and logs nothing", async () => {
    redeemCounterToken.mockResolvedValue({
      ok: false,
      error: "already_used",
      message: "Bu kod kullanıldı. Aynı QR ikinci kez damga vermez.",
    });
    const state = await redeemCounterTokenAction({
      kind: "code",
      value: "K7P42M9X",
      stamps: 1,
    });
    expect(state.error).toMatch(/kullanıldı/);
    expect(state.result).toBeUndefined();
    expect(logAudit).not.toHaveBeenCalled();
  });

  it("says the database is down instead of crashing the till", async () => {
    redeemCounterToken.mockRejectedValue(
      new DbUnreachableError("counter.burn", "ECONNREFUSED"),
    );
    const state = await redeemCounterTokenAction({
      kind: "code",
      value: "K7P42M9X",
      stamps: 1,
    });
    expect(state.error).toMatch(/ulaşılamıyor/);
  });
});

/**
 * The typed-address path.
 *
 * The QR and the code name a member by construction — the token row was minted
 * for an account. A typed address names nobody, and `redeemCounterToken` only
 * checks its SHAPE: `uye@gmial.com` used to pass, collect its own ledger rows
 * and come back as a green "+1 damga · Kart 1/6" receipt while the member it
 * was meant for saw nothing.
 */
describe("e-posta yolu · üyelik denetimi", () => {
  it("refuses an address with no member account, before any stamp is written", async () => {
    getCustomerByEmail.mockResolvedValue(null);
    const state = await redeemCounterTokenAction({
      kind: "email",
      value: "uye@gmial.com",
      stamps: 1,
    });
    expect(state.error).toMatch(/üye hesabı yok/);
    expect(state.result).toBeUndefined();
    expect(redeemCounterToken).not.toHaveBeenCalled();
    expect(logAudit).not.toHaveBeenCalled();
  });

  it("refuses a closed account too — a stamp there is a stamp nobody can spend", async () => {
    getCustomerByEmail.mockResolvedValue({
      email: "eda@ornek.com",
      isActive: false,
    });
    const state = await redeemCounterTokenAction({
      kind: "email",
      value: "eda@ornek.com",
      stamps: 1,
    });
    expect(state.error).toMatch(/kapalı/);
    expect(redeemCounterToken).not.toHaveBeenCalled();
  });

  it("stamps a real member as before", async () => {
    const state = await redeemCounterTokenAction({
      kind: "email",
      value: "eda@ornek.com",
      stamps: 2,
    });
    expect(getCustomerByEmail).toHaveBeenCalledWith("eda@ornek.com");
    expect(redeemCounterToken).toHaveBeenCalledWith(
      expect.objectContaining({ kind: "email", value: "eda@ornek.com" }),
    );
    expect(state.result).toBeTruthy();
  });

  it("does not ask the customer table on the QR path — the token already names the member", async () => {
    await redeemCounterTokenAction({
      kind: "token",
      value: "jeton",
      stamps: 1,
    });
    expect(getCustomerByEmail).not.toHaveBeenCalled();
  });

  it("says the database is down rather than inventing a missing member", async () => {
    getCustomerByEmail.mockRejectedValue(
      new DbUnreachableError("fetchCustomer", "ECONNREFUSED"),
    );
    const state = await redeemCounterTokenAction({
      kind: "email",
      value: "eda@ornek.com",
      stamps: 1,
    });
    expect(state.error).toMatch(/ulaşılamıyor/);
    expect(redeemCounterToken).not.toHaveBeenCalled();
  });
});
