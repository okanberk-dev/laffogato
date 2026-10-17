import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, relative } from "node:path";

import { createElement, type ReactElement } from "react";
import sharp from "sharp";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { OpeningHour, WeeklyHours } from "@/lib/admin/days";

/**
 * The link-preview cards (src/lib/seo/og-card.tsx and the
 * `opengraph-image.tsx` / `twitter-image.tsx` beside each page).
 *
 * Every card is drawn here for real, through next/og, and must come out a
 * 1200 x 630 image in the format its route declares - and the product card
 * must answer 404 for a missing product and fail, not stand in, when its
 * database does. Set OG_PREVIEW_DIR to keep the images and look at them: a
 * layout that overflows is caught by eye, not by this file.
 */

const store = vi.hoisted(() => ({
  getShopProductBySlugLive: vi.fn(),
  getProduct: vi.fn(),
  getPublicSettings: vi.fn(),
}));
vi.mock("@/lib/admin/store", () => store);

const PREVIEW_DIR = process.env.OG_PREVIEW_DIR;
const APP = join(process.cwd(), "src/app");
const LONG_DASH = /[\u2013\u2014]/;

type ImageModule = {
  default: (props: { params?: Promise<Record<string, string>> }) => unknown;
  alt: string;
  size: { width: number; height: number };
  contentType: string;
  runtime?: string;
  generateStaticParams?: () => Array<Record<string, string>>;
};

async function render(
  mod: ImageModule,
  name: string,
  params?: Record<string, string>,
): Promise<Buffer> {
  const res = (await mod.default(
    params ? { params: Promise.resolve(params) } : {},
  )) as Response;
  const image = Buffer.from(await res.arrayBuffer());
  if (PREVIEW_DIR) {
    const jpeg = res.headers.get("content-type") === "image/jpeg";
    mkdirSync(PREVIEW_DIR, { recursive: true });
    writeFileSync(join(PREVIEW_DIR, `${name}.${jpeg ? "jpg" : "png"}`), image);
  }
  return image;
}

/** Width, height and format, as sharp reads the bytes. */
async function dims(
  image: Buffer,
): Promise<{ width?: number; height?: number; format?: string }> {
  const { width, height, format } = await sharp(image).metadata();
  return { width, height, format };
}

const CARD = { width: 1200, height: 630 };

/** Every `opengraph-image.tsx` under src/app, as a path relative to it. */
function ogFiles(dir = APP): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...ogFiles(full));
    else if (entry === "opengraph-image.tsx") out.push(relative(APP, full));
  }
  return out;
}

const ROUTES: Array<{
  name: string;
  file: string;
  params?: Record<string, string>;
}> = [
  { name: "root", file: "opengraph-image.tsx" },
  { name: "karaoke", file: "karaoke/opengraph-image.tsx" },
  { name: "menu", file: "menu/opengraph-image.tsx" },
  {
    name: "menu-matcha",
    file: "menu/[kategori]/opengraph-image.tsx",
    params: { kategori: "matcha" },
  },
  {
    name: "menu-atistirmaliklar",
    file: "menu/[kategori]/opengraph-image.tsx",
    params: { kategori: "atistirmaliklar" },
  },
  { name: "magaza", file: "magaza/opengraph-image.tsx" },
  {
    name: "magaza-cekirdek",
    file: "magaza/[kategori]/opengraph-image.tsx",
    params: { kategori: "cekirdek" },
  },
  { name: "ziyaret", file: "ziyaret/opengraph-image.tsx" },
  { name: "hikayemiz", file: "hikayemiz/opengraph-image.tsx" },
  { name: "kampanyalar", file: "kampanyalar/opengraph-image.tsx" },
  { name: "rehber", file: "rehber/opengraph-image.tsx" },
  {
    name: "rehber-affogato-nedir",
    file: "rehber/[slug]/opengraph-image.tsx",
    params: { slug: "affogato-nedir" },
  },
  {
    name: "rehber-espresso-cesitleri",
    file: "rehber/[slug]/opengraph-image.tsx",
    params: { slug: "espresso-cesitleri" },
  },
];

/** The cards that carry a photograph, served as JPEG. */
const PHOTO_CARDS = new Set([
  "karaoke/opengraph-image.tsx",
  "menu/opengraph-image.tsx",
  "ziyaret/opengraph-image.tsx",
  "hikayemiz/opengraph-image.tsx",
  "magaza/urun/[slug]/opengraph-image.tsx",
]);

async function load(file: string): Promise<ImageModule> {
  return (await import(/* @vite-ignore */ join(APP, file))) as ImageModule;
}

/** The panel's weekly hours: every day the same unless `over` says. */
function weekly(over: Partial<WeeklyHours> = {}, every?: OpeningHour) {
  const day = every ?? { open: "09:00", close: "02:00", closed: false };
  return Object.fromEntries(
    ["mon", "tue", "wed", "thu", "fri", "sat", "sun"].map((d) => [
      d,
      over[d as keyof WeeklyHours] ?? day,
    ]),
  ) as WeeklyHours;
}

beforeEach(() => {
  store.getShopProductBySlugLive.mockReset();
  store.getProduct.mockReset();
  store.getPublicSettings.mockReset();
  store.getPublicSettings.mockResolvedValue({ weeklyHours: weekly() });
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe("every card route", () => {
  it("is in the list this file draws", () => {
    const drawn = new Set(ROUTES.map((r) => r.file));
    drawn.add("magaza/urun/[slug]/opengraph-image.tsx");
    expect(ogFiles().sort()).toEqual([...drawn].sort());
  });

  it.each(ogFiles())(
    "%s declares a 1200x630 image with Turkish alt text",
    async (file) => {
      const mod = await load(file);
      expect(mod.size).toEqual(CARD);
      // A photograph makes the card a JPEG (ogJpeg); a drawing stays PNG.
      expect(mod.contentType).toBe(
        PHOTO_CARDS.has(file) ? "image/jpeg" : "image/png",
      );
      expect(mod.runtime).toBe("nodejs");
      expect(mod.alt).toMatch(/^L'Affogato /);
      expect(LONG_DASH.test(mod.alt), mod.alt).toBe(false);
    },
  );

  it.each(ogFiles())(
    "%s has a twitter-image twin that serves the same card",
    async (file) => {
      const twinFile = join(dirname(file), "twitter-image.tsx");
      expect(existsSync(join(APP, twinFile)), twinFile).toBe(true);
      const og = await load(file);
      const twin = await load(twinFile);
      expect(twin.default).toBe(og.default);
      expect(twin.alt).toBe(og.alt);
      expect(twin.size).toBe(og.size);
      expect(twin.contentType).toBe(og.contentType);
      expect(twin.runtime).toBe(og.runtime);
      expect(twin.generateStaticParams).toBe(og.generateStaticParams);
      // Segment config is read from each file's own source, not re-exports:
      // the twin must repeat the literal.
      const read = (f: string) => readFileSync(join(APP, f), "utf8");
      for (const key of ["dynamicParams", "revalidate"]) {
        const line = new RegExp(`export const ${key} = [^;]+;`);
        expect(read(twinFile).match(line)?.[0], `${twinFile} ${key}`).toBe(
          read(file).match(line)?.[0],
        );
      }
    },
  );

  it.each(ROUTES)(
    "draws $name at 1200x630 in its declared format",
    async ({ name, file, params }) => {
      const mod = await load(file);
      const image = await render(mod, name, params);
      expect(await dims(image)).toEqual({
        ...CARD,
        format: mod.contentType === "image/jpeg" ? "jpeg" : "png",
      });
      // Light enough for a link preview on a phone.
      expect(image.length).toBeLessThan(300_000);
    },
  );

  it("prerenders exactly the categories and guides the pages know", async () => {
    const { MENU_CATEGORY_ROUTES, SHOP_CATEGORY_ROUTES } =
      await import("@/lib/seo/pages");
    const { GUIDES } = await import("@/lib/seo/guides");
    const menu = await load("menu/[kategori]/opengraph-image.tsx");
    const shop = await load("magaza/[kategori]/opengraph-image.tsx");
    const guide = await load("rehber/[slug]/opengraph-image.tsx");
    expect(menu.generateStaticParams?.()).toEqual(
      MENU_CATEGORY_ROUTES.map((c) => ({ kategori: c.slug })),
    );
    expect(shop.generateStaticParams?.()).toEqual(
      SHOP_CATEGORY_ROUTES.map((c) => ({ kategori: c.slug })),
    );
    expect(guide.generateStaticParams?.()).toEqual(
      GUIDES.map((g) => ({ slug: g.slug })),
    );
  });
});

describe("the page cards' copy", () => {
  it("is Turkish house style: no long dashes, no headline ending in a period", async () => {
    const pages = await import("@/lib/seo/og-pages");
    const { MENU_CATEGORY_ROUTES, SHOP_CATEGORY_ROUTES } =
      await import("@/lib/seo/pages");
    const { GUIDES } = await import("@/lib/seo/guides");
    const cards: ReactElement[] = [
      await pages.karaokeCard(),
      await pages.menuCard(),
      pages.shopCard(),
      await pages.visitCard(),
      await pages.storyCard(),
      pages.campaignsCard(),
      pages.guideHubCard(),
      ...MENU_CATEGORY_ROUTES.map(pages.menuCategoryCard),
      ...SHOP_CATEGORY_ROUTES.map(pages.shopCategoryCard),
      ...GUIDES.map(pages.guideCard),
    ];
    for (const card of cards) {
      const props = card.props as Record<string, unknown>;
      const title = String(props.title);
      expect(title.length, title).toBeGreaterThan(2);
      // Headlines carry no final period; the brand line ("Drink it. Eat the
      // cup.") is written as the brand writes it.
      expect(title.endsWith("."), title).toBe(false);
      expect(String(props.eyebrow).endsWith("."), title).toBe(false);
      for (const key of ["eyebrow", "title", "subtitle", "detail", "footer"]) {
        const text = props[key];
        if (typeof text !== "string") continue;
        expect(LONG_DASH.test(text), `${key}: ${text}`).toBe(false);
      }
      expect(String(props.path)).toMatch(/^\/[a-z0-9/-]+$/);
    }
  });

  it("prints the address, and the hours the page prints: the panel's", async () => {
    const { visitCard, visitHoursLine } = await import("@/lib/seo/og-pages");
    const { LEGAL_ENTITY } = await import("@/lib/legal/entity");
    const props = (await visitCard(weekly())).props as Record<string, string>;
    expect(props.subtitle).toBe("Her gün 09:00 - 02:00");
    expect(props.detail).toBe("Postane Mah. Atatürk Cad. No: 28, Tuzla");

    // An edit in Ayarlar reaches the card.
    const later = { open: "10:00", close: "23:00", closed: false };
    expect(visitHoursLine(weekly({}, later))).toBe("Her gün 10:00 - 23:00");
    // "Her gün" only when it is true: a different Sunday or a closed Monday
    // leaves the line out (the page shows the seven rows).
    expect(
      visitHoursLine(
        weekly({ sun: { open: "10:00", close: "02:00", closed: false } }),
      ),
    ).toBeUndefined();
    expect(
      visitHoursLine(
        weekly({ mon: { open: "09:00", close: "02:00", closed: true } }),
      ),
    ).toBeUndefined();
    // No panel hours (the build): the köşk's constant.
    expect(visitHoursLine(null)).toBe(
      `Her gün ${LEGAL_ENTITY.cafeHours.opens} - ${LEGAL_ENTITY.cafeHours.closes}`,
    );
  });

  it("reads /ziyaret's hours from the panel at request time, never at build", async () => {
    const route = await load("ziyaret/opengraph-image.tsx");
    const source = readFileSync(
      join(APP, "ziyaret/opengraph-image.tsx"),
      "utf8",
    );
    expect(source).toContain("export const revalidate = 3600;");

    store.getPublicSettings.mockResolvedValue({
      weeklyHours: weekly({
        sun: { open: "10:00", close: "20:00", closed: false },
      }),
    });
    const image = await render(route, "ziyaret-varying-hours");
    expect(await dims(image)).toEqual({ ...CARD, format: "jpeg" });
    expect(store.getPublicSettings).toHaveBeenCalledTimes(1);

    // `next build` has no database: the card is drawn without asking.
    vi.stubEnv("NEXT_PHASE", "phase-production-build");
    store.getPublicSettings.mockClear();
    await render(route, "ziyaret-build");
    expect(store.getPublicSettings).not.toHaveBeenCalled();
    vi.unstubAllEnvs();

    // A settings read that throws still draws the card, on the constant.
    store.getPublicSettings.mockRejectedValue(new Error("boom"));
    expect(await dims(await render(route, "ziyaret-error"))).toEqual({
      ...CARD,
      format: "jpeg",
    });
  });

  it("reads public/ only by literal paths, never a path built at run time", async () => {
    // A path joined from a variable makes the bundler copy all of public/
    // (7.7 MB) into the function, and og-card.tsx loads with every page
    // through the root card.
    const sources = [
      "src/lib/seo/og-card.tsx",
      "src/lib/seo/og-drawings.tsx",
      "src/lib/seo/og-pages.tsx",
      "src/lib/seo/og-product.tsx",
      ...ogFiles().map((f) => join("src/app", f)),
    ].map((f) => [f, readFileSync(f, "utf8")] as const);
    for (const [f, src] of sources) {
      const cwd = src.match(/process\.cwd\(\)/g) ?? [];
      const literal =
        src.match(/join\(\s*process\.cwd\(\),\s*"[^"]+",?\s*\)/g) ?? [];
      expect(literal.length, f).toBe(cwd.length);
      expect(src, f).not.toContain("PUBLIC_DIR");
    }
    const card = readFileSync("src/lib/seo/og-card.tsx", "utf8");
    expect(card).not.toMatch(/"public/);
    // The karaoke card's file is the registry's drawing.
    const { ILLUSTRATIONS } =
      await import("@/components/laffogato/illustration");
    expect(readFileSync("src/lib/seo/og-pages.tsx", "utf8")).toContain(
      `"public${ILLUSTRATIONS["karaoke-room"].src}"`,
    );
  });

  it("keeps the source files free of long dashes", () => {
    const files = [
      "src/lib/seo/og-card.tsx",
      "src/lib/seo/og-drawings.tsx",
      "src/lib/seo/og-pages.tsx",
      "src/lib/seo/og-product.tsx",
      ...ogFiles().flatMap((f) => [
        join("src/app", f),
        join("src/app", dirname(f), "twitter-image.tsx"),
      ]),
    ];
    for (const f of files) {
      expect(LONG_DASH.test(readFileSync(f, "utf8")), f).toBe(false);
    }
  });
});

describe("a page with its own card", () => {
  /**
   * Next fills og:image from the segment's opengraph-image file only when
   * the page's own `openGraph` has no `images` key (resolve-metadata
   * mergeStaticMetadata). `openGraphDefaults()` carries one, so a page that
   * spreads it shows the generic card instead of its own.
   */
  it.each(ogFiles().filter((f) => f !== "opengraph-image.tsx"))(
    "%s: the page beside it does not name an image",
    (file) => {
      const page = join(APP, dirname(file), "page.tsx");
      const source = readFileSync(page, "utf8");
      expect(source).not.toContain("openGraphDefaults(");
      expect(source).not.toMatch(/\bimages\s*:/);
      if (source.includes("pageMetadata(")) {
        const section = readFileSync("src/lib/seo/section-page.tsx", "utf8");
        const fn = section.slice(
          section.indexOf("export function pageMetadata"),
          section.indexOf("export async function renderSectionPage"),
        );
        expect(fn).toContain("openGraphBase()");
        expect(fn).not.toMatch(/\bimages\s*:/);
      }
    },
  );

  it("still spreads siteName and locale, the base without the image", async () => {
    const { openGraphBase, openGraphDefaults, SITE } =
      await import("@/lib/seo/site");
    expect(openGraphBase()).toEqual({
      siteName: SITE.name,
      locale: SITE.locale,
    });
    expect("images" in openGraphBase()).toBe(false);
    expect(openGraphDefaults()).toMatchObject(openGraphBase());
  });
});

describe("the product card", () => {
  const route = () => load("magaza/urun/[slug]/opengraph-image.tsx");

  /** An upload as the panel stores it: a WebP data URL (a real photo). */
  async function webp(): Promise<string> {
    const bytes = await sharp("public/photos/affogato-tray.webp")
      .resize(900, 1200, { fit: "inside" })
      .webp({ quality: 80 })
      .toBuffer();
    return `data:image/webp;base64,${bytes.toString("base64")}`;
  }

  const sirena = {
    id: "prd-0001",
    slug: "sirena",
    name: "Sirena - Espresso Harmanı",
    tag: "Çekirdek · 250 g",
    price: "450₺",
    priceMinor: 45000,
    desc: "Kakao, kuru incir, esmer şeker.",
    cat: "beans",
    img: "caramel",
    images: ["/gorsel/urun/prd-0001/0?v=abc"],
    stock: 12,
    variants: [],
  };

  it("has an alt that claims nothing a card may lack", async () => {
    // Next takes one `alt` per route file, not per product: it cannot name
    // the product, so it must not promise a photo or a price either.
    const { alt } = await route();
    expect(alt).not.toMatch(/fotoğraf|fiyat/i);
  });

  it("is drawn on request and kept an hour: prices move and the card follows", async () => {
    const source = readFileSync(
      join(APP, "magaza/urun/[slug]/opengraph-image.tsx"),
      "utf8",
    );
    expect(source).toContain("export const revalidate = 3600;");
    // Nothing at build (no database there); the empty list is what makes
    // the route incremental instead of redrawn on every request.
    expect((await route()).generateStaticParams?.()).toEqual([]);
  });

  it("draws the uploaded photo, the name, the shelf and the price", async () => {
    store.getShopProductBySlugLive.mockResolvedValue(sirena);
    store.getProduct.mockResolvedValue({ images: [await webp()] });
    const { productCard } = await import("@/lib/seo/og-product");
    const card = await productCard("sirena");
    const props = card?.props as Record<string, unknown>;
    expect(props.eyebrow).toBe("Mağaza · Çekirdek Kahve");
    expect(props.title).toBe("Sirena - Espresso Harmanı");
    expect(props.detail).toBe("Çekirdek · 250 g");
    expect(props.path).toBe("/magaza/urun/sirena");
    expect(props.artWidth).toBe(446);
    expect(store.getProduct).toHaveBeenCalledWith("prd-0001");

    const image = await render(await route(), "urun-photo", { slug: "sirena" });
    expect(await dims(image)).toEqual({ ...CARD, format: "jpeg" });
  });

  it("draws the coffee bag when the photo is an https link, without fetching it", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    store.getShopProductBySlugLive.mockResolvedValue({
      ...sirena,
      name: "Bialetti × L’Affogato Moka Pot, 3 fincanlık ☕",
      tag: "3 fincanlık, fırçalanmış alüminyum",
      priceMinor: 189000,
      compareAtPriceMinor: 219000,
      cat: "equipment",
    });
    store.getProduct.mockResolvedValue({
      images: ["https://example.com/moka.webp"],
    });
    const { productCard } = await import("@/lib/seo/og-product");
    const props = (await productCard("moka"))?.props as Record<string, unknown>;
    expect(props.artWidth).toBe(420);
    // The emoji would make next/og fetch Twemoji; it is dropped.
    expect(props.title).toBe("Bialetti × L’Affogato Moka Pot, 3 fincanlık");
    const image = await render(await route(), "urun-no-photo", {
      slug: "moka",
    });
    expect(await dims(image)).toEqual({ ...CARD, format: "jpeg" });
    expect(
      fetchSpy.mock.calls.some(([url]) => String(url).includes("example.com")),
    ).toBe(false);
    fetchSpy.mockRestore();
  });

  it("keeps a very long name inside its column", async () => {
    store.getShopProductBySlugLive.mockResolvedValue({
      ...sirena,
      name: "Notturna Kenya AA Nyeri Filtre Kahve Çekirdeği Hediye Kutusunda İki Paket ve Seramik Fincan",
      tag: "Süperuzunkelimelerlebirliktegelenbiretiketsatırı · 2 x 250 g",
      priceMinor: 1249900,
      compareAtPriceMinor: 1399900,
    });
    store.getProduct.mockResolvedValue({ images: [await webp()] });
    const { productCard } = await import("@/lib/seo/og-product");
    const props = (await productCard("uzun"))?.props as Record<string, unknown>;
    expect(String(props.title).length).toBeLessThanOrEqual(64);
    expect(String(props.title).endsWith("…")).toBe(true);
    const image = await render(await route(), "urun-long-name", {
      slug: "uzun",
    });
    expect(await dims(image)).toEqual({ ...CARD, format: "jpeg" });
  });

  it("is a 404 when there is no such active product, as the page is", async () => {
    store.getShopProductBySlugLive.mockResolvedValue(null);
    const { productCard } = await import("@/lib/seo/og-product");
    expect(await productCard("yok")).toBeNull();
    expect(store.getProduct).not.toHaveBeenCalled();
    const res = (await (
      await route()
    ).default({ params: Promise.resolve({ slug: "yok" }) })) as Response;
    expect(res.status).toBe(404);
    expect((await res.arrayBuffer()).byteLength).toBe(0);
  });

  it("returns its 404 rather than throwing notFound(), so it is not kept for good", () => {
    // Next stores a route's thrown 404 in the incremental cache without the
    // segment's `revalidate` (s-maxage=31536000): a product activated after
    // its link was fetched kept a 404 preview until the next deploy. A
    // returned 404 is cached like the card, an hour.
    const source = readFileSync(
      join(APP, "magaza/urun/[slug]/opengraph-image.tsx"),
      "utf8",
    );
    // notFound() comes from next/navigation; the route does not load it.
    expect(source).not.toContain("next/navigation");
    expect(source).toContain("new Response(null, { status: 404 })");
  });

  it("fails, not stands in, when the database cannot answer", async () => {
    // A stand-in card would be kept an hour; an error keeps the last good
    // card on revalidation. The read is the one without the page's outage
    // fallback, so an outage cannot read as "no product" either.
    const outage = new Error("ECONNREFUSED");
    store.getShopProductBySlugLive.mockRejectedValue(outage);
    await expect(
      render(await route(), "urun-db-down", { slug: "sirena" }),
    ).rejects.toBe(outage);

    store.getShopProductBySlugLive.mockResolvedValue(sirena);
    store.getProduct.mockRejectedValue(outage);
    await expect(
      render(await route(), "urun-photo-db-down", { slug: "sirena" }),
    ).rejects.toBe(outage);
  });

  it("draws the coffee bag when the stored photo is not an upload sharp can read", async () => {
    store.getShopProductBySlugLive.mockResolvedValue(sirena);
    const { productCard } = await import("@/lib/seo/og-product");
    for (const stored of [
      `data:image/webp;base64,${Buffer.from("not a photo").toString("base64")}`,
      // Not something the panel stores; never read from disk either.
      "/photos/affogato-cup.webp",
    ]) {
      store.getProduct.mockResolvedValue({ images: [stored] });
      const props = (await productCard("sirena"))?.props as Record<
        string,
        unknown
      >;
      expect(props.title, stored).toBe("Sirena - Espresso Harmanı");
      expect(props.artWidth, stored).toBe(420);
    }
  });

  it("fetches nothing for a name with a flag, a keycap, a check mark or CJK", async () => {
    const realFetch = globalThis.fetch;
    const remote: string[] = [];
    vi.spyOn(globalThis, "fetch").mockImplementation(async (url, init) => {
      const u = String(url instanceof Request ? url.url : url);
      if (u.startsWith("data:")) return realFetch(url, init);
      remote.push(u);
      throw new Error("offline");
    });
    store.getProduct.mockResolvedValue({ images: [] });
    for (const [name, tag] of [
      ["Kolombiya 🇨🇴 Supremo", "Çekirdek · 250 g"],
      ["Matcha 抹茶 Latte", "✓ Seremonyal"],
      ["Kupa 1️⃣ numara", "Ελληνικά ☕"],
    ]) {
      store.getShopProductBySlugLive.mockResolvedValue({
        ...sirena,
        name,
        tag,
      });
      const image = await render(await route(), "urun-odd-chars", {
        slug: "x",
      });
      expect(await dims(image), name).toEqual({ ...CARD, format: "jpeg" });
    }
    expect(remote).toEqual([]);
  });
});

/** Every code point Geist maps to a glyph (its cmap, formats 4 and 12). */
function geistCodePoints(font: Buffer): Set<number> {
  let cmap = 0;
  for (let i = 0; i < font.readUInt16BE(4); i++) {
    const at = 12 + i * 16;
    if (font.toString("latin1", at, at + 4) === "cmap") {
      cmap = font.readUInt32BE(at + 8);
    }
  }
  const out = new Set<number>();
  for (let i = 0; i < font.readUInt16BE(cmap + 2); i++) {
    const t = cmap + font.readUInt32BE(cmap + 4 + i * 8 + 4);
    const format = font.readUInt16BE(t);
    if (format === 4) {
      const segs = font.readUInt16BE(t + 6) / 2;
      const ends = t + 14;
      const starts = ends + segs * 2 + 2;
      const deltas = starts + segs * 2;
      const offsets = deltas + segs * 2;
      for (let g = 0; g < segs; g++) {
        const start = font.readUInt16BE(starts + g * 2);
        const end = font.readUInt16BE(ends + g * 2);
        const delta = font.readInt16BE(deltas + g * 2);
        const offset = font.readUInt16BE(offsets + g * 2);
        for (let c = start; c <= end && c !== 0xffff; c++) {
          let glyph = (c + delta) & 0xffff;
          if (offset) {
            glyph = font.readUInt16BE(
              offsets + g * 2 + offset + (c - start) * 2,
            );
            if (glyph) glyph = (glyph + delta) & 0xffff;
          }
          if (glyph) out.add(c);
        }
      }
    } else if (format === 12) {
      for (let g = 0; g < font.readUInt32BE(t + 12); g++) {
        const r = t + 16 + g * 12;
        const first = font.readUInt32BE(r + 8);
        for (let c = font.readUInt32BE(r); c <= font.readUInt32BE(r + 4); c++) {
          if (first + (c - font.readUInt32BE(r))) out.add(c);
        }
      }
    }
  }
  return out;
}

describe("the cards' typeface", () => {
  it("draws every character ogText lets through, with no fetch", async () => {
    const { ogText } = await import("@/lib/seo/og-card");
    const geist = geistCodePoints(
      readFileSync(
        "node_modules/next/dist/compiled/@vercel/og/Geist-Regular.ttf",
      ),
    );
    expect(geist.has("ş".codePointAt(0)!)).toBe(true);
    const missing: string[] = [];
    for (let cp = 0; cp <= 0x2ffff; cp++) {
      if (cp >= 0xd800 && cp <= 0xdfff) continue;
      for (const ch of ogText(`a${String.fromCodePoint(cp)}a`)) {
        if (!geist.has(ch.codePointAt(0)!)) {
          missing.push(cp.toString(16));
          break;
        }
      }
    }
    expect(missing).toEqual([]);
    // Turkish and the punctuation a product name carries survive.
    for (const ch of "çÇğĞıİöÖşŞüÜâÂîÎûÛéàß€’‘“”…•·×&%@#") {
      expect(ogText(ch), ch).toBe(ch);
    }
  });

  it("is not drawn a second time when next/og fails to render it", async () => {
    // An emoji set straight into a card (not through ogText) sends next/og
    // to Twemoji; offline, the render throws. ogJpeg used to catch that and
    // hand back a fresh, lazy render of the same card, which failed again
    // halfway through the response.
    const realFetch = globalThis.fetch;
    let remote = 0;
    vi.spyOn(globalThis, "fetch").mockImplementation(async (url, init) => {
      const u = String(url instanceof Request ? url.url : url);
      if (u.startsWith("data:")) return realFetch(url, init);
      remote++;
      throw new Error("offline");
    });
    const { ogJpeg } = await import("@/lib/seo/og-card");
    const card = createElement(
      "div",
      { style: { display: "flex", width: "100%", height: "100%" } },
      "Kahve ☕",
    );
    await expect(ogJpeg(card)).rejects.toThrow();
    expect(remote).toBeGreaterThan(0);
  });

  /**
   * next/og measures a word glyph by glyph but draws it kerned: a word with
   * a kerned pair ("mikrofon", "Atatürk") was followed by a wider space.
   */
  it("is next/og's own Geist with its kerning table hidden", async () => {
    const { withoutKerning } = await import("@/lib/seo/og-card");
    const font = readFileSync(
      "node_modules/next/dist/compiled/@vercel/og/Geist-Regular.ttf",
    );
    const tags = (bytes: Buffer) =>
      Array.from({ length: bytes.readUInt16BE(4) }, (_, i) =>
        bytes.toString("latin1", 12 + i * 16, 16 + i * 16),
      );
    expect(tags(font)).toContain("GPOS");
    const patched = withoutKerning(font);
    expect(patched.length).toBe(font.length);
    expect(tags(patched)).not.toContain("GPOS");
    expect(tags(patched)).toContain("XPOS");
    expect(tags(patched)).toContain("glyf");
    // The file on disk is never touched.
    expect(tags(font)).toContain("GPOS");
  });
});

describe("the product card's price", () => {
  it("is the price the product page opens on, KDV included, in whole lira", async () => {
    const { ogProductPrice, ogProductSoldOut } =
      await import("@/lib/seo/og-product");
    expect(ogProductPrice({ priceMinor: 45000 })).toEqual({ now: "450 TL" });
    expect(ogProductPrice({ priceMinor: 125050 })).toEqual({ now: "1.251 TL" });
    // The page preselects the first variant in stock and adds its delta.
    const variants = [
      { id: "a", name: "250 g", priceDelta: 50, stock: 0, isActive: true },
      { id: "b", name: "500 g", priceDelta: 400, stock: 3, isActive: true },
    ];
    expect(ogProductPrice({ priceMinor: 45000, variants })).toEqual({
      now: "850 TL",
    });
    expect(ogProductSoldOut({ priceMinor: 45000, variants })).toBe(false);
    expect(
      ogProductSoldOut({
        priceMinor: 45000,
        variants: [{ ...variants[0] }],
      }),
    ).toBe(true);
    expect(ogProductSoldOut({ priceMinor: 45000, stock: 0 })).toBe(true);
    expect(
      ogProductPrice({ priceMinor: 45000, compareAtPriceMinor: 60000 }),
    ).toEqual({ now: "450 TL", was: "600 TL" });
    expect(ogProductPrice({ priceMinor: 0 })).toBeNull();
    expect(ogProductPrice({})).toBeNull();
  });

  it("never prints the lira sign next/og cannot draw", async () => {
    const { ogText } = await import("@/lib/seo/og-card");
    expect(ogText("Kupa 250₺ yerine 199₺")).toBe("Kupa 250 TL yerine 199 TL");
    expect(ogText("Matcha 🍵 Latte")).toBe("Matcha Latte");
    // Flags and keycaps are not Extended_Pictographic; CJK and ✓ are not
    // in Geist. Each would send next/og to the network mid-render.
    expect(ogText("Kolombiya 🇨🇴 Supremo")).toBe("Kolombiya Supremo");
    expect(ogText("Kupa 1️⃣ numara")).toBe("Kupa 1 numara");
    expect(ogText("Matcha 抹茶 Latte")).toBe("Matcha Latte");
    expect(ogText("✓ Seremonyal")).toBe("Seremonyal");
    // Turkish, the typographic quotes and the ellipsis stay; a decomposed
    // letter is composed first rather than lost.
    expect(ogText("Çağ’ın “İyi” Şöleni… öğütülmüş")).toBe(
      "Çağ’ın “İyi” Şöleni… öğütülmüş",
    );
    expect(ogText("Cafe\u0301")).toBe("Café");
    expect(ogText("a ".repeat(80), 20).length).toBeLessThanOrEqual(20);
    // Cut at a word: a whole last word stays, a split one goes.
    expect(ogText("Hediye Kutusunda İki Paket", 17)).toBe("Hediye Kutusunda…");
    expect(ogText("Hediye Kutusunda İki Paket", 20)).toBe("Hediye Kutusunda…");
  });
});
