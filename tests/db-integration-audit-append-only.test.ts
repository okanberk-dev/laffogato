import pg from "pg";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { createDb, type Executor } from "@/lib/db/client";

import { applyBundledSchema } from "./_support/apply-schema";
import {
  holdSharedDatabase,
  SUITE_LOCK_WAIT_MS,
} from "./_support/db-suite-lock";

/**
 * Olay kaydı's triggers against a real Postgres (admin audit SYS-13,
 * decision D30, db/migrations/20261019170000_audit_logs_append_only.sql):
 * UPDATE and TRUNCATE raise P0001, a DELETE goes through only for a row older
 * than ten years, and the periodic destruction (src/lib/retention.ts) still
 * removes what it should. Skipped without TEST_DATABASE_URL.
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

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/db")>();
  const db = createDb(execute);
  return { ...real, getDb: () => db };
});

const TAG = `aud-ao-${Date.now()}`;
const DAY = 86_400_000;

function iso(msAgo: number, from = Date.now()): string {
  return new Date(from - msAgo).toISOString();
}

async function insert(id: string, createdAt: string): Promise<void> {
  await pool!.query(
    `insert into public.audit_logs (id, actor, action, entity, "entityId", payload, "createdAt")
     values ($1, 'append-only-test', 'update', 'audit_log', $2, '{}'::jsonb, $3)`,
    [id, TAG, createdAt],
  );
}

async function ids(): Promise<string[]> {
  const { rows } = await pool!.query<{ id: string }>(
    `select id from public.audit_logs where "entityId" = $1 order by id`,
    [TAG],
  );
  return rows.map((r) => r.id);
}

async function refusal(sql: string, params: unknown[] = []) {
  try {
    await pool!.query(sql, params);
  } catch (err) {
    return err as { code?: string; message?: string };
  }
  return null;
}

maybe("audit_logs is append-only in a real Postgres", () => {
  let release: (() => Promise<void>) | undefined;

  beforeAll(async () => {
    release = await holdSharedDatabase(URL_!);
    pool = new pg.Pool({ connectionString: URL_, max: 4 });
    await applyBundledSchema(pool);
  }, SUITE_LOCK_WAIT_MS);

  afterAll(async () => {
    if (pool) {
      // The test's young rows cannot be deleted through the trigger; the
      // table owner switches it off for this one statement (which is also
      // the honest limit of a trigger: it stops the app and mistakes, not
      // the database owner).
      const client = await pool.connect();
      try {
        await client.query("begin");
        await client.query(
          "alter table public.audit_logs disable trigger audit_logs_retention_delete",
        );
        await client.query(
          `delete from public.audit_logs where "entityId" = $1`,
          [TAG],
        );
        await client.query(
          "alter table public.audit_logs enable trigger audit_logs_retention_delete",
        );
        await client.query("commit");
      } catch (err) {
        await client.query("rollback");
        throw err;
      } finally {
        client.release();
      }
      await pool.end();
    }
    pool = null;
    await release?.();
  });

  it("refuses an UPDATE, even of an old row", async () => {
    await insert(`${TAG}-u1`, iso(2 * DAY));
    await insert(`${TAG}-u2`, iso(11 * 366 * DAY));
    for (const id of [`${TAG}-u1`, `${TAG}-u2`]) {
      const err = await refusal(
        `update public.audit_logs set actor = 'someone-else' where id = $1`,
        [id],
      );
      expect(err?.code).toBe("P0001");
      expect(err?.message).toMatch(/append-only/);
    }
    const { rows } = await pool!.query(
      `select distinct actor from public.audit_logs where "entityId" = $1`,
      [TAG],
    );
    expect(rows).toEqual([{ actor: "append-only-test" }]);
  });

  it("refuses a TRUNCATE", async () => {
    const err = await refusal("truncate public.audit_logs");
    expect(err?.code).toBe("P0001");
    expect((await ids()).length).toBeGreaterThan(0);
  });

  it("refuses a DELETE of a row younger than ten years, or with no stamp", async () => {
    await insert(`${TAG}-d1`, iso(DAY));
    // Nine years and 364 days: still inside the decade.
    await insert(`${TAG}-d2`, iso(3_650 * DAY));
    await insert(`${TAG}-d3`, "");
    for (const id of [`${TAG}-d1`, `${TAG}-d2`, `${TAG}-d3`]) {
      const err = await refusal(`delete from public.audit_logs where id = $1`, [
        id,
      ]);
      expect(err?.code).toBe("P0001");
      expect(err?.message).toContain(id);
    }
    // One refused row stops the whole statement.
    const err = await refusal(
      `delete from public.audit_logs where "entityId" = $1`,
      [TAG],
    );
    expect(err?.code).toBe("P0001");
    expect(await ids()).toEqual(
      expect.arrayContaining([`${TAG}-d1`, `${TAG}-d2`, `${TAG}-d3`]),
    );
  });

  it("lets a row older than ten years go", async () => {
    await insert(`${TAG}-o1`, iso(11 * 366 * DAY));
    const r = await pool!.query(`delete from public.audit_logs where id = $1`, [
      `${TAG}-o1`,
    ]);
    expect(r.rowCount).toBe(1);
  });

  it("keeps the periodic destruction working, and only for old rows", async () => {
    // A sweep run on an earlier day, so that every other rule's cutoff lies
    // before any row this database holds and only these rows are in scope:
    // two from before the sweep's decade (gone), one inside it (kept).
    const sweepAt = Date.parse("2014-06-01T06:00:00.000Z");
    await insert(`${TAG}-r1`, iso(3_661 * DAY, sweepAt));
    await insert(`${TAG}-r2`, iso(4_000 * DAY, sweepAt));
    await insert(`${TAG}-r3`, iso(3_000 * DAY, sweepAt));
    const { runRetention } = await import("@/lib/retention");
    const dry = await runRetention({ now: new Date(sweepAt) });
    const dryAudit = dry.results.find((x) => x.id === "audit-logs")!;
    expect(dryAudit.error).toBeUndefined();
    expect(dryAudit.matched).toBe(2);

    const report = await runRetention({ now: new Date(sweepAt), apply: true });
    const audit = report.results.find((x) => x.id === "audit-logs")!;
    expect(audit.error).toBeUndefined();
    expect(audit.destroyed).toBe(2);
    const left = await ids();
    expect(left).not.toContain(`${TAG}-r1`);
    expect(left).not.toContain(`${TAG}-r2`);
    expect(left).toContain(`${TAG}-r3`);
  });

  it("keeps the app's write path: an insert still lands", async () => {
    await insert(`${TAG}-i1`, new Date().toISOString());
    expect(await ids()).toContain(`${TAG}-i1`);
  });
});
