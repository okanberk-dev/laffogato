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

import { HOME_SLIDES } from "@/components/laffogato/data";
import { homeSlideToInput } from "@/lib/admin/home-hero-core";
import { createDb, type Executor } from "@/lib/db/client";

import { applyBundledSchema } from "./_support/apply-schema";
import {
  holdSharedDatabase,
  SUITE_LOCK_WAIT_MS,
} from "./_support/db-suite-lock";

/**
 * The home hero's table in a real Postgres
 * (db/migrations/20261017173000_home_hero_slides.sql): the columns the store
 * writes exist, the import's ON CONFLICT DO NOTHING adds back only missing
 * defaults, a reorder renumbers the list, and the site reads the live rows.
 * Skipped without TEST_DATABASE_URL, like the other db-integration suites.
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

const store = await import("@/lib/admin/home-hero");

maybe("home hero slides, in SQL", () => {
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
    await pool!.query("delete from public.home_hero_slides");
  });

  it("shows the bundled slides until the panel has a live one", async () => {
    expect(await store.listHomeSlidesForSite()).toEqual({
      slides: HOME_SLIDES,
      fromPanel: false,
    });
  });

  it("imports the four defaults once, and only the missing ones again", async () => {
    expect(await store.importDefaultHomeSlides()).toEqual({
      added: 4,
      total: 4,
    });
    const first = await store.listHomeHeroSlides();
    expect(first.map((s) => s.id)).toEqual(store.DEFAULT_HOME_SLIDE_IDS);
    expect(first.map((s) => s.sortOrder)).toEqual([10, 20, 30, 40]);
    expect(first[3]).toMatchObject({
      titleLine1: "Sahne",
      primaryAction: "karaoke",
      image: "/illustrations/karaoke-mic-cut.webp",
    });

    // An edited default survives a second import; a deleted one comes back.
    const edited = await store.updateHomeHeroSlide(first[0].id, {
      ...homeSlideToInput(HOME_SLIDES[0], 10),
      kicker: "Düzenlendi",
    });
    expect(edited?.kicker).toBe("Düzenlendi");
    // The delete hands back the removed slide's title for the audit log.
    expect(await store.deleteHomeHeroSlide(first[1].id)).toEqual({
      title: HOME_SLIDES[1].title.join(" "),
    });
    expect(await store.deleteHomeHeroSlide(first[1].id)).toBeNull();
    expect(await store.importDefaultHomeSlides()).toEqual({
      added: 1,
      total: 4,
    });
    const again = await store.listHomeHeroSlides();
    expect(again).toHaveLength(4);
    expect(again.find((s) => s.id === first[0].id)?.kicker).toBe("Düzenlendi");

    const site = await store.listHomeSlidesForSite();
    expect(site.fromPanel).toBe(true);
    expect(site.slides).toHaveLength(4);
  });

  it("creates, reorders, switches off and serves an upload by id", async () => {
    const pixel =
      "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
    const a = await store.createHomeHeroSlide({
      ...homeSlideToInput(HOME_SLIDES[0], 10),
      titleLine1: "Bir",
    });
    const b = await store.createHomeHeroSlide({
      ...homeSlideToInput(HOME_SLIDES[1], 20),
      titleLine1: "İki",
      image: pixel,
      primaryLabel: "Kampanyalar",
      primaryAction: "",
      primaryHref: "/kampanyalar",
    });
    expect(await store.moveHomeHeroSlide(b.id, "up")).toBe("moved");
    let site = await store.listHomeSlidesForSite();
    expect(site.slides.map((s) => s.title[0])).toEqual(["İki", "Bir"]);
    expect(site.slides[0].primary).toEqual({
      label: "Kampanyalar",
      href: "/kampanyalar",
    });
    expect(site.slides[0].photo).toMatch(
      new RegExp(`^/gorsel/ana-hero/${b.id}\\?v=[0-9a-f]{12}$`),
    );
    expect((await store.getHomeHeroSlide(b.id))?.image).toBe(pixel);

    expect(await store.setHomeHeroSlideActive(b.id, false)).toMatchObject({
      isActive: false,
    });
    site = await store.listHomeSlidesForSite();
    expect(site.slides.map((s) => s.id)).toEqual([a.id]);
    expect(await store.nextHomeHeroSortOrder()).toBe(30);
  });
});
