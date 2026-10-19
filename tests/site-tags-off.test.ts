import { readFileSync } from "node:fs";

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { CONSENT_DENIED, CONSENT_VERSION } from "@/lib/consent/cookie";
import { siteTagManagerId } from "@/lib/consent/script";
import { GOOGLE_TAGS_IN_LEGAL_TEXTS } from "@/lib/legal/meta";

/**
 * OP-SS2-PROVIDERS (18 Eki 2026): Google offers no Turkish standard contract
 * for Tag Manager, Analytics or Ads, so the transfer GTM makes on every page
 * view has no KVKK m.9/4 safeguard. Google is taken out instead of
 * contracted: no tags until a Google standard contract is signed and
 * notified, and the legal texts say "İnternet sitemizde bugün analitik veya
 * reklam etiketi kullanılmaz". Without a tag manager the banner offers the
 * necessary and preference cookies only.
 */

vi.mock("next/navigation", () => ({ usePathname: () => "/" }));
vi.mock("@next/third-parties/google", () => ({
  GoogleTagManager: ({ gtmId }: { gtmId: string }) =>
    createElement("script", { "data-gtm": gtmId }),
}));

const { ConsentScripts, CookieBanner, TagManager } =
  await import("@/components/laffogato/site-tags");
const { CookieConsent, consentCategories, recordedChoice } =
  await import("@/components/laffogato/cookie-consent");

const LAYOUT = readFileSync("src/app/layout.tsx", "utf8");

describe("Google Tag Manager is off while the texts say there are no tags", () => {
  it("the texts say so, and the container id is then always empty", () => {
    expect(GOOGLE_TAGS_IN_LEGAL_TEXTS).toBe(false);
    expect(siteTagManagerId("GTM-ABC123")).toBe("");
    expect(siteTagManagerId(undefined)).toBe("");
  });

  it("has no built-in container: an empty or missing id is no GTM", () => {
    expect(siteTagManagerId(undefined, true)).toBe("");
    expect(siteTagManagerId("   ", true)).toBe("");
    expect(siteTagManagerId(" GTM-ABC123 ", true)).toBe("GTM-ABC123");
  });

  it("the root layout reads the id only through that rule", () => {
    expect(LAYOUT).not.toContain("GTM-KZ2QCHTT");
    expect(LAYOUT).toContain(
      "const GTM_ID = siteTagManagerId(process.env.NEXT_PUBLIC_GTM_ID);",
    );
    expect(LAYOUT).toContain("<ConsentScripts withTagManager={!!GTM_ID} />");
    expect(LAYOUT).toContain("<CookieBanner tagManager={!!GTM_ID} />");
    expect(readFileSync(".env.example", "utf8")).not.toMatch(
      /^NEXT_PUBLIC_GTM_ID=\S/m,
    );
  });

  it("a page without a container: no GTM, no Consent Mode bootstrap, the banner flag and the banner stay", () => {
    const html = renderToStaticMarkup(
      createElement(
        "div",
        null,
        createElement(ConsentScripts, { withTagManager: false }),
        createElement(TagManager, { gtmId: "" }),
        createElement(CookieBanner, { tagManager: false }),
      ),
    );
    expect(html).not.toContain("data-gtm");
    expect(html).not.toContain("googletagmanager");
    // The Consent Mode defaults exist to sit ahead of the container; with no
    // container there is nothing for them to precede.
    expect(html).not.toContain('id="consent-bootstrap"');
    // The flag that keeps a decided visitor's banner hidden before paint.
    expect(html).toContain('id="consent-seen"');
    expect(html).toContain('class="cookie-banner"');
  });

  it("with a container the defaults still come first and the banner speaks of all four kinds", () => {
    const html = renderToStaticMarkup(
      createElement(
        "div",
        null,
        createElement(ConsentScripts, { withTagManager: true }),
        createElement(TagManager, { gtmId: "GTM-TEST" }),
        createElement(CookieBanner, { tagManager: true }),
      ),
    );
    expect(html.indexOf('id="consent-bootstrap"')).toBeGreaterThan(-1);
    expect(html.indexOf('id="consent-bootstrap"')).toBeLessThan(
      html.indexOf('data-gtm="GTM-TEST"'),
    );
    expect(html).toContain("Analitik ve pazarlama çerezleri");
  });
});

describe("the banner without a tag manager", () => {
  it("says there are no analytics or ad cookies", () => {
    const html = renderToStaticMarkup(
      createElement(CookieConsent, { tagManager: false }),
    );
    expect(html).toContain("Sitede analitik veya reklam çerezi yok");
    expect(html).not.toMatch(/Analitik ve\s+pazarlama çerezleri ise/);
    // Refusing stays as easy as accepting.
    expect(html).toContain("Yalnızca zorunlu");
    expect(html).toContain("Tümünü kabul et");
  });

  it("offers the preference switch alone", () => {
    expect(consentCategories(false).map((c) => c.key)).toEqual(["preferences"]);
    expect(consentCategories(true).map((c) => c.key)).toEqual([
      "preferences",
      "analytics",
      "marketing",
    ]);
  });

  it("records no yes for a category it did not show", () => {
    const all = {
      version: CONSENT_VERSION,
      preferences: true,
      analytics: true,
      marketing: true,
    };
    expect(recordedChoice(all, false)).toEqual({
      ...CONSENT_DENIED,
      preferences: true,
    });
    expect(recordedChoice(all, true)).toEqual(all);
    const src = readFileSync(
      "src/components/laffogato/cookie-consent.tsx",
      "utf8",
    );
    // Every write goes through it: the banner, the panel, both buttons.
    expect(src).toContain(
      "const shown = recordedChoice(choice, tagManager);\n      writeConsent(shown);",
    );
    expect(src.match(/writeConsent\(/g)).toHaveLength(1);
  });
});
