import { existsSync, readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import {
  DEFAULT_MOBILE_APP_CONFIG,
  normalizeMobileAppConfig,
  toBootstrapApp,
} from "@/lib/mobile/app-config";

/**
 * Store listings and deep-link identifiers.
 *
 * These are settings, not build constants, for one reason worth restating in
 * a test: an operator has to be able to change them WITHOUT shipping an app
 * release, and for two of them there is no other way at all -
 *
 * - the store URLs are read by the forced-update screen, which by definition
 *   is shown to builds too old to be fixed by shipping a build;
 * - Google generates the Play App Signing certificate AFTER the first upload,
 *   so its fingerprint cannot exist when the app is written.
 */

const store = (over: Record<string, unknown>) =>
  normalizeMobileAppConfig({ store: over }).store;

describe("store settings", () => {
  it("starts empty rather than guessing a listing", () => {
    const d = DEFAULT_MOBILE_APP_CONFIG.store;
    expect(d.appStoreUrl).toBe("");
    expect(d.playStoreUrl).toBe("");
    expect(d.appleTeamId).toBe("");
    expect(d.androidSha256).toEqual([]);
  });

  it("keeps a real listing URL", () => {
    const s = store({
      appStoreUrl: "https://apps.apple.com/tr/app/laffogato/id123456789",
      playStoreUrl:
        "https://play.google.com/store/apps/details?id=com.laffogato.app",
    });
    expect(s.appStoreUrl).toContain("apps.apple.com");
    expect(s.playStoreUrl).toContain("play.google.com");
  });

  it("refuses a URL that is not a store listing", () => {
    // This value ends up in `Linking.openURL` on a screen the member cannot
    // get past, so a typo has to degrade to "no button" - never to "opens
    // something else".
    for (const bad of [
      "http://apps.apple.com/tr/app/x", // not https
      "https://apps.evil.com/tr/app/x",
      "https://laffogato.net/indir",
      "javascript:alert(1)",
      "not a url at all",
    ]) {
      expect(store({ appStoreUrl: bad }).appStoreUrl).toBe("");
    }
  });

  it("normalises and de-duplicates signing fingerprints", () => {
    const one = "aa:bb:cc:dd:ee:ff:00:11:22:33:44:55:66:77:88:99";
    const full = `${one}:${one}`;
    const s = store({ androidSha256: [full, full.toUpperCase(), "  " + full] });
    expect(s.androidSha256).toEqual([full.toUpperCase()]);
  });

  it("drops one bad fingerprint instead of the whole list", () => {
    // A missing entry costs deep links for one signing key; a rejected array
    // costs them for every key.
    const good =
      "AA:BB:CC:DD:EE:FF:00:11:22:33:44:55:66:77:88:99:AA:BB:CC:DD:EE:FF:00:11:22:33:44:55:66:77:88:99";
    const s = store({ androidSha256: [good, "not-a-fingerprint", 42, null] });
    expect(s.androidSha256).toEqual([good]);
  });

  it("refuses an Apple Team ID that is not one", () => {
    expect(store({ appleTeamId: "ABCDE1234" }).appleTeamId).toBe(""); // 9 chars
    expect(store({ appleTeamId: "abcde12345" }).appleTeamId).toBe("ABCDE12345");
    expect(store({ appleTeamId: "ABCDE-12345" }).appleTeamId).toBe("");
  });

  it("keeps the default package name when given nonsense", () => {
    expect(store({ bundleId: "not a package" }).bundleId).toBe(
      DEFAULT_MOBILE_APP_CONFIG.store.bundleId,
    );
    expect(store({ bundleId: "com.laffogato.staging" }).bundleId).toBe(
      "com.laffogato.staging",
    );
  });

  it("survives a store section that is not an object", () => {
    for (const junk of [null, "x", 7, []]) {
      expect(normalizeMobileAppConfig({ store: junk }).store.bundleId).toBe(
        DEFAULT_MOBILE_APP_CONFIG.store.bundleId,
      );
    }
  });
});

describe("what the app is told", () => {
  it("publishes the listing URLs and nothing else", () => {
    const cfg = normalizeMobileAppConfig({
      store: {
        appStoreUrl: "https://apps.apple.com/tr/app/laffogato/id1",
        playStoreUrl:
          "https://play.google.com/store/apps/details?id=com.laffogato.app",
        appleTeamId: "ABCDE12345",
        bundleId: "com.laffogato.app",
        androidSha256: [
          "AA:BB:CC:DD:EE:FF:00:11:22:33:44:55:66:77:88:99:AA:BB:CC:DD:EE:FF:00:11:22:33:44:55:66:77:88:99",
        ],
      },
    });
    const app = toBootstrapApp(cfg, true);
    expect(app.store).toEqual({
      appStoreUrl: "https://apps.apple.com/tr/app/laffogato/id1",
      playStoreUrl:
        "https://play.google.com/store/apps/details?id=com.laffogato.app",
    });
    // The signing identifiers are the website's business: it publishes the
    // two `.well-known` documents. Handing the app its own fingerprint would
    // be giving it a fact it cannot use.
    expect(JSON.stringify(app)).not.toContain("ABCDE12345");
    expect(JSON.stringify(app)).not.toContain("AA:BB:CC");
  });

  it("moves with the setting, so a listing needs no release", () => {
    const before = toBootstrapApp(DEFAULT_MOBILE_APP_CONFIG, true).store;
    const after = toBootstrapApp(
      normalizeMobileAppConfig({
        store: { appStoreUrl: "https://apps.apple.com/tr/app/laffogato/id9" },
      }),
      true,
    ).store;
    expect(before.appStoreUrl).toBe("");
    expect(after.appStoreUrl).toBe(
      "https://apps.apple.com/tr/app/laffogato/id9",
    );
  });
});

/**
 * iOS writes a subtree as `/masa/*`, Android's intent filter as the prefix
 * `/masa/`. Both mean "every URL under /masa/", so the comparison strips the
 * wildcard and the trailing slash on both sides.
 */
function sameClaim(path: string): string {
  return path.replace(/\*$/, "").replace(/\/$/, "");
}

describe("the paths the app is allowed to intercept", () => {
  const AASA = readFileSync(
    "src/app/.well-known/apple-app-site-association/route.ts",
    "utf8",
  );

  /**
   * A claimed path is a promise that a laffogato.net URL under it opens an app
   * screen which can render THAT url. Four of them were promises the code
   * cannot keep, and the association is cached for days - so the app
   * intercepts the link, cannot show it, and the member cannot reach the web
   * version either.
   *
   * /menu/* and /magaza/* are category and /urun/<slug> URLs on the site and
   * item ids in the app. /siparis/* and /davet/* are served by nothing: the
   * order screen comes home on the custom scheme, which needs no association,
   * and davet.tsx takes no code. /uye/* has no app route at all.
   */
  const NEVER_CLAIMED = [
    "/uye/*",
    "/menu/*",
    "/magaza/*",
    "/siparis/*",
    "/davet/*",
  ];

  it("does not claim a path whose URL shape the app cannot render", () => {
    const claimed = [...AASA.matchAll(/^\s+"(\/[^"]*)",$/gm)].map((m) => m[1]);
    expect(claimed.length).toBeGreaterThan(0);
    for (const path of NEVER_CLAIMED) {
      expect(claimed).not.toContain(path);
    }
  });

  it("still keeps the panel and the API out of the app", () => {
    expect(AASA).toContain('"NOT /admin/*"');
    expect(AASA).toContain('"NOT /api/*"');
    // /uye/yeni-sifre must stay in a browser: the recovery session arrives in
    // a URL fragment, which is not a thing the app is handed.
    expect(AASA).toContain('"NOT /uye/*"');
  });

  it("claims the table QR path, and only as a prefix of the code", () => {
    const claimed = [...AASA.matchAll(/^\s+"(\/[^"]*)",$/gm)].map((m) => m[1]);
    expect(claimed).toContain("/masa/*");
    // /masa itself serves nothing; only /masa/<code> is a page.
    expect(claimed).not.toContain("/masa");
  });

  it("compares iOS wildcards and Android prefixes as the same claim", () => {
    expect(sameClaim("/masa/*")).toBe("/masa");
    expect(sameClaim("/masa/")).toBe("/masa");
    expect(sameClaim("/karaoke")).toBe("/karaoke");
  });

  it("matches what Android claims, since Android has no NOT rule to fall back on", () => {
    const appJson = "../lafmobil/app.json";
    if (!existsSync(appJson)) return; // the app repo is not always checked out
    const config = JSON.parse(readFileSync(appJson, "utf8"));
    const prefixes = new Set<string>(
      config.expo.android.intentFilters[0].data.map(
        (d: { pathPrefix?: string }) => sameClaim(d.pathPrefix ?? ""),
      ),
    );
    const claimed = [...AASA.matchAll(/^\s+"(\/[^"]*)",$/gm)].map((m) =>
      sameClaim(m[1]),
    );
    expect([...prefixes].sort()).toEqual(claimed.sort());
    // And no bare host claim, which would take the whole domain regardless.
    for (const entry of config.expo.android.intentFilters[0].data) {
      expect(entry.pathPrefix).toBeTruthy();
    }
  });
});
