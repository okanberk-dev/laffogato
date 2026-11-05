import { existsSync, readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import {
  DEFAULT_MOBILE_APP_CONFIG,
  normalizeMobileAppConfig,
  toBootstrapApp,
} from "@/lib/mobile/app-config";
import {
  EMAIL_LINK_APP_VERSION,
  aasaPaths,
  aasaPathsAtLatest,
} from "@/lib/mobile/app-links";
import { LIVE_APP_STORE_URL } from "@/lib/mobile/app-store";

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
  it("knows the live iOS listing and team, and guesses nothing for Android", () => {
    // 1.1.0 is on the App Store (operator, 5 Kas 2026): the listing and the
    // team are facts. Google Play has no listing and no signing key yet.
    const d = DEFAULT_MOBILE_APP_CONFIG.store;
    expect(d.appStoreUrl).toBe(LIVE_APP_STORE_URL);
    expect(d.appStoreUrl).toBe("https://apps.apple.com/tr/app/id6823861367");
    expect(d.playStoreUrl).toBe("");
    expect(d.appleTeamId).toBe("CBTKNY3LFC");
    expect(d.androidSha256).toEqual([]);
  });

  it("reads an emptied App Store field as the live listing", () => {
    // A panel row saved while the field was empty keeps "". The forced-update
    // screen must still find the store, and the panel must not warn about a
    // listing that exists.
    expect(store({ appStoreUrl: "" }).appStoreUrl).toBe(LIVE_APP_STORE_URL);
    expect(store({ playStoreUrl: "" }).playStoreUrl).toBe("");
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
      expect(store({ appStoreUrl: bad }).appStoreUrl).toBe(LIVE_APP_STORE_URL);
      expect(store({ playStoreUrl: bad }).playStoreUrl).toBe("");
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
    const team = DEFAULT_MOBILE_APP_CONFIG.store.appleTeamId;
    expect(store({ appleTeamId: "ABCDE1234" }).appleTeamId).toBe(team); // 9 chars
    expect(store({ appleTeamId: "abcde12345" }).appleTeamId).toBe("ABCDE12345");
    expect(store({ appleTeamId: "ABCDE-12345" }).appleTeamId).toBe(team);
    expect(store({ appleTeamId: "" }).appleTeamId).toBe(team);
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
    expect(before.appStoreUrl).toBe(LIVE_APP_STORE_URL);
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
  const route = readFileSync(
    "src/app/.well-known/apple-app-site-association/route.ts",
    "utf8",
  );

  it("does not claim a path whose URL shape the app cannot render", () => {
    const claimed = aasaPathsAtLatest();
    expect(claimed.length).toBeGreaterThan(0);
    for (const path of NEVER_CLAIMED) {
      expect(claimed).not.toContain(path);
    }
  });

  it("still keeps the panel and the API out of the app, before anything is claimed", () => {
    const paths = aasaPaths("9.9.9");
    expect(paths.slice(0, 3)).toEqual([
      "NOT /admin/*",
      "NOT /api/*",
      "NOT /uye/*",
    ]);
    // The route publishes exactly this list, for the panel's minimum version.
    expect(route).toContain("aasaPaths(mobileApp.minSupportedAppVersion)");
  });

  it("claims the table QR path, now that every released app can open it", () => {
    // lafmobil 1.1.0 (App Store, 5 Kas 2026) has the masa/[kod] screen and
    // 1.0.0 never reached the store, so a printed card opens the app at its
    // table (§22). Exactly the subtree: a bare "/masa" would also take the
    // web page's own path, which has no app screen.
    const claimed = aasaPaths("1.0.0");
    expect(claimed.filter((p) => p.startsWith("/masa"))).toEqual(["/masa/*"]);
  });

  it("claims the confirmation link only once every supported app has its screen", () => {
    // uygulama/dogrula ships in 1.1.1. While the panel still supports older
    // builds, the sign-up mail's link stays the site's page, which confirms
    // on a button press; raising "En düşük sürüm" to 1.1.1 hands it to the app.
    expect(EMAIL_LINK_APP_VERSION).toBe("1.1.1");
    expect(aasaPaths("1.0.0")).not.toContain("/uygulama/*");
    expect(aasaPaths("1.1.0")).not.toContain("/uygulama/*");
    expect(aasaPaths("1.1.1")).toContain("/uygulama/*");
    expect(aasaPaths("1.2.0")).toContain("/uygulama/*");
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
    // Android has no association to gate: the app build that lists a prefix
    // is the build that has its screen, so it lists every claim at once.
    const claimed = aasaPathsAtLatest()
      .filter((p) => !p.startsWith("NOT "))
      .map(sameClaim);
    expect([...prefixes].sort()).toEqual(claimed.sort());
    // And no bare host claim, which would take the whole domain regardless.
    for (const entry of config.expo.android.intentFilters[0].data) {
      expect(entry.pathPrefix).toBeTruthy();
    }
  });
});
