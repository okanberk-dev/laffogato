import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { istanbulClock } from "@/lib/mobile/venue";

describe("the venue's calendar, not UTC's", () => {
  it("istanbulClock names the Tuzla date just after midnight", () => {
    // 00:30 on 24 Sept in Tuzla is still 23 Sept in UTC.
    expect(istanbulClock(new Date("2026-09-23T21:30:00Z")).date).toBe(
      "2026-09-24",
    );
  });

  it("account deletion cancels only bookings from the venue's today on", () => {
    // toISOString() also cancelled yesterday's, already-sung nights between
    // 00:00 and 03:00 in Tuzla.
    const me = readFileSync("src/lib/mobile/me.ts", "utf8");
    const body = me.slice(me.indexOf("async function cancelFutureKaraoke"));
    expect(body).toContain("istanbulClock(now).date");
    expect(body.slice(0, 400)).not.toContain("toISOString().slice(0, 10)");
  });
});

describe("POST /loyalty/redeem refusal", () => {
  it("names the configured card size, not a literal 6", () => {
    const route = readFileSync(
      "src/app/api/mobile/v1/loyalty/redeem/route.ts",
      "utf8",
    );
    expect(route).toContain("${result.stampTarget} damga gerekiyor");
    expect(route).not.toContain("Ödül için 6 damga");
  });
});
