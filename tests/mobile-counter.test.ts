import { createHash } from "node:crypto";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { allTokens, fakeTokenDb, seedTokens } from "./_stubs/counter-tokens-db";

/**
 * The QR the member shows at the till.
 *
 * Everything worth guarding here is a one-line rule that is a free-drink
 * machine if it drifts: the raw token must never reach the database, a code
 * must burn exactly once, an expired code must burn nothing, and one member
 * must not be able to keep a queue of valid QRs alive.
 */

vi.mock("@/lib/db", () => fakeTokenDb());

const addCounterStamp = vi.fn();
const getLoyalty = vi.fn();
const getCustomerByEmail = vi.fn();

vi.mock("@/lib/mobile/loyalty", () => ({ addCounterStamp, getLoyalty }));
vi.mock("@/lib/customer/store", () => ({ getCustomerByEmail }));

const {
  COUNTER_TOKEN_TTL_SECONDS,
  hashCounterToken,
  issueCounterToken,
  maskEmail,
  normalizeCounterCode,
  redeemCounterToken,
} = await import("@/lib/mobile/counter");

const MEMBER = "eda@ornek.com";
const CASHIER = "kasa@laffogato.net";
const T0 = Date.UTC(2026, 8, 5, 12, 0, 0);

function at(offsetMs: number): void {
  vi.setSystemTime(new Date(T0 + offsetMs));
}

async function issue(): Promise<{ code: string; token: string }> {
  const res = await issueCounterToken(MEMBER);
  if (!res.ok) throw new Error(`beklenmedik hız sınırı: ${res.error}`);
  return res.issue;
}

function openRows() {
  const now = new Date().toISOString();
  return allTokens().filter(
    (r) => r.usedAt === "" && String(r.expiresAt) > now,
  );
}

beforeEach(() => {
  vi.useFakeTimers();
  at(0);
  seedTokens([]);
  addCounterStamp.mockReset();
  addCounterStamp.mockResolvedValue({ id: "stamp-000001" });
  getLoyalty.mockReset();
  getLoyalty.mockResolvedValue({
    stamps: 3,
    stampTarget: 6,
    rewardsReady: 0,
    lifetimeStamps: 9,
  });
  getCustomerByEmail.mockReset();
  getCustomerByEmail.mockResolvedValue({ name: "Eda" });
});

afterEach(() => {
  vi.useRealTimers();
});

describe("issueCounterToken", () => {
  it("stores the sha256 and never the token itself", async () => {
    const { token } = await issue();
    const row = allTokens()[0];
    expect(row.tokenHash).toBe(
      createHash("sha256").update(token).digest("hex"),
    );
    expect(JSON.stringify(allTokens())).not.toContain(token);
  });

  it("draws a code a cashier can read out loud", async () => {
    const { code } = await issue();
    expect(code).toHaveLength(8);
    // No O/0, no I/1/L - the whole point of the reduced alphabet.
    expect(code).toMatch(/^[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{8}$/);
  });

  it("draws a token QR can encode in its cheap mode", async () => {
    const { token } = await issue();
    // 128 bits re-spelled in base32 - 26 characters, all of them inside QR's
    // alphanumeric set. A lowercase letter or a `-` here would push the
    // payload into byte mode and grow the grid from 25x25 back to 33x33
    // (tests/counter-qr.test.ts measures the consequence).
    expect(token).toHaveLength(26);
    expect(token).toMatch(/^[0-9ABCDEFGHJKMNPQRSTVWXYZ]{26}$/);
  });

  it("spends every bit of its randomness", async () => {
    // A per-byte `% 32` would keep only five bits of each byte and quietly
    // hand out 80-bit tokens; over this many draws that shows up as both a
    // collision and a starved alphabet.
    const seen = new Set<string>();
    const chars = new Set<string>();
    // A fresh address each round: the per-member cap is ten a minute, and
    // this is a question about the generator, not about the limiter.
    for (let i = 0; i < 200; i += 1) {
      const res = await issueCounterToken(`uye${i}@ornek.com`);
      if (!res.ok) throw new Error(`beklenmedik hız sınırı: ${res.error}`);
      seen.add(res.issue.token);
      for (const ch of res.issue.token) chars.add(ch);
    }
    expect(seen.size).toBe(200);
    expect(chars.size).toBe(32);
  });

  it("expires two minutes out", async () => {
    await issue();
    const row = allTokens()[0];
    expect(COUNTER_TOKEN_TTL_SECONDS).toBe(120);
    expect(Date.parse(String(row.expiresAt)) - T0).toBe(120_000);
  });

  it("keeps at most three tokens valid at once", async () => {
    for (let i = 0; i < 5; i += 1) {
      at(i * 1000);
      await issue();
    }
    expect(allTokens()).toHaveLength(5);
    expect(openRows()).toHaveLength(3);
  });

  it("retires the oldest, never the one just issued", async () => {
    const codes: string[] = [];
    for (let i = 0; i < 4; i += 1) {
      at(i * 1000);
      codes.push((await issue()).code);
    }
    const stillOpen = openRows().map((r) => r.code);
    expect(stillOpen).toContain(codes[3]);
    expect(stillOpen).not.toContain(codes[0]);
  });

  it("refuses an eleventh token inside the same minute", async () => {
    for (let i = 0; i < 10; i += 1) {
      at(i * 1000);
      await issue();
    }
    at(10_000);
    const res = await issueCounterToken(MEMBER);
    expect(res).toMatchObject({ ok: false, error: "rate_limited" });
    if (res.ok) throw new Error("beklenmedik başarı");
    expect(res.retryAfterSeconds).toBeGreaterThan(0);
    expect(allTokens()).toHaveLength(10);
  });

  it("counts the window per member", async () => {
    for (let i = 0; i < 10; i += 1) {
      at(i * 1000);
      await issue();
    }
    const other = await issueCounterToken("baska@ornek.com");
    expect(other.ok).toBe(true);
  });
});

describe("redeemCounterToken · kod", () => {
  it("gives the asked-for stamps and reports the new balance", async () => {
    const { code } = await issue();
    const res = await redeemCounterToken({
      kind: "code",
      value: code,
      stamps: 2,
      actor: CASHIER,
    });
    if (!res.ok) throw new Error(res.error);
    expect(addCounterStamp).toHaveBeenCalledTimes(2);
    expect(addCounterStamp).toHaveBeenCalledWith(MEMBER, CASHIER, "Kasa · kod");
    expect(res.redemption).toMatchObject({
      name: "Eda",
      stampsGiven: 2,
      code,
    });
    expect(res.redemption.loyalty.stamps).toBe(3);
  });

  it("shows the cashier a masked address, never the member's own", async () => {
    const { code } = await issue();
    const res = await redeemCounterToken({
      kind: "code",
      value: code,
      stamps: 1,
      actor: CASHIER,
    });
    if (!res.ok) throw new Error(res.error);
    expect(res.redemption.memberLabel).toBe("e***@ornek.com");
    expect(res.redemption.memberLabel).not.toContain(MEMBER);
  });

  it("burns once: a second scan of the same code gives no stamp", async () => {
    const { code } = await issue();
    await redeemCounterToken({
      kind: "code",
      value: code,
      stamps: 1,
      actor: CASHIER,
    });
    addCounterStamp.mockClear();

    const again = await redeemCounterToken({
      kind: "code",
      value: code,
      stamps: 1,
      actor: CASHIER,
    });
    expect(again).toMatchObject({ ok: false, error: "already_used" });
    expect(again.ok === false && again.message).toMatch(/kullanıldı/);
    expect(addCounterStamp).not.toHaveBeenCalled();
  });

  it("writes who burned it and when", async () => {
    const { code } = await issue();
    await redeemCounterToken({
      kind: "code",
      value: code,
      stamps: 1,
      actor: CASHIER,
    });
    const row = allTokens().find((r) => r.code === code);
    expect(row?.usedBy).toBe(CASHIER);
    expect(row?.usedAt).not.toBe("");
  });

  it("refuses a code whose two minutes are up", async () => {
    const { code } = await issue();
    at(121_000);
    const res = await redeemCounterToken({
      kind: "code",
      value: code,
      stamps: 1,
      actor: CASHIER,
    });
    expect(res).toMatchObject({ ok: false, error: "expired" });
    expect(addCounterStamp).not.toHaveBeenCalled();
    // An expired code must stay unburned: it never gave anything away.
    expect(allTokens().find((r) => r.code === code)?.usedAt).toBe("");
  });

  it("says not_found for a code nobody ever held", async () => {
    const res = await redeemCounterToken({
      kind: "code",
      value: "ABCD2345",
      stamps: 1,
      actor: CASHIER,
    });
    expect(res).toMatchObject({ ok: false, error: "not_found" });
    expect(addCounterStamp).not.toHaveBeenCalled();
  });

  it("accepts the code as the cashier types it", async () => {
    const { code } = await issue();
    const typed = `${code.slice(0, 4).toLowerCase()}-${code.slice(4)}`;
    expect(normalizeCounterCode(typed)).toBe(code);
    const res = await redeemCounterToken({
      kind: "code",
      value: typed,
      stamps: 1,
      actor: CASHIER,
    });
    expect(res.ok).toBe(true);
  });
});

describe("redeemCounterToken · jeton", () => {
  it("accepts the raw token behind the QR", async () => {
    const { token, code } = await issue();
    const res = await redeemCounterToken({
      kind: "token",
      value: token,
      stamps: 1,
      actor: CASHIER,
    });
    if (!res.ok) throw new Error(res.error);
    expect(res.redemption.code).toBe(code);
    expect(addCounterStamp).toHaveBeenCalledWith(MEMBER, CASHIER, "Kasa · QR");
  });

  it("refuses a token that hashes to nothing on file", async () => {
    await issue();
    const res = await redeemCounterToken({
      kind: "token",
      value: "uydurma-jeton",
      stamps: 1,
      actor: CASHIER,
    });
    expect(res).toMatchObject({ ok: false, error: "not_found" });
    expect(hashCounterToken("uydurma-jeton")).toHaveLength(64);
  });

  it("gives nothing on the second scan of the same QR", async () => {
    const { token } = await issue();
    await redeemCounterToken({
      kind: "token",
      value: token,
      stamps: 3,
      actor: CASHIER,
    });
    expect(addCounterStamp).toHaveBeenCalledTimes(3);
    addCounterStamp.mockClear();
    const again = await redeemCounterToken({
      kind: "token",
      value: token,
      stamps: 3,
      actor: CASHIER,
    });
    expect(again).toMatchObject({ ok: false, error: "already_used" });
    expect(addCounterStamp).not.toHaveBeenCalled();
  });
});

describe("redeemCounterToken · e-posta", () => {
  it("keeps the address the cashier typed unmasked", async () => {
    const res = await redeemCounterToken({
      kind: "email",
      value: " Eda@Ornek.com ",
      stamps: 1,
      actor: CASHIER,
    });
    if (!res.ok) throw new Error(res.error);
    expect(res.redemption.memberLabel).toBe(MEMBER);
    expect(res.redemption.code).toBe("");
    expect(addCounterStamp).toHaveBeenCalledWith(
      MEMBER,
      CASHIER,
      "Kasa · e-posta",
    );
  });

  it("refuses something that is not an address", async () => {
    const res = await redeemCounterToken({
      kind: "email",
      value: "eda",
      stamps: 1,
      actor: CASHIER,
    });
    expect(res).toMatchObject({ ok: false, error: "invalid_email" });
    expect(addCounterStamp).not.toHaveBeenCalled();
  });
});

describe("stamp count", () => {
  it("is refused outside 1-5, before anything is burned", async () => {
    const { code } = await issue();
    for (const stamps of [0, 6, -1, Number.NaN]) {
      const res = await redeemCounterToken({
        kind: "code",
        value: code,
        stamps,
        actor: CASHIER,
      });
      expect(res).toMatchObject({ ok: false, error: "invalid_stamps" });
    }
    expect(addCounterStamp).not.toHaveBeenCalled();
    expect(allTokens().find((r) => r.code === code)?.usedAt).toBe("");
  });

  it("carries the cashier's note next to the source", async () => {
    const { code } = await issue();
    await redeemCounterToken({
      kind: "code",
      value: code,
      stamps: 1,
      actor: CASHIER,
      note: "Cappuccino",
    });
    expect(addCounterStamp).toHaveBeenCalledWith(
      MEMBER,
      CASHIER,
      "Kasa · kod · Cappuccino",
    );
  });
});

describe("maskEmail", () => {
  it("keeps the domain and one letter", () => {
    expect(maskEmail("ahmet@gmail.com")).toBe("a***@gmail.com");
    expect(maskEmail("")).toBe("");
  });
});

describe("housekeeping", () => {
  it("sweeps rows nobody can use a day later", async () => {
    const { code } = await issue();
    at(2 * 24 * 60 * 60 * 1000);
    await redeemCounterToken({
      kind: "email",
      value: MEMBER,
      stamps: 1,
      actor: CASHIER,
    });
    expect(allTokens().some((r) => r.code === code)).toBe(false);
  });
});
