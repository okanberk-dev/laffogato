import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The karaoke terms as published (karar D11): /hukuk/karaoke-odasi-rezervasyon
 * and the app's `GET /legal/{slug}` render §7, §9 and §10 from the policy a
 * booking made now gets, dated by the day it was saved. Under the default
 * (and while the app lock is shut) they are the coded text with its coded
 * date. A database that cannot be read shows the coded text too.
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
    effectiveKaraokeCancelPolicy: (
      s: Parameters<typeof real.effectiveKaraokeCancelPolicy>[0],
    ) => real.effectiveKaraokeCancelPolicy(s, h.appVersion),
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

  it("follow an open policy, dated by its save, on the site and in the app", async () => {
    h.appVersion = "1.1.0";
    h.settings = settings(24, 50);
    const site = await liveLegalDoc(SLUG);
    expect(site?.updatedAt).toBe("18 Ekim 2026");
    expect(JSON.stringify(site)).toContain("24 saatten fazla varken");
    expect(JSON.stringify(site)).toContain("%50'si kartınıza iade edilir");

    const app = await mobileLegal.legalDoc(SLUG);
    expect(app).toEqual(site);
    const index = await mobileLegal.legalIndex();
    expect(index.docs.find((d) => d.slug === SLUG)?.updatedAt).toBe(
      "18 Ekim 2026",
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
