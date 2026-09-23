import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The daily birthday run - the answer to the operator's own question, "üyelere
 * doğum gününde mail gidiyor mu?".
 *
 * Until this existed the answer was no on both counts: `sendBirthdayEmail` was
 * written, tested and called from nowhere, and the coupon it talks about was
 * only granted if the member happened to open the web promotions page during
 * their birthday MONTH - so an app-only member got neither.
 *
 * What is pinned here is the part that is easy to get wrong later:
 *
 *   • the gift and the message are not the same thing. The coupon is an
 *     entitlement and goes to every member whose day it is; the celebration
 *     carries a %20 offer, so it is commercial under 6563 and goes only to a
 *     member with the marketing preference AND a consent record.
 *   • the idempotency key is the coupon row. `grantBirthdayCouponToday`
 *     answering `null` means "already greeted this year", and then no message
 *     goes out - a second run of the cron greets nobody twice.
 *   • the calendar is Tuzla's, and 29 February is greeted on 1 March in a
 *     common year.
 */

const rpc = vi.fn();
const grantBirthdayCouponToday = vi.fn();
const ensureCustomerUnsubToken = vi.fn();
const sendBirthdayEmail = vi.fn();

// `rpcRows`: the audience function RETURNS TABLE. It used to be called via
// `rpc`, whose one-cell read turned the rows into a record string - and this
// mock, handing back an array to `rpc`, is exactly what hid that.
vi.mock("@/lib/db", () => ({ getDb: () => ({ rpcRows: rpc }) }));
vi.mock("@/lib/customer/coupons", () => ({ grantBirthdayCouponToday }));
vi.mock("@/lib/email/campaigns", () => ({ ensureCustomerUnsubToken }));
vi.mock("@/lib/email/send", () => ({ sendBirthdayEmail }));

const { birthdayDaysFor, runBirthdayGreetings } =
  await import("@/app/api/cron/_birthday");

interface Row {
  email: string;
  name: string;
  marketing: boolean;
}

function audience(rows: Row[]): void {
  rpc.mockResolvedValue({ data: rows, error: null, status: 200 });
}

function coupon(code: string, expiresAt = "2026-09-23T20:59:59.000Z") {
  return { code, expiresAt };
}

beforeEach(() => {
  vi.clearAllMocks();
  audience([]);
  grantBirthdayCouponToday.mockResolvedValue(coupon("DG-ABC123"));
  ensureCustomerUnsubToken.mockResolvedValue("tok-1");
  sendBirthdayEmail.mockResolvedValue(true);
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("which day is being greeted", () => {
  it("uses Tuzla's calendar, not the server's", () => {
    // 21:30 UTC on 15 September is already the 16th in Istanbul. A birthday
    // is a calendar fact where the member lives.
    expect(birthdayDaysFor(new Date("2026-09-15T21:30:00.000Z"))).toEqual([
      "09-16",
    ]);
    expect(birthdayDaysFor(new Date("2026-09-15T20:30:00.000Z"))).toEqual([
      "09-15",
    ]);
  });

  it("greets a leap-day member on 1 March of a common year", () => {
    expect(birthdayDaysFor(new Date("2027-03-01T06:00:00.000Z"))).toEqual([
      "03-01",
      "02-29",
    ]);
  });

  it("leaves 1 March alone in a leap year - the 29th is coming", () => {
    expect(birthdayDaysFor(new Date("2028-03-01T06:00:00.000Z"))).toEqual([
      "03-01",
    ]);
    expect(birthdayDaysFor(new Date("2028-02-29T06:00:00.000Z"))).toEqual([
      "02-29",
    ]);
  });

  it("knows a century is not a leap year unless it divides by 400", () => {
    expect(birthdayDaysFor(new Date("2100-03-01T06:00:00.000Z"))).toContain(
      "02-29",
    );
    expect(birthdayDaysFor(new Date("2000-03-01T06:00:00.000Z"))).not.toContain(
      "02-29",
    );
  });

  it("asks the database for exactly those days", async () => {
    await runBirthdayGreetings(new Date("2026-09-16T06:00:00.000Z"));
    expect(rpc).toHaveBeenCalledWith("birthday_greeting_audience", {
      p_month_days: ["09-16"],
    });
  });
});

describe("the gift and the message are not the same thing", () => {
  it("greets a member who consented to commercial mail", async () => {
    audience([{ email: "ayse@ornek.com", name: "Ayşe", marketing: true }]);
    grantBirthdayCouponToday.mockResolvedValue(
      coupon("DG-KAHVE1", "2026-09-23T20:59:59.000Z"),
    );

    const result = await runBirthdayGreetings(
      new Date("2026-09-16T06:00:00.000Z"),
    );

    expect(grantBirthdayCouponToday).toHaveBeenCalledWith(
      "ayse@ornek.com",
      2026,
      expect.any(Date),
    );
    expect(sendBirthdayEmail).toHaveBeenCalledWith({
      to: "ayse@ornek.com",
      name: "Ayşe",
      unsubToken: "tok-1",
      couponCode: "DG-KAHVE1",
      // Formatted on Tuzla's calendar: the instant is 23:59 local on the 23rd.
      expiresAt: "23 Eylül 2026",
    });
    expect(result).toMatchObject({
      granted: 1,
      mailed: 1,
      skippedNoConsent: 0,
    });
  });

  it("gives the coupon but stays silent without marketing consent", async () => {
    audience([{ email: "mehmet@ornek.com", name: "Mehmet", marketing: false }]);

    const result = await runBirthdayGreetings(
      new Date("2026-09-16T06:00:00.000Z"),
    );

    expect(grantBirthdayCouponToday).toHaveBeenCalledTimes(1);
    expect(sendBirthdayEmail).not.toHaveBeenCalled();
    // No token is minted for someone who is not being written to.
    expect(ensureCustomerUnsubToken).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      granted: 1,
      mailed: 0,
      skippedNoConsent: 1,
    });
  });
});

describe("idempotency is the coupon row", () => {
  it("sends nothing when this year's coupon was already granted", async () => {
    audience([{ email: "ayse@ornek.com", name: "Ayşe", marketing: true }]);
    grantBirthdayCouponToday.mockResolvedValue(null);

    const result = await runBirthdayGreetings(
      new Date("2026-09-16T06:00:00.000Z"),
    );

    expect(sendBirthdayEmail).not.toHaveBeenCalled();
    expect(result).toMatchObject({ candidates: 1, granted: 0, mailed: 0 });
  });

  it("a second run of the same cron greets nobody twice", async () => {
    audience([{ email: "ayse@ornek.com", name: "Ayşe", marketing: true }]);
    const now = new Date("2026-09-16T06:00:00.000Z");
    grantBirthdayCouponToday.mockResolvedValueOnce(coupon("DG-1"));
    grantBirthdayCouponToday.mockResolvedValue(null);

    await runBirthdayGreetings(now);
    await runBirthdayGreetings(now);

    expect(sendBirthdayEmail).toHaveBeenCalledTimes(1);
  });
});

describe("one member's bad day is not everyone's", () => {
  it("carries on past a failure, and never logs the address in full", async () => {
    audience([
      { email: "kirik@ornek.com", name: "Kırık", marketing: true },
      { email: "ayse@ornek.com", name: "Ayşe", marketing: true },
    ]);
    grantBirthdayCouponToday.mockImplementation(async (email: string) =>
      email === "kirik@ornek.com"
        ? Promise.reject(new Error("pool exhausted"))
        : coupon("DG-2"),
    );

    const result = await runBirthdayGreetings(
      new Date("2026-09-16T06:00:00.000Z"),
    );

    expect(result).toMatchObject({ candidates: 2, granted: 1, mailed: 1 });
    const logged = (
      console.error as unknown as { mock: { calls: unknown[][] } }
    ).mock.calls
      .flat()
      .map(String)
      .join(" ");
    expect(logged).toContain("ki***@ornek.com");
    expect(logged).not.toContain("kirik@ornek.com");
  });

  it("counts only the messages the provider actually took", async () => {
    audience([{ email: "ayse@ornek.com", name: "Ayşe", marketing: true }]);
    sendBirthdayEmail.mockResolvedValue(false);

    const result = await runBirthdayGreetings(
      new Date("2026-09-16T06:00:00.000Z"),
    );

    expect(result).toMatchObject({ granted: 1, mailed: 0 });
  });

  it("turns a database error into a thrown run, not a silent empty one", async () => {
    rpc.mockResolvedValue({
      data: null,
      error: { code: "57P01", message: "terminating connection" },
      status: 500,
    });
    await expect(
      runBirthdayGreetings(new Date("2026-09-16T06:00:00.000Z")),
    ).rejects.toThrow(/birthday_greeting_audience/);
  });
});
