import { existsSync, readFileSync } from "node:fs";

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { HOME_SLIDES, type HomeSlide } from "@/components/laffogato/data";
import { HomeHeroSlider } from "@/components/laffogato/home-hero-slider";
import { SCENES } from "@/components/laffogato/scenes";
import {
  HOME_HERO_BUNDLED_IMAGES,
  HOME_HERO_SCENES,
  HOME_SLIDE_ACTIONS,
  MAX_LIVE_HOME_SLIDES,
  homeSlideOffReason,
  homeSlideToInput,
  liveHomeHeroSlides,
  safeSlideHref,
  safeSlideImage,
  slideButton,
  toHomeSlide,
  unknownPlaceholders,
  type HomeHeroSlide,
} from "@/lib/admin/home-hero-core";
import { parseHomeHeroForm } from "@/lib/admin/home-hero-schema";
import { canAccess } from "@/lib/admin/roles";
import { createDb, type Executor } from "@/lib/db/client";

/**
 * The home page hero, editable from the panel (operator, 17 Eki 2026: "site
 * slider alanı, 3-4 kampanya slaytı, panelden tamamen düzenlenebilir olsun"):
 * the link rules, the publish window and order, the fallback to the bundled
 * HOME_SLIDES, the table's reads and writes, and the slider drawing what the
 * panel gives it.
 */

const read = (p: string) => readFileSync(p, "utf8");

const PIXEL =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

function row(over: Partial<HomeHeroSlide> = {}): HomeHeroSlide {
  return {
    id: "hhero-1",
    sortOrder: 10,
    isActive: true,
    startsAt: "",
    endsAt: "",
    kicker: "Ekim kampanyası",
    titleLine1: "Sonbahar",
    titleLine2: "Menüsü",
    body: "Balkabağı latte geri döndü. Ekim boyunca köşkte.",
    image: "/menu/matcha-latte-cut.webp",
    alt: "Buzlu bir latte",
    scene: "spice",
    primaryLabel: "Kampanyalar",
    primaryAction: "",
    primaryHref: "/kampanyalar",
    secondaryLabel: "Tüm menü",
    secondaryAction: "menu",
    secondaryHref: "",
    createdAt: "2026-10-17T10:00:00.000Z",
    updatedAt: "2026-10-17T10:00:00.000Z",
    ...over,
  };
}

describe("a button's free link", () => {
  it("takes a path on this site or an https URL", () => {
    expect(safeSlideHref("/kampanyalar")).toBe("/kampanyalar");
    expect(safeSlideHref(" /menu/matcha?x=1#top ")).toBe(
      "/menu/matcha?x=1#top",
    );
    expect(safeSlideHref("https://www.instagram.com/laffogato/")).toBe(
      "https://www.instagram.com/laffogato/",
    );
  });

  it("refuses every other scheme and every way out of the site", () => {
    for (const bad of [
      "javascript:alert(1)",
      "JavaScript:alert(1)",
      " javascript:alert(1)",
      "data:text/html,<script>alert(1)</script>",
      "vbscript:msgbox(1)",
      "http://laffogato.net/",
      "//evil.example/",
      "/\\evil.example",
      "https://user:pass@evil.example/",
      "https://",
      "kampanyalar",
      "#uygulama",
      "/menu\nmatcha",
      "/menu matcha",
      "https://evil.example/ x",
      "",
      42,
      null,
    ]) {
      expect(safeSlideHref(bad), String(bad)).toBeNull();
    }
  });

  it("drops a button whose stored target fails the check, on read", () => {
    expect(slideButton("Bak", "", "javascript:alert(1)")).toBeUndefined();
    expect(slideButton("", "menu", "")).toBeUndefined();
    expect(slideButton("Bak", "notAnAction", "")).toBeUndefined();
    expect(slideButton("Bak", "karaoke", "")).toEqual({
      label: "Bak",
      action: "karaoke",
    });
    expect(slideButton(" Bak ", "", "/kampanyalar")).toEqual({
      label: "Bak",
      href: "/kampanyalar",
    });
  });
});

describe("a slide's picture", () => {
  it("is a bundled file, an upload the panel can make, or an https URL", () => {
    expect(safeSlideImage("/menu/matcha-latte-cut.webp")).toBe(
      "/menu/matcha-latte-cut.webp",
    );
    expect(safeSlideImage(PIXEL)).toBe(PIXEL);
    expect(safeSlideImage("https://cdn.example.com/a.webp")).toBe(
      "https://cdn.example.com/a.webp",
    );
    for (const bad of [
      "/etc/passwd",
      "/menu/not-in-the-list.webp",
      "data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=",
      "data:text/html;base64,PGgxPg==",
      "http://cdn.example.com/a.webp",
      "javascript:alert(1)",
    ]) {
      expect(safeSlideImage(bad), bad).toBe("");
    }
  });

  it("offers only files that ship in public/, every bundled slide's among them", () => {
    for (const img of HOME_HERO_BUNDLED_IMAGES) {
      expect(existsSync(`public${img.path}`), img.path).toBe(true);
    }
    for (const s of HOME_SLIDES) {
      expect(
        HOME_HERO_BUNDLED_IMAGES.map((i) => i.path),
        s.photo,
      ).toContain(s.photo);
    }
  });
});

describe("the action codes and scenes the panel offers", () => {
  it("are all handled by the home page and all drawable", () => {
    const home = read("src/components/laffogato/home-page.tsx");
    for (const a of HOME_SLIDE_ACTIONS) {
      expect(home, a).toContain(`case "${a}":`);
    }
    for (const k of HOME_HERO_SCENES) expect(SCENES[k], k).toBeDefined();
  });

  it("knows only the two placeholders the site fills", () => {
    expect(
      unknownPlaceholders("Oda {kapasite} kişi, {kapanis} kadar."),
    ).toEqual([]);
    expect(unknownPlaceholders("{fiyat} TL, {kapasite}")).toEqual(["{fiyat}"]);
  });
});

describe("which rows the site draws", () => {
  const NOW = Date.parse("2026-10-17T12:00:00Z");

  it("keeps the panel's order and leaves out what is off or outside its window", () => {
    const rows = [
      row({ id: "c", sortOrder: 30 }),
      row({ id: "a", sortOrder: 10 }),
      row({ id: "off", sortOrder: 5, isActive: false }),
      row({ id: "later", sortOrder: 1, startsAt: "2026-10-18T00:00:00.000Z" }),
      row({ id: "over", sortOrder: 2, endsAt: "2026-10-17T11:59:00.000Z" }),
      row({ id: "typo", sortOrder: 3, endsAt: "30.10.2026" }),
      row({ id: "b", sortOrder: 20, startsAt: "2026-10-17T11:00:00.000Z" }),
      row({ id: "noimg", sortOrder: 4, image: "/nope.webp" }),
    ];
    expect(liveHomeHeroSlides(rows, NOW).map((r) => r.id)).toEqual([
      "a",
      "b",
      "c",
    ]);
    expect(homeSlideOffReason(rows[2], NOW)).toBe("Yayında değil");
    expect(homeSlideOffReason(rows[3], NOW)).toBe("Yayın aralığı dışında");
    // A mistyped end date fails closed, it never means "no end".
    expect(homeSlideOffReason(rows[5], NOW)).toBe("Yayın aralığı dışında");
    expect(homeSlideOffReason(rows[7], NOW)).toBe("Başlık ya da görsel eksik");
  });

  it("breaks an order tie by age, and draws at most six", () => {
    const rows = Array.from({ length: 8 }, (_, i) =>
      row({
        id: `s${i}`,
        sortOrder: 10,
        createdAt: `2026-10-17T10:0${7 - i}:00.000Z`,
      }),
    );
    const live = liveHomeHeroSlides(rows, NOW);
    expect(live).toHaveLength(MAX_LIVE_HOME_SLIDES);
    expect(live[0].id).toBe("s7");
  });

  it("maps a row to what the slider draws", () => {
    const slide = toHomeSlide(
      row({ titleLine2: "", primaryHref: "javascript:x()", scene: "nope" }),
      "/gorsel/ana-hero/hhero-1",
    );
    expect(slide).toMatchObject({
      id: "hhero-1",
      title: ["Sonbahar", ""],
      photo: "/gorsel/ana-hero/hhero-1",
      scene: "latte",
      // The unsafe first button is gone and the second moved up.
      primary: { label: "Tüm menü", action: "menu" },
      secondary: undefined,
    });
  });

  it("turns every bundled slide into a row and back without a loss", () => {
    for (const [i, s] of HOME_SLIDES.entries()) {
      const input = homeSlideToInput(s, (i + 1) * 10);
      const back = toHomeSlide(
        { ...input, id: "x", createdAt: "", updatedAt: "" },
        s.photo,
      );
      const { id: _id, ...rest } = back;
      expect(rest, s.title.join(" ")).toEqual({ ...s, secondary: s.secondary });
    }
  });
});

describe("the slide form", () => {
  const base: Record<string, string> = {
    kicker: "Ekim",
    titleLine1: "Sonbahar",
    titleLine2: "Menüsü",
    body: "Balkabağı latte geri döndü. Ekim boyunca köşkte.",
    imageSource: "/menu/matcha-latte-cut.webp",
    imageUpload: "[]",
    alt: "Buzlu bir latte",
    scene: "spice",
    primaryLabel: "Kampanyalar",
    primaryTarget: "link",
    primaryHref: "/kampanyalar",
    secondaryLabel: "Tüm menü",
    secondaryTarget: "menu",
    secondaryHref: "",
    sortOrder: "20",
    isActive: "on",
    startsAt: "2026-10-20T09:00",
    endsAt: "2026-10-31T23:59",
  };
  const form = (over: Record<string, string | null> = {}) => {
    const fd = new FormData();
    for (const [k, v] of Object.entries({ ...base, ...over })) {
      if (v !== null) fd.set(k, v);
    }
    return parseHomeHeroForm(fd);
  };
  const errors = (over: Record<string, string | null>) => {
    const r = form(over);
    expect(r.ok).toBe(false);
    return r.ok ? {} : r.fieldErrors;
  };

  it("reads a full slide, the window as Istanbul wall clock", () => {
    const r = form();
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.input).toMatchObject({
      titleLine1: "Sonbahar",
      image: "/menu/matcha-latte-cut.webp",
      primaryAction: "",
      primaryHref: "/kampanyalar",
      secondaryAction: "menu",
      secondaryHref: "",
      sortOrder: 20,
      isActive: true,
      startsAt: "2026-10-20T06:00:00.000Z",
      endsAt: "2026-10-31T20:59:00.000Z",
    });
  });

  it("refuses an unsafe or foreign link under the link field", () => {
    for (const bad of [
      "javascript:alert(document.cookie)",
      "data:text/html,x",
      "http://example.com",
      "//evil.example",
      "",
    ]) {
      expect(errors({ primaryHref: bad }).primaryHref, bad).toMatch(
        /sitedeki bir yol/,
      );
    }
    expect(form({ primaryHref: "https://instagram.com/laffogato" }).ok).toBe(
      true,
    );
  });

  it("asks for each part of a button the operator started", () => {
    expect(errors({ primaryTarget: "" }).primaryTarget).toMatch(/nereye/);
    expect(errors({ primaryLabel: "" }).primaryLabel).toMatch(/yazısını/);
    expect(errors({ secondaryTarget: "admin" }).secondaryTarget).toMatch(
      /Listeden/,
    );
    expect(
      errors({ primaryLabel: "", primaryTarget: "", primaryHref: "" })
        .primaryLabel,
    ).toMatch(/Önce birinci/);
    // No buttons at all is allowed: a slide can be a picture and a line.
    const bare = form({
      primaryLabel: "",
      primaryTarget: "",
      secondaryLabel: "",
      secondaryTarget: "",
    });
    expect(bare.ok).toBe(true);
  });

  it("refuses a missing title, text or description, and an unknown light", () => {
    const e = errors({ titleLine1: " ", body: "", alt: "", scene: "neon" });
    expect(Object.keys(e).sort()).toEqual(
      ["alt", "body", "scene", "titleLine1"].sort(),
    );
    expect(errors({ titleLine1: "x".repeat(21) }).titleLine1).toMatch(/20/);
  });

  it("keeps the phone's first sentence short and the placeholders known", () => {
    expect(errors({ body: `${"a".repeat(95)}. İkinci.` }).body).toMatch(
      /İlk cümle/,
    );
    expect(errors({ body: "Bu akşam {fiyat} TL." }).body).toMatch(/\{fiyat\}/);
    expect(
      form({ body: "Oda {kapasite} kişilik. Gece {kapanis} kadar açık." }).ok,
    ).toBe(true);
  });

  it("takes an upload or an https picture, never an svg or http one", () => {
    const custom = (imageUpload: string) =>
      form({ imageSource: "custom", imageUpload });
    const ok = custom(JSON.stringify([PIXEL]));
    expect(ok.ok && ok.input.image).toBe(PIXEL);
    const url = custom(JSON.stringify(["https://cdn.example.com/a.webp"]));
    expect(url.ok && url.input.image).toBe("https://cdn.example.com/a.webp");
    for (const bad of [
      "[]",
      JSON.stringify(["data:image/svg+xml;base64,PHN2Zz48L3N2Zz4="]),
      JSON.stringify(["http://cdn.example.com/a.webp"]),
      "not json [",
    ]) {
      const r = custom(bad);
      expect(r.ok, bad).toBe(false);
      expect(r.ok ? "" : r.fieldErrors.imageUpload, bad).toBeTruthy();
    }
    expect(errors({ imageSource: "/etc/hosts" }).imageSource).toBeTruthy();
    expect(errors({ imageSource: "" }).imageSource).toBeTruthy();
  });

  it("refuses a window that ends before it starts, or a date it cannot read", () => {
    expect(errors({ endsAt: "2026-10-19T09:00" }).endsAt).toMatch(/sonra/);
    expect(errors({ startsAt: "yarın" }).startsAt).toBeTruthy();
    const open = form({ startsAt: "", endsAt: "" });
    expect(open.ok && [open.input.startsAt, open.input.endsAt]).toEqual([
      "",
      "",
    ]);
  });

  it("reads the order and the switch as numbers and booleans", () => {
    expect(errors({ sortOrder: "-1" }).sortOrder).toBeTruthy();
    expect(errors({ sortOrder: "1000" }).sortOrder).toBeTruthy();
    expect(errors({ sortOrder: "1.5" }).sortOrder).toBeTruthy();
    const off = form({ isActive: null, sortOrder: "" });
    expect(off.ok && [off.input.isActive, off.input.sortOrder]).toEqual([
      false,
      0,
    ]);
  });
});

describe("who edits the home hero", () => {
  it("is the content editors: owner and manager", () => {
    expect(canAccess("content", "owner")).toBe(true);
    expect(canAccess("content", "manager")).toBe(true);
    expect(canAccess("content", "staff")).toBe(false);
    expect(canAccess("content", "cashier")).toBe(false);
    const actions = read("src/app/admin/anasayfa-hero/actions.ts");
    const exported = [...actions.matchAll(/export async function (\w+)/g)];
    expect(exported.length).toBe(6);
    // Every action, not just the page, opens the gate.
    const gates = actions.match(/await requireRole\("content"\);/g) ?? [];
    expect(gates.length).toBe(exported.length);
    for (const page of [
      "src/app/admin/anasayfa-hero/page.tsx",
      "src/app/admin/anasayfa-hero/yeni/page.tsx",
      "src/app/admin/anasayfa-hero/[id]/page.tsx",
    ]) {
      expect(read(page), page).toContain('await requireRole("content");');
    }
  });
});

// ─── The table ──────────────────────────────────────────────────────────

const db = vi.hoisted(() => ({
  rows: [] as HomeHeroSlide[],
  fail: null as null | (Error & { code?: string }),
  seen: [] as { text: string; values: unknown[] }[],
}));

const exec: Executor = async ({ text, params }) => {
  db.seen.push({ text, values: params });
  if (db.fail) throw db.fail;
  if (/^SELECT /.test(text)) {
    return { rows: db.rows.map((r) => ({ ...r })), rowCount: db.rows.length };
  }
  if (/^INSERT /.test(text) && /RETURNING/.test(text)) {
    // ON CONFLICT DO NOTHING: only the ids not already stored come back.
    const ids = params.filter(
      (v) => typeof v === "string" && /^hhero-varsayilan-\d$/.test(v),
    ) as string[];
    const stored = new Set(db.rows.map((r) => r.id));
    const fresh = ids.filter((id) => !stored.has(id)).map((id) => ({ id }));
    return { rows: fresh, rowCount: fresh.length };
  }
  return { rows: [], rowCount: 0 };
};

vi.doMock("@/lib/db", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/db")>();
  const fake = createDb(exec);
  return { ...real, getDb: () => fake };
});

const store = await import("@/lib/admin/home-hero");

beforeEach(() => {
  db.rows = [];
  db.fail = null;
  db.seen = [];
});

describe("the home page's slides", () => {
  it("are the bundled ones while the table is empty", async () => {
    const r = await store.listHomeSlidesForSite();
    expect(r).toEqual({ slides: HOME_SLIDES, fromPanel: false });
    expect(db.seen[0].text).toMatch(/FROM "home_hero_slides"/);
  });

  it("are the bundled ones while no row is live", async () => {
    db.rows = [
      row({ isActive: false }),
      row({ id: "b", endsAt: "2020-01-01T00:00:00.000Z" }),
    ];
    expect(await store.listHomeSlidesForSite()).toEqual({
      slides: HOME_SLIDES,
      fromPanel: false,
    });
  });

  it("are the bundled ones when the database cannot be reached", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    db.fail = new Error("connect ECONNREFUSED");
    expect(await store.listHomeSlidesForSite()).toEqual({
      slides: HOME_SLIDES,
      fromPanel: false,
    });
    // The outage is still logged, so a degraded page is never silent.
    expect(log).toHaveBeenCalledWith(
      expect.stringContaining("[db-degraded] listHomeSlidesForSite"),
    );
    log.mockRestore();
  });

  it("still fail loudly on a query the database rejects", async () => {
    db.fail = Object.assign(new Error('relation "x" does not exist'), {
      code: "42P01",
    });
    await expect(store.listHomeSlidesForSite()).rejects.toThrow(/42P01|exist/);
  });

  it("are the panel's live rows, in order, an upload served by id", async () => {
    db.rows = [
      row({ id: "two", sortOrder: 20, image: PIXEL }),
      row({ id: "one", sortOrder: 10 }),
      row({ id: "off", sortOrder: 1, isActive: false }),
    ];
    const { slides, fromPanel } = await store.listHomeSlidesForSite();
    expect(fromPanel).toBe(true);
    expect(slides.map((s) => s.id)).toEqual(["one", "two"]);
    expect(slides[0].photo).toBe("/menu/matcha-latte-cut.webp");
    expect(slides[1].photo).toMatch(
      /^\/gorsel\/ana-hero\/two\?v=[0-9a-f]{12}$/,
    );
    // The data URL never reaches the page payload.
    expect(JSON.stringify(slides)).not.toContain("base64");
  });
});

describe("the panel's writes", () => {
  it("imports the four bundled slides, karaoke included, with fixed ids", async () => {
    const r = await store.importDefaultHomeSlides({
      firstImage: "https://cdn.example.com/hero.webp",
    });
    expect(r).toEqual({ added: 4, total: 4 });
    const insert = db.seen.find((q) => /^INSERT /.test(q.text))!;
    expect(insert.text).toMatch(
      /ON CONFLICT \("id"\) DO NOTHING RETURNING "id"$/,
    );
    const values = insert.values;
    expect(values).toEqual(
      expect.arrayContaining(store.DEFAULT_HOME_SLIDE_IDS),
    );
    expect(values).toContain("Sahne");
    expect(values).toContain(HOME_SLIDES[3].text);
    expect(values).toContain("karaoke");
    // Ayarlar → "Hero görsel URL" goes with the first slide.
    expect(values).toContain("https://cdn.example.com/hero.webp");
  });

  it("adds back only the defaults that are missing", async () => {
    db.rows = [row({ id: "hhero-varsayilan-1", sortOrder: 40 })];
    const r = await store.importDefaultHomeSlides();
    expect(r).toEqual({ added: 3, total: 4 });
    const insert = db.seen.find((q) => /^INSERT /.test(q.text))!;
    // Appended after the last row.
    expect(insert.values).toContain(50);
  });

  it("stores a link the site would refuse as no button at all", async () => {
    const input = homeSlideToInput(HOME_SLIDES[0], 10);
    const created = await store.createHomeHeroSlide({
      ...input,
      primaryLabel: "Tıkla",
      primaryAction: "",
      primaryHref: "javascript:alert(1)",
      image: "data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=",
    });
    expect(created).toMatchObject({
      primaryLabel: "",
      primaryHref: "",
      image: "",
    });
    const insert = db.seen.find((q) => /^INSERT /.test(q.text))!;
    expect(JSON.stringify(insert.values)).not.toContain("javascript");
  });

  it("moves a slide past its neighbour and renumbers the list", async () => {
    db.rows = [
      row({ id: "a", sortOrder: 10 }),
      row({ id: "b", sortOrder: 20, createdAt: "2026-10-17T10:00:00.000Z" }),
      row({ id: "c", sortOrder: 20, createdAt: "2026-10-17T11:00:00.000Z" }),
    ];
    expect(await store.moveHomeHeroSlide("c", "up")).toBe("moved");
    const updates = db.seen
      .filter((q) => /^UPDATE /.test(q.text))
      .map((q) => q.values);
    // a stays 10; c becomes 20 (unchanged number, so not written), b 30.
    expect(updates).toEqual([[30, "b"]]);
    db.seen = [];
    expect(await store.moveHomeHeroSlide("a", "up")).toBe("edge");
    expect(await store.moveHomeHeroSlide("zzz", "down")).toBe("not_found");
    expect(db.seen.some((q) => /^UPDATE /.test(q.text))).toBe(false);
  });
});

// ─── The slider ─────────────────────────────────────────────────────────

const FACTS = {
  capacity: 8,
  hourlyMinor: 90_000,
  closeHour: 24,
  rubyDiscountPct: 15,
  rubyLabel: "RUBY",
  prepay: true,
};

const draw = (slides?: HomeSlide[], heroImageUrl?: string) =>
  renderToStaticMarkup(
    createElement(HomeHeroSlider, {
      slides,
      onAction: () => {},
      karaoke: FACTS,
      heroImageUrl,
    }),
  );

describe("the slider with the panel's slides", () => {
  const panel: HomeSlide[] = [
    toHomeSlide(
      row({
        id: "p1",
        body: "Oda {kapasite} kişilik. Gece {kapanis} kadar senin.",
      }),
      "/menu/matcha-latte-cut.webp",
    ),
    toHomeSlide(
      row({
        id: "p2",
        titleLine1: "Instagram",
        titleLine2: "",
        primaryHref: "https://www.instagram.com/laffogato/",
        secondaryLabel: "",
        secondaryAction: "",
      }),
      "/gorsel/ana-hero/p2?v=abcdefabcdef",
    ),
  ];

  it("draws the first slide: its words, its buttons, its light", () => {
    const html = draw(panel);
    expect(html).toContain('<p class="hero-x-kicker">Ekim kampanyası</p>');
    expect(html).toMatch(
      /<h2 class="hero-x-title"><span>Sonbahar<\/span><span>Menüsü<\/span><\/h2>/,
    );
    // {kapasite} / {kapanis} filled from the panel's karaoke settings.
    expect(html).toContain("Oda 8 kişilik.");
    expect(html).toContain("Gece 24:00’e kadar senin.");
    // A same-site link is a link, an action stays a button.
    expect(html).toMatch(
      /<a class="btn btn-lg btn-primary" href="\/kampanyalar">Kampanyalar<\/a>/,
    );
    expect(html).toMatch(
      /<button type="button" class="btn btn-lg btn-ghost">Tüm menü<\/button>/,
    );
    expect(html).toContain(`--scene-core:${SCENES.spice.core}`);
  });

  it("loads only the first photo eagerly, and the rest lazily", () => {
    const html = draw(panel);
    const stage = html.slice(html.indexOf('class="hero-x-stage"'));
    expect(stage).toMatch(
      /<img[^>]*fetchpriority="high"[^>]*loading="eager"|<img[^>]*loading="eager"[^>]*fetchpriority="high"/i,
    );
    // The upload's thumbnail is a plain lazy <img>, not next/image.
    expect(html).toMatch(
      /<img src="\/gorsel\/ana-hero\/p2\?v=abcdefabcdef" alt="" width="581" height="942" loading="lazy"/,
    );
  });

  it("names every slide in its thumbnail row, one column each", () => {
    const html = draw(panel);
    expect(html).toContain('aria-label="1. slayt: Sonbahar Menüsü"');
    expect(html).toContain('aria-label="2. slayt: Instagram"');
    expect(html).toContain("--thumbs:2");
    expect(html).toContain('aria-roledescription="karusel"');
    // Server render and reduced motion: no clock running.
    expect(html).not.toContain("hero-x-thumb-progress");
  });

  it("draws a lone slide without thumbnails or a carousel role", () => {
    const html = draw([panel[1]]);
    expect(html).not.toContain("hero-x-thumbs");
    expect(html).not.toContain("aria-roledescription");
    expect(html).toMatch(
      /<h2 class="hero-x-title"><span>Instagram<\/span><\/h2>/,
    );
    expect(html).toMatch(
      /<a class="btn btn-lg btn-primary" href="https:\/\/www\.instagram\.com\/laffogato\/" rel="noopener noreferrer">Kampanyalar<\/a>/,
    );
  });

  it("holds a wide upload inside the stage instead of cutting it off", () => {
    // The photo is set to the stage's height. A cut-out is far narrower than
    // the stage, but a 16:9 campaign picture at that height ran past the
    // frame (overflow: hidden) and lost its right side.
    const css = read("src/app/globals.css");
    const rule = /\.hero-x-photo \{([^}]*)\}/.exec(css)?.[1] ?? "";
    expect(rule).toMatch(/height: calc\(var\(--stage\) \* 0\.92\);/);
    expect(rule).toMatch(/max-width: 100%;/);
    expect(rule).toMatch(/object-fit: contain;/);
    expect(rule).not.toMatch(/max-width: none/);
  });

  it("falls back to the bundled slides with nothing from the panel", () => {
    for (const html of [draw(undefined), draw([])]) {
      expect(html).toContain(
        `<p class="hero-x-kicker">${HOME_SLIDES[0].kicker}</p>`,
      );
      expect(html).toContain(`--thumbs:${HOME_SLIDES.length}`);
    }
    // "Hero görsel URL" still replaces the first bundled photo.
    expect(draw(undefined, "https://cdn.example.com/hero.webp")).toContain(
      'src="https://cdn.example.com/hero.webp"',
    );
  });
});

describe("the home page's shortcuts", () => {
  const home = read("src/components/laffogato/home-page.tsx");

  it("say the panel's pickup time and stamp count, not typed-in ones", () => {
    expect(home).not.toContain("Gel-al · 15 dk");
    expect(home).not.toContain("6 damgada");
    expect(home).not.toContain("altıncı içecek");
    expect(home).toContain("title: `Gel-al · ${pickupMinutes} dk`");
    expect(home).toContain("title: `${stampTarget} damgada 1 içecek`");
    const props = read("src/lib/seo/app-props.ts");
    expect(props).toContain("pickupReadyMinutes: settings.pickupReadyMinutes");
    expect(props).toContain(
      "stampTarget: settings.mobileApp.loyalty.stampTarget",
    );
  });

  it("only send the panel's slides, and the photo setting only without them", () => {
    const props = read("src/lib/seo/app-props.ts");
    expect(props).toContain(
      "homeSlides: homeHero?.fromPanel ? homeHero.slides : undefined",
    );
    expect(props).toMatch(
      /heroImageUrl:\s*homeHero\?\.fromPanel\s*\?\s*undefined\s*:\s*settings\.heroImageUrl \|\| undefined/,
    );
    expect(read("src/app/page.tsx")).toContain(
      "loadAppProps({ withHomeHero: true })",
    );
    // Ayarlar says so too: the field used to promise the whole hero, so an
    // operator with panel slides changed it and saw nothing happen.
    const settingsForm = read("src/app/admin/ayarlar/settings-form.tsx");
    expect(settingsForm).not.toContain("SVG placeholder");
    expect(settingsForm).toContain(
      "yayında slayt yokken yerleşik ilk slaytın görselini değiştirir",
    );
  });
});
