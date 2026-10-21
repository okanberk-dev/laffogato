import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

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
    expect(code).toMatch(/^[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{8}$/);
  });

  it("never prints an L, however many codes it draws", async () => {
    // The alphabet carried an `L` for weeks while its comment said it did
    // not; one 8-character code shows it only now and then, sixty do not lie.
    const letters = new Set<string>();
    for (let i = 0; i < 60; i += 1) {
      const res = await issueCounterToken(`tur${i}@ornek.com`);
      if (!res.ok) throw new Error(`beklenmedik hız sınırı: ${res.error}`);
      for (const ch of res.issue.code) letters.add(ch);
    }
    expect(letters.has("L")).toBe(false);
    expect(letters.has("I")).toBe(false);
    expect(letters.has("O")).toBe(false);
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

  it("says not_found for a code nobody ever held, pointing at a new QR", async () => {
    const res = await redeemCounterToken({
      kind: "code",
      value: "ABCD2345",
      stamps: 1,
      actor: CASHIER,
    });
    // The till no longer has an e-mail path to send the cashier to.
    expect(res).toEqual({
      ok: false,
      error: "not_found",
      message:
        "Kod bulunamadı. Kodu kontrol et ya da üyeden yeni QR göstermesini iste.",
    });
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

describe("redeemCounterToken · refuseOwner (barista in the app)", () => {
  // POST /staff/stamp passes the barista's own address: a barista must not
  // stamp their own QR or code. The refusal must come before the burn, or
  // the member's code would be spent for nothing and fail at a real till.
  it.each(["token", "code"] as const)(
    "refuses the owner's own %s and leaves it unburned",
    async (kind) => {
      const { token, code } = await issue();
      const res = await redeemCounterToken({
        kind,
        value: kind === "token" ? token : code,
        stamps: 1,
        actor: MEMBER,
        refuseOwner: ` ${MEMBER.toUpperCase()} `,
      });
      expect(res).toMatchObject({ ok: false, error: "self_stamp" });
      expect(addCounterStamp).not.toHaveBeenCalled();
      expect(allTokens()[0].usedAt).toBe("");

      const atTill = await redeemCounterToken({
        kind,
        value: kind === "token" ? token : code,
        stamps: 1,
        actor: CASHIER,
      });
      expect(atTill.ok).toBe(true);
    },
  );

  it("stamps somebody else's code as usual", async () => {
    const { code } = await issue();
    const res = await redeemCounterToken({
      kind: "code",
      value: code,
      stamps: 1,
      actor: "bora@ornek.com",
      refuseOwner: "bora@ornek.com",
    });
    expect(res.ok).toBe(true);
    expect(addCounterStamp).toHaveBeenCalledWith(
      MEMBER,
      "bora@ornek.com",
      "Kasa · kod",
    );
  });
});

/**
 * The typed address is refused (decision ASK-LOYALTY, 21 Ekim 2026): it named
 * a member who showed nothing and burned no code. The kind stays in the type,
 * and its "Kasa · e-posta" ledger note in the source, for the rows written
 * before that day.
 */
describe("redeemCounterToken · e-posta kapalı", () => {
  const REFUSED = {
    ok: false,
    error: "email_refused",
    message:
      "E-postayla damga verilmiyor. Üyeden uygulamadaki kasa kodunu (QR ya da 8 karakterlik kod) göstermesini iste.",
  };

  it("refuses a member's address: no stamp, no lookup, no label", async () => {
    const res = await redeemCounterToken({
      kind: "email",
      value: " Eda@Ornek.com ",
      stamps: 1,
      actor: CASHIER,
    });
    expect(res).toEqual(REFUSED);
    expect(addCounterStamp).not.toHaveBeenCalled();
    expect(getCustomerByEmail).not.toHaveBeenCalled();
    expect(getLoyalty).not.toHaveBeenCalled();
  });

  it("refuses something that is not an address the same way, no longer invalid_email", async () => {
    const res = await redeemCounterToken({
      kind: "email",
      value: "eda",
      stamps: 1,
      actor: CASHIER,
    });
    expect(res).toEqual(REFUSED);
    expect(addCounterStamp).not.toHaveBeenCalled();
  });

  it("refuses before the stamp count is even read", async () => {
    const res = await redeemCounterToken({
      kind: "email",
      value: MEMBER,
      stamps: 99,
      actor: CASHIER,
    });
    expect(res).toEqual(REFUSED);
  });

  it("cannot be used to burn anybody's code: an open code stays usable", async () => {
    const { code } = await issue();
    const res = await redeemCounterToken({
      kind: "email",
      value: code,
      stamps: 1,
      actor: CASHIER,
    });
    expect(res).toEqual(REFUSED);
    expect(allTokens().find((r) => r.code === code)?.usedAt).toBe("");
    const atTill = await redeemCounterToken({
      kind: "code",
      value: code,
      stamps: 1,
      actor: CASHIER,
    });
    expect(atTill.ok).toBe(true);
  });

  it("keeps the old ledger note's name in the source, for the rows before the change", () => {
    const src = readFileSync("src/lib/mobile/counter.ts", "utf8");
    expect(src).toContain(
      'export type CounterRedeemKind = "token" | "code" | "email";',
    );
    expect(src).toContain('email: "Kasa · e-posta",');
    // The address shape check went with the path.
    expect(src).not.toMatch(/\bEMAIL_RE\b/);
  });
});

/**
 * After the burn (admin audit ORD-M02). The code was spent, the stamps go
 * in one insert at a time, then the balance is read: a throw anywhere in
 * that stretch reached the till as "Damga verilemedi. Tekrar dene." with
 * some or all of the stamps written, and the retry answered "already used".
 */
describe("redeemCounterToken · yarıda kalan", () => {
  it("answers partial, with how many inserts answered, when one fails", async () => {
    const { code } = await issue();
    addCounterStamp
      .mockResolvedValueOnce({ id: "stamp-000001" })
      .mockRejectedValueOnce(new Error("insert failed"));
    const res = await redeemCounterToken({
      kind: "code",
      value: code,
      stamps: 3,
      actor: CASHIER,
    });
    expect(res).toMatchObject({
      ok: false,
      error: "partial",
      message: "Damga verilmiş olabilir, üyenin kartını kontrol et.",
      stampsWritten: 1,
      stampsAsked: 3,
      code,
      memberLabel: "e***@ornek.com",
    });
    expect(
      res.ok === false && res.error === "partial" && res.cause,
    ).toBeInstanceOf(Error);
    // The code stays spent: the scan cannot be repeated into more stamps.
    expect(allTokens().find((r) => r.code === code)?.usedAt).not.toBe("");
  });

  it("answers partial when the stamps are in and the balance read fails", async () => {
    const { code } = await issue();
    getLoyalty.mockRejectedValue(new Error("read failed"));
    const res = await redeemCounterToken({
      kind: "code",
      value: code,
      stamps: 2,
      actor: CASHIER,
    });
    expect(res).toMatchObject({
      ok: false,
      error: "partial",
      stampsWritten: 2,
    });
  });

  it("never answers partial for a typed address: it is refused before the first insert", async () => {
    addCounterStamp.mockRejectedValue(new Error("connection reset"));
    const res = await redeemCounterToken({
      kind: "email",
      value: MEMBER,
      stamps: 1,
      actor: CASHIER,
    });
    expect(res).toMatchObject({ ok: false, error: "email_refused" });
    expect(res).not.toHaveProperty("stampsWritten");
    expect(addCounterStamp).not.toHaveBeenCalled();
  });

  it("answers partial on the code path when the first insert fails: it may have landed", async () => {
    const { code } = await issue();
    addCounterStamp.mockRejectedValue(new Error("connection reset"));
    const res = await redeemCounterToken({
      kind: "code",
      value: code,
      stamps: 1,
      actor: CASHIER,
    });
    expect(res).toMatchObject({
      ok: false,
      error: "partial",
      stampsWritten: 0,
      code,
      memberLabel: "e***@ornek.com",
    });
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
    // Any real scan runs the sweep, even one that finds nothing.
    await redeemCounterToken({
      kind: "code",
      value: "ABCD2345",
      stamps: 1,
      actor: CASHIER,
    });
    expect(allTokens().some((r) => r.code === code)).toBe(false);
  });

  it("a refused typed address touches nothing, not even the sweep", async () => {
    const { code } = await issue();
    at(2 * 24 * 60 * 60 * 1000);
    await redeemCounterToken({
      kind: "email",
      value: MEMBER,
      stamps: 1,
      actor: CASHIER,
    });
    expect(allTokens().some((r) => r.code === code)).toBe(true);
  });
});
