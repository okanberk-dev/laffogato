import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The karaoke terms as published (karar D11): /hukuk/karaoke-odasi-rezervasyon
 * and the app's `GET /legal/{slug}`. Since ASK-OTH-3-CFG the text names no
 * hours or percent (it points at the booking's summary), so it is the coded
 * text under every policy; a policy other than the default dates it by the
 * day it was saved, the version a booking's consent records. A database that
 * cannot be read shows the coded text with its coded date.
 */

const h = vi.hoisted(() => ({
  appVersion: null as string | null,
  settings: {} as Record<string, unknown>,
}));

vi.mock("@/lib/admin/store", () => ({
  getPublicSettings: vi.fn(async () => h.settings),
}));
vi.mock("@/lib/legal/store", () => ({
  getPublishedLegalOverride: vi.fn(async () => null),
  listLegalDocOverrides: vi.fn(async () => ({})),
}));
vi.mock("@/lib/mobile/karaoke-time", async (importOriginal) => {
  const real =
    await importOriginal<typeof import("@/lib/mobile/karaoke-time")>();
  return {
    ...real,
    // A share of 1..99 % stays closed in the code until the resale refund
    // ships; these tests keep exercising its path (karar D9).
    effectiveKaraokeCancelPolicy: (
      s: Parameters<typeof real.effectiveKaraokeCancelPolicy>[0],
    ) => real.effectiveKaraokeCancelPolicy(s, h.appVersion, true),
  };
});

const { karaokeLegalDocNow, liveLegalDoc } =
  await import("@/lib/legal/karaoke-doc");
const { findLegalDoc } = await import("@/lib/legal/documents");
const mobileLegal = await import("@/lib/mobile/legal");

const SLUG = "karaoke-odasi-rezervasyon";

function settings(hours: number, percent: number) {
  return {
    karaokeFreeCancelHours: hours,
    karaokeLateRefundPercent: percent,
    karaokeCancelPolicyAt: "2026-10-18T09:00:00.000Z",
    mobileApp: { minSupportedAppVersion: "1.1.0" },
  };
}

beforeEach(() => {
  h.appVersion = null;
  h.settings = settings(2, 0);
});

describe("the karaoke terms as published", () => {
  it("are the coded document under the default", async () => {
    expect(await karaokeLegalDocNow()).toEqual(findLegalDoc(SLUG));
  });

  it("stay the coded document while the app lock is shut", async () => {
    h.settings = settings(24, 50);
    expect(await karaokeLegalDocNow()).toEqual(findLegalDoc(SLUG));
  });

  it("keep their words under an open policy, dated by its save, on the site and in the app", async () => {
    h.appVersion = "1.1.0";
    h.settings = settings(24, 50);
    const site = await liveLegalDoc(SLUG);
    // The save was 18 Ekim, before the coded revision: the later day wins.
    expect(site?.updatedAt).toBe(findLegalDoc(SLUG)?.updatedAt);
    h.settings = {
      ...settings(24, 50),
      karaokeCancelPolicyAt: "2026-11-02T09:00:00.000Z",
    };
    const later = await liveLegalDoc(SLUG);
    expect(later?.updatedAt).toBe("2 Kasım 2026");
    // The same words: only the date moved.
    expect({ ...later, updatedAt: "" }).toEqual({
      ...findLegalDoc(SLUG),
      updatedAt: "",
    });
    expect(JSON.stringify(later)).not.toContain("24 saatten fazla varken");

    const app = await mobileLegal.legalDoc(SLUG);
    expect(app).toEqual(later);
    const index = await mobileLegal.legalIndex();
    expect(index.docs.find((d) => d.slug === SLUG)?.updatedAt).toBe(
      "2 Kasım 2026",
    );
  });

  it("leave every other document alone", async () => {
    h.appVersion = "1.1.0";
    h.settings = settings(24, 50);
    expect(await liveLegalDoc("mesafeli-satis-sozlesmesi")).toBe(
      findLegalDoc("mesafeli-satis-sozlesmesi"),
    );
  });
});

describe("opening the app lock", () => {
  /**
   * Other documents still quote the default rule in their own words
   * (odeme-kosullari, hesap-silme; the café terms, iade-ve-cayma and
   * veri-saklama-ve-imha-politikasi point at the karaoke terms since 19 Ekim
   * 2026). That is true while every booking is made under 2 hours / 0 %,
   * which the lock guarantees. Whoever opens it (KARAOKE_POLICY_APP_VERSION)
   * rewrites them first, to point at the karaoke terms instead of repeating
   * a rule the panel may change.
   */
  it("needs every other document to stop quoting the fixed rule", async () => {
    const { KARAOKE_POLICY_APP_VERSION } =
      await import("@/lib/mobile/karaoke-time");
    const { LEGAL_DOCS } = await import("@/lib/legal/documents");
    const quoting = LEGAL_DOCS.filter(
      (d) =>
        d.slug !== SLUG &&
        /(?<!\d)2 saatten (fazla|az)/.test(JSON.stringify(d)),
    ).map((d) => d.slug);
    if (KARAOKE_POLICY_APP_VERSION === null) {
      // Shut: the quotes are true, and they are there.
      expect(quoting.length).toBeGreaterThan(0);
    } else {
      expect(quoting, "rewrite these before opening the lock").toEqual([]);
    }
  });

  /**
   * The site's own karaoke screens print the fixed rule as well (PR 3c
   * makes them print the booking's): the box above the payment, which also
   * echoes that rule back, so under another policy every prepaid web
   * booking would be refused as policy_changed; and the booking page with
   * its cancel step, which offers a cancel only inside the free window and
   * says "iade yapılmaz" after it, so a late share could not be taken there.
   */
  it("needs the site's karaoke screens to print the booking's own rule", async () => {
    const { readFileSync } = await import("node:fs");
    const { KARAOKE_POLICY_APP_VERSION } =
      await import("@/lib/mobile/karaoke-time");
    const fixed =
      /\b(KARAOKE_REFUND_RULE|KARAOKE_NO_REFUND_RULE|DEFAULT_KARAOKE_CANCEL_POLICY)\b/;
    // A moved or renamed screen fails here instead of passing unread.
    const printing = [
      "src/components/laffogato/karaoke-booking.tsx",
      "src/components/uye/karaoke-reservation-view.tsx",
    ].filter((file) => fixed.test(readFileSync(file, "utf8")));
    if (KARAOKE_POLICY_APP_VERSION !== null) {
      expect(printing, "print the booking's rule here first").toEqual([]);
    }
  });
});
