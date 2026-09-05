import { describe, expect, it } from "vitest";

import {
  APP_SLIDE_ROUTE_LABELS,
  APP_SLIDE_ROUTES,
  APP_SLIDE_TONE_LABELS,
  APP_SLIDE_TONES,
  isAppSlideRoute,
} from "@/lib/admin/app-content-schema";

/**
 * The slide allow-list is a contract with the app (APP-CONFIG-SPEC §5): the
 * app resolves these keys through its own map and ignores anything else, so a
 * key added here without an app-side mapping is a button that does nothing,
 * and a key removed here silently disarms slides already in the database.
 */
describe("APP_SLIDE_ROUTES", () => {
  it("is exactly the twelve keys of APP-CONFIG-SPEC §5, no-action first", () => {
    expect([...APP_SLIDE_ROUTES]).toEqual([
      "",
      "/menu",
      "/magaza",
      "/kart",
      "/hesabim",
      "/kampanyalar",
      "/karaoke",
      "/canli-durum",
      "/oduller",
      "/davet",
      "/ziyaret",
      "/hikaye",
    ]);
  });

  it("labels every key in Turkish, with no label left over", () => {
    expect(Object.keys(APP_SLIDE_ROUTE_LABELS).sort()).toEqual(
      [...APP_SLIDE_ROUTES].sort(),
    );
    expect(APP_SLIDE_ROUTE_LABELS).toMatchObject({
      "": "Yok (tıklanamaz)",
      "/menu": "Menü",
      "/magaza": "Mağaza",
      "/kart": "Üyelik kartı",
      "/hesabim": "Profil",
      "/kampanyalar": "Kampanyalar",
      "/karaoke": "Karaoke",
      "/canli-durum": "Canlı durum",
      "/oduller": "Ödüller",
      "/davet": "Davet",
      "/ziyaret": "Ziyaret",
      "/hikaye": "Hikâye",
    });
    for (const label of Object.values(APP_SLIDE_ROUTE_LABELS)) {
      expect(label.trim().length).toBeGreaterThan(0);
    }
  });

  it("fails closed on anything outside the list", () => {
    expect(isAppSlideRoute("/karaoke")).toBe(true);
    expect(isAppSlideRoute("")).toBe(true);
    // Trailing slash, app-internal path, URL, scheme: none may pass, because
    // the store keeps exactly what this guard accepts.
    expect(isAppSlideRoute("/menu/")).toBe(false);
    expect(isAppSlideRoute("/(tabs)/menu")).toBe(false);
    expect(isAppSlideRoute("/uyelik-karti")).toBe(false);
    expect(isAppSlideRoute("https://laffogato.net/menu")).toBe(false);
    expect(isAppSlideRoute("javascript:alert(1)")).toBe(false);
  });
});

describe("APP_SLIDE_TONES", () => {
  it("labels each of the four grounds", () => {
    expect(APP_SLIDE_TONES).toEqual(["premium", "inverse", "brand", "paper"]);
    expect(Object.keys(APP_SLIDE_TONE_LABELS).sort()).toEqual(
      [...APP_SLIDE_TONES].sort(),
    );
  });
});
