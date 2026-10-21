import { readFileSync } from "node:fs";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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
const listStamps = vi.fn();

vi.mock("@/lib/admin/auth", () => ({ requireRole }));
vi.mock("@/lib/admin/audit", () => ({ logAudit }));
vi.mock("@/lib/customer/store", () => ({ getCustomerByEmail }));
vi.mock("@/lib/mobile/loyalty", () => ({ listStamps }));
vi.mock("@/lib/mobile/counter", async () => {
  const actual = await vi.importActual<typeof import("@/lib/mobile/counter")>(
    "@/lib/mobile/counter",
  );
  return {
    MIN_COUNTER_STAMPS: actual.MIN_COUNTER_STAMPS,
    MAX_COUNTER_STAMPS: actual.MAX_COUNTER_STAMPS,
    COUNTER_MAYBE_STAMPED: actual.COUNTER_MAYBE_STAMPED,
    COUNTER_EMAIL_REFUSED: actual.COUNTER_EMAIL_REFUSED,
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
  getCustomerByEmail.mockResolvedValue({
    email: "eda@ornek.com",
    isActive: true,
  });
  listStamps.mockReset();
  listStamps.mockResolvedValue([]);
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

  it("refuses a path that is not one of the two", async () => {
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
 * The typed-address path is closed (decision ASK-LOYALTY, 21 Ekim 2026).
 *
 * The QR and the code name a member by construction - the token row was minted
 * for the account whose app shows it. A typed address names a member who
 * showed nothing: it once collected ledger rows for `uye@gmial.com`, and it
 * burned no single-use code, so a second press gave the member another 1-5
 * stamps (ORD-13). Every case the path used to handle is now the same
 * refusal, in the decided words, before a member is looked up, a stamp is
 * written or an audit row is filed.
 */
const EMAIL_REFUSED =
  "E-postayla damga verilmiyor. Üyeden uygulamadaki kasa kodunu (QR ya da 8 karakterlik kod) göstermesini iste.";

function expectNothingDone(): void {
  expect(redeemCounterToken).not.toHaveBeenCalled();
  expect(logAudit).not.toHaveBeenCalled();
  expect(getCustomerByEmail).not.toHaveBeenCalled();
  expect(listStamps).not.toHaveBeenCalled();
}

describe("e-posta yolu · kapalı", () => {
  it("refuses a member's address in the decided words, writing nothing", async () => {
    const state = await redeemCounterTokenAction({
      kind: "email",
      value: "eda@ornek.com",
      stamps: 2,
    });
    expect(state).toEqual({ error: EMAIL_REFUSED });
    expectNothingDone();
  });

  it("answers an address with no member account the same way, so it tells nothing", async () => {
    getCustomerByEmail.mockResolvedValue(null);
    const state = await redeemCounterTokenAction({
      kind: "email",
      value: "uye@gmial.com",
      stamps: 1,
    });
    expect(state).toEqual({ error: EMAIL_REFUSED });
    expectNothingDone();
  });

  it("refuses a closed account's address too, without asking about it", async () => {
    getCustomerByEmail.mockResolvedValue({
      email: "eda@ornek.com",
      isActive: false,
    });
    const state = await redeemCounterTokenAction({
      kind: "email",
      value: "eda@ornek.com",
      stamps: 1,
    });
    expect(state.error).toBe(EMAIL_REFUSED);
    expectNothingDone();
  });

  it("refuses an empty address with the same words, not 'Önce bir QR okut'", async () => {
    const state = await redeemCounterTokenAction({
      kind: "email",
      value: "",
      stamps: 1,
    });
    expect(state.error).toBe(EMAIL_REFUSED);
    expectNothingDone();
  });

  it("still opens the till gate first: no answer at all without the role", async () => {
    requireRole.mockRejectedValue(new Error("NEXT_REDIRECT"));
    await expect(
      redeemCounterTokenAction({
        kind: "email",
        value: "eda@ornek.com",
        stamps: 1,
      }),
    ).rejects.toThrow();
    expectNothingDone();
  });

  it("does not touch the database, so a database outage cannot change the answer", async () => {
    getCustomerByEmail.mockRejectedValue(
      new DbUnreachableError("fetchCustomer", "ECONNREFUSED"),
    );
    redeemCounterToken.mockRejectedValue(
      new DbUnreachableError("counter.burn", "ECONNREFUSED"),
    );
    const state = await redeemCounterTokenAction({
      kind: "email",
      value: "eda@ornek.com",
      stamps: 1,
    });
    expect(state.error).toBe(EMAIL_REFUSED);
    expectNothingDone();
  });

  it("does not ask the customer table on the QR path - the token already names the member", async () => {
    await redeemCounterTokenAction({
      kind: "token",
      value: "jeton",
      stamps: 1,
    });
    expect(getCustomerByEmail).not.toHaveBeenCalled();
  });

  it("keeps the e-mail branch's helpers out of the action", () => {
    const src = readFileSync("src/app/admin/kasa/actions.ts", "utf8");
    expect(src).toContain(
      'const KINDS: readonly CounterRedeemKind[] = ["token", "code"];',
    );
    for (const gone of [
      "getCustomerByEmail",
      "listStamps",
      "REPEAT_WINDOW_MS",
      "repeat",
    ]) {
      expect(src, gone).not.toContain(gone);
    }
  });
});

/**
 * The repeat window lived for the e-mail path only (admin audit ORD-13, karar
 * D6): a typed address burned no code, so a second press inside three minutes
 * was asked about ("Tekrar ver"). With the path closed the window has nothing
 * left to guard; each of its old cases is now the refusal, and the QR and the
 * code stay single-use on their own.
 */
describe("e-posta yolu · tekrar penceresi yok", () => {
  const T0 = Date.parse("2026-10-17T12:00:00.000Z");

  function lastCounterStamp(ago: number, over: Record<string, unknown> = {}) {
    listStamps.mockResolvedValue([
      {
        id: "stamp-000009",
        kind: "earn",
        source: "counter",
        createdAt: new Date(T0 - ago).toISOString(),
        ...over,
      },
    ]);
  }

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(T0);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("answers an address inside three minutes of a counter stamp with the refusal, not the repeat question", async () => {
    lastCounterStamp(60_000);
    const state = await redeemCounterTokenAction({
      kind: "email",
      value: "eda@ornek.com",
      stamps: 2,
    });
    expect(state).toEqual({ error: EMAIL_REFUSED });
    expect(state).not.toHaveProperty("repeat");
    expectNothingDone();
  });

  it("ignores an old till's 'Tekrar ver' tick: still refused, nothing stamped", async () => {
    lastCounterStamp(60_000);
    const state = await redeemCounterTokenAction({
      kind: "email",
      value: "eda@ornek.com",
      stamps: 1,
      repeat: true,
    } as Parameters<typeof redeemCounterTokenAction>[0]);
    expect(state).toEqual({ error: EMAIL_REFUSED });
    expectNothingDone();
  });

  it("refuses an address after three minutes as well: time does not open the path", async () => {
    lastCounterStamp(3 * 60_000 + 1);
    const state = await redeemCounterTokenAction({
      kind: "email",
      value: "eda@ornek.com",
      stamps: 1,
    });
    expect(state.error).toBe(EMAIL_REFUSED);
    expectNothingDone();
  });

  it("refuses it whatever the last stamp was, an app order's included", async () => {
    lastCounterStamp(10_000, { source: "order" });
    const state = await redeemCounterTokenAction({
      kind: "email",
      value: "eda@ornek.com",
      stamps: 1,
    });
    expect(state.error).toBe(EMAIL_REFUSED);
    expectNothingDone();
  });

  it("leaves the QR and the code alone: their token is single-use", async () => {
    lastCounterStamp(1_000);
    const state = await redeemCounterTokenAction({
      kind: "code",
      value: "K7P42M9X",
      stamps: 1,
    });
    expect(state.result).toBeTruthy();
    expect(listStamps).not.toHaveBeenCalled();
  });
});

/**
 * After the write (admin audit ORD-12, ORD-M02): the audit row was written
 * with the throwing logAudit outside the try, and the till awaited the
 * action with no catch, so a failure after the stamps opened the panel's
 * error page and the cashier stamped again.
 */
describe("after the stamps", () => {
  it("does not throw when the audit row cannot be written", async () => {
    logAudit.mockRejectedValue(new Error("audit down"));
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const state = await redeemCounterTokenAction({
      kind: "code",
      value: "K7P42M9X",
      stamps: 1,
    });
    // Logged without the member's address (CLAUDE.md rule 9).
    expect(JSON.stringify(spy.mock.calls)).not.toContain("eda@ornek.com");
    spy.mockRestore();
    expect(state.result).toBeTruthy();
  });

  it("answers 'verilmiş olabilir' when the run stopped after the burn, and logs it", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    redeemCounterToken.mockResolvedValue({
      ok: false,
      error: "partial",
      message: "Damga verilmiş olabilir, üyenin kartını kontrol et.",
      stampsWritten: 1,
      stampsAsked: 3,
      code: "K7P42M9X",
      memberLabel: "e***@ornek.com",
      cause: new Error("insert failed"),
    });
    const state = await redeemCounterTokenAction({
      kind: "code",
      value: "K7P42M9X",
      stamps: 3,
    });
    spy.mockRestore();
    expect(state).toEqual({
      error: "Damga verilmiş olabilir, üyenin kartını kontrol et.",
      partial: true,
    });
    expect(state.error).not.toMatch(/Tekrar dene/);
    expect(logAudit).toHaveBeenCalledWith({
      action: "update",
      entity: "counter_token",
      entityId: "K7P42M9X",
      payload: { kind: "code", stamps: 1, asked: 3, partial: true },
    });
  });
});

describe("the till screen", () => {
  const src = readFileSync("src/app/admin/kasa/till-console.tsx", "utf8");

  it("answers a thrown action in place on both paths, never with the error page", async () => {
    const { COUNTER_MAYBE_STAMPED } = await import("@/lib/mobile/counter");
    expect(src).toContain(`const MAYBE_STAMPED = "${COUNTER_MAYBE_STAMPED}";`);
    expect(
      src.match(/next = \{ error: MAYBE_STAMPED, partial: true \};/g),
    ).toHaveLength(2);
  });

  it("retires a scanned code the server may have burned", () => {
    expect(src).toContain(
      "redeemed: Boolean(next.result) || Boolean(next.partial)",
    );
  });

  it("keeps Damga ver off after a receipt until Yeni işlem, and empties the field", () => {
    expect(src).toContain("Boolean(state.result) || Boolean(state.partial)");
    // One typed path left: the code.
    expect(src.match(/disabled=\{pending \|\| settled\}/g)).toHaveLength(1);
    expect(src).toContain('if (next.result || next.partial) setCode("");');
    expect(src).toContain("Yeni işlem");
  });

  it("has no e-mail tab, no address field and no repeat box (ASK-LOYALTY)", () => {
    for (const gone of [
      "E-posta ile",
      'type="email"',
      "Üye e-postası",
      'kind: "email"',
      "state.repeat",
      "Tekrar ver",
      "setEmail",
    ]) {
      expect(src, gone).not.toContain(gone);
    }
    expect(src).toContain('type Tab = "camera" | "code";');
  });

  it("tells the cashier what to do when the QR will not scan, under the code tab", () => {
    expect(src).toContain(
      '"QR okunmuyorsa üyeden kodun altındaki 8 karakteri söylemesini iste."',
    );
    // Drawn inside the code tab's card, after its form.
    const codeTab = src.slice(src.indexOf('{tab === "code" && ('));
    expect(codeTab.indexOf("{CODE_HINT}")).toBeGreaterThan(
      codeTab.indexOf("</form>"),
    );
    expect(codeTab.indexOf("{CODE_HINT}")).toBeLessThan(
      codeTab.indexOf("</Card>"),
    );
  });

  it("draws two tabs, the camera first, and the page no longer offers the address", async () => {
    vi.doMock("@/app/admin/kasa/actions", () => ({
      redeemCounterTokenAction: vi.fn(),
    }));
    const { renderToStaticMarkup } = await import("react-dom/server");
    const { createElement } = await import("react");
    const { TillConsole } = await import("@/app/admin/kasa/till-console");
    const html = renderToStaticMarkup(createElement(TillConsole));
    const tabs = [
      ...html.matchAll(/aria-pressed="(?:true|false)"[^>]*>([^<]+)</g),
    ].map((m) => m[1]);
    expect(tabs).toEqual(["Kamera ile okut", "Kodu yaz"]);
    expect(html).not.toContain("E-posta");
    vi.doUnmock("@/app/admin/kasa/actions");
    const page = readFileSync("src/app/admin/kasa/page.tsx", "utf8");
    expect(page).not.toContain("e-postasını kullan");
    expect(page).toContain("E-postayla damga verilmez.");
  });
});
