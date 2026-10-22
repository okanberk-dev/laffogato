import { describe, expect, it } from "vitest";

import type { WeeklyHours } from "@/lib/admin/days";

import {
  defaultVenueStatus,
  isCafeOpenForOrder,
  isCafeOpenNow,
  isOpenByHours,
  istanbulClock,
  parseClock,
  toLiveStatus,
} from "@/lib/mobile/venue";

/** Every day 09:00 - 01:00 (the house's real schedule; close is next morning). */
function lateHours(): WeeklyHours {
  const day = { open: "09:00", close: "01:00", closed: false };
  return {
    mon: { ...day },
    tue: { ...day },
    wed: { ...day },
    thu: { ...day },
    fri: { ...day },
    sat: { ...day },
    sun: { ...day },
  };
}

function dayHours(open: string, close: string): WeeklyHours {
  const day = { open, close, closed: false };
  return {
    mon: { ...day },
    tue: { ...day },
    wed: { ...day },
    thu: { ...day },
    fri: { ...day },
    sat: { ...day },
    sun: { ...day },
  };
}

/**
 * Istanbul is UTC+3 all year (no DST since 2016). 2026-08-31 is a Monday, so
 * Tuesday 00:30 local is Monday 21:30 UTC.
 */
function istanbul(localIso: string): Date {
  return new Date(`${localIso}+03:00`);
}

describe("istanbulClock", () => {
  it("reads the wall clock in Europe/Istanbul, not UTC", () => {
    const c = istanbulClock(istanbul("2026-09-01T00:30:00"));
    expect(c.day).toBe("tue");
    expect(c.minutes).toBe(30);
    expect(c.date).toBe("2026-09-01");
  });

  it("rolls the calendar day at local midnight", () => {
    // 23:30 local on Monday is still Monday even though UTC is already Monday 20:30.
    const c = istanbulClock(istanbul("2026-08-31T23:30:00"));
    expect(c.day).toBe("mon");
    expect(c.date).toBe("2026-08-31");
  });
});

describe("parseClock", () => {
  it("parses HH:MM and treats 24:00 as the end of the day", () => {
    expect(parseClock("09:00")).toBe(540);
    expect(parseClock("01:00")).toBe(60);
    expect(parseClock("24:00")).toBe(1440);
  });

  it("rejects garbage", () => {
    expect(parseClock("")).toBeNull();
    expect(parseClock("9")).toBeNull();
    expect(parseClock("25:00")).toBeNull();
  });
});

describe("isOpenByHours - 09:00 - 01:00 (closes after midnight)", () => {
  const hours = lateHours();

  it("is open at 00:30 because yesterday's hours run past midnight", () => {
    expect(isOpenByHours(hours, istanbul("2026-09-01T00:30:00"))).toBe(true);
  });

  it("closes at 01:00 sharp", () => {
    expect(isOpenByHours(hours, istanbul("2026-09-01T00:59:00"))).toBe(true);
    expect(isOpenByHours(hours, istanbul("2026-09-01T01:00:00"))).toBe(false);
  });

  it("is closed in the morning gap and opens at 09:00", () => {
    expect(isOpenByHours(hours, istanbul("2026-09-01T08:00:00"))).toBe(false);
    expect(isOpenByHours(hours, istanbul("2026-09-01T08:59:00"))).toBe(false);
    expect(isOpenByHours(hours, istanbul("2026-09-01T09:00:00"))).toBe(true);
  });

  it("stays open through the evening up to midnight", () => {
    expect(isOpenByHours(hours, istanbul("2026-09-01T18:00:00"))).toBe(true);
    expect(isOpenByHours(hours, istanbul("2026-09-01T23:59:00"))).toBe(true);
  });

  it("does not carry a closed day's tail into the next morning", () => {
    const withMondayOff = { ...hours, mon: { ...hours.mon, closed: true } };
    // Tuesday 00:30: Monday was closed, so nothing spills over…
    expect(isOpenByHours(withMondayOff, istanbul("2026-09-01T00:30:00"))).toBe(
      false,
    );
    // …but Tuesday's own hours still apply later that day.
    expect(isOpenByHours(withMondayOff, istanbul("2026-09-01T10:00:00"))).toBe(
      true,
    );
    // And Monday itself is closed at noon.
    expect(isOpenByHours(withMondayOff, istanbul("2026-08-31T12:00:00"))).toBe(
      false,
    );
  });
});

describe("isOpenByHours - same-day schedules", () => {
  it("10:00 - 23:00 closes at 23:00 and is not open after midnight", () => {
    const hours = dayHours("10:00", "23:00");
    expect(isOpenByHours(hours, istanbul("2026-09-01T22:59:00"))).toBe(true);
    expect(isOpenByHours(hours, istanbul("2026-09-01T23:00:00"))).toBe(false);
    expect(isOpenByHours(hours, istanbul("2026-09-01T00:30:00"))).toBe(false);
    expect(isOpenByHours(hours, istanbul("2026-09-01T09:59:00"))).toBe(false);
  });

  it("a 24:00 close runs to the end of the day and no further", () => {
    const hours = dayHours("10:00", "24:00");
    expect(isOpenByHours(hours, istanbul("2026-09-01T23:59:00"))).toBe(true);
    expect(isOpenByHours(hours, istanbul("2026-09-02T00:00:00"))).toBe(false);
  });
});

describe("isCafeOpenNow - manual override", () => {
  const hours = lateHours();

  it("'open' wins over the posted hours", () => {
    expect(isCafeOpenNow(hours, "open", istanbul("2026-09-01T08:00:00"))).toBe(
      true,
    );
  });

  it("'closed' wins over the posted hours", () => {
    expect(
      isCafeOpenNow(hours, "closed", istanbul("2026-09-01T12:00:00")),
    ).toBe(false);
  });

  it("'auto' defers to the posted hours", () => {
    expect(isCafeOpenNow(hours, "auto", istanbul("2026-09-01T08:00:00"))).toBe(
      false,
    );
    expect(isCafeOpenNow(hours, "auto", istanbul("2026-09-01T12:00:00"))).toBe(
      true,
    );
  });
});

describe("isCafeOpenForOrder - a scheduled order and the staff override", () => {
  // Every day 09:00 - 01:00; Tuesday 1 Sep 2026 on the köşk's clock.
  const hours = lateHours();
  const now = istanbul("2026-09-01T02:30:00");

  it("Açık opens the köşk for an order now, past its hours", () => {
    expect(isCafeOpenForOrder(hours, "open", null, now)).toBe(true);
  });

  it("Açık does not reach a scheduled hour the posted week keeps shut (AUDIT §8 P1)", () => {
    // Was accepted: a paid order for 04:00 the next morning.
    expect(
      isCafeOpenForOrder(hours, "open", istanbul("2026-09-02T04:00:00"), now),
    ).toBe(false);
    // An hour the köşk is open by its week is still taken.
    expect(
      isCafeOpenForOrder(hours, "open", istanbul("2026-09-01T10:00:00"), now),
    ).toBe(true);
  });

  it("Kapalı still refuses a scheduled order, even inside the posted hours", () => {
    expect(
      isCafeOpenForOrder(hours, "closed", istanbul("2026-09-01T10:00:00"), now),
    ).toBe(false);
    expect(isCafeOpenForOrder(hours, "closed", null, now)).toBe(false);
  });

  it("Otomatik follows the week, now and at the scheduled time", () => {
    expect(isCafeOpenForOrder(hours, "auto", null, now)).toBe(false);
    expect(
      isCafeOpenForOrder(hours, "auto", istanbul("2026-09-01T10:00:00"), now),
    ).toBe(true);
    // The overnight tail: 00:30 belongs to the day before, which runs to 01:00.
    expect(
      isCafeOpenForOrder(hours, "auto", istanbul("2026-09-02T00:30:00"), now),
    ).toBe(true);
  });

  it("the app order's gate is this one (store.ts placeAppOrder)", async () => {
    const { readFileSync } = await import("node:fs");
    const store = readFileSync("src/lib/admin/store.ts", "utf8");
    expect(store).toContain(
      "isCafeOpenForOrder(settings.weeklyHours, venue.manualOverride, at)",
    );
    expect(store).not.toMatch(/isCafeOpenNow\(settings\.weeklyHours/);
  });
});

describe("toLiveStatus - contract §6", () => {
  const settings = { weeklyHours: lateHours(), karaokeCapacity: 8 };

  it("maps the row to the wire shape with Turkish labels", () => {
    const now = istanbul("2026-09-01T12:10:00");
    const status = {
      ...defaultVenueStatus(),
      freeTables: 9,
      wifi: "slow" as const,
      noise: "low" as const,
      note: "Çalışmaya uygun",
      updatedAt: istanbul("2026-09-01T12:08:00").toISOString(),
    };
    const live = toLiveStatus(status, settings, now);
    expect(live).toEqual({
      isOpen: true,
      openLabel: "Şu an açık",
      updatedAt: status.updatedAt,
      updatedAgoMinutes: 2,
      freeTables: 9,
      totalTables: 20,
      wifi: "slow",
      noise: "low",
      power: true,
      note: "Çalışmaya uygun",
      hours: { weekday: "09:00 - 01:00", weekend: "09:00 - 01:00" },
      karaoke: { available: true, label: "Rezervasyonla" },
    });
  });

  it("never spreads the row: no `id` on the wire", () => {
    const live = toLiveStatus(defaultVenueStatus(), settings, new Date());
    expect("id" in live).toBe(false);
    expect("manualOverride" in live).toBe(false);
  });

  it("says nothing about freshness or tables when never reported", () => {
    const live = toLiveStatus(
      { ...defaultVenueStatus(), manualOverride: "closed" },
      settings,
      istanbul("2026-09-01T12:00:00"),
    );
    expect(live.isOpen).toBe(false);
    expect(live.openLabel).toBe("Şu an kapalı");
    expect(live.updatedAt).toBe("");
    // Was 0/0 - indistinguishable from "a minute ago, the house is full".
    expect(live.updatedAgoMinutes).toBeNull();
    expect(live.freeTables).toBeNull();
    expect(live.totalTables).toBe(20);
  });

  it("shows a closed weekend as 'Kapalı' and no karaoke at zero capacity", () => {
    const hours = lateHours();
    hours.sat.closed = true;
    hours.sun.closed = true;
    const live = toLiveStatus(
      defaultVenueStatus(),
      { weeklyHours: hours, karaokeCapacity: 0 },
      new Date(),
    );
    expect(live.hours.weekend).toBe("Kapalı");
    expect(live.karaoke.available).toBe(false);
  });

  it("groups days that differ instead of quoting Monday and Saturday", () => {
    const hours = lateHours();
    hours.fri.close = "02:00";
    hours.sun.closed = true;
    const live = toLiveStatus(defaultVenueStatus(), {
      weeklyHours: hours,
      karaokeCapacity: 8,
    });
    expect(live.hours.weekday).toBe(
      "Pzt-Per 09:00 - 01:00 · Cum 09:00 - 02:00",
    );
    expect(live.hours.weekend).toBe("Cmt 09:00 - 01:00 · Paz Kapalı");
  });
});
