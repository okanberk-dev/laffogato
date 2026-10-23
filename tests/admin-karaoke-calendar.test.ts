import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import type { KaraokeRowView } from "@/lib/admin/karaoke-panel";

/**
 * The karaoke page's week (Innex's calendar and list on one screen, 22 Eki
 * 2026): the week's edges on the köşk's calendar, the hours drawn and where
 * each booking sits. A cancelled booking holds no hour and is not drawn.
 */

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...rest
  }: {
    href: string;
    children?: ReactNode;
  }) => createElement("a", { href, ...rest }, children),
  useLinkStatus: () => ({ pending: false }),
}));

const core = await import("@/lib/admin/karaoke-calendar-core");
const { KaraokeWeekCalendar } =
  await import("@/components/admin/karaoke-calendar");

describe("the week", () => {
  it("starts on Monday, whatever day is asked for", () => {
    expect(core.weekStart("2026-10-23")).toBe("2026-10-19");
    expect(core.weekStart("2026-10-19")).toBe("2026-10-19");
    expect(core.weekStart("2026-10-25")).toBe("2026-10-19");
    expect(core.weekDays("2026-10-19")).toEqual([
      "2026-10-19",
      "2026-10-20",
      "2026-10-21",
      "2026-10-22",
      "2026-10-23",
      "2026-10-24",
      "2026-10-25",
    ]);
  });

  it("reads ?hafta= only as a real date, else this week", () => {
    expect(core.parseWeekParam("2026-11-04", "2026-10-23")).toBe("2026-11-02");
    for (const bad of ["2026-02-30", "dün", "2026-1-4", undefined]) {
      expect(core.parseWeekParam(bad, "2026-10-23"), String(bad)).toBe(
        "2026-10-19",
      );
    }
    expect(core.parseWeekParam(["2026-11-04"], "2026-10-23")).toBe(
      "2026-11-02",
    );
  });

  it("names the week across a month and a year", () => {
    expect(core.weekLabel("2026-10-19")).toBe("19 - 25 Ekim 2026");
    expect(core.weekLabel("2026-10-26")).toBe("26 Ekim - 1 Kasım 2026");
    expect(core.weekLabel("2026-12-28")).toBe("28 Aralık 2026 - 3 Ocak 2027");
    expect(core.dayHead("2026-10-23")).toEqual({
      short: "Cum",
      long: "Cuma",
      date: 23,
      month: "Ekim",
    });
  });

  it("draws the room's hours, widened to a booking outside them", () => {
    expect(core.calendarHours([])).toEqual({ first: 12, close: 24 });
    expect(
      core.calendarHours([{ date: "2026-10-23", startHour: 10, hours: 2 }]),
    ).toEqual({ first: 10, close: 24 });
    expect(
      core.nowOffset({ hour: 18, minute: 0 }, { first: 12, close: 24 }),
    ).toBe(0.5);
    expect(
      core.nowOffset({ hour: 9, minute: 30 }, { first: 12, close: 24 }),
    ).toBeNull();
    expect(core.karaokeCalendarHref()).toBe(
      "/admin/mobil/karaoke?gorunum=takvim",
    );
    expect(core.karaokeCalendarHref("2026-10-26")).toBe(
      "/admin/mobil/karaoke?gorunum=takvim&hafta=2026-10-26",
    );
  });
});

describe("the calendar", () => {
  const view = (over: {
    id: string;
    date: string;
    startHour: number;
    hours: number;
    status?: string;
    money?: string;
  }): KaraokeRowView =>
    ({
      r: {
        id: over.id,
        date: over.date,
        startHour: over.startHour,
        hours: over.hours,
        guests: 4,
        status: over.status ?? "confirmed",
        customerName: "Ayşe",
      },
      money: over.money ?? "paid",
      live: (over.status ?? "confirmed") !== "cancelled",
      time: `${over.startHour}:00 - ${over.startHour + over.hours}:00`,
      paymentLabel: "Ödendi",
      refundOwed: false,
      attention: [],
    }) as unknown as KaraokeRowView;

  const html = renderToStaticMarkup(
    createElement(KaraokeWeekCalendar, {
      monday: "2026-10-19",
      today: "2026-10-23",
      clock: { hour: 18, minute: 0 },
      views: [
        view({ id: "a", date: "2026-10-23", startHour: 14, hours: 2 }),
        view({
          id: "b",
          date: "2026-10-23",
          startHour: 14,
          hours: 1,
          status: "cancelled",
        }),
        view({
          id: "c",
          date: "2026-10-21",
          startHour: 20,
          hours: 1,
          money: "pending",
        }),
      ],
      prevHref: "/p",
      nextHref: "/n",
      thisWeekHref: null,
      back: "/admin/mobil/karaoke?gorunum=takvim",
    }),
  );

  it("places a booking from its first hour to its last, 48 px an hour", () => {
    // 14:00 is two hours after 12:00: 96 px down (+2 px inset), two hours tall.
    expect(html).toContain('style="top:98px;height:92px"');
    expect(html).toContain('style="top:386px;height:44px"');
  });

  it("draws no cancelled booking: it holds no hour", () => {
    expect(html).toContain("/admin/mobil/karaoke/a");
    expect(html).not.toContain("/admin/mobil/karaoke/b");
    expect(html).toContain("Bu hafta 2 rezervasyon");
  });

  it("colours a booking by its money, leads back to the calendar and marks today", () => {
    expect(html).toContain("border-l-[var(--admin-success)]");
    expect(html).toContain("border-l-[var(--admin-warning)]");
    expect(html).toContain(
      "/admin/mobil/karaoke/c?geri=%2Fadmin%2Fmobil%2Fkaraoke%3Fgorunum%3Dtakvim",
    );
    expect(html).toContain('<span class="sr-only">(bugün)</span>');
    // The line across today's column at 18:00, halfway down the hours.
    expect(html).toContain('style="top:50%"');
  });
});
