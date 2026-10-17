import { describe, expect, it } from "vitest";

import { openStatus } from "@/components/laffogato/open-status";
import { tinLabel } from "@/components/laffogato/visuals";

/**
 * The visit page's "Şu an açık" line. It used to be fixed text; now it is
 * worked out from the same rows the hours table prints, on the köşk's clock
 * (Europe/Istanbul, UTC+3) whatever zone the visitor or the server is in.
 */
const EVERY_DAY: Array<[string, string]> = [["Her gün", "09:00 - 02:00"]];
const WEEK: Array<[string, string]> = [
  ["Pazartesi", "Kapalı"],
  ["Salı", "09:00 - 22:00"],
  ["Çarşamba", "09:00 - 22:00"],
  ["Perşembe", "09:00 - 22:00"],
  ["Cuma", "09:00 - 02:00"],
  ["Cumartesi", "10:00 - 02:00"],
  ["Pazar", "10:00 - 20:00"],
];

/** An instant given as Istanbul wall-clock time (fixed UTC+3). */
const ist = (iso: string) => new Date(`${iso}+03:00`);

describe("openStatus", () => {
  it("is open inside the day's span and names the closing time", () => {
    // Fri 26 Sep 2026, 15:00 in Tuzla.
    expect(openStatus(EVERY_DAY, ist("2026-09-26T15:00:00"))).toEqual({
      open: true,
      at: "02:00",
    });
  });

  it("stays open past midnight on an overnight span", () => {
    // 01:15 belongs to the previous day's 09:00 - 02:00 shift.
    expect(openStatus(EVERY_DAY, ist("2026-09-27T01:15:00"))).toEqual({
      open: true,
      at: "02:00",
    });
  });

  it("reads the köşk's clock, not UTC", () => {
    // 23:30 UTC is 02:30 in Istanbul: closed, opening at 09:00 that day.
    // Reading the UTC hour would have said "open until 02:00".
    expect(openStatus(EVERY_DAY, new Date("2026-09-26T23:30:00Z"))).toEqual({
      open: false,
      at: "09:00",
      opensToday: true,
    });
  });

  it("skips a closed day to the next opening", () => {
    // Sun 27 Sep 2026, 21:00: Sunday closed at 20:00, Monday is closed all
    // day, so the next opening is Tuesday 09:00.
    expect(openStatus(WEEK, ist("2026-09-27T21:00:00"))).toEqual({
      open: false,
      at: "09:00",
      opensToday: false,
    });
  });

  it("gives up on rows it cannot read rather than guessing", () => {
    expect(
      openStatus([
        ["Hafta içi", "09:00 - 22:00"],
        ["Hafta sonu", "10:00 - 02:00"],
      ]),
    ).toBeNull();
    expect(
      openStatus([["Her gün", "Kapalı"]], ist("2026-09-26T15:00:00")),
    ).toEqual({
      open: false,
      at: null,
    });
  });
});

describe("tinLabel", () => {
  it("keeps a short name on one line at full size", () => {
    const fit = tinLabel("Sirena");
    expect(fit.lines).toEqual(["Sirena"]);
    expect(fit.size).toBeGreaterThan(20);
    expect(fit.note).toBeNull();
  });

  it("splits a dashed name into the blend and its descriptor", () => {
    const fit = tinLabel("Sirena - Espresso Harmanı");
    expect(fit.lines).toEqual(["Sirena"]);
    expect(fit.note).toBe("Espresso Harmanı");
    expect(fit.noteSize).toBeLessThan(fit.size);
  });

  it("wraps a long name onto two balanced lines instead of overflowing", () => {
    const fit = tinLabel("Hediye Seti Büyük Kutu");
    expect(fit.lines).toEqual(["Hediye Seti", "Büyük Kutu"]);
    // 80 units of label width at ~0.52 em per glyph.
    const longest = Math.max(...fit.lines.map((l) => l.length));
    expect(longest * fit.size * 0.52).toBeLessThanOrEqual(80.5);
  });
});
