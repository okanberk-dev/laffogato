import pg from "pg";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import { createDb, type Executor } from "@/lib/db/client";

import { applyBundledSchema } from "./_support/apply-schema";
import {
  holdSharedDatabase,
  SUITE_LOCK_WAIT_MS,
} from "./_support/db-suite-lock";

/**
 * patchVenueStatus (src/lib/mobile/venue.ts) against a real Postgres: a
 * partial save of Canlı durum (Personel's form and the top bar's köşk
 * chip) writes only its own fields, holds the free tables to the stored
 * total in the same statement, and seeds a never-saved status without ever
 * overwriting one. Skipped without a database:
 *
 *   TEST_DATABASE_URL=postgres://user@host:5432/db npm test
 */
const URL_ = process.env.TEST_DATABASE_URL;
const maybe = URL_ ? describe : describe.skip;

let pool: pg.Pool | null = null;
const execute: Executor = async (q) => {
  if (!pool) throw new Error("pool not ready");
  const r = await pool.query(q.text, q.params as unknown[]);
  return {
    rows: (r.rows ?? []) as Record<string, unknown>[],
    rowCount: r.rowCount ?? 0,
  };
};

vi.mock("@/lib/db", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/db")>();
  const db = createDb(execute);
  return { ...real, getDb: () => db };
});

const { getVenueStatus, patchVenueStatus, toLiveStatus } =
  await import("@/lib/mobile/venue");

const COLLEAGUE = {
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

async function putRow(row: typeof COLLEAGUE): Promise<void> {
  await pool!.query(`delete from public.venue_status`);
  await pool!.query(
    `insert into public.venue_status
       (id, "manualOverride", "freeTables", "totalTables", wifi, noise, power, note, "updatedAt")
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [
      row.id,
      row.manualOverride,
      row.freeTables,
      row.totalTables,
      row.wifi,
      row.noise,
      row.power,
      row.note,
      row.updatedAt,
    ],
  );
}

maybe("Canlı durum partial saves against a real Postgres", () => {
  let release: (() => Promise<void>) | undefined;
  let before: Record<string, unknown>[] = [];

  beforeAll(async () => {
    release = await holdSharedDatabase(URL_!);
    pool = new pg.Pool({ connectionString: URL_, max: 4 });
    await applyBundledSchema(pool);
    // The single row is shared state: put back whatever was there.
    before = (await pool.query(`select * from public.venue_status`)).rows;
  }, SUITE_LOCK_WAIT_MS);

  afterAll(async () => {
    if (pool) {
      await pool.query(`delete from public.venue_status`);
      for (const row of before) {
        const cols = Object.keys(row);
        await pool.query(
          `insert into public.venue_status (${cols.map((c) => `"${c}"`).join(", ")})
           values (${cols.map((_, i) => `$${i + 1}`).join(", ")})`,
          cols.map((c) => row[c]),
        );
      }
      await pool.end();
    }
    pool = null;
    await release?.();
  });

  beforeEach(async () => {
    await putRow(COLLEAGUE);
  });

  it("changes the override and the free tables and keeps everything else", async () => {
    const now = new Date("2026-10-19T19:00:00.000Z");
    const saved = await patchVenueStatus(
      { manualOverride: "open", freeTables: 0 },
      now,
    );
    expect(saved).toMatchObject({ manualOverride: "open", freeTables: 0 });
    expect(await getVenueStatus()).toEqual({
      ...COLLEAGUE,
      manualOverride: "open",
      freeTables: 0,
      updatedAt: now.toISOString(),
    });
  });

  it("refuses more free tables than the stored total and writes nothing", async () => {
    expect(await patchVenueStatus({ freeTables: 13 })).toBeNull();
    expect(await getVenueStatus()).toEqual(COLLEAGUE);
    // Exactly the total is fine.
    expect(await patchVenueStatus({ freeTables: 12 })).toMatchObject({
      freeTables: 12,
      totalTables: 12,
    });
  });

  it("a Personel save of every field but the total keeps the total", async () => {
    await patchVenueStatus({
      manualOverride: "closed",
      freeTables: 1,
      wifi: "down",
      noise: "low",
      power: true,
      note: "Erken kapanış",
    });
    expect(await getVenueStatus()).toMatchObject({
      manualOverride: "closed",
      freeTables: 1,
      totalTables: 12,
      wifi: "down",
      noise: "low",
      power: true,
      note: "Erken kapanış",
    });
  });

  it("seeds a never-saved status with the defaults plus the patch", async () => {
    await pool!.query(`delete from public.venue_status`);
    const now = new Date("2026-10-19T19:05:00.000Z");
    const saved = await patchVenueStatus(
      { manualOverride: "auto", freeTables: 5 },
      now,
    );
    expect(saved).toMatchObject({ freeTables: 5, totalTables: 20 });
    expect(await getVenueStatus()).toMatchObject({
      manualOverride: "auto",
      freeTables: 5,
      totalTables: 20,
      wifi: "stable",
      noise: "medium",
      power: true,
      note: "",
      updatedAt: now.toISOString(),
    });
    // And refuses one the default total cannot hold.
    await pool!.query(`delete from public.venue_status`);
    expect(await patchVenueStatus({ freeTables: 21 })).toBeNull();
    expect(
      (await pool!.query(`select count(*)::int as n from public.venue_status`))
        .rows[0].n,
    ).toBe(0);
  });

  it("the app's live-status answer after a quick save: the same fields, the colleague's as they were", async () => {
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
    const now = new Date("2026-10-19T19:00:00.000Z");
    const before = toLiveStatus(await getVenueStatus(), settings, now);
    await patchVenueStatus({ manualOverride: "closed", freeTables: 0 }, now);
    const after = toLiveStatus(await getVenueStatus(), settings, now);
    expect(Object.keys(after)).toEqual(Object.keys(before));
    expect(after).toEqual({
      ...before,
      isOpen: false,
      openLabel: "Şu an kapalı",
      freeTables: 0,
      updatedAt: now.toISOString(),
      updatedAgoMinutes: 0,
    });
    expect(after).toMatchObject({
      wifi: "slow",
      noise: "high",
      power: false,
      note: "Maç gecesi",
      totalTables: 12,
    });
  });

  it("two quick saves at once both land on their own fields", async () => {
    await Promise.all([
      patchVenueStatus({ manualOverride: "open", freeTables: 2 }),
      patchVenueStatus({ note: "Priz arızalı", power: false, freeTables: 2 }),
    ]);
    expect(await getVenueStatus()).toMatchObject({
      manualOverride: "open",
      freeTables: 2,
      note: "Priz arızalı",
      wifi: "slow",
      noise: "high",
      totalTables: 12,
    });
  });
});
