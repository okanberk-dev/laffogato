import { describe, expect, it } from "vitest";

import type { AdminSettings } from "@/lib/admin/store";
import {
  DEFAULT_MOBILE_APP_CONFIG,
  normalizeMobileAppConfig,
} from "@/lib/mobile/app-config";
import { buildBootstrap, weeklyHoursRows } from "@/lib/mobile/menu-mapper";
import { buildSlots, quoteReservation } from "@/lib/mobile/karaoke-core";

/**
 * The lafmobil app ships through the app stores. Anything it needs to be able
 * to change has to reach it from the server, or the change costs a release and
 * a review — and old installs keep the stale value until people update.
 *
 * These tests pin that property for the values an operator actually turns:
 * they change a setting and assert the app-facing payload moves with it. A
 * refactor that quietly hardcodes one of them (a constant "her gün 09:00",
 * a fixed courier fee, a baked-in karaoke price) fails here.
 *
 * They are NOT a copy of the wire-shape assertions in mobile-menu-mapper —
 * those check the shape is right, these check the values are the operator's.
 */

const SITE = {
  name: "L'Affogato",
  phone: "+90 536 429 09 19",
  email: "info@nextgenlab.com.tr",
  address: {
    streetAddress: "Postane Mah. Atatürk Cad. No: 28 İç Kapı No: 1",
    addressLocality: "Tuzla",
    addressRegion: "İstanbul",
    postalCode: "34940",
  },
  geo: { latitude: 40.8165716, longitude: 29.3032493 },
};

type BootstrapSettings = Pick<
  AdminSettings,
  | "phone"
  | "email"
  | "address"
  | "weeklyHours"
  | "courierFeeMinor"
  | "mobileApp"
>;

function everyDay(open: string, close: string) {
  const row = { open, close, closed: false };
  return {
    mon: { ...row },
    tue: { ...row },
    wed: { ...row },
    thu: { ...row },
    fri: { ...row },
    sat: { ...row },
    sun: { ...row },
  } as AdminSettings["weeklyHours"];
}

function settings(over: Partial<BootstrapSettings> = {}): BootstrapSettings {
  return {
    phone: "",
    email: "",
    address: "",
    weeklyHours: everyDay("09:00", "01:00"),
    courierFeeMinor: 5500,
    mobileApp: normalizeMobileAppConfig(undefined),
    ...over,
  };
}

/** A Wednesday, so "today" is stable regardless of when the suite runs. */
const NOW = new Date("2026-09-09T12:00:00.000Z");

describe("what an operator edits reaches the app without a release", () => {
  it("carries the contact details from settings, not from the bundle", () => {
    const b = buildBootstrap(
      settings({
        phone: "+90 555 000 00 00",
        email: "merhaba@laffogato.net",
        address: "Yeni Mah. Deneme Cad. No: 1",
      }),
      SITE,
      NOW,
    );
    expect(b.venue.phone).toBe("+90 555 000 00 00");
    expect(b.venue.email).toBe("merhaba@laffogato.net");
    expect(b.venue.addressLines[0]).toBe("Yeni Mah. Deneme Cad. No: 1");
  });

  it("falls back to the tax-certificate details only when a field is blanked", () => {
    const b = buildBootstrap(settings(), SITE, NOW);
    expect(b.venue.phone).toBe(SITE.phone);
    expect(b.venue.email).toBe(SITE.email);
    expect(b.venue.addressLines[0]).toBe(SITE.address.streetAddress);
  });

  it("moves the opening hours, the label and today's row together", () => {
    const b = buildBootstrap(
      settings({ weeklyHours: everyDay("08:00", "23:00") }),
      SITE,
      NOW,
    );
    expect(b.hoursLabel).toBe("Her gün 08:00 - 23:00");
    expect(b.venue.opensAt).toBe("08:00");
    expect(b.venue.closesAt).toBe("23:00");
    expect(b.venue.hours).toHaveLength(7);
    expect(b.venue.hours.every((h) => h.value === "08:00 - 23:00")).toBe(true);
  });

  it("shows a closed day as closed rather than as hours", () => {
    const weekly = everyDay("09:00", "01:00");
    weekly.mon = { open: "09:00", close: "01:00", closed: true };
    expect(weeklyHoursRows(weekly)[0]).toEqual({
      label: "Pazartesi",
      value: "Kapalı",
    });
  });

  it("carries the courier fee from settings", () => {
    const b = buildBootstrap(settings({ courierFeeMinor: 7500 }), SITE, NOW);
    expect(b.courierFeeMinor).toBe(7500);
  });

  it("carries the minimum supported app version an operator sets", () => {
    // The value that decides whether an install is forced to update. If this
    // ever stopped being operator-editable, unlocking a stuck fleet would
    // itself need a release.
    const mobileApp = normalizeMobileAppConfig({
      ...DEFAULT_MOBILE_APP_CONFIG,
      minSupportedAppVersion: "2.4.1",
    });
    const b = buildBootstrap(settings({ mobileApp }), SITE, NOW);
    expect(b.minSupportedAppVersion).toBe("2.4.1");
    expect(b.app.minSupportedAppVersion).toBe("2.4.1");
  });

  it("carries the fulfilment switches, so a channel can be closed remotely", () => {
    const mobileApp = normalizeMobileAppConfig({
      ...DEFAULT_MOBILE_APP_CONFIG,
      ordering: {
        ...DEFAULT_MOBILE_APP_CONFIG.ordering,
        deliveryEnabled: false,
        cafeEnabled: false,
      },
    });
    const b = buildBootstrap(settings({ mobileApp }), SITE, NOW);
    expect(b.app.ordering.deliveryEnabled).toBe(false);
    expect(b.app.ordering.cafeEnabled).toBe(false);
    // Pickup is untouched: closing one channel must not close the others.
    expect(b.app.ordering.pickupEnabled).toBe(true);
  });
});

describe("karaoke rules are the operator's, on both surfaces", () => {
  // The web /karaoke page and POST /api/mobile/v1/karaoke/reservations both
  // call the same helpers with the same rules document, so an operator who
  // moves the closing hour moves it for the phone and the site at once.
  it("builds the slot grid from the configured opening window", () => {
    const rules = {
      ...DEFAULT_KARAOKE_RULES_SHAPE,
      firstHour: 14,
      closeHour: 18,
    };
    const slots = buildSlots([], undefined, rules);
    expect(slots.map((s) => s.startHour)).toEqual([14, 15, 16, 17]);
  });

  it("prices from the configured hourly rate and ORO percentage", () => {
    // 2 hours at ₺450 = ₺900, less 20% for an ORO member.
    expect(quoteReservation(2, 45000, "oro", 20)).toEqual({
      priceMinor: 90000,
      discountMinor: 18000,
      totalMinor: 72000,
    });
    // A VERDE member pays the undiscounted price for the same block.
    expect(quoteReservation(2, 45000, "verde", 20).totalMinor).toBe(90000);
  });
});

/** The karaoke rules block, spread so a test can vary one field. */
const DEFAULT_KARAOKE_RULES_SHAPE = DEFAULT_MOBILE_APP_CONFIG.karaoke;
