import { createHash } from "node:crypto";

import { describe, expect, it, vi } from "vitest";

/**
 * GET /api/mobile/v1/live-status stays byte for byte what main answered
 * before UI-13 (security review of PR #189): toLiveStatus over a matrix of
 * rows, hours, karaoke capacities and instants on the köşk's clock gives
 * the same JSON, key order included. The expected values were made by
 * running main's venue.ts (169e0191) over the same matrix: six of them are
 * written out below, and the SHA-256 of all 216 (one JSON per line) stands
 * for the rest. Also nextOpenChangeAt against a minute-by-minute scan over
 * random weeks.
 */

vi.mock("@/lib/admin/store", () => ({ getSettings: vi.fn() }));
vi.mock("@/lib/db", () => ({ getDb: vi.fn(), TABLES: {} }));

const venue = await import("@/lib/mobile/venue");

type Day = { open: string; close: string; closed: boolean };
const week = (f: (i: number) => Day) =>
  Object.fromEntries(
    ["mon", "tue", "wed", "thu", "fri", "sat", "sun"].map((d, i) => [d, f(i)]),
  ) as never;

const HOURS = [
  week(() => ({ open: "09:00", close: "22:00", closed: false })),
  week(() => ({ open: "09:00", close: "01:00", closed: false })),
  week((i) => ({ open: "08:30", close: "24:00", closed: i === 0 })),
  week(() => ({ open: "00:00", close: "24:00", closed: false })),
  week(() => ({ open: "10:00", close: "10:00", closed: false })),
  week(() => ({ open: "bad", close: "25:99", closed: false })),
];
const NOWS = [
  "2026-10-20T05:59:00Z",
  "2026-10-20T18:59:59Z",
  "2026-10-20T19:00:00Z",
  "2026-10-20T21:30:00Z",
  "2026-10-20T22:00:00Z",
  "2026-10-25T23:59:00Z",
].map((s) => new Date(s));
const ROWS = [
  {
    id: "main",
    manualOverride: "auto",
    freeTables: 0,
    totalTables: 12,
    wifi: "slow",
    noise: "high",
    power: false,
    note: "Maç gecesi",
    updatedAt: "2026-10-20T18:00:00.000Z",
  },
  {
    id: "main",
    manualOverride: "open",
    freeTables: 5,
    totalTables: 20,
    wifi: "stable",
    noise: "medium",
    power: true,
    note: "",
    updatedAt: "",
  },
  {
    id: "main",
    manualOverride: "closed",
    freeTables: 999,
    totalTables: 999,
    wifi: "down",
    noise: "low",
    power: true,
    note: "<script>",
    updatedAt: "2026-10-01T00:00:00.000Z",
  },
];

const live = (r: number, h: number, karaokeCapacity: number, n: number) =>
  JSON.stringify(
    venue.toLiveStatus(
      ROWS[r] as never,
      { weeklyHours: HOURS[h], karaokeCapacity },
      NOWS[n],
    ),
  );

/** main's answers, as main's venue.ts printed them. */
const MAIN_SAMPLES: [number, number, number, number, string][] = [
  [
    0,
    0,
    8,
    1,
    '{"isOpen":true,"openLabel":"Şu an açık","updatedAt":"2026-10-20T18:00:00.000Z","updatedAgoMinutes":59,"freeTables":0,"totalTables":12,"wifi":"slow","noise":"high","power":false,"note":"Maç gecesi","hours":{"weekday":"09:00 - 22:00","weekend":"09:00 - 22:00"},"karaoke":{"available":true,"label":"Rezervasyonla"}}',
  ],
  [
    0,
    0,
    8,
    2,
    '{"isOpen":false,"openLabel":"Şu an kapalı","updatedAt":"2026-10-20T18:00:00.000Z","updatedAgoMinutes":60,"freeTables":0,"totalTables":12,"wifi":"slow","noise":"high","power":false,"note":"Maç gecesi","hours":{"weekday":"09:00 - 22:00","weekend":"09:00 - 22:00"},"karaoke":{"available":true,"label":"Rezervasyonla"}}',
  ],
  [
    1,
    1,
    0,
    3,
    '{"isOpen":true,"openLabel":"Şu an açık","updatedAt":"","updatedAgoMinutes":null,"freeTables":null,"totalTables":20,"wifi":"stable","noise":"medium","power":true,"note":"","hours":{"weekday":"09:00 - 01:00","weekend":"09:00 - 01:00"},"karaoke":{"available":false,"label":"Şu an yok"}}',
  ],
  [
    2,
    2,
    8,
    5,
    '{"isOpen":false,"openLabel":"Şu an kapalı","updatedAt":"2026-10-01T00:00:00.000Z","updatedAgoMinutes":35999,"freeTables":999,"totalTables":999,"wifi":"down","noise":"low","power":true,"note":"<script>","hours":{"weekday":"Pzt Kapalı · Sal-Cum 08:30 - 24:00","weekend":"08:30 - 24:00"},"karaoke":{"available":true,"label":"Rezervasyonla"}}',
  ],
  [
    0,
    5,
    0,
    0,
    '{"isOpen":false,"openLabel":"Şu an kapalı","updatedAt":"2026-10-20T18:00:00.000Z","updatedAgoMinutes":0,"freeTables":0,"totalTables":12,"wifi":"slow","noise":"high","power":false,"note":"Maç gecesi","hours":{"weekday":"bad - 25:99","weekend":"bad - 25:99"},"karaoke":{"available":false,"label":"Şu an yok"}}',
  ],
  [
    1,
    4,
    8,
    4,
    '{"isOpen":true,"openLabel":"Şu an açık","updatedAt":"","updatedAgoMinutes":null,"freeTables":null,"totalTables":20,"wifi":"stable","noise":"medium","power":true,"note":"","hours":{"weekday":"10:00 - 10:00","weekend":"10:00 - 10:00"},"karaoke":{"available":true,"label":"Rezervasyonla"}}',
  ],
];

/** SHA-256 of main's 216 answers, rows × hours × capacity × instant. */
const MAIN_MATRIX_SHA256 =
  "d194e51248e20d85f27b39833e14f3b38e949179404798858b79e6fc7f8cb98a";

describe("the live-status mapper answers what main answered", () => {
  it("six answers, written out", () => {
    for (const [r, h, c, n, json] of MAIN_SAMPLES) {
      expect(live(r, h, c, n), `${r}/${h}/${c}/${n}`).toBe(json);
    }
  });

  it("all 216, by digest", () => {
    const lines: string[] = [];
    for (let r = 0; r < ROWS.length; r++) {
      for (let h = 0; h < HOURS.length; h++) {
        for (const c of [0, 8]) {
          for (let n = 0; n < NOWS.length; n++) lines.push(live(r, h, c, n));
        }
      }
    }
    expect(lines).toHaveLength(216);
    expect(createHash("sha256").update(lines.join("\n")).digest("hex")).toBe(
      MAIN_MATRIX_SHA256,
    );
  });

  it("a row a partial save returns normalises as main's stored row did", () => {
    expect(
      ROWS.map((row) => JSON.stringify(venue.normalizeVenueStatus({ ...row }))),
    ).toEqual([
      '{"id":"main","manualOverride":"auto","freeTables":0,"totalTables":12,"wifi":"slow","noise":"high","power":false,"note":"Maç gecesi","updatedAt":"2026-10-20T18:00:00.000Z"}',
      '{"id":"main","manualOverride":"open","freeTables":5,"totalTables":20,"wifi":"stable","noise":"medium","power":true,"note":"","updatedAt":""}',
      '{"id":"main","manualOverride":"closed","freeTables":999,"totalTables":999,"wifi":"down","noise":"low","power":true,"note":"<script>","updatedAt":"2026-10-01T00:00:00.000Z"}',
    ]);
  });
});

describe("nextOpenChangeAt against a minute-by-minute scan (random weeks)", () => {
  const MIN = 60_000;
  function brute(hours: never, now: Date, horizonMs: number): number | null {
    const open = venue.isOpenByHours(hours, now);
    const first = Math.floor(now.getTime() / MIN) * MIN + MIN;
    for (let t = first; t <= now.getTime() + horizonMs; t += MIN) {
      if (venue.isOpenByHours(hours, new Date(t)) !== open) return t;
    }
    return null;
  }
  let seed = 20261020;
  const rand = (n: number) => {
    seed = (seed * 1103515245 + 12345) % 2147483648;
    return seed % n;
  };
  const clock = () => {
    const m = rand(24 * 4) * 15 + (rand(3) === 0 ? rand(15) : 0);
    const hh = String(Math.floor(m / 60)).padStart(2, "0");
    const mm = String(m % 60).padStart(2, "0");
    return rand(20) === 0 ? "24:00" : `${hh}:${mm}`;
  };

  it("agrees on 40 random weeks and instants under Otomatik", () => {
    for (let i = 0; i < 40; i++) {
      const hours = week(() => ({
        open: clock(),
        close: clock(),
        closed: rand(6) === 0,
      }));
      const now = new Date(
        Date.parse("2026-10-19T00:00:00Z") +
          rand(14 * 24 * 60) * MIN +
          rand(60_000),
      );
      const horizon = 24 * 60 * MIN;
      const got = venue.nextOpenChangeAt(hours, "auto", now, horizon);
      expect({ i, got: got?.getTime() ?? null }).toEqual({
        i,
        got: brute(hours, now, horizon),
      });
    }
  }, 60_000);

  it("never turns under a manual override", () => {
    for (const o of ["open", "closed"] as const) {
      expect(venue.nextOpenChangeAt(HOURS[0], o, new Date())).toBeNull();
    }
  });
});
