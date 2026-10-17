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
 * The 2FA setup draft against a real Postgres (admin audit SHE-09): the
 * conditional writes `startEnrollment` relies on (an UPDATE guarded by the
 * row as it was read, an INSERT ... ON CONFLICT DO NOTHING RETURNING) do
 * what the unit test's fake says they do. Skipped without TEST_DATABASE_URL.
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

const EMAIL = "kurulum-taslak@laffogato.net";
const T0 = Date.parse("2026-10-17T12:00:00.000Z");

maybe("2FA setup draft against a real Postgres", () => {
  let release: (() => Promise<void>) | undefined;

  beforeAll(async () => {
    release = await holdSharedDatabase(URL_!);
    pool = new pg.Pool({ connectionString: URL_, max: 6 });
    await applyBundledSchema(pool);
  }, SUITE_LOCK_WAIT_MS);

  afterAll(async () => {
    await pool?.query(`delete from public.admin_2fa where email = $1`, [
      EMAIL,
    ]);
    await pool?.end();
    pool = null;
    await release?.();
  });

  beforeEach(async () => {
    await pool!.query(`delete from public.admin_2fa where email = $1`, [
      EMAIL,
    ]);
  });

  async function stored() {
    const { rows } = await pool!.query(
      `select secret, enabled, "updatedAt" from public.admin_2fa where email = $1`,
      [EMAIL],
    );
    return rows;
  }

  it("writes one draft and shows it again for 15 minutes, then replaces it", async () => {
    const { startEnrollment, DRAFT_REUSE_MS } = await import(
      "@/lib/admin/twofa"
    );
    const first = await startEnrollment(EMAIL, "L'Affogato Admin", T0);
    const again = await startEnrollment(EMAIL, "L'Affogato Admin", T0 + 1000);
    expect(again.secret).toBe(first.secret);
    expect(await stored()).toEqual([
      {
        secret: first.secret,
        enabled: false,
        updatedAt: new Date(T0).toISOString(),
      },
    ]);
    const later = await startEnrollment(EMAIL, "x", T0 + DRAFT_REUSE_MS);
    expect(later.secret).not.toBe(first.secret);
    expect((await stored())[0].secret).toBe(later.secret);
  });

  it("gives tabs opened at the same moment one secret", async () => {
    const { startEnrollment } = await import("@/lib/admin/twofa");
    const drafts = await Promise.all(
      [0, 1, 2, 3].map(() => startEnrollment(EMAIL, "x", T0)),
    );
    expect(new Set(drafts.map((d) => d.secret)).size).toBe(1);
    expect(await stored()).toHaveLength(1);
  });

  it("never writes over an enabled enrollment", async () => {
    const { startEnrollment } = await import("@/lib/admin/twofa");
    await pool!.query(
      `insert into public.admin_2fa (email, secret, enabled, "enrolledAt", "updatedAt")
       values ($1, 'LIVESECRET', true, '2026-10-01T00:00:00.000Z', '2026-10-01T00:00:00.000Z')`,
      [EMAIL],
    );
    await expect(startEnrollment(EMAIL, "x", T0)).rejects.toThrow(
      /already enabled/,
    );
    expect(await stored()).toEqual([
      {
        secret: "LIVESECRET",
        enabled: true,
        updatedAt: "2026-10-01T00:00:00.000Z",
      },
    ]);
  });

  it("enables the draft the phone scanned, after a reload", async () => {
    const { generateSync } = await import("otplib");
    const { startEnrollment, verifyAndEnable, has2FA } = await import(
      "@/lib/admin/twofa"
    );
    const now = Date.now();
    const scanned = await startEnrollment(EMAIL, "x", now);
    // The page renders again before the code is typed.
    await startEnrollment(EMAIL, "x", now + 5_000);
    const code = generateSync({ secret: scanned.secret });
    expect(await verifyAndEnable(EMAIL, code)).toBe(true);
    expect(await has2FA(EMAIL)).toBe(true);
  });
});
