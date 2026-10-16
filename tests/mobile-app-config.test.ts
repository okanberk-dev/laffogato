import { describe, expect, it } from "vitest";

import {
  compareSemver,
  DEFAULT_MOBILE_APP_CONFIG,
  mergeMobileAppConfig,
  normalizeMobileAppConfig,
  reminderCopyIssue,
  toBootstrapApp,
  type MobileAppConfig,
} from "@/lib/mobile/app-config";

describe("DEFAULT_MOBILE_APP_CONFIG", () => {
  it("carries the contract defaults (APP-CONFIG-SPEC §2)", () => {
    expect(DEFAULT_MOBILE_APP_CONFIG).toMatchObject({
      minSupportedAppVersion: "1.0.0",
      maintenance: { enabled: false, title: "Kısa bir mola" },
      ordering: {
        cafeEnabled: true,
        deliveryEnabled: true,
        pickupEnabled: true,
        courierEtaMinutes: [25, 35],
      },
      loyalty: {
        stampTarget: 6,
        rewardTitle: "Ücretsiz içecek",
        rewardValueMinor: 28000,
        rewardTtlDays: 90,
      },
      karaoke: {
        firstHour: 12,
        closeHour: 24,
        maxHours: 4,
        bookingWindowDays: 60,
        oroDiscountPct: 15,
      },
      campaignCards: { loyalty: true, invite: true, subscription: true },
      venue: { shortName: "Tuzla · İstanbul" },
    });
    expect(DEFAULT_MOBILE_APP_CONFIG.reminders.items.map((i) => i.id)).toEqual([
      "morning",
      "afternoon",
    ]);
  });

  it("is frozen, and its own reminder copy passes the copy rule", () => {
    expect(Object.isFrozen(DEFAULT_MOBILE_APP_CONFIG)).toBe(true);
    expect(Object.isFrozen(DEFAULT_MOBILE_APP_CONFIG.ordering)).toBe(true);
    expect(
      Object.isFrozen(DEFAULT_MOBILE_APP_CONFIG.ordering.courierEtaMinutes),
    ).toBe(true);
    for (const it of DEFAULT_MOBILE_APP_CONFIG.reminders.items) {
      expect(reminderCopyIssue(it.title)).toBeNull();
      expect(reminderCopyIssue(it.body)).toBeNull();
    }
  });
});

describe("normalizeMobileAppConfig", () => {
  it("turns nothing at all into the full default document", () => {
    for (const raw of [undefined, null, {}, "", 7, [], "{}"]) {
      expect(normalizeMobileAppConfig(raw)).toEqual(DEFAULT_MOBILE_APP_CONFIG);
    }
  });

  it("hands out fresh objects - mutating the result must not touch the defaults", () => {
    const cfg = normalizeMobileAppConfig({});
    expect(cfg).not.toBe(DEFAULT_MOBILE_APP_CONFIG);
    cfg.ordering.courierEtaMinutes[0] = 99;
    cfg.reminders.items.pop();
    expect(DEFAULT_MOBILE_APP_CONFIG.ordering.courierEtaMinutes).toEqual([
      25, 35,
    ]);
    expect(DEFAULT_MOBILE_APP_CONFIG.reminders.items).toHaveLength(2);
  });

  it("keeps valid values and lets each broken leaf fall back on its own", () => {
    const cfg = normalizeMobileAppConfig({
      minSupportedAppVersion: "2.1.0",
      maintenance: { enabled: true, title: "", message: "Bakım." },
      ordering: {
        cafeEnabled: false,
        deliveryEnabled: "yes",
        courierEtaMinutes: [40, 20],
        closedMessage: "x".repeat(201),
      },
      loyalty: { stampTarget: 8, rewardValueMinor: 12.5, rewardTtlDays: 400 },
      venue: { shortName: "  Tuzla  " },
    });
    expect(cfg.minSupportedAppVersion).toBe("2.1.0");
    // The valid leaves of a section survive a broken sibling.
    expect(cfg.maintenance).toEqual({
      enabled: true,
      title: "Kısa bir mola",
      message: "Bakım.",
    });
    expect(cfg.ordering).toEqual({
      cafeEnabled: false,
      deliveryEnabled: true,
      pickupEnabled: true,
      // Absent from the stored row (written before table orders): the default.
      tableEnabled: true,
      courierEtaMinutes: [25, 35],
      closedMessage: DEFAULT_MOBILE_APP_CONFIG.ordering.closedMessage,
    });
    expect(cfg.loyalty).toEqual({
      stampTarget: 8,
      rewardTitle: "Ücretsiz içecek",
      rewardValueMinor: 28000,
      rewardTtlDays: 90,
    });
    expect(cfg.venue.shortName).toBe("Tuzla");
    // Untouched sections are the defaults.
    expect(cfg.karaoke).toEqual(DEFAULT_MOBILE_APP_CONFIG.karaoke);
    expect(cfg.campaignCards).toEqual(DEFAULT_MOBILE_APP_CONFIG.campaignCards);
  });

  it("does not let a corrupt section poison the others", () => {
    const cfg = normalizeMobileAppConfig({
      maintenance: "down",
      ordering: null,
      loyalty: 4,
      karaoke: { firstHour: 20, closeHour: 18 },
      campaignCards: { invite: false },
    });
    expect(cfg.maintenance).toEqual(DEFAULT_MOBILE_APP_CONFIG.maintenance);
    expect(cfg.ordering).toEqual(DEFAULT_MOBILE_APP_CONFIG.ordering);
    expect(cfg.loyalty).toEqual(DEFAULT_MOBILE_APP_CONFIG.loyalty);
    expect(cfg.campaignCards).toEqual({
      loyalty: true,
      invite: false,
      subscription: true,
    });
    // closeHour must be after firstHour: the close falls back, the first hour stays.
    expect(cfg.karaoke).toMatchObject({ firstHour: 20, closeHour: 24 });
  });

  it("rejects a non-semver minimum version", () => {
    expect(
      normalizeMobileAppConfig({ minSupportedAppVersion: "v2" })
        .minSupportedAppVersion,
    ).toBe("1.0.0");
    expect(
      normalizeMobileAppConfig({ minSupportedAppVersion: " 1.4.2 " })
        .minSupportedAppVersion,
    ).toBe("1.4.2");
  });

  it("drops broken, duplicate, salesy or surplus reminder items and keeps the rest", () => {
    const good = (id: string) => ({
      id,
      hour: 9,
      minute: 15,
      title: "Merhaba",
      body: "Köşkte bir kahve?",
    });
    const cfg = normalizeMobileAppConfig({
      reminders: {
        enabled: false,
        items: [
          good("a"),
          { ...good("Bad Id"), hour: 9 },
          { ...good("b"), hour: 24 },
          good("a"),
          { ...good("c"), body: "Bugün %20 indirim!" },
          { ...good("d"), title: "Son şans" },
          good("e"),
          good("f"),
          good("g"),
          good("h"),
        ],
      },
    });
    expect(cfg.reminders.enabled).toBe(false);
    expect(cfg.reminders.items.map((i) => i.id)).toEqual(["a", "e", "f", "g"]);
  });

  it("falls back to the default reminder list only when items is not a list", () => {
    expect(
      normalizeMobileAppConfig({ reminders: { items: "none" } }).reminders
        .items,
    ).toEqual(DEFAULT_MOBILE_APP_CONFIG.reminders.items);
    expect(
      normalizeMobileAppConfig({ reminders: { items: [] } }).reminders.items,
    ).toEqual([]);
  });
});

describe("reminderCopyIssue", () => {
  it("flags price, discount and urgency language", () => {
    for (const bad of [
      "Bugün 120₺",
      "%15 kazan",
      "İndirim var",
      "indirimli kahve",
      "SON gün",
      "Kaçırma!",
      "Kaçırmayın",
      "Hemen gel",
    ]) {
      expect(reminderCopyIssue(bad), bad).not.toBeNull();
    }
  });

  it("does not flag ordinary words that merely contain a forbidden one", () => {
    for (const ok of [
      "Sezon açıldı",
      "Sonra görüşürüz",
      "Bir affogato tam şimdi.",
      "Günaydın ☕",
    ]) {
      expect(reminderCopyIssue(ok), ok).toBeNull();
    }
  });
});

describe("mergeMobileAppConfig", () => {
  it("replaces only the sections in the patch and normalises the result", () => {
    const current: MobileAppConfig = normalizeMobileAppConfig({
      loyalty: { stampTarget: 9 },
      venue: { landmark: "Postane karşısı" },
    });
    const merged = mergeMobileAppConfig(current, {
      ordering: {
        ...current.ordering,
        cafeEnabled: false,
        courierEtaMinutes: [30, 999],
      },
      maintenance: undefined,
    });
    expect(merged.ordering.cafeEnabled).toBe(false);
    // Out-of-range patch values are normalised away, not persisted.
    expect(merged.ordering.courierEtaMinutes).toEqual([25, 35]);
    expect(merged.loyalty.stampTarget).toBe(9);
    expect(merged.venue.landmark).toBe("Postane karşısı");
    expect(merged.maintenance).toEqual(current.maintenance);
    expect(current.ordering.cafeEnabled).toBe(true);
  });
});

describe("toBootstrapApp", () => {
  it("publishes the app-facing part and keeps karaoke, venue and coupon economics back", () => {
    const app = toBootstrapApp(DEFAULT_MOBILE_APP_CONFIG, true);
    expect(Object.keys(app).sort()).toEqual(
      [
        "minSupportedAppVersion",
        "maintenance",
        "ordering",
        "loyalty",
        "reminders",
        "campaignCards",
        "store",
        // Karar 177: fA'L's AI switch, from the environment - off by default.
        "fal",
      ].sort(),
    );
    expect(app.fal).toEqual({ ai: false });
    expect(toBootstrapApp(DEFAULT_MOBILE_APP_CONFIG, true, true).fal).toEqual({ ai: true });
    // Only the listing URLs cross the wire. The signing identifiers are the
    // website's own business - it publishes the two `.well-known` documents,
    // and the app can do nothing with its own fingerprint.
    expect(app.store).toEqual({ appStoreUrl: "", playStoreUrl: "" });
    expect(app.store).not.toHaveProperty("appleTeamId");
    expect(app.store).not.toHaveProperty("androidSha256");
    expect(app.loyalty).toEqual({
      stampTarget: 6,
      rewardTitle: "Ücretsiz içecek",
      stampMinOrderMinor: 14000,
    });
    expect(app).not.toHaveProperty("karaoke");
    expect(app).not.toHaveProperty("venue");
    // Copies, never the frozen defaults themselves.
    expect(app.ordering.courierEtaMinutes).not.toBe(
      DEFAULT_MOBILE_APP_CONFIG.ordering.courierEtaMinutes,
    );
    expect(app.reminders.items[0]).not.toBe(
      DEFAULT_MOBILE_APP_CONFIG.reminders.items[0],
    );
  });
});

describe("compareSemver", () => {
  it("compares numerically, part by part", () => {
    expect(compareSemver("1.0.0", "1.0.0")).toBe(0);
    expect(compareSemver("1.2.0", "1.10.0")).toBe(-1);
    expect(compareSemver("2.0.0", "1.99.99")).toBe(1);
    expect(compareSemver("1.2", "1.2.0")).toBe(0);
    expect(compareSemver("1.0.1", "1.0")).toBe(1);
  });
});

describe("mutlu saatler", () => {
  /**
   * The section exists so the campaign is the operator's to run from the
   * panel; the switch exists because nothing prices the discount. Both halves
   * are asserted here: off by default, and published only when turned on.
   */
  it("is off until an operator turns it on", () => {
    expect(DEFAULT_MOBILE_APP_CONFIG.happyHour.enabled).toBe(false);
    expect(normalizeMobileAppConfig({}).happyHour).toEqual({
      enabled: false,
      days: "weekday",
      from: "14:00",
      to: "17:00",
      pct: 25,
    });
  });

  it("keeps what an operator typed", () => {
    const c = normalizeMobileAppConfig({
      happyHour: {
        enabled: true,
        days: "everyday",
        from: "09:00",
        to: "11:00",
        pct: 50,
      },
    });
    expect(c.happyHour).toEqual({
      enabled: true,
      days: "everyday",
      from: "09:00",
      to: "11:00",
      pct: 50,
    });
  });

  it("falls back rather than publishing a broken clock or a wild percent", () => {
    const c = normalizeMobileAppConfig({
      happyHour: {
        enabled: true,
        days: "pazartesi",
        from: "25:00",
        to: "17:60",
        pct: 900,
      },
    });
    expect(c.happyHour).toEqual({
      enabled: true,
      days: "weekday",
      from: "14:00",
      to: "17:00",
      pct: 25,
    });
  });
});
