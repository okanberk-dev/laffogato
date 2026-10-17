import { describe, expect, it } from "vitest";

import { DEFAULT_MOBILE_APP_CONFIG } from "@/lib/mobile/app-config";
import {
  buildSlots,
  daysBetween,
  DEFAULT_KARAOKE_RULES,
  isCalendarDate,
  KARAOKE_BOOKING_WINDOW_DAYS,
  KARAOKE_CLOSE_HOUR,
  KARAOKE_FIRST_HOUR,
  KARAOKE_MAX_HOURS,
  karaokeDiscountPct,
  ORO_DISCOUNT_PCT,
  quoteReservation,
  rangeConflicts,
  toReservationJson,
  validateReservationRequest,
  type KaraokeRules,
  type KaraokeReservation,
} from "@/lib/mobile/karaoke";

function booking(
  startHour: number,
  hours: number,
  status: KaraokeReservation["status"] = "requested",
) {
  return { startHour, hours, status };
}

describe("buildSlots", () => {
  it("lists every hour from 12:00 to 23:00, all free on an empty day", () => {
    const slots = buildSlots([]);
    expect(slots).toHaveLength(KARAOKE_CLOSE_HOUR - KARAOKE_FIRST_HOUR);
    expect(slots[0]).toEqual({ startHour: 12, available: true });
    expect(slots.at(-1)).toEqual({ startHour: 23, available: true });
    expect(slots.every((s) => s.available)).toBe(true);
  });

  it("blocks every hour a requested or confirmed booking covers", () => {
    const slots = buildSlots([
      booking(16, 2, "requested"),
      booking(20, 1, "confirmed"),
    ]);
    const taken = slots.filter((s) => !s.available).map((s) => s.startHour);
    expect(taken).toEqual([16, 17, 20]);
  });

  it("ignores cancelled bookings", () => {
    const slots = buildSlots([booking(16, 2, "cancelled")]);
    expect(slots.every((s) => s.available)).toBe(true);
  });

  it("follows firstHour/closeHour from the configured rules", () => {
    const slots = buildSlots([], undefined, { firstHour: 14, closeHour: 22 });
    expect(slots.map((s) => s.startHour)).toEqual([
      14, 15, 16, 17, 18, 19, 20, 21,
    ]);
    expect(slots.every((s) => s.available)).toBe(true);
  });

  it("marks hours already past as unavailable on the configured day", () => {
    const slots = buildSlots([], 15 * 60 + 10, {
      firstHour: 14,
      closeHour: 18,
    });
    expect(slots.map((s) => s.available)).toEqual([false, false, true, true]);
  });
});

describe("rangeConflicts", () => {
  const existing = [booking(14, 2)]; // 14:00 - 16:00

  it("detects overlap in both directions", () => {
    expect(rangeConflicts(15, 1, existing)).toBe(true); // inside
    expect(rangeConflicts(13, 2, existing)).toBe(true); // overlaps the start
    expect(rangeConflicts(15, 3, existing)).toBe(true); // overlaps the end
    expect(rangeConflicts(12, 4, existing)).toBe(true); // covers it
  });

  it("treats back-to-back bookings as compatible", () => {
    expect(rangeConflicts(12, 2, existing)).toBe(false); // ends 14:00
    expect(rangeConflicts(16, 2, existing)).toBe(false); // starts 16:00
  });

  it("frees the hours of a cancelled booking", () => {
    expect(rangeConflicts(14, 1, [booking(14, 2, "cancelled")])).toBe(false);
  });
});

describe("quoteReservation - kuruş, server-side", () => {
  it("multiplies hours by the hourly rate", () => {
    expect(quoteReservation(2, 90_000, "verde")).toEqual({
      priceMinor: 180_000,
      discountMinor: 0,
      totalMinor: 180_000,
    });
  });

  it("gives ORO members the contract discount", () => {
    const q = quoteReservation(2, 90_000, "oro");
    expect(ORO_DISCOUNT_PCT).toBe(15);
    expect(q).toEqual({
      priceMinor: 180_000,
      discountMinor: 27_000,
      totalMinor: 153_000,
    });
  });

  it("gives ARGENTO and unknown tiers nothing", () => {
    expect(quoteReservation(1, 90_000, "argento").discountMinor).toBe(0);
    expect(quoteReservation(1, 90_000, "").discountMinor).toBe(0);
    expect(quoteReservation(1, 90_000, undefined).discountMinor).toBe(0);
  });

  it("rounds the discount to whole kuruş", () => {
    // 1 × 33 333 = 33 333; 15 % = 4 999.95 → 5 000
    expect(quoteReservation(1, 33_333, "oro")).toEqual({
      priceMinor: 33_333,
      discountMinor: 5_000,
      totalMinor: 28_333,
    });
  });

  it("takes the ORO percentage from the configured rules", () => {
    expect(karaokeDiscountPct("oro", 25)).toBe(25);
    expect(karaokeDiscountPct("argento", 25)).toBe(0);
    expect(quoteReservation(2, 90_000, "oro", 25)).toEqual({
      priceMinor: 180_000,
      discountMinor: 45_000,
      totalMinor: 135_000,
    });
    // 0 % is a legal setting: ORO pays full price, nothing goes negative.
    expect(quoteReservation(2, 90_000, "oro", 0)).toEqual({
      priceMinor: 180_000,
      discountMinor: 0,
      totalMinor: 180_000,
    });
  });
});

describe("defaults mirror the app config", () => {
  it("keeps the exported constants equal to DEFAULT_MOBILE_APP_CONFIG.karaoke", () => {
    expect(DEFAULT_KARAOKE_RULES).toEqual(DEFAULT_MOBILE_APP_CONFIG.karaoke);
    expect(KARAOKE_FIRST_HOUR).toBe(12);
    expect(KARAOKE_CLOSE_HOUR).toBe(24);
    expect(KARAOKE_MAX_HOURS).toBe(4);
    expect(KARAOKE_BOOKING_WINDOW_DAYS).toBe(60);
    expect(ORO_DISCOUNT_PCT).toBe(15);
  });
});

describe("calendar helpers", () => {
  it("accepts real dates and rejects impossible ones", () => {
    expect(isCalendarDate("2026-09-01")).toBe(true);
    expect(isCalendarDate("2026-02-30")).toBe(false);
    expect(isCalendarDate("2026-13-01")).toBe(false);
    expect(isCalendarDate("01-09-2026")).toBe(false);
    expect(isCalendarDate("")).toBe(false);
  });

  it("counts whole days, negative when the target is in the past", () => {
    expect(daysBetween("2026-08-30", "2026-08-30")).toBe(0);
    expect(daysBetween("2026-08-30", "2026-09-01")).toBe(2);
    expect(daysBetween("2026-08-30", "2026-08-29")).toBe(-1);
    expect(daysBetween("2026-08-30", "2026-10-29")).toBe(60);
  });
});

describe("validateReservationRequest", () => {
  const ctx = { today: "2026-08-30", capacity: 8 };
  const good = { date: "2026-09-05", startHour: 18, hours: 2, guests: 4 };

  it("accepts a valid request and defaults the note", () => {
    const r = validateReservationRequest(good, ctx);
    expect(r).toEqual({ ok: true, value: { ...good, note: "" } });
  });

  it("allows today and the last day of the window", () => {
    expect(
      validateReservationRequest({ ...good, date: "2026-08-30" }, ctx).ok,
    ).toBe(true);
    expect(
      validateReservationRequest({ ...good, date: "2026-10-29" }, ctx).ok,
    ).toBe(true);
    expect(KARAOKE_BOOKING_WINDOW_DAYS).toBe(60);
  });

  it("rejects a past date with a Turkish message", () => {
    const r = validateReservationRequest({ ...good, date: "2026-08-29" }, ctx);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.message).toMatch(/Geçmiş/);
  });

  it("rejects a date beyond the booking window", () => {
    const r = validateReservationRequest({ ...good, date: "2026-10-30" }, ctx);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.message).toMatch(/60 gün/);
  });

  it("rejects hours outside 12-23 and durations outside 1-4", () => {
    expect(validateReservationRequest({ ...good, startHour: 11 }, ctx).ok).toBe(
      false,
    );
    expect(validateReservationRequest({ ...good, startHour: 24 }, ctx).ok).toBe(
      false,
    );
    expect(validateReservationRequest({ ...good, hours: 0 }, ctx).ok).toBe(
      false,
    );
    expect(validateReservationRequest({ ...good, hours: 5 }, ctx).ok).toBe(
      false,
    );
    expect(validateReservationRequest({ ...good, hours: 2.5 }, ctx).ok).toBe(
      false,
    );
  });

  it("does not let a booking run past the midnight close", () => {
    const r = validateReservationRequest(
      { ...good, startHour: 23, hours: 2 },
      ctx,
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.message).toMatch(/kapanır/);
    expect(
      validateReservationRequest({ ...good, startHour: 22, hours: 2 }, ctx).ok,
    ).toBe(true);
  });

  it("caps guests at the room capacity from settings", () => {
    const r = validateReservationRequest({ ...good, guests: 9 }, ctx);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.message).toMatch(/8 kişi/);
    expect(validateReservationRequest({ ...good, guests: 0 }, ctx).ok).toBe(
      false,
    );
  });

  it("rejects a malformed date and a non-object body", () => {
    expect(
      validateReservationRequest({ ...good, date: "2026-02-30" }, ctx).ok,
    ).toBe(false);
    expect(validateReservationRequest(null, ctx).ok).toBe(false);
    expect(validateReservationRequest("x", ctx).ok).toBe(false);
  });

  it("trims and bounds the note", () => {
    const r = validateReservationRequest(
      { ...good, note: "  Doğum günü  " },
      ctx,
    );
    expect(r.ok && r.value.note).toBe("Doğum günü");
    expect(
      validateReservationRequest({ ...good, note: "x".repeat(201) }, ctx).ok,
    ).toBe(false);
  });
});

describe("validateReservationRequest - configured rules", () => {
  const rules: KaraokeRules = {
    firstHour: 14,
    closeHour: 22,
    maxHours: 2,
    bookingWindowDays: 7,
    oroDiscountPct: 10,
  };
  const ctx = { today: "2026-08-30", capacity: 8, rules };
  const good = { date: "2026-09-02", startHour: 18, hours: 2, guests: 4 };

  it("accepts a request inside the configured window and hours", () => {
    expect(validateReservationRequest(good, ctx).ok).toBe(true);
    expect(
      validateReservationRequest({ ...good, date: "2026-09-06" }, ctx).ok,
    ).toBe(true); // day 7 - last allowed
  });

  it("rejects a date beyond the configured bookingWindowDays", () => {
    const r = validateReservationRequest({ ...good, date: "2026-09-07" }, ctx);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.message).toMatch(/7 gün/);
    // The same date is fine under the 60-day default.
    expect(
      validateReservationRequest(
        { ...good, date: "2026-09-07" },
        { today: ctx.today, capacity: 8 },
      ).ok,
    ).toBe(true);
  });

  it("rejects a start before firstHour or at/after closeHour", () => {
    const early = validateReservationRequest({ ...good, startHour: 13 }, ctx);
    expect(early.ok).toBe(false);
    if (!early.ok) expect(early.message).toMatch(/14:00/);
    const late = validateReservationRequest(
      { ...good, startHour: 22, hours: 1 },
      ctx,
    );
    expect(late.ok).toBe(false);
    if (!late.ok) expect(late.message).toMatch(/21:00/);
    // 12:00 is legal under the defaults but not under these rules.
    expect(validateReservationRequest({ ...good, startHour: 12 }, ctx).ok).toBe(
      false,
    );
  });

  it("caps the block at maxHours and at the configured close", () => {
    const long = validateReservationRequest({ ...good, hours: 3 }, ctx);
    expect(long.ok).toBe(false);
    if (!long.ok) expect(long.message).toMatch(/2 saat/);
    const spill = validateReservationRequest(
      { ...good, startHour: 21, hours: 2 },
      ctx,
    );
    expect(spill.ok).toBe(false);
    if (!spill.ok) expect(spill.message).toMatch(/22:00'te kapanır/);
    expect(
      validateReservationRequest({ ...good, startHour: 20, hours: 2 }, ctx).ok,
    ).toBe(true);
  });
});

describe("toReservationJson - allow-list", () => {
  it("never exposes the customer's e-mail or the internal note", () => {
    const row: KaraokeReservation = {
      id: "krk-00001",
      customerEmail: "eda@example.com",
      customerName: "Eda",
      date: "2026-09-05",
      startHour: 18,
      hours: 2,
      guests: 4,
      status: "requested",
      priceMinor: 180_000,
      discountMinor: 27_000,
      totalMinor: 153_000,
      note: "Doğum günü",
      createdAt: "2026-08-30T10:00:00.000Z",
      updatedAt: "2026-08-30T10:00:00.000Z",
    };
    expect(toReservationJson(row)).toEqual({
      id: "krk-00001",
      date: "2026-09-05",
      startHour: 18,
      hours: 2,
      guests: 4,
      status: "requested",
      priceMinor: 180_000,
      discountMinor: 27_000,
      totalMinor: 153_000,
      createdAt: "2026-08-30T10:00:00.000Z",
      // Additive (16 Eki 2026): money state, an unpaid hold's deadline, and
      // the last moment of a free cancel (18:00 Tuzla - 2 h = 13:00Z).
      paymentStatus: "none",
      paymentDueAt: "",
      cancellableUntil: "2026-09-05T13:00:00.000Z",
      // Additive (17 Eki 2026): the booking's KDV rate; none was kept then.
      taxRatePct: null,
    });
  });
});

describe("validateReservationRequest - which field a 400 is about (L7-21)", () => {
  const ctx = { today: "2026-08-30", capacity: 8 };
  const good = { date: "2026-09-05", startHour: 18, hours: 2, guests: 4 };

  it("names the note when the note is what failed", () => {
    for (const note of ["x".repeat(201), 42]) {
      const r = validateReservationRequest({ ...good, note }, ctx);
      expect(r.ok).toBe(false);
      if (r.ok) return;
      expect(r.field).toBe("note");
    }
  });

  it("names no field for any other refusal", () => {
    const r = validateReservationRequest({ ...good, startHour: 3 }, ctx);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.field).toBeUndefined();
  });
});
