import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import {
  ILLUSTRATIONS,
  Illustration,
} from "@/components/laffogato/illustration";
import { CampaignsPage } from "@/components/laffogato/campaigns-page";
import { PageHero } from "@/components/laffogato/page-hero";
import { EmptyState } from "@/components/uye/account-shell";

// account-shell's sign-out form posts to a server action; the empty state
// does not need the action module (and its database) to render.
vi.mock("@/app/uye/actions", () => ({ logoutAction: vi.fn() }));

/**
 * The drawings in public/illustrations (operator, 17 Eki 2026: "websitesine
 * de birkaç görsel çizip görsel gereken yerlere ekle"). Each one follows the
 * karaoke room drawing's rules, and each rule is a line a later edit in a
 * vector app could quietly break: the export bloats past 15 KB, a seventh
 * colour or a gradient creeps in, the root loses `aria-hidden`, a text
 * element brings a font (and with it a name or a claim) into the picture.
 */

const DIR = "public/illustrations";
const read = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

/** The brand's six (forest, burgundy, cream, pink, pistachio, espresso). */
const PALETTE = [
  "#1E4031",
  "#6B1A2B",
  "#FFF2E4",
  "#F59BBE",
  "#9FCB82",
  "#2E1A12",
];

const svgs = readdirSync(DIR)
  .filter((f) => f.endsWith(".svg"))
  .map((f) => ({ file: f, src: read(join(DIR, f)) }));

describe("every drawing in public/illustrations", () => {
  it("is there - the set the pages use", () => {
    expect(svgs.length).toBeGreaterThanOrEqual(25);
  });

  it.each(svgs.map((s) => [s.file, s.src] as const))(
    "%s: small, hidden from assistive tech, the brand's six colours, a 2 px espresso line",
    (file, src) => {
      expect(
        Buffer.byteLength(src),
        `${file} is over 15 KB`,
      ).toBeLessThanOrEqual(15 * 1024);
      const root = src.match(/<svg\b[^>]*>/)?.[0] ?? "";
      expect(root).toContain('aria-hidden="true"');
      expect(root).toContain('focusable="false"');
      expect(root).toMatch(/viewBox="0 0 \d+ \d+"/);

      const colours = new Set(
        [...src.matchAll(/#[0-9a-fA-F]{6}\b/g)].map((m) => m[0].toUpperCase()),
      );
      expect(colours.size).toBeLessThanOrEqual(6);
      for (const c of colours) expect(PALETTE, `${file}: ${c}`).toContain(c);
      // Flat fills only: no gradient, no filter, no other colour notation.
      expect(src).not.toMatch(/Gradient|<filter|rgba?\(|hsla?\(|opacity=/);

      // The outline: espresso, 2 px.
      expect(src).toContain('stroke="#2E1A12" stroke-width="2"');

      // Nothing that loads, runs or writes: no script, no external or raster
      // image, no text (so no font, no name, no claim about a cup).
      expect(src).not.toMatch(/<script|<image|<text|<foreignObject/);
      expect(src).not.toMatch(/(?:href|src)="(?!#)|url\(/);
    },
  );

  it("is registered once, at its own size", () => {
    const files = new Set(svgs.map((s) => `/illustrations/${s.file}`));
    const registered = Object.values(ILLUSTRATIONS).map((a) => a.src);
    expect(new Set(registered).size).toBe(registered.length);
    for (const src of files) expect(registered).toContain(src);
    for (const art of Object.values(ILLUSTRATIONS)) {
      expect(existsSync(join("public", art.src)), art.src).toBe(true);
      if (!art.src.endsWith(".svg")) continue;
      const root = read(join("public", art.src)).match(/<svg\b[^>]*>/)![0];
      // The spot plates draw on the app's 0-100 grid and show at 96.
      expect(root, art.src).toContain(`width="${art.width}"`);
      expect(root, art.src).toContain(`height="${art.height}"`);
    }
  });

  it("keeps the room drawing a light square raster", () => {
    const file = join(DIR, "karaoke-room.webp");
    expect(statSync(file).size).toBeLessThan(40 * 1024);
    expect(ILLUSTRATIONS["karaoke-room"]).toMatchObject({
      width: 1200,
      height: 1200,
    });
  });
});

describe("how the pages show them", () => {
  it("renders each one as decoration: empty alt, aria-hidden", () => {
    for (const name of Object.keys(ILLUSTRATIONS) as Array<
      keyof typeof ILLUSTRATIONS
    >) {
      const html = renderToStaticMarkup(createElement(Illustration, { name }));
      expect(html, name).toMatch(/^<img alt="" aria-hidden="true"/);
      expect(html, name).toContain('class="illo"');
    }
  });

  it("goes through <Illustration> wherever a page draws one", () => {
    // A bare <img src="/illustrations/…"> could forget the empty alt; only
    // the registry names the files (and the hero slide its cut-out photo,
    // which has alt text because it is the slide's picture).
    const offenders: string[] = [];
    const walk = (dir: string) => {
      for (const e of readdirSync(dir, { withFileTypes: true })) {
        const p = join(dir, e.name);
        if (e.isDirectory()) walk(p);
        else if (
          /\.(ts|tsx)$/.test(e.name) &&
          /\/illustrations\//.test(read(p))
        )
          offenders.push(p);
      }
    };
    walk("src");
    expect(offenders.sort()).toEqual([
      "src/components/laffogato/data.ts",
      "src/components/laffogato/illustration.tsx",
    ]);
  });

  it("gives PageHero a drawing slot only when asked, out of the tree", () => {
    const plain = renderToStaticMarkup(
      createElement(PageHero, { eyebrow: "E", title: "T", lede: "L" }),
    );
    expect(plain).not.toContain("has-art");
    expect(plain).not.toContain("page-hero-art");
    const withArt = renderToStaticMarkup(
      createElement(PageHero, {
        eyebrow: "E",
        title: "T",
        lede: "L",
        art: createElement(Illustration, { name: "kampanya-lights" }),
      }),
    );
    expect(withArt).toContain('class="page-hero-frame has-art"');
    expect(withArt).toMatch(
      /<div class="page-hero-art" aria-hidden="true"><img alt="" aria-hidden="true"[^>]*src="\/illustrations\/kampanya-lights\.svg"/,
    );
  });

  it("draws a campaign without a photo by its kind, and an empty page", () => {
    const post = (id: string, kind: "campaign" | "collab" | "event") => ({
      id,
      kind,
      title: `Başlık ${id}`,
      body: "Metin",
      image: "",
      linkUrl: "",
      linkLabel: "",
    });
    const html = renderToStaticMarkup(
      createElement(CampaignsPage, {
        posts: [post("a", "campaign"), post("b", "collab"), post("c", "event")],
        cards: { loyalty: false, invite: false, subscription: false },
        stampTarget: 6,
        rewardTitle: "İçecek",
      }),
    );
    for (const name of ["campaign", "collab", "event"]) {
      expect(html).toContain(`src="/illustrations/kampanya-${name}.svg"`);
    }
    expect(html).toContain("/illustrations/kampanya-lights.svg");
    expect(html).not.toContain("brand-mark");

    const empty = renderToStaticMarkup(
      createElement(CampaignsPage, {
        posts: [],
        cards: { loyalty: false, invite: false, subscription: false },
        stampTarget: 6,
        rewardTitle: "İçecek",
      }),
    );
    expect(empty).toContain('src="/illustrations/kampanya-empty.svg"');
    expect(empty).toContain("Şu an yayında bir kampanya yok.");
  });

  it("leads an empty account list with its own drawing, or the old mark", () => {
    const art = renderToStaticMarkup(
      createElement(EmptyState, {
        title: "Henüz siparişin yok",
        art: "spot-siparis",
      }),
    );
    expect(art).toMatch(
      /<img alt="" aria-hidden="true"[^>]*src="\/illustrations\/spot-siparis\.svg"/,
    );
    expect(art).not.toContain("✻");
    const plain = renderToStaticMarkup(
      createElement(EmptyState, { title: "Boş" }),
    );
    expect(plain).toContain("✻");
    // The room is a picture with L'Af on the mic's sleeve: a soft square
    // frame, never a circle (the mark is never set inside a circle).
    const room = renderToStaticMarkup(
      createElement(EmptyState, { title: "Boş", art: "karaoke-room" }),
    );
    expect(room).toContain('class="illo account-empty-art is-picture"');
    const css = read("src/app/globals.css");
    const rule = css.slice(css.indexOf("\n.account-empty-art.is-picture {"));
    expect(rule.slice(0, rule.indexOf("}"))).not.toContain("50%");
  });

  it("puts each drawing where the plan put it", () => {
    const where: Array<[string, string[]]> = [
      ["src/components/laffogato/home-page.tsx", ["kosk-ticket"]],
      [
        "src/components/laffogato/story-page.tsx",
        [
          "story-1897",
          "story-1994",
          "story-2008",
          "story-2026",
          "story-kupa",
          "ilke-kapi",
          "ilke-fincan",
          "ilke-hoparlor",
          "ilke-teneke",
          "ilke-saat",
          "ilke-laptop",
        ],
      ],
      ["src/components/laffogato/shop-page.tsx", ["magaza-teneke"]],
      ["src/components/laffogato/karaoke-booking.tsx", ["karaoke-room"]],
      ["src/app/rezervasyon/page.tsx", ["karaoke-room"]],
      ["src/app/bulten/onay/page.tsx", ["bulten-zarf"]],
      ["src/app/bulten/cikis/page.tsx", ["bulten-zarf"]],
      [
        "src/app/rehber/page.tsx",
        [
          "rehber-affogato",
          "rehber-matcha",
          "rehber-espresso",
          "rehber-cheesecake",
          "rehber-kupa",
        ],
      ],
      ["src/app/uye/hesap/adreslerim/page.tsx", ["spot-adres"]],
      ["src/app/uye/hesap/favorilerim/page.tsx", ["spot-favori"]],
      ["src/app/uye/hesap/siparislerim/page.tsx", ["spot-siparis"]],
      ["src/app/uye/hesap/karaoke/page.tsx", ["karaoke-room"]],
      ["src/app/uye/hesap/promosyonlar/page.tsx", ["spot-kupon"]],
    ];
    for (const [file, names] of where) {
      const src = read(file);
      for (const name of names)
        expect(src, `${name} in ${file}`).toContain(`"${name}"`);
    }
    // The menu page and its search belong to another change this round.
    expect(read("src/components/laffogato/menu-page.tsx")).not.toContain(
      "Illustration",
    );
  });
});
