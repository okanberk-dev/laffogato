import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

/**
 * The storefront parts of CAT-25 and CAT-27 (admin audit, catalog package
 * 5b): the shop hero's Slide is exported so the panel's preview can draw the
 * real thing, and its photo goes into a quoted, escaped CSS url(). Unquoted,
 * a space or a bracket in the address dropped the image, and an address
 * ending in `);position:fixed;...;(` added declarations to the storefront.
 */

/**
 * Reads one CSS string token from `src` at `at` (on its opening quote), the
 * way a browser does (CSS Syntax 4.3.5), and returns the index after it.
 */
function endOfCssString(src: string, at: number): number {
  const quote = src[at];
  let i = at + 1;
  while (i < src.length) {
    const c = src[i]!;
    if (c === quote) return i + 1;
    if (c === "\n") return -1; // bad string
    if (c === "\\") {
      const hex = /^[0-9a-fA-F]{1,6}\s?/.exec(src.slice(i + 1));
      i += 1 + (hex ? hex[0].length : 1);
      continue;
    }
    i += 1;
  }
  return -1;
}

describe("cssUrl", () => {
  it("quotes the address and escapes what could end the string", async () => {
    const { cssUrl } = await import("@/components/laffogato/css-url");
    expect(cssUrl("https://cdn.example.com/hero (1).jpg")).toBe(
      'url("https://cdn.example.com/hero (1).jpg")',
    );
    expect(cssUrl('a"b')).toBe('url("a\\22 b")');
    expect(cssUrl("a\\b")).toBe('url("a\\5c b")');
    expect(cssUrl("a\nb")).toBe('url("a\\a b")');
  });

  it("keeps an injection attempt inside one CSS string", async () => {
    const { cssUrl } = await import("@/components/laffogato/css-url");
    for (const evil of [
      "x');position:fixed;inset:0;z-index:2147483647;background:#c00;('",
      'x");position:fixed;inset:0;("',
      'x\\");position:fixed;("',
      "x\n);position:fixed;(",
    ]) {
      const out = cssUrl(evil);
      expect(out.startsWith('url("')).toBe(true);
      expect(endOfCssString(out, 4), evil).toBe(out.length - 1);
      expect(out.endsWith('")')).toBe(true);
    }
  });
});

describe("the shop hero slide", () => {
  const slide = {
    id: "s1",
    title: "Köşkün mağazası",
    subtitle: "",
    imageUrl: "https://cdn.example.com/hero (1).jpg",
    ctaLabel: "",
    ctaHref: "",
    textTheme: "light" as const,
  };

  it("is exported for the panel preview and draws the photo quoted", async () => {
    const { Slide } = await import("@/components/laffogato/shop-hero-slider");
    expect(typeof Slide).toBe("function");
    const html = renderToStaticMarkup(
      createElement(Slide, { slide, active: true, loaded: true }),
    );
    expect(html).toContain(
      "url(&quot;https://cdn.example.com/hero (1).jpg&quot;)",
    );
    expect(html).not.toContain("url(https://");
  });

  it("does not let a crafted address add declarations", async () => {
    const { Slide } = await import("@/components/laffogato/shop-hero-slider");
    const html = renderToStaticMarkup(
      createElement(Slide, {
        slide: { ...slide, imageUrl: 'x");position:fixed;inset:0;("' },
        active: true,
        loaded: true,
      }),
    );
    expect(html).toContain(
      "url(&quot;x\\22 );position:fixed;inset:0;(\\22 &quot;)",
    );
  });
});
