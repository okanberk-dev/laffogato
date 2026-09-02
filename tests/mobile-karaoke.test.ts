import { describe, expect, it } from "vitest";

import {
  buildSlots,
  daysBetween,
  isCalendarDate,
  KARAOKE_BOOKING_WINDOW_DAYS,
  KARAOKE_CLOSE_HOUR,
  KARAOKE_FIRST_HOUR,
  ORO_DISCOUNT_PCT,
  quoteReservation,
  rangeConflicts,
  toReservationJson,
  validateReservationRequest,
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
});

describe("rangeConflicts", () => {
  const existing = [booking(14, 2)]; // 14:00 – 16:00

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

describe("quoteReservation — kuruş, server-side", () => {
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

  it("rejects hours outside 12–23 and durations outside 1–4", () => {
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

describe("toReservationJson — allow-list", () => {
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
    });
  });
});
