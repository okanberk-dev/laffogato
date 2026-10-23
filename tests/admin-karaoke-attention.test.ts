import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createDb, type Executor } from "@/lib/db/client";
import type { KaraokeReservation } from "@/lib/mobile/karaoke-core";

/**
 * What waits for a person, any day (admin audit KAR-07, KAR-25).
 *
 * The dashboard card counted today's rows and the refunds owed, so a paid
 * request from yesterday (money held, never confirmed) or tomorrow's old
 * pay-at-the-venue request never reached it while the Dikkat tab showed
 * them; and Dikkat itself was computed from the panel's newest 5000 rows,
 * so an old refund owed would one day fall off it. `listKaraokeAttention`
 * reads the attention set by payment state; this file runs it over a fake
 * table holding every status, payment state and day, and checks it finds
 * exactly what `karaokeAttention` flags over the whole table.
 */

let table: KaraokeReservation[] = [];

// A tiny WHERE evaluator for the shapes the karaoke reads compile to; any
// other shape fails the test instead of matching by accident.
function matches(
  row: Record<string, unknown>,
  where: string,
  params: unknown[],
): boolean {
  if (!where) return true;
  return where.split(" AND ").every((part) => {
    let m = /^"(\w+)" = \$(\d+)$/.exec(part);
    if (m) return row[m[1]!] === params[Number(m[2]) - 1];
    m = /^"(\w+)" >= \$(\d+)$/.exec(part);
    if (m) return String(row[m[1]!]) >= String(params[Number(m[2]) - 1]);
    m = /^"(\w+)" < \$(\d+)$/.exec(part);
    if (m) return String(row[m[1]!]) < String(params[Number(m[2]) - 1]);
    m = /^"(\w+)" IN \((.+)\)$/.exec(part);
    if (m) {
      const values = m[2]!
        .split(", ")
        .map((p) => params[Number(p.slice(1)) - 1]);
      return values.includes(row[m[1]!]);
    }
    throw new Error(`unexpected condition: ${part}`);
  });
}

const reads: string[] = [];
const exec: Executor = async ({ text, params }) => {
  reads.push(text);
  if (!text.startsWith("SELECT")) throw new Error(`unexpected: ${text}`);
  const where = /WHERE (.+?)(?: ORDER BY| LIMIT|$)/.exec(text)?.[1] ?? "";
  const out = table.filter((r) =>
    matches(r as unknown as Record<string, unknown>, where, params),
  );
  return {
    rows: out as unknown as Record<string, unknown>[],
    rowCount: out.length,
  };
};

vi.mock("@/lib/db", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/db")>();
  const db = createDb(exec);
  return { ...real, getDb: () => db };
});
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  unstable_rethrow: vi.fn(),
}));
vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children?: unknown }) =>
    createElement("a", { href }, children as never),
}));

const karaoke = await import("@/lib/mobile/karaoke");
const panel = await import("@/lib/admin/karaoke-panel");
const { loadKaraokeTodayCard } = await import("@/lib/admin/karaoke-today");
const { KaraokeTodayCard } =
  await import("@/components/admin/karaoke-today-card");

// 15:00 in Tuzla on 17 Ekim.
const NOW = new Date("2026-10-17T12:00:00.000Z");
const TODAY = "2026-10-17";
const CTX = { today: TODAY, now: NOW, prepay: true, canRefund: true };

let seq = 0;
function booking(over: Partial<KaraokeReservation>): KaraokeReservation {
  seq += 1;
  return {
    id: `krk-${String(seq).padStart(5, "0")}`,
    customerEmail: `uye${seq}@example.com`,
    customerName: `Üye ${seq}`,
    date: TODAY,
    startHour: 20,
    hours: 2,
    guests: 4,
    status: "confirmed",
    priceMinor: 200_000,
    discountMinor: 0,
    totalMinor: 200_000,
    note: "",
    createdAt: "2026-10-01T10:00:00.000Z",
    updatedAt: "2026-10-01T10:00:00.000Z",
    paymentStatus: "paid",
    paymentDueAt: "",
    paidMinor: 200_000,
    ...over,
  };
}

/**
 * Every combination the schema allows (`pending` only on a request,
 * `expired` / `refunded` only once cancelled), on four days: last week,
 * today's afternoon (over), tonight, tomorrow; and, for an unpaid hold, a
 * page that closed long ago and one still open.
 */
function everyCase(): KaraokeReservation[] {
  const out: KaraokeReservation[] = [];
  const days = [
    { date: "2026-10-10", startHour: 20 },
    { date: TODAY, startHour: 10 },
    { date: TODAY, startHour: 20 },
    { date: "2026-10-18", startHour: 20 },
  ];
  for (const day of days) {
    for (const status of ["requested", "confirmed", "cancelled"] as const) {
      for (const money of [
        "none",
        "pending",
        "paid",
        "refunding",
        "refunded",
        "expired",
      ] as const) {
        if (money === "pending" && status !== "requested") continue;
        if (
          (money === "expired" || money === "refunded") &&
          status !== "cancelled"
        ) {
          continue;
        }
        const dues =
          money === "pending"
            ? ["2026-10-17T11:00:00.000Z", "2026-10-17T11:55:00.000Z"]
            : [""];
        for (const due of dues) {
          out.push(
            booking({
              ...day,
              status,
              paymentStatus: money,
              paymentDueAt: due,
              paidMinor: money === "none" || money === "pending" ? 0 : 200_000,
            }),
          );
        }
      }
    }
  }
  return out;
}

const attentionOf = (
  views: readonly { r: KaraokeReservation; attention: string[] }[],
) => Object.fromEntries(views.map((v) => [v.r.id, v.attention]));

beforeEach(() => {
  seq = 0;
  reads.length = 0;
  table = everyCase();
});

describe("listKaraokeAttention", () => {
  it("finds exactly what the whole table flags, any day", async () => {
    const truth = panel.karaokeAttentionViews(table, CTX);
    const found = panel.karaokeAttentionViews(
      await karaoke.listKaraokeAttention(TODAY),
      CTX,
    );
    expect(truth.length).toBeGreaterThan(5);
    expect(attentionOf(found)).toEqual(attentionOf(truth));
    // Each booking once (a confirmed one under refund is both a refund and
    // a day's confirmed booking).
    const ids = found.map((v) => v.r.id);
    expect(ids).toHaveLength(new Set(ids).size);
  });

  it("keeps a paid request from a past day, and tomorrow's old pay-at-the-venue request", async () => {
    const found = attentionOf(
      panel.karaokeAttentionViews(
        await karaoke.listKaraokeAttention(TODAY),
        CTX,
      ),
    );
    const pastPaid = table.find(
      (r) =>
        r.date === "2026-10-10" &&
        r.status === "requested" &&
        r.paymentStatus === "paid",
    )!;
    const tomorrowVenue = table.find(
      (r) =>
        r.date === "2026-10-18" &&
        r.status === "requested" &&
        r.paymentStatus === "none",
    )!;
    expect(found[pastPaid.id]).toEqual(["paid_unconfirmed_past"]);
    expect(found[tomorrowVenue.id]).toEqual(["venue_request"]);

    // The dashboard's old read (today's rows + the refunds owed) missed both.
    const old = [
      ...(await karaoke.listReservationsForDate(TODAY)),
      ...(await karaoke.listKaraokeRefundsOwed()),
    ].map((r) => r.id);
    expect(old).not.toContain(pastPaid.id);
    expect(old).not.toContain(tomorrowVenue.id);
  });

  it("tells a lost hour from a free one: the day's confirmed bookings come along", async () => {
    table = [
      booking({ id: "krk-00100", date: "2026-10-18", status: "requested" }),
      booking({ id: "krk-00101", date: "2026-10-18", startHour: 21, hours: 1 }),
      booking({ id: "krk-00102", date: "2026-10-19", status: "requested" }),
    ];
    const views = panel.karaokeAttentionViews(
      await karaoke.listKaraokeAttention(TODAY),
      CTX,
    );
    expect(attentionOf(views)).toEqual({
      "krk-00100": ["slot_lost"],
      "krk-00102": ["confirm_pending"],
    });
    // The confirmed booking was read only to be checked against.
    expect(views.map((v) => v.r.id)).not.toContain("krk-00101");
  });

  it("reads by payment state, never the whole table, and no IP or browser", async () => {
    await karaoke.listKaraokeAttention(TODAY);
    for (const sql of reads) {
      expect(sql).toMatch(/WHERE .*"(paymentStatus|status)"/);
      expect(sql).not.toContain("legalConsent");
      expect(sql).not.toContain("LIMIT");
    }
  });
});

describe("the dashboard card counts the Dikkat set", () => {
  it("loadKaraokeTodayCard: today's rows, and the attention of every day", async () => {
    const data = await loadKaraokeTodayCard(CTX);
    expect(data).not.toBeNull();
    expect(data!.today.every((v) => v.r.date === TODAY)).toBe(true);
    const truth = panel.karaokeAttentionViews(table, CTX);
    expect(data!.attention.map((v) => v.r.id).sort()).toEqual(
      truth.map((v) => v.r.id).sort(),
    );
    const markup = renderToStaticMarkup(
      createElement(KaraokeTodayCard, {
        today: data!.today,
        attention: data!.attention,
        now: NOW,
      }),
    );
    expect(markup).toContain(`${truth.length} rezervasyon bir işlem bekliyor`);
  });

  it("says how full the room is against the same weekday last week", async () => {
    const { karaokeOccupancy } = await import("@/lib/admin/dashboard-core");
    const rules = { firstHour: 12, closeHour: 24 };
    // 14-16 and 20-22 held, a cancelled 17-18 not, 23-01 only to midnight.
    const today = karaokeOccupancy(
      [
        { startHour: 14, hours: 2, status: "confirmed" },
        { startHour: 20, hours: 2, status: "requested" },
        { startHour: 17, hours: 1, status: "cancelled" },
        { startHour: 23, hours: 2, status: "confirmed" },
      ],
      rules,
    );
    expect(today).toEqual({ hours: 5, capacity: 12, pct: 42 });
    expect(karaokeOccupancy([], { firstHour: 12, closeHour: 12 }).pct).toBe(0);
    const markup = renderToStaticMarkup(
      createElement(KaraokeTodayCard, {
        today: [],
        attention: [],
        occupancy: {
          today,
          lastWeek: { hours: 3, capacity: 12, pct: 25 },
        },
        now: NOW,
      }),
    );
    expect(markup).toContain("%42");
    expect(markup).toContain("5/12 saat");
    expect(markup).toMatch(/\+17 puan<span class="sr-only"> artış<\/span>/);
    expect(markup).toMatch(/Geçen \S+ %25/);
  });

  it("answers null when a read fails, and the card says so", async () => {
    table = null as unknown as KaraokeReservation[];
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const data = await loadKaraokeTodayCard(CTX);
    spy.mockRestore();
    expect(data).toBeNull();
    const markup = renderToStaticMarkup(
      createElement(KaraokeTodayCard, {
        today: null,
        attention: null,
        now: NOW,
      }),
    );
    expect(markup).toContain("okunamadı");
  });
});

describe("the Dikkat tab reads its own set", () => {
  it("shows and counts a booking the list's newest rows no longer hold", () => {
    const old = booking({
      id: "krk-00001",
      date: "2025-01-05",
      status: "cancelled",
      paymentStatus: "paid",
    });
    const recent = booking({ id: "krk-09999", date: TODAY });
    const views = panel.karaokeRowViews([recent], CTX);
    const attention = panel.karaokeAttentionViews([old], CTX);
    const opts = {
      filters: {},
      sort: { key: "tarih", dir: "asc" as const },
      page: 1,
      today: TODAY,
      attention,
    };
    const dikkat = panel.karaokeList(views, { ...opts, tab: "dikkat" });
    expect(dikkat.rows.map((v) => v.r.id)).toEqual(["krk-00001"]);
    expect(dikkat.counts.dikkat).toBe(1);
    const bugun = panel.karaokeList(views, { ...opts, tab: "bugun" });
    expect(bugun.counts.dikkat).toBe(1);
    expect(bugun.counts.bugun).toBe(1);
    // Without the attention read (it failed), the list's rows decide.
    const fallback = panel.karaokeList(views, {
      ...opts,
      attention: null,
      tab: "dikkat",
    });
    expect(fallback.counts.dikkat).toBe(0);
  });

  it("filters the attention rows like the list's", () => {
    const attention = panel.karaokeAttentionViews(
      [
        booking({ id: "krk-00001", status: "cancelled", customerName: "Işık" }),
        booking({ id: "krk-00002", status: "cancelled", customerName: "Eda" }),
      ],
      CTX,
    );
    const res = panel.karaokeList([], {
      tab: "dikkat",
      filters: { q: "isik" },
      sort: { key: "tarih", dir: "asc" },
      page: 1,
      today: TODAY,
      attention,
    });
    expect(res.rows.map((v) => v.r.id)).toEqual(["krk-00001"]);
  });
});
