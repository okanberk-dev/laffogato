import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import {
  CONSENT_COOKIE,
  CONSENT_DENIED,
  CONSENT_VERSION,
  parseConsent,
  toGoogleConsent,
} from "@/lib/consent/cookie";
import { CONSENT_BOOTSTRAP } from "@/lib/consent/script";

const encode = (v: unknown) => encodeURIComponent(JSON.stringify(v));

describe("consent cookie", () => {
  it("treats a missing or unparseable cookie as no decision", () => {
    expect(parseConsent(undefined)).toBeNull();
    expect(parseConsent("")).toBeNull();
    expect(parseConsent("not-json")).toBeNull();
  });

  it("discards a decision recorded under an older shape", () => {
    const stale = encode({
      version: CONSENT_VERSION - 1,
      decidedAt: "2026-01-01T00:00:00.000Z",
      analytics: true,
    });
    expect(parseConsent(stale)).toBeNull();
  });

  it("coerces every category to a strict boolean", () => {
    const raw = encode({
      version: CONSENT_VERSION,
      decidedAt: "2026-01-01T00:00:00.000Z",
      analytics: "yes",
      marketing: 1,
      preferences: true,
    });
    expect(parseConsent(raw)).toEqual({
      version: CONSENT_VERSION,
      decidedAt: "2026-01-01T00:00:00.000Z",
      preferences: true,
      analytics: false,
      marketing: false,
    });
  });
});

describe("Google Consent Mode v2 mapping", () => {
  it("denies everything but security storage before a choice is made", () => {
    const signals = toGoogleConsent(null);
    expect(signals.security_storage).toBe("granted");
    const consented = Object.entries(signals).filter(
      ([key]) => key !== "security_storage",
    );
    expect(consented.every(([, v]) => v === "denied")).toBe(true);
  });

  it("maps marketing to all three ad signals", () => {
    const signals = toGoogleConsent({ ...CONSENT_DENIED, marketing: true });
    expect(signals.ad_storage).toBe("granted");
    expect(signals.ad_user_data).toBe("granted");
    expect(signals.ad_personalization).toBe("granted");
    expect(signals.analytics_storage).toBe("denied");
  });
});

describe("consent bootstrap script", () => {
  it("sets the defaults before anything can be granted", () => {
    expect(CONSENT_BOOTSTRAP).toContain("'consent', 'default'");
    expect(CONSENT_BOOTSTRAP).toContain(CONSENT_COOKIE);
    // Only security_storage may be hard-coded granted; every consent-bearing
    // signal has to go through the cookie-derived g() helper, or the container
    // would fire its tags before the visitor ever answered.
    for (const key of [
      "ad_storage",
      "ad_user_data",
      "ad_personalization",
      "analytics_storage",
      "functionality_storage",
      "personalization_storage",
    ]) {
      expect(CONSENT_BOOTSTRAP).toMatch(new RegExp(`${key}: g\\(`));
    }
    expect(CONSENT_BOOTSTRAP).toContain("security_storage: 'granted'");
  });

  it("is inlined in the document head ahead of the GTM container", () => {
    const layout = readFileSync("src/app/layout.tsx", "utf8");
    const bootstrap = layout.indexOf("CONSENT_BOOTSTRAP");
    const gtm = layout.indexOf("<GoogleTagManager");
    expect(bootstrap).toBeGreaterThan(-1);
    expect(gtm).toBeGreaterThan(bootstrap);
  });
});
