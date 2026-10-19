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

vi.mock("@/lib/db", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/db")>();
  const db = createDb(execute);
  return { ...real, getDb: () => db };
});
vi.mock("@/lib/admin/store", () => ({ getSettings: vi.fn() }));

const { patchVenueStatus, venuePatchColumns } =
  await import("@/lib/mobile/venue");

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
