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
 * The legal override archive in a real Postgres
 * (db/migrations/20261017210000_legal_override_history.sql): a save that
 * changes an override archives the text it replaces, a save that changes
 * nothing does not, "Varsayılana döndür" archives before it deletes, and the
 * archive cannot be edited. Skipped without TEST_DATABASE_URL, like the other
 * db-integration suites.
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

const store = await import("@/lib/legal/store");

const SLUG = "kvkk-aydinlatma-metni";
const OWNER = "patron@laffogato.net";

function input(over: Partial<Parameters<typeof store.upsertLegalDoc>[1]>) {
  return {
    title: "KVKK Aydınlatma Metni",
    summary: "Özet",
    effectiveDate: "20 Ekim 2026",
    bodyMarkdown: "## Birinci metin\n\nParagraf.",
    isPublished: true,
    ...over,
  };
}

maybe("legal override archive, in SQL", () => {
  let release: (() => Promise<void>) | undefined;

  beforeAll(async () => {
    release = await holdSharedDatabase(URL_!);
    pool = new pg.Pool({ connectionString: URL_, max: 4 });
    await applyBundledSchema(pool);
  }, SUITE_LOCK_WAIT_MS);

  afterAll(async () => {
    await pool?.end();
    pool = null;
    await release?.();
  });

  beforeEach(async () => {
    await pool!.query("delete from public.legal_docs where slug = $1", [SLUG]);
    // The archive refuses UPDATE only; the suite clears its own rows.
    await pool!.query(
      "delete from public.legal_override_history where slug = $1",
      [SLUG],
    );
  });

  it("archives the replaced text only when the save changes something", async () => {
    const first = await store.upsertLegalDoc(SLUG, input({}), { by: OWNER });
    expect(first.archivedId).toBeNull();

    // A later millisecond, so a rewritten updatedAt would show.
    await new Promise((r) => setTimeout(r, 5));
    const same = await store.upsertLegalDoc(SLUG, input({}), { by: OWNER });
    expect(same.archivedId).toBeNull();
    // Nothing written: the text still counts from its first save, so the
    // archive's spans say exactly when each text was shown.
    expect((await store.getLegalDocOverride(SLUG))?.updatedAt).toBe(
      first.override.updatedAt,
    );

    const second = await store.upsertLegalDoc(
      SLUG,
      input({ bodyMarkdown: "## İkinci metin\n\nParagraf." }),
      { by: OWNER },
    );
    expect(second.archivedId).not.toBeNull();

    const archived = await store.getLegalOverrideArchive(second.archivedId!);
    expect(archived).toMatchObject({
      slug: SLUG,
      bodyMarkdown: "## Birinci metin\n\nParagraf.",
      isPublished: true,
      effectiveDate: "20 Ekim 2026",
      archivedBy: OWNER,
      reason: "replaced",
    });
    expect(archived!.updatedAt).toBe(first.override.updatedAt);

    const live = await store.getLegalDocOverride(SLUG);
    expect(live?.bodyMarkdown).toBe("## İkinci metin\n\nParagraf.");
  });

  it("archives a published flag change too", async () => {
    await store.upsertLegalDoc(SLUG, input({}), { by: OWNER });
    const draft = await store.upsertLegalDoc(
      SLUG,
      input({ isPublished: false }),
      { by: OWNER },
    );
    expect(draft.archivedId).not.toBeNull();
  });

  it("Varsayılana döndür archives the override, then removes it", async () => {
    await store.upsertLegalDoc(SLUG, input({}), { by: OWNER });
    const id = await store.resetLegalDoc(SLUG, { by: OWNER });
    expect(id).not.toBeNull();
    expect(await store.getLegalDocOverride(SLUG)).toBeNull();

    const archived = await store.getLegalOverrideArchive(id!);
    expect(archived).toMatchObject({
      slug: SLUG,
      reason: "reset",
      archivedBy: OWNER,
      bodyMarkdown: "## Birinci metin\n\nParagraf.",
    });

    // Nothing left to reset: no second archive row.
    expect(await store.resetLegalDoc(SLUG, { by: OWNER })).toBeNull();
    const list = await store.listLegalOverrideArchive({ slug: SLUG });
    expect(list).toHaveLength(1);
  });

  it("lists newest first without bodies, and the published texts with them", async () => {
    await store.upsertLegalDoc(SLUG, input({ isPublished: false }), {
      by: OWNER,
    });
    await store.upsertLegalDoc(SLUG, input({ bodyMarkdown: "## B\n\nx." }), {
      by: OWNER,
    });
    await store.resetLegalDoc(SLUG, { by: OWNER });

    const list = await store.listLegalOverrideArchive({ slug: SLUG });
    expect(list.map((r) => r.reason)).toEqual(["reset", "replaced"]);
    expect(list.map((r) => r.isPublished)).toEqual([true, false]);
    expect(list[0]).not.toHaveProperty("bodyMarkdown");
    expect(typeof list[0].id).toBe("string");

    const published = await store.listPublishedLegalArchive(SLUG);
    expect(published).toHaveLength(1);
    expect(published[0].bodyMarkdown).toBe("## B\n\nx.");
  });

  it("puts an archived text back, archiving the one it replaces", async () => {
    await store.upsertLegalDoc(SLUG, input({}), { by: OWNER });
    const resetId = await store.resetLegalDoc(SLUG, { by: OWNER });
    await store.upsertLegalDoc(
      SLUG,
      input({ bodyMarkdown: "## Yeni taslak\n\nx.", isPublished: false }),
      { by: OWNER },
    );

    const archived = await store.getLegalOverrideArchive(resetId!);
    const restored = await store.upsertLegalDoc(SLUG, archived!, {
      by: OWNER,
    });
    expect(restored.archivedId).not.toBeNull();
    expect((await store.getLegalDocOverride(SLUG))?.bodyMarkdown).toBe(
      "## Birinci metin\n\nParagraf.",
    );
    const replaced = await store.getLegalOverrideArchive(restored.archivedId!);
    expect(replaced?.bodyMarkdown).toBe("## Yeni taslak\n\nx.");
  });

  it("refuses to edit an archived text", async () => {
    await store.upsertLegalDoc(SLUG, input({}), { by: OWNER });
    const id = await store.resetLegalDoc(SLUG, { by: OWNER });
    await expect(
      pool!.query(
        `update public.legal_override_history set "bodyMarkdown" = 'x' where id = $1`,
        [id],
      ),
    ).rejects.toThrow(/append-only/);
  });

  it("reads an unknown or malformed archive id as missing", async () => {
    expect(await store.getLegalOverrideArchive("999999999")).toBeNull();
    expect(await store.getLegalOverrideArchive("1; drop")).toBeNull();
  });
});
