import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { basename, join } from "node:path";

import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { MENU_CATEGORY_KEYS } from "@/lib/admin/store";
import { MENU, type MenuCategory } from "@/components/laffogato/data";
import { PageMenu } from "@/components/laffogato/menu-page";
import { MENU_PHOTO_NOTE } from "@/components/laffogato/menu-photo-note";

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    prefetch: _prefetch,
    ...rest
  }: {
    href: string;
    children?: ReactNode;
    prefetch?: boolean;
  }) => createElement("a", { href, ...rest }, children),
}));
vi.mock("next/image", () => ({
  default: ({ src, alt }: { src: string; alt: string }) =>
    createElement("img", { src, alt }),
}));

/**
 * The stock menu photos (17 Oct 2026, docs/MENU-PHOTOS.md): the migration
 * that wires them into the live menu, the files it points at, the bundled
 * seed that carries the same paths, and the "Görseller temsilidir." line the
 * menu shows next to them.
 */

const MIGRATION = "db/migrations/20261017120000_menu_photos.sql";
const sql = readFileSync(MIGRATION, "utf8");
/** The SQL without its comments, which quote other statements. */
const code = sql.replace(/--[^\n]*/g, "");

/** The (id, name, image) rows of the migration's values list. */
const rows = [
  ...code.matchAll(
    /\('(mnu-\d{4})', '((?:[^']|'')*)',\s*'(\/menu\/[a-z0-9-]+\.webp)'\)/g,
  ),
].map(([, id, name, image]) => ({
  id,
  name: name.replace(/''/g, "'"),
  image,
}));

/** The seed, with the ids ensureSeed() gives it on an empty table. */
const seed = MENU_CATEGORY_KEYS.flatMap((key) => MENU[key]?.items ?? []).map(
  (item, index) => ({
    id: `mnu-${String(index + 1).padStart(4, "0")}`,
    ...item,
  }),
);

const file = (path: string) => join(process.cwd(), "public", path);

/** Width, height and first chunk of a WebP file; null when it is not one. */
function webpInfo(buf: Buffer) {
  if (
    buf.toString("ascii", 0, 4) !== "RIFF" ||
    buf.toString("ascii", 8, 12) !== "WEBP"
  ) {
    return null;
  }
  const chunk = buf.toString("ascii", 12, 16);
  if (chunk === "VP8 ") {
    // Frame tag, then the start code 9d 01 2a, then 14-bit width and height.
    if (buf[23] !== 0x9d || buf[24] !== 0x01 || buf[25] !== 0x2a) return null;
    return {
      chunk,
      width: buf.readUInt16LE(26) & 0x3fff,
      height: buf.readUInt16LE(28) & 0x3fff,
    };
  }
  if (chunk === "VP8L") {
    if (buf[20] !== 0x2f) return null;
    const bits = buf.readUInt32LE(21);
    return {
      chunk,
      width: (bits & 0x3fff) + 1,
      height: ((bits >>> 14) & 0x3fff) + 1,
    };
  }
  if (chunk === "VP8X") {
    return {
      chunk,
      width: buf.readUIntLE(24, 3) + 1,
      height: buf.readUIntLE(27, 3) + 1,
    };
  }
  return null;
}

describe("the migration", () => {
  it("lists one photo per item, each item and file once", () => {
    expect(rows).toHaveLength(75);
    expect(new Set(rows.map((r) => r.id)).size).toBe(rows.length);
    expect(new Set(rows.map((r) => r.image)).size).toBe(rows.length);
  });

  it("is a single update of menu_items that writes only the photo columns", () => {
    const statements = code
      .split(";")
      .map((s) => s.trim())
      .filter(Boolean);
    expect(statements).toHaveLength(1);
    expect(statements[0]).toMatch(/^update public\.menu_items as m\s+set /);
    expect(code).not.toMatch(/\b(insert|delete|alter|drop|truncate)\b/i);
    const set = /\bset\s+([\s\S]*?)\s+from\s*\(/.exec(statements[0])?.[1];
    expect(set?.replace(/\s+/g, " ")).toBe(
      'image = v.image, "photoCutout" = false',
    );
  });

  it("touches only rows with no photo, under the name the photo was chosen for", () => {
    const where = code.slice(code.lastIndexOf(" where m.id"));
    expect(where).toContain("m.id = v.id");
    expect(where).toContain("m.name = v.name");
    expect(where).toContain("m.image = ''");
  });

  it("runs once: the bundle re-runs every migration, a removed photo must stay removed", () => {
    expect(code).toMatch(
      new RegExp(
        `not exists \\(\\s*select 1\\s+from public\\._migrations as applied\\s+` +
          `where applied\\.name = '${basename(MIGRATION).replace(/\./g, "\\.")}'\\s*\\)`,
      ),
    );
  });

  it("names every row as the live menu and the seed name it", () => {
    for (const row of rows) {
      const item = seed.find((s) => s.id === row.id);
      expect(item?.name, row.id).toBe(row.name);
    }
  });
});

describe("the photo files", () => {
  const referenced = [
    ...new Set([
      ...rows.map((r) => r.image),
      ...seed.flatMap((s) => (s.image ? [s.image] : [])),
    ]),
  ];

  it("exist for every path the migration and the seed name", () => {
    expect(referenced.length).toBeGreaterThanOrEqual(78);
    for (const path of referenced) {
      expect(existsSync(file(path)), path).toBe(true);
    }
  });

  it("are square WebP files", () => {
    for (const path of referenced) {
      const info = webpInfo(readFileSync(file(path)));
      expect(info, path).not.toBeNull();
      expect(info!.width, path).toBe(info!.height);
    }
  });

  it("are all in use: a photo taken off the menu leaves the folder too", () => {
    // The *-cut.webp cutouts are the home hero's (HOME_SLIDES in data.ts).
    const onDisk = readdirSync(file("menu"))
      .filter((name) => name.endsWith(".webp") && !name.endsWith("-cut.webp"))
      .map((name) => `/menu/${name}`);
    expect(onDisk.sort()).toEqual([...referenced].sort());
  });

  it("are 900 px squares of at most 150 KB, with no alpha and no metadata", () => {
    for (const { image } of rows) {
      const size = statSync(file(image)).size;
      expect(size, image).toBeLessThanOrEqual(150 * 1024);
      const info = webpInfo(readFileSync(file(image)));
      // The simple lossy format: a lone VP8 chunk has no room for alpha,
      // EXIF, XMP or an ICC profile.
      expect(info, image).toEqual({ chunk: "VP8 ", width: 900, height: 900 });
    }
  });
});

describe("the bundled seed", () => {
  it("carries the same photo as the migration for every item", () => {
    for (const row of rows) {
      const item = seed.find((s) => s.id === row.id);
      expect(item?.image, row.id).toBe(row.image);
    }
  });

  it("leaves only the items docs/MENU-PHOTOS.md lists without a photo", () => {
    const missing = seed.filter((s) => !s.image).map((s) => s.name);
    expect(missing).toEqual(["Salep", "Çarkıfelek", "Ananas", "Şurup"]);
    const docs = readFileSync("docs/MENU-PHOTOS.md", "utf8");
    const section = docs.slice(
      docs.indexOf("## Fotoğrafsız kalanlar"),
      docs.indexOf("## Notlar"),
    );
    for (const name of missing) expect(section).toContain(name);
    for (const row of rows) {
      expect(docs, row.id).toContain(`| ${row.id} | `);
      expect(docs, row.image).toContain(basename(row.image));
    }
  });
});

describe('"Görseller temsilidir." on the menu', () => {
  const props = {
    navigate: () => {},
    addToCart: () => {},
    openProduct: () => {},
  };
  const category = (items: MenuCategory["items"]): MenuCategory => ({
    title: "Espresso",
    sub: "",
    italian: "",
    note: "",
    items,
  });
  const render = (menu: Record<string, MenuCategory>) =>
    renderToStaticMarkup(createElement(PageMenu, { ...props, menu }));

  it("is shown under the grid when a photo is on screen", () => {
    const html = render({
      espresso: category([
        {
          name: "Espresso",
          desc: "Tek shot.",
          price: "110₺",
          hue: "espresso",
          image: "/menu/espresso.webp",
        },
        { name: "Su", desc: "0,5 lt.", price: "60₺", hue: "stone" },
      ]),
    });
    expect(MENU_PHOTO_NOTE).toBe("Görseller temsilidir.");
    expect(html).toContain(`<p class="menu-photo-note">${MENU_PHOTO_NOTE}</p>`);
    expect(html.indexOf("menu-photo-note")).toBeGreaterThan(
      html.indexOf('class="menu-grid"'),
    );
  });

  it("is not shown when every plate is drawn", () => {
    const html = render({
      espresso: category([
        { name: "Su", desc: "0,5 lt.", price: "60₺", hue: "stone" },
      ]),
    });
    expect(html).toContain('class="menu-grid"');
    expect(html).not.toContain(MENU_PHOTO_NOTE);
  });

  it("is shown on the full bundled menu, and under the home page rail", () => {
    expect(renderToStaticMarkup(createElement(PageMenu, props))).toContain(
      MENU_PHOTO_NOTE,
    );
    const home = readFileSync("src/components/laffogato/home-page.tsx", "utf8");
    expect(home).toMatch(
      /<\/div>\s*<MenuPhotoNote show=\{railItems\.some\(\(it\) => it\.image\)\} \/>/,
    );
  });
});
