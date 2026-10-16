import { readFileSync } from "node:fs";

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import {
  documentLoadedAtCheckout,
  isCheckoutPath,
} from "@/lib/security/checkout-document";

/**
 * GTM never runs in the checkout document (docs/PAYNKOLAY.md §15.5): the
 * root layout's tags stay out of a document LOADED at /odeme, the site's
 * own ways in are full page loads, and the checkout reloads itself when a
 * client-side navigation brought it into another page's document.
 */

let pathname = "/";
vi.mock("next/navigation", () => ({ usePathname: () => pathname }));
vi.mock("@next/third-parties/google", () => ({
  GoogleTagManager: ({ gtmId }: { gtmId: string }) =>
    createElement("script", { "data-gtm": gtmId }),
}));
vi.mock("@/components/laffogato/cookie-consent", () => ({
  CookieConsent: () => createElement("div", { "data-banner": "" }),
}));

const { ConsentScripts, CookieBanner, TagManager } =
  await import("@/components/laffogato/site-tags");

function tags(path: string): string {
  pathname = path;
  return renderToStaticMarkup(
    createElement(
      "div",
      null,
      createElement(ConsentScripts, { withTagManager: true }),
      createElement(TagManager, { gtmId: "GTM-TEST" }),
      createElement(CookieBanner),
    ),
  );
}

describe("the root layout's tags", () => {
  it("render on every page but the checkout", () => {
    for (const path of ["/", "/magaza", "/odeme/donus", "/odeme/basarili"]) {
      const html = tags(path);
      expect(html, path).toContain('data-gtm="GTM-TEST"');
      expect(html, path).toContain('id="consent-bootstrap"');
      expect(html, path).toContain('id="consent-seen"');
      expect(html, path).toContain("data-banner");
    }
  });

  it("render nothing at all in the checkout document", () => {
    expect(tags("/odeme")).toBe("<div></div>");
  });

  it("the root layout reaches GTM only through them", () => {
    const layout = readFileSync("src/app/layout.tsx", "utf8");
    expect(layout).not.toContain("@next/third-parties");
    expect(layout).not.toContain("dangerouslySetInnerHTML");
    expect(layout).toContain("<TagManager");
    // Reading headers() would make every page of the site dynamic.
    expect(layout).not.toMatch(/\bheaders\(\)/);
  });
});

describe("which document is the checkout's", () => {
  it("is decided by the path the document was loaded at", () => {
    expect(isCheckoutPath("/odeme")).toBe(true);
    expect(isCheckoutPath("/odeme/donus")).toBe(false);
    expect(isCheckoutPath("/odemex")).toBe(false);
    expect(isCheckoutPath(null)).toBe(false);
    expect(documentLoadedAtCheckout("https://laffogato.net/odeme")).toBe(true);
    // A 303 from the payment route lands here with its query.
    expect(
      documentLoadedAtCheckout("https://laffogato.net/odeme?odeme=reddedildi"),
    ).toBe(true);
    expect(documentLoadedAtCheckout("https://laffogato.net/magaza")).toBe(
      false,
    );
    expect(documentLoadedAtCheckout("https://laffogato.net/urun/x")).toBe(
      false,
    );
    expect(documentLoadedAtCheckout("")).toBeNull();
    expect(documentLoadedAtCheckout("not a url")).toBeNull();
  });

  it("the checkout shows no card field before it has checked", () => {
    const checkout = readFileSync("src/app/odeme/checkout.tsx", "utf8");
    expect(checkout).toContain('performance.getEntriesByType("navigation")[0]');
    expect(checkout).toContain("documentLoadedAtCheckout(");
    expect(checkout).toContain("window.location.reload()");
    // Until then: the skeleton, never the form.
    expect(checkout).toMatch(
      /if \(!boot\) return <div className="checkout-skeleton"/,
    );
  });

  it("the site's own ways in are full page loads", () => {
    const chrome = readFileSync("src/components/laffogato/chrome.tsx", "utf8");
    const pdp = readFileSync(
      "src/components/laffogato/product-detail.tsx",
      "utf8",
    );
    const verify = readFileSync("src/app/uye/dogrula/page.tsx", "utf8");
    for (const [name, src] of [
      ["chrome.tsx", chrome],
      ["product-detail.tsx", pdp],
    ] as const) {
      expect(src, name).not.toMatch(
        /router\.(push|replace)\(\s*["']\/odeme["']/,
      );
      expect(src, name).toContain('window.location.assign("/odeme")');
    }
    for (const src of [chrome, pdp, verify]) {
      expect(src).not.toMatch(/<Link[^>]*href="\/odeme"/);
    }
  });

  it("every link on the checkout leaves with a full page load", () => {
    for (const file of [
      "src/app/odeme/checkout.tsx",
      "src/app/odeme/checkout-chrome.tsx",
      "src/app/odeme/card-payment.tsx",
      "src/app/odeme/page.tsx",
    ]) {
      expect(readFileSync(file, "utf8"), file).not.toMatch(/from "next\/link"/);
    }
    // The consent block's document links are next/link, but open a new
    // tab (target="_blank"): a document of their own all the same.
    const consent = readFileSync("src/app/odeme/checkout-consent.tsx", "utf8");
    for (const m of consent.matchAll(/<Link\b[^>]*>/g)) {
      expect(m[0]).toContain('target="_blank"');
    }
  });
});

/**
 * No blank page and no endless wait around the payment step (operator,
 * 16 Eki 2026): a render error, the wait for the server part, and a hand-off
 * to the bank that never happens all end on words and a way on.
 */
describe("the checkout never leaves the customer on a white or stuck page", () => {
  it("a render error shows a message and 'Tekrar dene'", async () => {
    const { default: CheckoutError } = await import("@/app/odeme/error");
    const html = renderToStaticMarkup(
      createElement(CheckoutError, { error: new Error("boom") }),
    );
    expect(html).toContain('role="alert"');
    expect(html).toContain("<h1");
    expect(html).toMatch(/<a href="\/odeme"[^>]*>Tekrar dene<\/a>/);
    expect(html).toContain("kartından para çekilmedi");
    expect(readFileSync("src/app/odeme/error.tsx", "utf8")).toMatch(
      /^"use client";/,
    );
  });

  it("the wait for the server part is a skeleton, not nothing", async () => {
    const { default: CheckoutLoading } = await import("@/app/odeme/loading");
    const html = renderToStaticMarkup(createElement(CheckoutLoading));
    expect(html).toContain("checkout-skeleton");
    expect(html).toContain('role="status"');
  });

  it("'Bankaya yönlendiriliyorsun…' gives way after 20 s, and on Back", () => {
    const checkout = readFileSync("src/app/odeme/checkout.tsx", "utf8");
    expect(checkout).toContain("const BANK_HANDOFF_WAIT_MS = 20_000;");
    // Armed right before every navigation away: the bank, a hosted page,
    // the success page.
    expect(checkout).toMatch(
      /awaitHandoff\(\);\s+cardRef\.current\?\.submitToBank\(result\.d, result\.s\);/,
    );
    expect(
      checkout.match(/awaitHandoff\(\);\s+window\.location\.assign/g),
    ).toHaveLength(2);
    // When it fires: the button back, and a message.
    const arm = checkout.slice(checkout.indexOf("const awaitHandoff"));
    expect(arm.slice(0, 500)).toContain("setPlacing(false);");
    expect(arm.slice(0, 500)).toContain("setPayError(HANDOFF_STALLED);");
    // The order step itself is bounded too.
    expect(checkout).toContain("const ACTION_WAIT_MS = 30_000;");
    // Back from the bank through the back-forward cache: the card form's
    // pageshow handler calls onRestored, which is `stop` (clears the timer,
    // re-enables the button).
    expect(checkout).toContain("onRestored={stop}");
    const card = readFileSync("src/app/odeme/card-payment.tsx", "utf8");
    expect(card).toMatch(/addEventListener\("pageshow", onShow\)/);
    expect(card).toContain("if (event.persisted) onRestored();");
  });
});
