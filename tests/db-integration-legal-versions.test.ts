import pg from "pg";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { createDb, type Executor } from "@/lib/db/client";
import { legalVersionOf, type LegalVersionDoc } from "@/lib/legal/version-core";

import { applyBundledSchema } from "./_support/apply-schema";
import {
  holdSharedDatabase,
  SUITE_LOCK_WAIT_MS,
} from "./_support/db-suite-lock";

/**
 * `legal_doc_versions` in a real Postgres
 * (db/migrations/20261020180000_legal_doc_versions.sql): a text is stored
 * once per hash, however many requests store it at once; the database
 * refuses a row whose hash is not its text's; UPDATE and TRUNCATE are
 * refused and DELETE passes only past eleven years; a prefix finds the one
 * text of its document; the periodic destruction takes only a text that was
 * replaced before its cutoff and that no consent of the last eleven years
 * names. Skipped without TEST_DATABASE_URL, like the other db-integration
 * suites.
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

const versions = await import("@/lib/legal/versions");

const RUN = Date.now().toString(36);
const slugOf = (name: string) => `dbtest-${RUN}-${name}`;

function textDoc(slug: string, body: string): LegalVersionDoc {
  return {
    format: 1,
    slug,
    source: "override",
    category: "Sipariş",
    title: `Belge ${slug}`,
    summary: "",
    updatedAt: "21 Ekim 2026",
    bodyMarkdown: body,
  };
}

async function count(hash: string): Promise<number> {
  const { rows } = await pool!.query<{ n: number }>(
    "select count(*)::int as n from public.legal_doc_versions where hash = $1",
    [hash],
  );
  return rows[0].n;
}

async function refusal(sql: string, params: unknown[] = []) {
  try {
    await pool!.query(sql, params);
  } catch (err) {
    return err as { code?: string; message?: string };
  }
  return null;
}

/** A stored row, first stored at `createdAt` (written directly). */
async function storeAt(slug: string, body: string, createdAt: string) {
  const v = legalVersionOf(textDoc(slug, body));
  await pool!.query(
    `insert into public.legal_doc_versions (hash, slug, body, "createdAt") values ($1, $2, $3, $4)`,
    [v.hash, v.slug, v.text, createdAt],
  );
  return v;
}

maybe("legal_doc_versions in a real Postgres", () => {
  let release: (() => Promise<void>) | undefined;

  beforeAll(async () => {
    release = await holdSharedDatabase(URL_!);
    pool = new pg.Pool({ connectionString: URL_, max: 4 });
    await applyBundledSchema(pool);
  }, SUITE_LOCK_WAIT_MS);

  afterAll(async () => {
    if (pool) {
      // The test's young rows cannot be deleted through the trigger; the
      // table owner switches it off for this cleanup (the honest limit of a
      // trigger: it stops the app and mistakes, not the owner).
      const client = await pool.connect();
      try {
        await client.query("begin");
        await client.query(
          "alter table public.legal_doc_versions disable trigger legal_doc_versions_retention_delete",
        );
        await client.query(
          "delete from public.legal_doc_versions where slug like $1",
          [`dbtest-${RUN}-%`],
        );
        await client.query(
          "alter table public.legal_doc_versions enable trigger legal_doc_versions_retention_delete",
        );
        await client.query("commit");
      } catch (err) {
        await client.query("rollback");
        throw err;
      } finally {
        client.release();
      }
      await pool.query("delete from public.orders where id like $1", [
        `ord-dbtest-${RUN}%`,
      ]);
      await pool.query(
        "delete from public.karaoke_reservations where id like $1",
        [`krk-dbtest-${RUN}%`],
      );
      await pool.end();
    }
    pool = null;
    await release?.();
  });

  it("stores a text once per hash, however many requests store it at once", async () => {
    const v = legalVersionOf(textDoc(slugOf("once"), "## Bir\n\nMetin."));
    versions.forgetKnownLegalVersions();
    await Promise.all([
      versions.recordLegalVersions([v]),
      versions.recordLegalVersions([v]),
      versions.recordLegalVersions([v, v]),
    ]);
    versions.forgetKnownLegalVersions();
    await versions.recordLegalVersions([v]);
    expect(await count(v.hash)).toBe(1);
    const { rows } = await pool!.query(
      `select slug, body, "createdAt" from public.legal_doc_versions where hash = $1`,
      [v.hash],
    );
    expect(rows[0].slug).toBe(v.slug);
    expect(rows[0].body).toBe(v.text);
    // The database's clock, in the app's ISO shape.
    expect(rows[0].createdAt).toMatch(
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/,
    );
  });

  it("refuses a row whose hash is not its text's", async () => {
    const v = legalVersionOf(textDoc(slugOf("lie"), "Gerçek metin."));
    const err = await refusal(
      "insert into public.legal_doc_versions (hash, slug, body) values ($1, $2, $3)",
      [v.hash, v.slug, `${v.text} `],
    );
    expect(err?.code).toBe("23514");
    expect(err?.message).toContain("legal_doc_versions_hash_of_body");
    expect(await count(v.hash)).toBe(0);
  });

  it("refuses UPDATE and TRUNCATE, and a DELETE younger than eleven years", async () => {
    const v = legalVersionOf(textDoc(slugOf("ro"), "Değişmez metin."));
    versions.forgetKnownLegalVersions();
    await versions.recordLegalVersions([v]);
    for (const [sql, params] of [
      [
        "update public.legal_doc_versions set slug = 'baska' where hash = $1",
        [v.hash],
      ],
      [
        "update public.legal_doc_versions set body = body where hash = $1",
        [v.hash],
      ],
      ["delete from public.legal_doc_versions where hash = $1", [v.hash]],
      ["truncate public.legal_doc_versions", []],
    ] as const) {
      const err = await refusal(sql, [...params]);
      expect(err?.code, sql).toBe("P0001");
    }
    expect(await count(v.hash)).toBe(1);
    // A row first stored twelve years ago may go.
    const old = await storeAt(
      slugOf("old"),
      "Eski.",
      "2014-01-01T00:00:00.000Z",
    );
    const r = await pool!.query(
      "delete from public.legal_doc_versions where hash = $1",
      [old.hash],
    );
    expect(r.rowCount).toBe(1);
  });

  it("finds the one text of its document by prefix, and reads it back verified", async () => {
    const v = legalVersionOf(textDoc(slugOf("find"), "## Bul\n\nBeni."));
    versions.forgetKnownLegalVersions();
    await versions.recordLegalVersions([v]);
    const found = await versions.findLegalVersionByPrefix(
      v.slug,
      v.hash.slice(0, 16),
    );
    expect(found?.version.hash).toBe(v.hash);
    expect(found?.version.doc).toEqual(v.doc);
    expect(
      (await versions.findLegalVersionByPrefix(v.slug, v.hash))?.version.hash,
    ).toBe(v.hash);
    // Another document's address, a prefix of nothing, a short prefix.
    expect(
      await versions.findLegalVersionByPrefix(
        slugOf("baska"),
        v.hash.slice(0, 16),
      ),
    ).toBeNull();
    const flipped = (v.hash[0] === "0" ? "1" : "0") + v.hash.slice(1, 16);
    expect(await versions.findLegalVersionByPrefix(v.slug, flipped)).toBeNull();
    expect(
      await versions.findLegalVersionByPrefix(v.slug, v.hash.slice(0, 15)),
    ).toBeNull();
    const loaded = await versions.loadLegalVersions([v.hash, "f".repeat(64)]);
    expect([...loaded.keys()]).toEqual([v.hash]);
  });

  it("destroys only a text replaced before the cutoff that no recent consent names", async () => {
    // The sweep runs on an earlier day, so every other rule's cutoff lies
    // before any row this database holds (as in the audit-log suite).
    const sweepAt = new Date("2014-06-01T06:00:00.000Z");
    const [s1, s2, s3, s4] = ["a", "b", "c", "d"].map(slugOf);
    // s1: replaced in 2002, named by nobody -> the 2001 text goes.
    const gone = await storeAt(s1, "1. metin", "2001-01-01T00:00:00.000Z");
    const s1Newest = await storeAt(s1, "2. metin", "2002-01-01T00:00:00.000Z");
    // s2: replaced in 2002, but an order accepted in 2010 names it -> kept.
    const ordered = await storeAt(s2, "1. metin", "2001-01-01T00:00:00.000Z");
    await storeAt(s2, "2. metin", "2002-06-01T00:00:00.000Z");
    await pool!.query(
      `insert into public.orders (id, "orderNo", status, "legalConsent", "createdAt")
       values ($1, $2, 'completed', $3::jsonb, '2010-01-01T00:00:00.000Z')`,
      [
        `ord-dbtest-${RUN}`,
        900_000_000 + Math.floor(Math.random() * 90_000_000),
        JSON.stringify({
          acceptedAt: "2010-01-01T00:00:00.000Z",
          textHashes: { [s2]: ordered.hash },
        }),
      ],
    );
    // s3: replaced only in 2012, after the cutoff -> kept.
    const lateReplaced = await storeAt(
      s3,
      "1. metin",
      "2001-01-01T00:00:00.000Z",
    );
    await storeAt(s3, "2. metin", "2012-01-01T00:00:00.000Z");
    // s4: replaced in 2002, a karaoke booking accepted in 2010 names it -> kept.
    const booked = await storeAt(s4, "1. metin", "2001-01-01T00:00:00.000Z");
    await storeAt(s4, "2. metin", "2002-06-01T00:00:00.000Z");
    await pool!.query(
      `insert into public.karaoke_reservations (id, "customerEmail", date, "startHour", status, "legalConsent", "createdAt")
       values ($1, 'dbtest@example.com', '2010-01-02', 20, 'cancelled', $2::jsonb, '2010-01-01T00:00:00.000Z')`,
      [
        `krk-dbtest-${RUN}`,
        JSON.stringify({
          acceptedAt: "2010-01-01T00:00:00.000Z",
          textHashes: { [s4]: booked.hash },
        }),
      ],
    );

    // s5: replaced in 2002 and shown again today (a reset to the coded
    // text keeps the row's first "createdAt") -> kept (review R1).
    const s5 = slugOf("e");
    const shownAgain = await storeAt(
      s5,
      "1. metin",
      "2001-01-01T00:00:00.000Z",
    );
    await storeAt(s5, "2. metin", "2002-06-01T00:00:00.000Z");
    const keep = { "legal-doc-versions": [shownAgain.hash] };

    const { runRetention } = await import("@/lib/retention");
    // A caller that cannot say what is shown today removes nothing.
    const blind = await runRetention({ now: sweepAt, apply: true });
    expect(
      blind.results.find((x) => x.id === "legal-doc-versions"),
    ).toMatchObject({ matched: 0, destroyed: 0 });
    expect(await count(gone.hash)).toBe(1);
    const { rows: nullKeep } = await pool!.query(
      "select public.legal_doc_versions_retention($1, true, null) as n",
      [sweepAt.toISOString()],
    );
    expect(nullKeep[0].n).toBe(0);

    const dry = await runRetention({ now: sweepAt, keep });
    const dryRule = dry.results.find((x) => x.id === "legal-doc-versions")!;
    expect(dryRule.error).toBeUndefined();
    expect(dryRule.matched).toBe(1);
    expect(await count(gone.hash)).toBe(1);

    const report = await runRetention({ now: sweepAt, apply: true, keep });
    const rule = report.results.find((x) => x.id === "legal-doc-versions")!;
    expect(rule.error).toBeUndefined();
    expect(rule.destroyed).toBe(1);
    expect(await count(gone.hash)).toBe(0);
    for (const kept of [s1Newest, ordered, lateReplaced, booked, shownAgain]) {
      expect(await count(kept.hash)).toBe(1);
    }
  });
});
