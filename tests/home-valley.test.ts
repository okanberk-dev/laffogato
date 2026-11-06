import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { HomeValley } from "@/components/laffogato/home-valley";

/**
 * The home page's first screen, the night valley of coffee (owner's brief,
 * 6 Kas 2026). Its promises are each one line a later tidy-up could undo
 * without anything visibly breaking: three.js stays out of the first-load
 * bundle, the type is server-rendered and never waits for WebGL, and the
 * canvas only ever fades in over a ground that works without it.
 */

const read = (rel: string) => readFileSync(rel, "utf8");
const CSS = read("src/app/globals.css");
const VALLEY = read("src/components/laffogato/home-valley.tsx");
const SCENE = read("src/components/laffogato/valley-scene.ts");

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.(ts|tsx)$/.test(name) ? [path] : [];
  });
}

/** The rule body for an exact selector, e.g. `rule(".valley-name")`. */
function rule(selector: string): string {
  const at = CSS.indexOf(`\n${selector} {`);
  expect(at, `${selector} is missing from globals.css`).toBeGreaterThan(-1);
  return CSS.slice(at, CSS.indexOf("\n}", at));
}

describe("three.js loads late, in a chunk of its own", () => {
  it("is imported by the valley scene and nothing else", () => {
    const importers = sourceFiles("src").filter((path) =>
      /from\s+["']three(?:\/[^"']*)?["']|import\(\s*["']three/.test(read(path)),
    );
    expect(importers).toEqual([
      join("src", "components", "laffogato", "valley-scene.ts"),
    ]);
  });

  it("reaches the scene only through import(), never a static import", () => {
    const statics = sourceFiles("src").filter((path) =>
      /^\s*import\s+(?!type\b)[^;]*?from\s+["'][^"']*valley-scene["']/m.test(
        read(path),
      ),
    );
    expect(statics).toEqual([]);
    expect(VALLEY).toMatch(/await import\("\.\/valley-scene"\)/);
    expect(VALLEY).toMatch(
      /import type \{ ValleyHandle \} from "\.\/valley-scene"/,
    );
  });

  it("waits for the load event and an idle moment before fetching it", () => {
    expect(VALLEY).toMatch(/document\.readyState === "complete"/);
    expect(VALLEY).toMatch(/addEventListener\("load", schedule/);
    expect(VALLEY).toMatch(/requestIdleCallback/);
  });

  it("asks for WebGL 2 without a performance caveat before it downloads", () => {
    expect(VALLEY).toMatch(/getContext\("webgl2"/);
    expect(VALLEY).toMatch(/failIfMajorPerformanceCaveat: true/);
    expect(VALLEY).toMatch(/saveData/);
  });
});

describe("the scene is a good guest", () => {
  it("caps the pixel ratio and pauses off-screen and in a hidden tab", () => {
    expect(SCENE).toMatch(/const MAX_PIXEL_RATIO = 1\.5;/);
    expect(SCENE).toMatch(/new IntersectionObserver/);
    expect(SCENE).toMatch(/document\.hidden/);
  });

  it("gives everything back on unmount", () => {
    for (const call of [
      "renderer.dispose()",
      "renderer.forceContextLoss()",
      "light.geometry.dispose()",
      "things.geometry.dispose()",
      "lightMaterial.dispose()",
      "coreMaterial.dispose()",
      "fringeMaterial.dispose()",
      "resized.disconnect()",
      "seen.disconnect()",
    ]) {
      expect(SCENE).toContain(call);
    }
    expect(VALLEY).toMatch(/handle\.current\?\.dispose\(\)/);
  });

  it("never holds the page's scroll", () => {
    expect(SCENE).not.toMatch(
      /preventDefault\(\)[^;]*;[\s\S]{0,40}(wheel|scroll|touch)/,
    );
    expect(SCENE).not.toMatch(/addEventListener\("(wheel|touchmove)"/);
    expect(SCENE).toMatch(
      /addEventListener\("pointermove", onPointer, \{ passive: true \}\)/,
    );
  });

  it("draws one still frame under reduced motion", () => {
    expect(VALLEY).toMatch(
      /still: window\.matchMedia\("\(prefers-reduced-motion: reduce\)"\)/,
    );
    expect(SCENE).toMatch(
      /const on =[^;]*!still\s*&&\s*visible\s*&&\s*!paused/,
    );
  });
});

describe("the type is the page's, not the canvas's", () => {
  const html = renderToStaticMarkup(
    createElement(HomeValley, { onMenu: () => {}, onVisit: () => {} }),
  );

  it("server-renders the name, the caption, the arrow and the hint", () => {
    expect(html).toContain("L&#x27;Affogato");
    expect(html).toContain("Bologna 1897&#x27;den Tuzla&#x27;ya,");
    expect(html).toContain("iki yüz yıllık bir köşkte.");
    expect(html).toMatch(/<a class="valley-go" href="\/menu"/);
    expect(html).toContain("Menüyü keşfet");
    expect(html).toContain("Kaydır ve keşfet");
    expect(html).toContain('aria-label="Hareketi durdur"');
  });

  it("sends no canvas and no scene state in the HTML", () => {
    expect(html).not.toContain("<canvas");
    expect(html).not.toContain("data-gl");
  });

  it("never fades the name in: it is the largest paint", () => {
    // The wordmark arrives with a mask wipe, its first letter already
    // showing; it is never transparent, so it paints at once (LCP).
    expect(rule(".valley-wordmark")).not.toMatch(/opacity/);
    expect(rule("@keyframes valley-wipe")).not.toMatch(/opacity/);
  });

  it("shows the canvas, the loader and the pause control only in their state", () => {
    expect(rule(".valley-canvas")).toContain("opacity: 0;");
    expect(CSS).toMatch(
      /\.valley\[data-gl="ready"\] \.valley-canvas \{\s*opacity: 1;/,
    );
    expect(CSS).toMatch(/\.valley\[data-gl="loading"\] \.valley-loader \{/);
    expect(rule(".valley-pause")).toContain("display: none;");
    expect(CSS).toMatch(
      /\.valley\[data-gl="ready"\] \.valley-pause \{\s*display: grid;/,
    );
  });

  it("paints the scene from the palette's tokens", () => {
    const body = rule(".valley");
    for (const token of [
      // Green, bordo and white (owner, 6 Kas 2026); brass only on beans.
      "--valley-sky: var(--bg-espresso-deep);",
      "--valley-ground: var(--green-house);",
      "--valley-horizon: var(--accent);",
      "--valley-blossom: var(--surface);",
      "--valley-leaf: var(--green-brand);",
      "--valley-bean: var(--gold-deep);",
      "--valley-cherry: var(--accent);",
    ]) {
      expect(body).toContain(token);
    }
    expect(SCENE).not.toMatch(/#[0-9a-f]{6}\b/i);
  });
});

describe("no slider band below it", () => {
  it("draws the valley as the whole entrance (6 Kas 2026)", () => {
    expect(existsSync("src/components/laffogato/home-hero-slider.tsx")).toBe(false);
    const home = read("src/components/laffogato/home-page.tsx");
    expect(home).not.toContain("HomeHeroSlider");
    expect(CSS).not.toMatch(/\n\.hero-x[-\w]* \{/);
  });
});
