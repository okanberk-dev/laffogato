import { readFileSync } from "node:fs";

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import {
  CONSENT_DENIED,
  CONSENT_VERSION,
  consentVersionFor,
  parseConsent,
} from "@/lib/consent/cookie";
import { CONSENT_BOOTSTRAP, siteTagManagerId } from "@/lib/consent/script";
import {
  GOOGLE_TAGS_IN_LEGAL_TEXTS,
  META_PIXEL_IN_LEGAL_TEXTS,
} from "@/lib/legal/meta";

/**
 * OP-SS2-PROVIDERS (18 Eki 2026): Google offers no Turkish standard contract
 * for Tag Manager, Analytics or Ads, so the transfer GTM makes on every page
 * view has no KVKK m.9/4 safeguard. Google is taken out instead of
 * contracted: no tags until a Google standard contract is signed and
 * notified, and the legal texts say Google's tags are not used. Without a
 * tag manager the banner offers the necessary and preference cookies, plus the
 * marketing switch only while the Meta Pixel (25 Ekim 2026) runs.
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
    expect(LAYOUT).toContain(
      "<CookieBanner tagManager={!!GTM_ID} metaPixel={!!META_PIXEL_ID} />",
    );
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

describe("the banner without a tag manager and without the pixel", () => {
  it("says there are no analytics or ad cookies", () => {
    const html = renderToStaticMarkup(
      createElement(CookieConsent, { tagManager: false, metaPixel: false }),
    );
    expect(html).toContain("Sitede analitik veya reklam çerezi yok");
    expect(html).not.toMatch(/Analitik ve\s+pazarlama çerezleri ise/);
    // Refusing stays as easy as accepting.
    expect(html).toContain("Yalnızca zorunlu");
    expect(html).toContain("Tümünü kabul et");
  });

  it("offers the preference switch alone", () => {
    const none = { tagManager: false, metaPixel: false };
    expect(consentCategories(none).map((c) => c.key)).toEqual(["preferences"]);
    expect(consentCategories({ tagManager: true }).map((c) => c.key)).toEqual([
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
    expect(
      recordedChoice(all, { tagManager: false, metaPixel: false }),
    ).toEqual({
      ...CONSENT_DENIED,
      preferences: true,
    });
    expect(recordedChoice(all, { tagManager: true })).toEqual(all);
    const src = readFileSync(
      "src/components/laffogato/cookie-consent.tsx",
      "utf8",
    );
    // Every write goes through it: the banner, the panel, both buttons.
    expect(src).toContain(
      "const shown = recordedChoice(choice, { tagManager, metaPixel });\n      writeConsent(shown);",
    );
    expect(src.match(/writeConsent\(/g)).toHaveLength(1);
  });
});

describe("the banner with the Meta Pixel and no tag manager", () => {
  const pixelOnly = { tagManager: false, metaPixel: true };

  it("no longer says the site has no ad cookies, and names the pixel", () => {
    const html = renderToStaticMarkup(createElement(CookieConsent, pixelOnly));
    expect(html).not.toContain("Sitede analitik veya reklam çerezi yok");
    expect(html).toContain("Meta Pixel");
    expect(html).toContain("yalnızca siz izin verirseniz çalışır");
    expect(html).toContain("Yalnızca zorunlu");
    expect(html).toContain("Tümünü kabul et");
  });

  it("shows the marketing switch but never the analytics one", () => {
    expect(consentCategories(pixelOnly).map((c) => c.key)).toEqual([
      "preferences",
      "marketing",
    ]);
    const marketing = consentCategories(pixelOnly).find(
      (c) => c.key === "marketing",
    )!;
    expect(marketing.body).toContain("Meta Platforms Ireland Ltd.");
    expect(marketing.body).toContain("geri alabilirsiniz");
  });

  it("records a marketing yes and still no analytics yes", () => {
    const all = {
      version: CONSENT_VERSION,
      preferences: true,
      analytics: true,
      marketing: true,
    };
    expect(recordedChoice(all, pixelOnly)).toEqual({
      ...all,
      analytics: false,
    });
  });
});

describe("when a tag comes or goes, everyone is asked again", () => {
  // A yes recorded before 19 Ekim 2026 was given to texts that described GTM;
  // one recorded since was given to a panel without the tag switches; one
  // recorded before 25 Ekim 2026 to a panel without the Meta Pixel. None is a
  // choice about the pixel, and the cookie lives 180 days: turning the pixel
  // on must not let it grant from any of them.
  const cookie = (version: number) =>
    encodeURIComponent(
      JSON.stringify({
        version,
        decidedAt: "2026-10-01T10:00:00.000Z",
        preferences: true,
        analytics: true,
        marketing: true,
      }),
    );

  it("every shape of tags has a version of its own", () => {
    const versions = [false, true].flatMap((google) =>
      [false, true].map((meta) => consentVersionFor(google, meta)),
    );
    expect(new Set(versions).size).toBe(4);
    // The shape no tags at all keeps the number it always had, and the pixel
    // is the first shape past it.
    expect(consentVersionFor(false, false)).toBe(1);
    expect(consentVersionFor(false, true)).toBe(2);
  });

  it("the consent version moves with the tags flags", () => {
    expect(CONSENT_VERSION).toBe(
      consentVersionFor(GOOGLE_TAGS_IN_LEGAL_TEXTS, META_PIXEL_IN_LEGAL_TEXTS),
    );
    // The pixel on, Google off: version 2, so every choice stored under
    // version 1 (marketing yes or not) is asked again.
    expect(GOOGLE_TAGS_IN_LEGAL_TEXTS).toBe(false);
    expect(META_PIXEL_IN_LEGAL_TEXTS).toBe(true);
    expect(CONSENT_VERSION).toBe(2);
  });

  it("a choice stored before the pixel is discarded", () => {
    const old = cookie(consentVersionFor(false, false));
    expect(parseConsent(old)).toBeNull();
    // The same cookie under the version it was written for still reads.
    expect(parseConsent(old, consentVersionFor(false, false))?.marketing).toBe(
      true,
    );
  });

  it("a choice stored while the tags were off is discarded once Google's are on", () => {
    const stored = cookie(consentVersionFor(false, true));
    expect(
      parseConsent(stored, consentVersionFor(false, true))?.marketing,
    ).toBe(true);
    expect(parseConsent(stored, consentVersionFor(true, true))).toBeNull();
  });

  it("the Consent Mode bootstrap checks the same version", () => {
    expect(CONSENT_BOOTSTRAP).toContain(`p.version === ${CONSENT_VERSION}`);
  });
});
