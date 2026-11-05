import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { AppStoreLinks } from "@/components/laffogato/app-links";
import { TableBanner } from "@/components/laffogato/table-banner";
import { LIVE_APP_STORE_URL } from "@/lib/mobile/app-store";

/**
 * /masa/<kod> after lafmobil 1.1.0 reached the App Store (5 Kas 2026): an
 * iPhone with the app opens the app (AASA `/masa/*`); whoever lands on the
 * page is told to order from the app, gets the live App Store button, and
 * still has the staff line. The site itself takes no cafe order.
 */
describe("table page banner", () => {
  it("names the table and sends the guest to the app", () => {
    const html = renderToStaticMarkup(
      createElement(TableBanner, { tableName: "Bahçe 3" }),
    );
    expect(html).toContain("Masa: Bahçe 3");
    expect(html).toContain("uygulamasından ver");
    // The app's own words for its scanner (lafmobil i18n/screens/table.ts).
    expect(html).toContain("Masadan sipariş ver");
    expect(html).toContain("görevliye");
    expect(html).toContain(`href="${LIVE_APP_STORE_URL}"`);
  });

  it("says nothing about ordering to a code that names no table", () => {
    const html = renderToStaticMarkup(
      createElement(TableBanner, { tableName: null }),
    );
    expect(html).toContain("siparişe açık değil");
    expect(html).not.toContain("uygulamasından ver");
  });
});

describe("store buttons", () => {
  it("shows the live App Store listing and an honest line for Android", () => {
    const html = renderToStaticMarkup(createElement(AppStoreLinks));
    expect(html).toContain(`href="${LIVE_APP_STORE_URL}"`);
    expect(html).toContain("Android uygulaması yakında");
    // No Play button while there is no Play listing.
    expect(html).not.toContain("play.google.com");
  });
});
