import { beforeEach, describe, expect, it, vi } from "vitest";

import { createDb, type Executor } from "@/lib/db/client";

/**
 * WP1: a member's karaoke bookings are found through the index.
 *
 * `listMine` (GET /karaoke/reservations, /karaoke on the web) and
 * `listReservationDecisions` (every GET /notifications) matched the e-mail
 * with an `ILIKE` prefilter. `karaoke_reservations_email_idx` is on
 * `lower("customerEmail")` and Postgres has no btree opclass for ILIKE, so
 * both were sequential scans - 47 ms and 66 ms at 50k bookings on a local
 * Postgres 16, against 0.07 ms through the index. The orders read had the
 * same bug and the same fix (tests/mobile-order-reads.test.ts).
 */

const seen: string[] = [];
let rowsOut: Record<string, unknown>[] = [];
const exec: Executor = async ({ text }) => {
  seen.push(text);
  return { rows: rowsOut, rowCount: rowsOut.length };
};

vi.mock("@/lib/db", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/db")>();
  const db = createDb(exec);
  return { ...real, getDb: () => db };
});

const karaoke = await import("@/lib/mobile/karaoke");

function booking(email: string): Record<string, unknown> {
  return {
    id: `kar-${email}`,
    customerEmail: email,
    customerName: "",
    date: "2026-10-20",
    startHour: 20,
    hours: 1,
    guests: 2,
    status: "confirmed",
    priceMinor: 0,
    discountMinor: 0,
    totalMinor: 0,
    note: "",
    createdAt: "2026-10-01T00:00:00.000Z",
    updatedAt: "2026-10-02T00:00:00.000Z",
  };
}

beforeEach(() => {
  seen.length = 0;
  rowsOut = [];
});

describe("karaoke member reads use the lower() index", () => {
  it("listMine", async () => {
    rowsOut = [booking("Ayse@Example.com")];
    const mine = await karaoke.listMine(" AYSE@example.com ");
    expect(mine).toHaveLength(1);
    const [sql] = seen;
    expect(sql).toContain('lower("customerEmail") = lower($1)');
    expect(sql).not.toContain("ILIKE");
  });

  it("listReservationDecisions", async () => {
    await karaoke.listReservationDecisions(
      "ayse@example.com",
      "2026-09-01T00:00:00.000Z",
    );
    const [sql] = seen;
    expect(sql).toContain('lower("customerEmail") = lower($1)');
    expect(sql).not.toContain("ILIKE");
  });

  it("still keeps only the member's own rows", async () => {
    rowsOut = [booking("ayse@example.com"), booking("someone@example.com")];
    const mine = await karaoke.listMine("ayse@example.com");
    expect(mine.map((r) => r.customerEmail)).toEqual(["ayse@example.com"]);
  });

  it("an address with LIKE metacharacters is matched literally", async () => {
    // The ILIKE version had to escape `_` and `%`; equality needs nothing.
    rowsOut = [booking("a_b@example.com")];
    expect(await karaoke.listMine("a_b@example.com")).toHaveLength(1);
  });
});
