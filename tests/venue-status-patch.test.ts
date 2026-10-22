import { readFileSync } from "node:fs";

import { beforeEach, describe, expect, it, vi } from "vitest";

import { createDb, type Executor } from "@/lib/db/client";

/**
 * patchVenueStatus (src/lib/mobile/venue.ts): a partial save of Canlı durum
 * for Personel and the top bar's köşk chip. One UPDATE that sets only the
 * fields given and holds the free tables to the STORED total, so a quick
 * change never puts back a colleague's Wi-Fi, noise, power or note, and a
 * total lowered in between still refuses the count. The table count is
 * never written here.
 */

const queries: { text: string; params: unknown[] }[] = [];
/** One answer per statement, in order; a statement past the end gets none. */
let answers: Record<string, unknown>[][] = [];
let fail: { message: string; code: string } | null = null;
const execute: Executor = async (q) => {
  queries.push({ text: q.text, params: q.params });
  if (fail) throw Object.assign(new Error(fail.message), { code: fail.code });
  const rows = answers.shift() ?? [];
  return { rows, rowCount: rows.length };
};

/** The tags the data layer expired, as getDb's write hook does it. */
const expired = vi.hoisted(() => ({ tags: [] as string[] }));
vi.mock("next/cache", () => ({
  revalidateTag: vi.fn((tag: string) => {
    expired.tags.push(tag);
  }),
}));
vi.mock("next/server", () => ({ after: vi.fn() }));

vi.mock("@/lib/db", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/db")>();
  const { expireTags, tagsForWrite } = await import("@/lib/cache/tags");
  // The same hook src/lib/db/index.ts gives the real getDb().
  const db = createDb(execute, {
    onWrite: (target) => expireTags(tagsForWrite(target)),
  });
  return { ...real, getDb: () => db };
});
vi.mock("@/lib/admin/store", () => ({ getSettings: vi.fn() }));

const {
  normalizeVenueStatus,
  patchVenueStatus,
  toLiveStatus,
  updateVenueStatus,
  venuePatchColumns,
} = await import("@/lib/mobile/venue");
const { TAG_VENUE, tagsForWrite } = await import("@/lib/cache/tags");

const NOW = new Date("2026-10-19T18:30:00.000Z");
const STORED = {
  id: "main",
  manualOverride: "auto",
  freeTables: 3,
  totalTables: 12,
  wifi: "slow",
  noise: "high",
  power: false,
  note: "Maç gecesi",
  updatedAt: "2026-10-19T18:00:00.000Z",
};

beforeEach(() => {
  queries.length = 0;
  answers = [];
  fail = null;
  expired.tags.length = 0;
});

describe("every venue write expires what reads the venue (#185 cache)", () => {
  // `live:venue` is the tag of the two cached reads that follow the venue:
  // the bell's busy-hours inputs and the köşk chip's change marker
  // (src/lib/admin/change-marker.ts). GET /api/mobile/v1/live-status reads
  // live (30 s at the CDN), so nothing cached stands between a save and
  // the app. Not `pub:site`: a chip tap does not empty the public pages'
  // cache (docs/AUDIT.md §8, P2).
  it("venue_status is a live:venue table", () => {
    expect(tagsForWrite({ table: "venue_status" })).toEqual([TAG_VENUE]);
  });

  it("a quick save expires live:venue, not pub:site", async () => {
    answers = [[STORED]];
    await patchVenueStatus({ manualOverride: "open", freeTables: 2 }, NOW);
    expect(expired.tags).toEqual([TAG_VENUE]);
  });

  it("so does a refused one (no row matched): a lost reply looks the same", async () => {
    answers = [[], [], []];
    expect(await patchVenueStatus({ freeTables: 13 }, NOW)).toBeNull();
    expect(new Set(expired.tags)).toEqual(new Set([TAG_VENUE]));
  });

  it("so does a failed statement: Postgres may have committed it", async () => {
    fail = { message: "connection reset", code: "08006" };
    await expect(patchVenueStatus({ freeTables: 1 }, NOW)).rejects.toThrow();
    expect(expired.tags).toEqual([TAG_VENUE]);
  });

  it("and the full form's save (owner and manager)", async () => {
    await updateVenueStatus(
      {
        manualOverride: "auto",
        freeTables: 1,
        totalTables: 12,
        wifi: "stable",
        noise: "low",
        power: true,
        note: "",
      },
      NOW,
    );
    expect(expired.tags).toEqual([TAG_VENUE]);
  });
});

describe("patchVenueStatus", () => {
  it("sets only the override and the free tables, in one UPDATE held to the stored total", async () => {
    answers = [[{ ...STORED, manualOverride: "open", freeTables: 0 }]];
    const saved = await patchVenueStatus(
      { manualOverride: "open", freeTables: 0 },
      NOW,
    );
    expect(queries).toHaveLength(1);
    const [q] = queries;
    expect(q.text).toBe(
      'UPDATE "venue_status" SET "manualOverride" = $1, "freeTables" = $2, "updatedAt" = $3 WHERE "id" = $4 AND "totalTables" >= $5 RETURNING *',
    );
    expect(q.params).toEqual(["open", 0, NOW.toISOString(), "main", 0]);
    // What the colleague saved is what comes back.
    expect(saved).toMatchObject({
      manualOverride: "open",
      freeTables: 0,
      totalTables: 12,
      wifi: "slow",
      noise: "high",
      power: false,
      note: "Maç gecesi",
    });
  });

  it("never writes wifi, noise, power, note or the table count unless given", async () => {
    answers = [[STORED]];
    await patchVenueStatus({ manualOverride: "closed", freeTables: 2 }, NOW);
    for (const col of ["wifi", "noise", "power", "note", "totalTables"]) {
      expect(queries[0].text, col).not.toMatch(new RegExp(`"${col}" = \\$`));
    }
  });

  it("answers null and writes nothing more when the free tables exceed the stored total", async () => {
    // UPDATE matched no row; the seed insert met the existing row (DO
    // NOTHING); the second UPDATE matched none either.
    answers = [[], [], []];
    const saved = await patchVenueStatus({ freeTables: 13 }, NOW);
    expect(saved).toBeNull();
    expect(queries.map((q) => q.text.split(" ")[0])).toEqual([
      "UPDATE",
      "INSERT",
      "UPDATE",
    ]);
    expect(queries[1].text).toMatch(
      /ON CONFLICT \("id"\) DO NOTHING RETURNING \*$/,
    );
  });

  it("does not seed a row whose free tables exceed the default total", async () => {
    answers = [[]];
    expect(await patchVenueStatus({ freeTables: 21 }, NOW)).toBeNull();
    expect(queries).toHaveLength(1);
  });

  it("seeds a never-saved status with the defaults plus the patch, without overwriting", async () => {
    answers = [
      [],
      [
        {
          id: "main",
          manualOverride: "open",
          freeTables: 4,
          totalTables: 20,
          wifi: "stable",
          noise: "medium",
          power: true,
          note: "",
          updatedAt: NOW.toISOString(),
        },
      ],
    ];
    const saved = await patchVenueStatus(
      { manualOverride: "open", freeTables: 4 },
      NOW,
    );
    expect(saved).toMatchObject({ freeTables: 4, totalTables: 20 });
    expect(queries).toHaveLength(2);
    expect(queries[1].text).toMatch(/^INSERT INTO "venue_status"/);
    expect(queries[1].text).not.toMatch(/DO UPDATE/);
  });

  it("throws the classified error on a refused statement", async () => {
    fail = { message: "permission denied", code: "42501" };
    await expect(
      patchVenueStatus({ freeTables: 1 }, NOW),
    ).rejects.toMatchObject({ name: "DbQueryError", code: "42501" });
    expect(queries).toHaveLength(1);
  });
});

describe("venuePatchColumns", () => {
  it("keeps only the given keys, normalised like a stored row", () => {
    expect(venuePatchColumns({})).toEqual({});
    expect(
      venuePatchColumns({
        manualOverride: "nope" as never,
        freeTables: 1000,
        wifi: "down",
        note: `  ${"x".repeat(250)} `,
        power: false,
      }),
    ).toEqual({
      manualOverride: "auto",
      freeTables: 999,
      wifi: "down",
      note: "x".repeat(200),
      power: false,
    });
    // A total in the input never reaches the statement.
    expect(venuePatchColumns({ totalTables: 50 } as never)).not.toHaveProperty(
      "totalTables",
    );
  });
});

describe("GET /api/mobile/v1/live-status keeps its shape (docs/API-MOBILE.md §6)", () => {
  /** The §6 answer's fields, in the order toLiveStatus writes them. */
  const LIVE_KEYS = [
    "isOpen",
    "openLabel",
    "updatedAt",
    "updatedAgoMinutes",
    "freeTables",
    "totalTables",
    "wifi",
    "noise",
    "power",
    "note",
    "hours",
    "karaoke",
  ];
  const day = { open: "00:00", close: "24:00", closed: false };
  const settings = {
    weeklyHours: {
      mon: day,
      tue: day,
      wed: day,
      thu: day,
      fri: day,
      sat: day,
      sun: day,
    },
    karaokeCapacity: 8,
  };

  it("a row a quick save returns maps to the same answer: the two fields and the time change, nothing else", async () => {
    answers = [
      [
        {
          ...STORED,
          manualOverride: "closed",
          freeTables: 0,
          updatedAt: NOW.toISOString(),
        },
      ],
    ];
    const saved = await patchVenueStatus(
      { manualOverride: "closed", freeTables: 0 },
      NOW,
    );
    expect(saved).not.toBeNull();
    const before = toLiveStatus(normalizeVenueStatus(STORED), settings, NOW);
    const after = toLiveStatus(saved!, settings, NOW);
    expect(Object.keys(before)).toEqual(LIVE_KEYS);
    expect(Object.keys(after)).toEqual(LIVE_KEYS);
    expect(after).toEqual({
      ...before,
      isOpen: false,
      openLabel: "Şu an kapalı",
      freeTables: 0,
      updatedAt: NOW.toISOString(),
      updatedAgoMinutes: 0,
    });
    // Nothing of the row beyond §6 (no id, no override) reaches the wire.
    expect(after).not.toHaveProperty("id");
    expect(after).not.toHaveProperty("manualOverride");
  });

  it("each of those fields is the one §6 documents", () => {
    const doc = readFileSync("docs/API-MOBILE.md", "utf8");
    const s6 = doc.slice(
      doc.indexOf("## 6. Canlı durum"),
      doc.indexOf("## 7. Karaoke"),
    );
    expect(s6.length).toBeGreaterThan(100);
    for (const key of LIVE_KEYS) expect(s6, key).toContain(`"${key}":`);
  });
});
