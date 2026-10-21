import { readFileSync } from "node:fs";

import { afterEach, describe, expect, it } from "vitest";

import {
  activeDatePreset,
  datePresets,
  istanbulDayOf,
} from "@/lib/admin/date-presets";
import { istanbulToday, shiftDay } from "@/lib/admin/day-close-core";
import { isIsoDate } from "@/lib/admin/list-params";

/**
 * The list filters' quick ranges (admin UI v2, UI-14). They are days on the
 * köşk's calendar (Europe/Istanbul, fixed UTC+3, CLAUDE.md rule 22), never
 * the server's UTC date and never the machine's zone.
 */

const at = (iso: string) => new Date(iso);
const range = (p: { from: string; to: string }) => `${p.from}..${p.to}`;
const byId = (now: Date) =>
  Object.fromEntries(datePresets(now).map((p) => [p.id, range(p)]));

describe("the six presets", () => {
  it("come in the bar's order, with their Turkish labels", () => {
    expect(datePresets(at("2026-10-21T09:00:00Z")).map((p) => p.label)).toEqual(
      ["Bugün", "Dün", "Son 7 gün", "Son 30 gün", "Bu ay", "Geçen ay"],
    );
  });

  it("midday: today, yesterday, a week and a month back, this and last month", () => {
    expect(byId(at("2026-10-21T09:00:00Z"))).toEqual({
      today: "2026-10-21..2026-10-21",
      yesterday: "2026-10-20..2026-10-20",
      // Today and the six days before it; today and the twenty-nine.
      last7: "2026-10-15..2026-10-21",
      last30: "2026-09-22..2026-10-21",
      // Whole calendar months: Bu ay runs to the month's last day.
      thisMonth: "2026-10-01..2026-10-31",
      lastMonth: "2026-09-01..2026-09-30",
    });
  });

  it("21:30Z is 00:30 the next day in Tuzla: the day has already turned", () => {
    // The UTC date of this instant is the 20th; the köşk's is the 21st.
    expect(byId(at("2026-10-20T21:30:00Z")).today).toBe(
      "2026-10-21..2026-10-21",
    );
    expect(byId(at("2026-10-20T21:30:00Z")).yesterday).toBe(
      "2026-10-20..2026-10-20",
    );
    // An hour earlier it is 23:30 on the 20th still.
    expect(byId(at("2026-10-20T20:30:00Z")).today).toBe(
      "2026-10-20..2026-10-20",
    );
    // The turn is exactly 21:00Z.
    expect(istanbulDayOf(at("2026-10-20T20:59:59.999Z"))).toBe("2026-10-20");
    expect(istanbulDayOf(at("2026-10-20T21:00:00.000Z"))).toBe("2026-10-21");
  });

  it("a month that turned at 00:30 in Tuzla moves Bu ay, Geçen ay and Dün with it", () => {
    // 21:30Z on 30 Sep is 00:30 on 1 Oct.
    expect(byId(at("2026-09-30T21:30:00Z"))).toEqual({
      today: "2026-10-01..2026-10-01",
      yesterday: "2026-09-30..2026-09-30",
      last7: "2026-09-25..2026-10-01",
      last30: "2026-09-02..2026-10-01",
      thisMonth: "2026-10-01..2026-10-31",
      lastMonth: "2026-09-01..2026-09-30",
    });
  });

  it("the year turns, and a leap February is 29 days", () => {
    expect(byId(at("2026-12-31T21:30:00Z"))).toMatchObject({
      today: "2027-01-01..2027-01-01",
      yesterday: "2026-12-31..2026-12-31",
      thisMonth: "2027-01-01..2027-01-31",
      lastMonth: "2026-12-01..2026-12-31",
    });
    expect(byId(at("2028-02-29T21:30:00Z"))).toMatchObject({
      today: "2028-03-01..2028-03-01",
      thisMonth: "2028-03-01..2028-03-31",
      lastMonth: "2028-02-01..2028-02-29",
    });
    expect(byId(at("2027-03-10T09:00:00Z")).lastMonth).toBe(
      "2027-02-01..2027-02-28",
    );
  });

  it("every range is real days, first not after last", () => {
    for (let d = 0; d < 800; d += 7) {
      const now = new Date(Date.UTC(2026, 0, 1) + d * 86_400_000 + 20_000_000);
      for (const p of datePresets(now)) {
        expect(isIsoDate(p.from) && isIsoDate(p.to), range(p)).toBe(true);
        expect(p.from <= p.to, range(p)).toBe(true);
      }
    }
  });
});

describe("the köşk's clock, not the machine's", () => {
  const original = process.env.TZ;
  afterEach(() => {
    if (original === undefined) delete process.env.TZ;
    else process.env.TZ = original;
  });

  it("answers the same under zones a day behind and a day ahead of UTC", () => {
    const instants = [
      "2026-10-20T20:59:59Z",
      "2026-10-20T21:30:00Z",
      "2026-10-21T02:00:00Z",
      "2026-12-31T21:00:00Z",
      "2028-02-29T21:30:00Z",
    ].map(at);
    const expected = instants.map((now) => datePresets(now));
    for (const zone of [
      "America/Los_Angeles",
      "Pacific/Kiritimati",
      "Europe/Istanbul",
    ]) {
      process.env.TZ = zone;
      expect(
        instants.map((now) => datePresets(now)),
        zone,
      ).toEqual(expected);
    }
  });

  it("agrees with the day-close module's istanbulToday and shiftDay, which it does not import", () => {
    // day-close-core brings the order filters with it; the bar is on most
    // panel pages, so the preset module keeps its own three lines and this
    // test keeps the two together.
    for (let h = 0; h < 24 * 400; h += 5) {
      const now = new Date(Date.UTC(2026, 0, 1) + h * 3_600_000 + 1_234_567);
      const today = istanbulToday(now);
      expect(istanbulDayOf(now)).toBe(today);
      const [yesterday, week] = datePresets(now).slice(1, 3);
      expect(yesterday.from).toBe(shiftDay(today, -1));
      expect(week.from).toBe(shiftDay(today, -6));
    }
  });

  it("reads no local-time getter and no zone lookup", () => {
    const src = readFileSync("src/lib/admin/date-presets.ts", "utf8")
      .split("\n")
      .filter((line) => !line.trimStart().startsWith("//"))
      .join("\n");
    expect(src).not.toMatch(
      /getLocalTimeZone|\.getDay\(|\.getDate\(|\.getMonth\(|\.getFullYear\(|\.getHours\(|toLocale|Intl\./,
    );
    expect(src).toMatch(/\.toISOString\(\)/);
  });
});

describe("which preset is on", () => {
  const presets = datePresets(at("2026-10-21T09:00:00Z"));

  it("a range that is exactly one marks it", () => {
    expect(activeDatePreset(presets, "2026-10-01", "2026-10-31")).toBe(
      "thisMonth",
    );
    expect(activeDatePreset(presets, "2026-10-21", "2026-10-21")).toBe("today");
  });

  it("any other range, one end, or none marks nothing", () => {
    expect(activeDatePreset(presets, "2026-10-01", "2026-10-30")).toBeNull();
    expect(activeDatePreset(presets, "2026-10-01", undefined)).toBeNull();
    expect(activeDatePreset(presets, undefined, "2026-10-31")).toBeNull();
    expect(activeDatePreset(presets, undefined, undefined)).toBeNull();
  });
});
