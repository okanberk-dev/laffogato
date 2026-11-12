import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

import { createElement, type ComponentProps } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { HomeRoast } from "@/components/laffogato/home-roast";
import { RevealText } from "@/components/laffogato/reveal-text";
import { RoastPause, RoastStage } from "@/components/laffogato/roast-stage";

/**
 * The home page's first screen and its two bands, drawn live in three.js
 * (operator, 11 Kas 2026: the landing takes the look of
 * coffee-beans-swart.vercel.app; docs/REDESIGN-ROAST.md). It replaced the
 * night valley of 6 Kas 2026 and keeps that hero's promises, each of which
 * is one line a later tidy-up could undo without anything visibly breaking:
 * three.js stays out of the first-load bundle, the type is server-rendered
 * and never waits for WebGL, the canvas only ever fades in over a drawing
 * that works without it, and nothing moves that the visitor cannot stop.
 */

const read = (rel: string) => readFileSync(rel, "utf8");
const CSS = read("src/app/globals.css");
const HERO = read("src/components/laffogato/home-roast.tsx");
const STAGE = read("src/components/laffogato/roast-stage.tsx");
const SCENE = read("src/components/laffogato/roast-scene.ts");
const HOME = read("src/components/laffogato/home-page.tsx");

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.(ts|tsx)$/.test(name) ? [path] : [];
  });
}

/** The rule body for an exact selector, e.g. `rule(".roast-canvas")`. */
function rule(selector: string): string {
  const at = CSS.indexOf(`\n${selector} {`);
  expect(at, `${selector} is missing from globals.css`).toBeGreaterThan(-1);
  return CSS.slice(at, CSS.indexOf("\n}", at));
}

describe("three.js loads late, in a chunk of its own", () => {
  it("is imported by the roast scene and nothing else", () => {
    const importers = sourceFiles("src").filter((path) =>
      /from\s+["']three(?:\/[^"']*)?["']|import\(\s*["']three/.test(read(path)),
    );
    expect(importers).toEqual([
      join("src", "components", "laffogato", "roast-scene.ts"),
    ]);
  });

  it("reaches the scene only through import(), never a static import", () => {
    const statics = sourceFiles("src").filter((path) =>
      /^\s*import\s+(?!type\b)[^;]*?from\s+["'][^"']*roast-scene["']/m.test(
        read(path),
      ),
    );
    expect(statics).toEqual([]);
    expect(STAGE).toMatch(/await import\("\.\/roast-scene"\)/);
    expect(STAGE).toMatch(
      /import type \{ RoastHandle, RoastKind \} from "\.\/roast-scene"/,
    );
  });

  it("waits for the load event and an idle moment before fetching it", () => {
    expect(STAGE).toMatch(/document\.readyState === "complete"/);
    expect(STAGE).toMatch(/addEventListener\("load", schedule/);
    expect(STAGE).toMatch(/requestIdleCallback/);
  });

  it("asks for WebGL 2 without a performance caveat before it downloads", () => {
    expect(STAGE).toMatch(/getContext\("webgl2"/);
    expect(STAGE).toMatch(/failIfMajorPerformanceCaveat: true/);
    expect(STAGE).toMatch(/saveData/);
  });

  it("does not start a band's drawing until the band is near the screen", () => {
    // Only the hero's bean is on the first screen. A visitor who never
    // scrolls to the pour or the affogato never downloads or runs them.
    expect(STAGE).toMatch(/if \(kind === "bean"\) \{\s*afterLoad\(\);/);
    expect(STAGE).toMatch(/rootMargin: "50% 0px"/);
  });

  it("retired the valley: its files and its component are gone", () => {
    for (const name of [
      "home-valley.tsx",
      "valley-scene.ts",
      "valley-shaders.ts",
    ]) {
      expect(existsSync(join("src/components/laffogato", name)), name).toBe(
        false,
      );
    }
    expect(HOME).not.toContain("HomeValley");
    expect(HOME).toContain("<HomeRoast");
    expect(CSS).not.toMatch(/\n\.valley[-\w]* \{/);
  });
});

describe("the scene is a good guest", () => {
  it("caps the pixel ratio and the backing store", () => {
    expect(SCENE).toMatch(/const MAX_PIXEL_RATIO = 1\.5;/);
    expect(SCENE).toMatch(/const MAX_PIXELS = [\d_]+;/);
  });

  it("holds while off screen, in a hidden tab, paused, or asked to be still", () => {
    expect(SCENE).toMatch(/new IntersectionObserver/);
    expect(SCENE).toMatch(/document\.hidden/);
    expect(SCENE).toMatch(
      /const on =[^;]*!still\s*&&\s*visible\s*&&\s*!paused\s*&&\s*!document\.hidden/,
    );
    expect(STAGE).toMatch(
      /const still = window\.matchMedia\("\(prefers-reduced-motion: reduce\)"\)\.matches;/,
    );
  });

  it("gives the visitor one switch that stops every drawing (WCAG 2.2.2)", () => {
    // The drawings move for longer than five seconds, so each place that
    // mounts one mounts the control beside it. Until 11 Kas 2026 this was
    // the valley's "Hareketi durdur" button; the promise is the same.
    for (const [name, source] of [
      ["home-roast.tsx", HERO],
      ["home-page.tsx", HOME],
    ] as const) {
      const stages = source.match(/<RoastStage\b/g)?.length ?? 0;
      const controls = source.match(/<RoastPause\b/g)?.length ?? 0;
      expect(stages, `${name} mounts no drawing`).toBeGreaterThan(0);
      expect(controls, `${name}: a drawing without a pause control`).toBe(
        stages,
      );
    }
    // A real button that says what it does and which state it is in.
    expect(STAGE).toMatch(
      /<button\s+type="button"\s+className=\{cx\("roast-pause", className\)\}\s+aria-pressed=\{paused\}\s+aria-label=\{paused \? "Hareketi başlat" : "Hareketi durdur"\}/,
    );
    // One shared switch: pressing any control holds every running scene,
    // and a scene that starts later starts held.
    expect(STAGE).toMatch(
      /motion\.paused = !motion\.paused;\s+motion\.emit\(\);/,
    );
    expect(STAGE).toMatch(/handle\.current\?\.setPaused\(paused\);/);
    expect(STAGE).toMatch(/handle\.current\.setPaused\(motion\.paused\);/);
    // It sits outside the stage (which takes no pointer) and is a 44px
    // target: a 36px disc with 4px of reach on every side.
    const control = rule(".roast-pause");
    expect(control).toMatch(/pointer-events: auto;/);
    expect(control).toMatch(/width: 36px;/);
    expect(rule(".roast-pause::after")).toMatch(/inset: -4px;/);
  });

  it("gives everything back when it leaves", () => {
    for (const call of [
      "bin.empty()",
      "renderer.dispose()",
      "renderer.forceContextLoss()",
      "seen.disconnect()",
      "resized.disconnect()",
    ]) {
      expect(SCENE, call).toContain(call);
    }
    expect(STAGE).toMatch(/handle\.current\?\.dispose\(\)/);
  });

  it("never takes the scroll or a pointer away from the page", () => {
    // It only listens to where the pointer is (the camera leans toward it),
    // passively; it never handles a wheel or a touch.
    expect(SCENE).not.toMatch(
      /addEventListener\("(wheel|touchmove|touchstart)"/,
    );
    expect(SCENE).not.toMatch(
      /preventDefault\(\)[^;]*;[\s\S]{0,40}(wheel|scroll|touch)/,
    );
    expect(SCENE).toMatch(
      /addEventListener\("pointermove", onPointer, \{ passive: true \}\)/,
    );
    expect(SCENE).toContain(
      'window.removeEventListener("pointermove", onPointer)',
    );
    expect(HERO).toMatch(
      /addEventListener\("scroll", read, \{ passive: true \}\)/,
    );
    expect(rule(".roast-stage")).toMatch(/pointer-events: none;/);
  });

  it("loads no file: the models and the studio are arithmetic", () => {
    expect(SCENE).not.toMatch(/Loader\b|\.glb|\.gltf|\.hdr|fetch\(/);
    expect(SCENE).not.toMatch(/from "three\/(addons|examples)/);
  });

  it("spares a phone the shadow pass, the pointer and the far beans", () => {
    expect(SCENE).toMatch(/const shadows = !lite;/);
    expect(SCENE).toMatch(/const follows = !still && !lite;/);
    expect(SCENE).toMatch(/const FAR = lite \? 0 : 12;/);
  });
});

/**
 * Operator, 12 Kas 2026: "yapay zekaymış gibi gözükmesin". The first cut
 * carried the marks of a generated scene (a glow inside the bean, orbit
 * lines, sparkles, dust in the air, beads left hanging, cups that bobbed).
 * docs/REDESIGN-ROAST.md "A photograph of things" is the rule; these are
 * the lines a later "make it livelier" pass would cross first.
 */
describe("the scenes are photographs of things, not effects", () => {
  it("has no sprite, no point cloud and nothing that adds light", () => {
    const imports = SCENE.slice(0, SCENE.indexOf('} from "three";'));
    expect(imports).not.toMatch(
      /\b(Sprite|SpriteMaterial|Points|PointsMaterial|PointLight)\b/,
    );
    expect(SCENE).not.toMatch(/AdditiveBlending|emissive/);
    expect(SCENE).not.toMatch(/glowTexture|sparkTexture|wispTexture/);
  });

  it("moves only liquid in the two bands: a cup and a pitcher stand still", () => {
    const from = (name: string) => {
      const start = SCENE.indexOf(`function ${name}(`);
      const body = SCENE.slice(start, SCENE.indexOf("\n}\n", start));
      return body.slice(body.indexOf("const update = (time: number) => {"));
    };
    for (const name of ["drawPour", "drawAffogato"]) {
      const update = from(name);
      expect(update.length).toBeGreaterThan(100);
      // Nothing solid is given a place or a turn per frame.
      expect(update).not.toMatch(
        /\b(cup|filter|pitcher|saucer|plate)\.(position|rotation)\b/,
      );
    }
  });

  it("pours espresso as thin streams and tips the pitcher like a hand does", () => {
    // Two streams, one per spout, each pinned to its spout and the crema.
    expect(SCENE).toMatch(/const streams = spouts\.map\(/);
    expect(SCENE).toMatch(/const gauge = \(u: number\) => 0\.034 - /);
    // Past level a glass is empty: the pitcher is tipped under a right angle
    // and its espresso stands level with the lip it leaves by.
    const tilt = Number(/const TILT = ([\d.]+);/.exec(SCENE)?.[1]);
    expect(tilt).toBeGreaterThan(0.6);
    expect(tilt).toBeLessThan(Math.PI / 2);
    expect(SCENE).toMatch(
      /new Plane\(new Vector3\(0, -1, 0\), lip\.y \+ 0\.012\)/,
    );
  });

  it("reads glass by its edge and makes metal of a room with a dark side", () => {
    // No body colour and almost no body: an edge and a highlight.
    expect(SCENE).toMatch(/diffuseColor\.a = clamp\(0\.006 \+ edge \* 0\.7/);
    // In an evenly white room polished metal is simply white.
    expect(SCENE).toMatch(/const wall = lerp\(1, lerp\(0\.46, 1\.12, behind\)/);
  });

  it("draws the hero's bean at the size of the words it stands between", () => {
    // The scene repeats the stylesheet's word size; the two must agree.
    expect(CSS).toContain(
      "--roast-word: min(12.5rem, calc((50vw - var(--hero-pad)) / 3.68));",
    );
    expect(SCENE).toContain(
      "const word = Math.min(200, (width / 2 - pad) / 3.68);",
    );
    // The row starts where the stylesheet starts it.
    expect(CSS).toMatch(/@media \(min-width: 640px\) \{\n  \.roast-hero \{/);
    expect(SCENE).toContain("const tall = width < 640;");
  });

  it("roasts no two far beans alike", () => {
    expect(SCENE).toMatch(/farBeans\.setColorAt\(/);
  });
});

describe("the type is the page's, not the canvas's", () => {
  const html = renderToStaticMarkup(
    createElement(HomeRoast, { onMenu: () => {}, onVisit: () => {} }),
  );

  it("server-renders the words, the kicker, the way to the menu and the hint", () => {
    // Each word is split into glyph boxes for the rise; the whole word is
    // there once for a screen reader.
    for (const word of ["Uyan", "Kahve", "Hazır"]) {
      expect(html).toContain(`<span class="sr-only">${word}</span>`);
    }
    expect(html).toContain("Bologna 1897’den Tuzla’ya");
    // 12 Kas 2026: no chapter numbers ("Bölüm 1:"), here or below.
    expect(html).not.toMatch(/Bölüm \d/);
    expect(html).toMatch(
      /<a class="btn btn-ghost btn-sm roast-hero-go" href="\/menu"/,
    );
    expect(html).toContain("Menüyü keşfet");
    expect(html).toContain("Kaydır ve keşfet");
  });

  it("sends no canvas, no scene state and no pause control in the HTML", () => {
    expect(html).not.toContain("<canvas");
    expect(html).not.toContain("data-gl");
    // The control exists only once a drawing is really running.
    expect(html).not.toContain("Hareketi durdur");
    expect(renderToStaticMarkup(createElement(RoastPause))).toBe("");
  });

  it("puts a still drawing where each live one will be", () => {
    for (const kind of ["bean", "pour", "affogato"] as const) {
      const stage = renderToStaticMarkup(createElement(RoastStage, { kind }));
      expect(stage).toContain(`roast-stage--${kind}`);
      expect(stage).toContain(`roast-still--${kind}`);
      expect(stage).toMatch(
        /^<div class="roast-stage [^"]*" aria-hidden="true">/,
      );
    }
  });

  it("never fades the words in: they are the largest paint", () => {
    // The glyphs rise through a mask (transform only). An opacity fade would
    // keep the page's largest text out of the browser's largest-paint record.
    expect(rule(".rv-load .rv-item")).toMatch(/animation: rv-rise /);
    expect(rule("@keyframes rv-rise")).not.toMatch(/opacity/);
    expect(rule("@keyframes rv-rise-word")).not.toMatch(/opacity/);
    expect(rule(".roast-word")).not.toMatch(/opacity/);
  });

  it("shows the canvas only once its first frame is drawn", () => {
    expect(rule(".roast-canvas")).toMatch(/opacity: 0;/);
    expect(CSS).toMatch(
      /\.roast-stage\[data-gl="ready"\] \.roast-canvas \{\s*opacity: 1;/,
    );
    expect(CSS).toMatch(
      /\.roast-stage\[data-gl="ready"\] \.roast-stage-art \{\s*opacity: 0;/,
    );
  });

  it("is one screen, not three and a half, under reduced motion", () => {
    expect(CSS).toMatch(
      /@media \(prefers-reduced-motion: reduce\) \{\s*\.roast-hero \{\s*height: auto;/,
    );
    expect(HERO).toMatch(
      /if \(window\.matchMedia\("\(prefers-reduced-motion: reduce\)"\)\.matches\) return;/,
    );
  });
});

/** The text goes in as a child, the way a page writes it. */
type RevealProps = ComponentProps<typeof RevealText>;

describe("a split title still reads as one", () => {
  it("names a heading by its whole line and hides the glyph boxes", () => {
    const html = renderToStaticMarkup(
      createElement(RevealText, { as: "h2" } as RevealProps, "Şimdi barda"),
    );
    expect(html).toMatch(/^<h2 class="rv rv-chars" aria-label="Şimdi barda">/);
    expect(html).toContain('<span aria-hidden="true">');
    expect(html.match(/class="rv-mask"/g)).toHaveLength(2);
    expect(html.match(/class="rv-item"/g)).toHaveLength(10);
  });

  it("leaves a paragraph's words in the reading order, unhidden", () => {
    const html = renderToStaticMarkup(
      createElement(
        RevealText,
        { as: "p", by: "words" } as RevealProps,
        "Bir iki üç",
      ),
    );
    expect(html).not.toContain("aria-hidden");
    expect(html).not.toContain("aria-label");
    expect(html.replace(/<[^>]+>/g, "")).toBe("Bir iki üç");
  });

  it("hides nothing by default: only an armed title is moved", () => {
    // `.rv-item` alone must not carry a transform; the hidden state belongs
    // to `.will-reveal` (set by script, below the fold only).
    expect(rule(".rv-item")).not.toMatch(/transform: translate/);
    expect(rule(".rv.will-reveal .rv-item")).toMatch(
      /transform: translateY\(145%\)/,
    );
  });
});
