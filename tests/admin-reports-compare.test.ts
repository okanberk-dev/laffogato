import { describe, expect, it, vi } from "vitest";

/**
 * Raporlar reads each figure against the period just before it (Innex,
 * 22 Eki 2026). The current period runs up to now, its last bucket only
 * partly gone, so the previous one stops at the same point (review of
 * #231: flat sales read as a fall on a Monday morning and on the 1st).
 */

vi.mock("@/lib/db", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/db")>();
  return {
    ...real,
    getDb: () => {
      throw new Error("no database in this test");
    },
  };
});

const store = await import("@/lib/admin/store");

const HOUR = 3_600_000;

/** One ₺100 paid order every hour from `from` up to `to`, inclusive. */
function hourly(from: Date, to: Date) {
  const out = [];
  for (let t = from.getTime(); t <= to.getTime(); t += HOUR) {
    out.push({
      status: "completed" as const,
      createdAt: new Date(t).toISOString(),
      totalMinor: 10_000,
      refunds: [],
    });
  }
  return out;
}

describe("the previous period stops where the current one is", () => {
  const cases = [
    // Monday 09:00 in Tuzla (06:00Z), "Son 12 hafta".
    ["week", 12, "2026-10-26T06:00:00.000Z"],
    // The 1st of November, 09:00, "Son 12 ay".
    ["month", 12, "2026-11-01T06:00:00.000Z"],
    // Any morning, "Son 30 gün".
    ["day", 30, "2026-10-23T05:30:00.000Z"],
    // Late on the last day of January.
    ["month", 12, "2027-01-31T18:00:00.000Z"],
  ] as const;

  for (const [granularity, count, at] of cases) {
    it(`flat sales read flat: ${granularity} × ${count} at ${at}`, () => {
      const now = new Date(at);
      const orders = hourly(new Date(now.getTime() - 800 * 24 * HOUR), now);
      const { current, previous } = store.comparedHeadlines(
        orders,
        granularity,
        count,
        now,
      );
      // Same length up to the hour boundary of a shorter month: never the
      // ~8% "fall" a whole previous period against a partial one showed.
      const ratio = previous.grossRevenueMinor / current.grossRevenueMinor;
      expect(ratio, `${current.totalOrders} vs ${previous.totalOrders}`).toBe(
        granularity === "month" ? ratio : 1,
      );
      expect(Math.abs(1 - ratio)).toBeLessThan(0.02);
    });
  }

  it("cuts a calendar month back at the same day and hour, clamped to its end", () => {
    // 31 March 10:00 in Tuzla: a month back is 28 February 10:00.
    expect(
      store
        .previousPeriodEnd("month", 1, new Date("2027-03-31T07:00:00.000Z"))
        .toISOString(),
    ).toBe("2027-02-28T07:00:00.000Z");
    // Twelve months back, across a year.
    expect(
      store
        .previousPeriodEnd("month", 12, new Date("2026-11-01T06:00:00.000Z"))
        .toISOString(),
    ).toBe("2025-11-01T06:00:00.000Z");
    // 00:30 on the 1st in Tuzla is still the 31st in UTC: the köşk's day.
    expect(
      store
        .previousPeriodEnd("month", 1, new Date("2026-10-31T21:30:00.000Z"))
        .toISOString(),
    ).toBe("2026-09-30T21:30:00.000Z");
    expect(
      store
        .previousPeriodEnd("week", 2, new Date("2026-10-26T06:00:00.000Z"))
        .toISOString(),
    ).toBe("2026-10-12T06:00:00.000Z");
    expect(
      store
        .previousPeriodEnd("day", 30, new Date("2026-10-23T05:30:00.000Z"))
        .toISOString(),
    ).toBe("2026-09-23T05:30:00.000Z");
  });
});
