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

import type { Executor } from "@/lib/db/client";
import {
  completeFalReading,
  falReadingsToday,
  releaseFalReading,
  reserveFalReading,
} from "@/lib/mobile/fal";

import { applyBundledSchema } from "./_support/apply-schema";
import {
  holdSharedDatabase,
  SUITE_LOCK_WAIT_MS,
} from "./_support/db-suite-lock";

/**
 * The fA'L quota seat (src/lib/mobile/fal.ts) against a real Postgres:
 * `reserve_fal_reading` (db/migrations/20261014173600_fal_reading_seat.sql),
 * the release and the fill-in. The burst test is the one an in-memory table
 * cannot show: ranking an inserted row by id let a fourth of six parallel
 * requests through about once in twenty runs here, the function's advisory
 * lock does not. Skipped without TEST_DATABASE_URL, like the other
 * tests/db-integration*.test.ts suites.
 */
const URL_ = process.env.TEST_DATABASE_URL;
const maybe = URL_ ? describe : describe.skip;

let pool: pg.Pool | null = null;

// vi.mock is hoisted above the imports, and fal.ts is imported statically, so
// the executor the mock hands to createDb must exist before either: it reads
// the pool through this holder at query time, not at mock time.
const holder = vi.hoisted(() => ({ pool: null as pg.Pool | null }));
const execute: Executor = async (q) => {
  if (!holder.pool) throw new Error("pool not ready");
  const r = await holder.pool.query(q.text, q.params as unknown[]);
  return {
    rows: (r.rows ?? []) as Record<string, unknown>[],
    rowCount: r.rowCount ?? 0,
  };
};

vi.mock("@/lib/db", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/db")>();
  const { createDb: create } = await import("@/lib/db/client");
  const db = create((q) => execute(q));
  return { ...real, getDb: () => db };
});

const EMAIL = "fal-seat@laffogato.net";
const OTHER = "fal-seat-2@laffogato.net";
const NOW = new Date("2026-10-14T09:00:00Z");

async function rowsOf(email: string) {
  const { rows } = await pool!.query(
    `select id, model, "cupSeen" from public.fal_readings where "customerEmail" = $1 order by id`,
    [email],
  );
  return rows as { id: string; model: string; cupSeen: boolean }[];
}

maybe("the fA'L quota seat in a real Postgres", () => {
  let release: (() => Promise<void>) | undefined;

  beforeAll(async () => {
    release = await holdSharedDatabase(URL_!);
    pool = new pg.Pool({ connectionString: URL_, max: 8 });
    holder.pool = pool;
    await applyBundledSchema(pool);
  }, SUITE_LOCK_WAIT_MS);

  afterAll(async () => {
    await pool?.query(
      `delete from public.fal_readings where "customerEmail" in ($1, $2)`,
      [EMAIL, OTHER],
    );
    await pool?.end();
    pool = null;
    holder.pool = null;
    await release?.();
  });

  beforeEach(async () => {
    await pool!.query(
      `delete from public.fal_readings where "customerEmail" in ($1, $2)`,
      [EMAIL, OTHER],
    );
  });

  it("seats a member up to the limit and refuses the next without leaving a row", async () => {
    const seats = [];
    for (let i = 0; i < 3; i++)
      seats.push(await reserveFalReading(EMAIL, 3, NOW));
    expect(seats.map((s) => (s.ok ? s.used : -1))).toEqual([0, 1, 2]);

    expect(await reserveFalReading(EMAIL, 3, NOW)).toEqual({ ok: false });
    expect(await rowsOf(EMAIL)).toHaveLength(3);
    expect(await falReadingsToday(EMAIL, NOW)).toBe(3);
  });

  it("gives a released seat back and fills a completed one in", async () => {
    const first = await reserveFalReading(EMAIL, 2, NOW);
    const second = await reserveFalReading(EMAIL, 2, NOW);
    if (!first.ok || !second.ok) throw new Error("expected two seats");

    await releaseFalReading(second.id);
    await completeFalReading(first.id, true, "gpt-test");
    expect(await rowsOf(EMAIL)).toEqual([
      { id: String(first.id), model: "gpt-test", cupSeen: true },
    ]);

    const again = await reserveFalReading(EMAIL, 2, NOW);
    expect(again).toEqual(expect.objectContaining({ ok: true, used: 1 }));
  });

  it("counts each member's own rows only", async () => {
    for (let i = 0; i < 2; i++) await reserveFalReading(OTHER, 2, NOW);
    expect(await reserveFalReading(EMAIL, 2, NOW)).toEqual(
      expect.objectContaining({ ok: true, used: 0 }),
    );
  });

  it("holds the cap for a burst of parallel requests", async () => {
    const seats = await Promise.all(
      Array.from({ length: 6 }, () => reserveFalReading(EMAIL, 3, NOW)),
    );
    expect(seats.filter((s) => s.ok)).toHaveLength(3);
    expect(await rowsOf(EMAIL)).toHaveLength(3);
  });
});
