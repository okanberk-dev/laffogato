import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

import { createElement } from "react";
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
    for (const name of ["home-valley.tsx", "valley-scene.ts", "valley-shaders.ts"]) {
      expect(existsSync(join("src/components/laffogato", name)), name).toBe(false);
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
    expect(SCENE).not.toMatch(/addEventListener\("(wheel|touchmove|touchstart)"/);
    expect(SCENE).not.toMatch(/preventDefault\(\)[^;]*;[\s\S]{0,40}(wheel|scroll|touch)/);
    expect(SCENE).toMatch(
      /addEventListener\("pointermove", onPointer, \{ passive: true \}\)/,
    );
    expect(SCENE).toContain('window.removeEventListener("pointermove", onPointer)');
    expect(HERO).toMatch(/addEventListener\("scroll", read, \{ passive: true \}\)/);
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
    expect(html).toContain("Bölüm 1: Bologna 1897’den Tuzla’ya");
    expect(html).toMatch(/<a class="btn btn-ghost btn-sm roast-hero-go" href="\/menu"/);
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
      expect(stage).toMatch(/^<div class="roast-stage [^"]*" aria-hidden="true">/);
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

describe("a split title still reads as one", () => {
  it("names a heading by its whole line and hides the glyph boxes", () => {
    const html = renderToStaticMarkup(
      createElement(RevealText, { as: "h2", children: "Şimdi barda" }),
    );
    expect(html).toMatch(/^<h2 class="rv rv-chars" aria-label="Şimdi barda">/);
    expect(html).toContain('<span aria-hidden="true">');
    expect(html.match(/class="rv-mask"/g)).toHaveLength(2);
    expect(html.match(/class="rv-item"/g)).toHaveLength(10);
  });

  it("leaves a paragraph's words in the reading order, unhidden", () => {
    const html = renderToStaticMarkup(
      createElement(RevealText, { as: "p", by: "words", children: "Bir iki üç" }),
    );
    expect(html).not.toContain("aria-hidden");
    expect(html).not.toContain("aria-label");
    expect(html.replace(/<[^>]+>/g, "")).toBe("Bir iki üç");
  });

  it("hides nothing by default: only an armed title is moved", () => {
    // `.rv-item` alone must not carry a transform; the hidden state belongs
    // to `.will-reveal` (set by script, below the fold only).
    expect(rule(".rv-item")).not.toMatch(/transform: translate/);
    expect(rule(".rv.will-reveal .rv-item")).toMatch(/transform: translateY\(145%\)/);
  });
});
