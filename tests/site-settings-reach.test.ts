import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

/**
 * Ayarlar → Genel / Saatler reach every place the panel says they do
 * (admin audit SYS-04, SYS-M01): the footer on every page, the home page's
 * facts block, the visit page's buttons. And the footer names the company
 * behind the site with a link to its page; the visit page links to Google
 * Maps instead of framing it.
 */

vi.mock("server-only", () => ({}));
vi.mock("@/app/uye/actions", () => ({
  accountMenuStateAction: vi.fn(),
  logoutAction: vi.fn(),
}));
vi.mock("@/app/newsletter/actions", () => ({
  subscribeNewsletterAction: vi.fn(),
}));
vi.mock("next/navigation", () => ({
  usePathname: () => "/",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

import type { WeeklyHours } from "@/lib/admin/days";
import { Footer } from "@/components/laffogato/chrome";
import { SeoContent } from "@/components/laffogato/seo-content";
import {
  PageVisit,
  branchPending,
  untilTime,
} from "@/components/laffogato/visit-page";
import { LEGAL_ENTITY } from "@/lib/legal/entity";
import {
  footerSettings,
  hoursRowsFromLabel,
  venueContact,
} from "@/lib/seo/contact";

function week(
  over: Partial<WeeklyHours> = {},
  base = { open: "09:00", close: "02:00", closed: false },
): WeeklyHours {
  const days = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;
  return {
    ...(Object.fromEntries(days.map((d) => [d, { ...base }])) as WeeklyHours),
    ...over,
  };
}

const WINTER = week({}, { open: "10:00", close: "00:00", closed: false });
const MIXED = week({
  sat: { open: "10:00", close: "03:00", closed: false },
  sun: { open: "09:00", close: "02:00", closed: true },
});

function footerHtml(settings?: Parameters<typeof Footer>[0]["settings"]) {
  return renderToStaticMarkup(createElement(Footer, { settings }));
}

describe("venueContact / footerSettings", () => {
  it("falls back to the bundled phone and e-mail when a field is blank", () => {
    const c = venueContact({ phone: "  ", email: "", address: "" });
    expect(c.phone).toBe("+90 536 429 09 19");
    expect(c.phoneTel).toBe("+905364290919");
    expect(c.email).toBe(LEGAL_ENTITY.email);
    expect(c.addressLines[0]).toContain("Postane Mah.");
  });

  it("reads the hours from the panel, in the app's words", () => {
    expect(venueContact({ weeklyHours: WINTER }).hoursLabel).toBe(
      "Her gün 10:00 - 00:00",
    );
    expect(venueContact({ weeklyHours: WINTER }).hoursRows).toEqual([
      ["Her gün", "10:00 - 00:00"],
    ]);
    expect(venueContact({ weeklyHours: MIXED }).hoursRows).toEqual([
      ["Pzt-Cum", "09:00 - 02:00"],
      ["Cmt", "10:00 - 03:00"],
      ["Paz", "Kapalı"],
    ]);
  });

  it("splits a label back into rows without regrouping the week", () => {
    expect(hoursRowsFromLabel("Kapalı")).toEqual([["Her gün", "Kapalı"]]);
    expect(hoursRowsFromLabel("")).toEqual([["Her gün", "09:00 - 02:00"]]);
  });

  it("gives every footer the hours along with the contact fields", () => {
    expect(
      footerSettings({
        phone: "+90 216 000 00 00",
        email: "a@b.co",
        address: "X Sok. 1, 34940 Tuzla / İstanbul",
        weeklyHours: WINTER,
      }),
    ).toEqual({
      phone: "+90 216 000 00 00",
      email: "a@b.co",
      address: "X Sok. 1, 34940 Tuzla / İstanbul",
      hours: [["Her gün", "10:00 - 00:00"]],
    });
  });
});

describe("the footer", () => {
  it("shows the panel's hours, not a fixed 09:00 - 02:00", () => {
    const html = footerHtml(footerSettings({ weeklyHours: MIXED }));
    expect(html).toContain("Pzt-Cum");
    expect(html).toContain("10:00 - 03:00");
    expect(html).toContain("Kapalı");
    expect(footerHtml(footerSettings({ weeklyHours: WINTER }))).toContain(
      "10:00 - 00:00",
    );
    expect(footerHtml(footerSettings({ weeklyHours: WINTER }))).not.toContain(
      "09:00 - 02:00",
    );
  });

  it("never prints an empty tel: or mailto: for a cleared field", () => {
    const html = footerHtml({ phone: "", email: "", address: "" });
    expect(html).not.toMatch(/href="tel:"/);
    expect(html).not.toMatch(/href="mailto:"/);
    expect(html).toContain('href="tel:+905364290919"');
    expect(html).toContain(`href="mailto:${LEGAL_ENTITY.email}"`);
  });

  it("dials the bundled number when the panel's phone has no digits", () => {
    // Ayarlar takes any text up to 40 characters; "Yakında" left `tel:`
    // empty while the visit page and the facts block fell back.
    const html = footerHtml({ phone: "Yakında", email: "", address: "" });
    expect(html).not.toMatch(/href="tel:"/);
    expect(html).toContain('href="tel:+905364290919"');
    expect(html).toContain(">Yakında</a>");
  });

  it("names the company: title, MERSİS, seat, and the Şirket bilgileri page", () => {
    const html = footerHtml(footerSettings({}));
    expect(html).toContain(LEGAL_ENTITY.legalName);
    expect(html).toContain(LEGAL_ENTITY.mersisNo);
    expect(html).toContain(LEGAL_ENTITY.address.line1);
    expect(html).toContain("34940 Tuzla / İstanbul");
    expect(html).toContain('href="/hukuk/sirket-bilgileri"');
    // No KEP address yet: the row is left out rather than shown empty.
    expect(LEGAL_ENTITY.kep).toBe("");
    expect(html).not.toContain(">KEP<");
  });
});

describe("the home page's facts block", () => {
  it("prints the panel's phone, e-mail, address and hours", () => {
    const html = renderToStaticMarkup(
      createElement(SeoContent, {
        faq: [],
        contact: venueContact({
          phone: "+90 216 111 22 33",
          email: "kosk@example.com",
          address: "Yeni Sok. No: 5, 34940 Tuzla / İstanbul",
          weeklyHours: WINTER,
        }),
      }),
    );
    expect(html).toContain('href="tel:+902161112233"');
    expect(html).toContain("kosk@example.com");
    expect(html).toContain("Yeni Sok. No: 5");
    expect(html).toContain("Her gün: 10:00 - 00:00");
    expect(html).not.toContain("09:00 - 02:00");
  });
});

describe("the visit page", () => {
  const props = {
    navigate: vi.fn(),
    addToCart: vi.fn(),
    openProduct: vi.fn(),
    visit: {
      addressLines: ["Yeni Sok. No: 5", "34940 Tuzla / İstanbul"],
      phone: "+90 216 111 22 33",
      email: "kosk@example.com",
      todayHours: "10:00 - 00:00",
      hours: [
        ["Pazartesi", "10:00 - 00:00"],
        ["Salı", "10:00 - 00:00"],
      ] as [string, string][],
    },
  } as unknown as Parameters<typeof PageVisit>[0];
  const html = renderToStaticMarkup(createElement(PageVisit, props));

  it("links to Google Maps in a new tab and frames nothing", () => {
    expect(html).not.toContain("<iframe");
    expect(html).not.toContain("output=embed");
    expect(html).toMatch(
      /<a class="btn btn-primary" href="https:\/\/www\.google\.com\/maps\/search\/\?api=1&amp;query=[^"]+" target="_blank" rel="noopener noreferrer">Haritayı göster/,
    );
  });

  it("calls the panel's number and says its closing time", () => {
    expect(html).toContain('href="tel:+902161112233"');
    expect(html).not.toContain('href="tel:+905364290919"');
    expect(html).toContain("gece yarısına kadar");
    expect(html).not.toContain("02:00");
  });

  it("reads a closing time with the right dative", () => {
    expect(untilTime("02:00")).toBe("02:00'ye");
    expect(untilTime("01:00")).toBe("01:00'e");
    expect(untilTime("23:00")).toBe("23:00'e");
    expect(untilTime("20:00")).toBe("20:00'ye");
    expect(untilTime("00:30")).toBe("00:30'a");
    expect(untilTime("10:00")).toBe("10:00'a");
    expect(untilTime("00:00")).toBe("yarısına");
  });

  it("names the courier and its fee while the panel offers one", () => {
    expect(html).toContain("Tuzla içi kurye");
  });

  it("draws Marina's card at Tuzla Marina with its hours, a map and no phone yet", () => {
    const card = html.slice(html.indexOf('id="marina"'));
    const section = card.slice(0, card.indexOf("</section>"));
    expect(section).toContain("Tuzla Marina");
    expect(section).toContain("Tuzla / İstanbul");
    expect(section).toContain("10:00 - 23:00");
    expect(section).toContain("Haritada gör");
    expect(section).toContain("Telefonu çok yakında bu sayfada.");
    expect(section).not.toContain("Çalışma saatleri ve telefonu");
    expect(section).not.toContain("Adresi, çalışma saatleri");
    expect(section).not.toContain("tel:");
  });

  it("a branch card names only what still follows", () => {
    expect(branchPending("", null)).toBe(
      "Çalışma saatleri ve telefonu çok yakında bu sayfada.",
    );
    expect(branchPending("10:00 - 23:00", null)).toBe(
      "Telefonu çok yakında bu sayfada.",
    );
    expect(branchPending("", "+902160000000")).toBe(
      "Çalışma saatleri çok yakında bu sayfada.",
    );
  });
});

/**
 * Operator, 5 Kas 2026: "kahvelerde sadece gel al yap, ayrıca kurye
 * olmasın şimdilik". The switch is Mobil → Ayarlar → Kurye, the one
 * POST /orders enforces (`fulfillment_unavailable`); the site's own courier
 * lines follow it instead of promising what the checkout refuses.
 */
describe("the courier switch (Mobil → Ayarlar → Kurye)", () => {
  const visitHtml = (settings: Record<string, unknown>) =>
    renderToStaticMarkup(
      createElement(PageVisit, {
        navigate: vi.fn(),
        addToCart: vi.fn(),
        openProduct: vi.fn(),
        settings,
      } as unknown as Parameters<typeof PageVisit>[0]),
    );

  it("the visit page shows the pickup time in the courier's place while it is off", () => {
    const html = visitHtml({ courierEnabled: false, pickupReadyMinutes: 12 });
    expect(html).not.toMatch(/kurye/i);
    expect(html).toContain("12 dk");
    expect(html).toContain("uygulamadan gel-al");
  });

  it("the visit page keeps the courier when the switch is on", () => {
    const html = visitHtml({ courierEnabled: true, courierFeeMinor: 7500 });
    expect(html).toContain("Tuzla içi kurye");
    expect(html).not.toContain("uygulamadan gel-al");
  });

  it("the home page's order lines name the courier only while it runs", async () => {
    const { orderDoorSub } = await import("@/components/laffogato/home-page");
    // The app section's cards (home-app-intro.tsx since 6 Kas 2026).
    const { appBenefits } =
      await import("@/components/laffogato/home-app-intro");
    expect(appBenefits(6, false)[0].body).not.toContain("kurye");
    expect(appBenefits(6, false)[0].body).toContain("gel-al");
    expect(orderDoorSub(false, "55 ₺")).toBe("Uygulamadan sipariş ver");
    expect(appBenefits(6, true)[0].body).toContain("Tuzla içi kurye");
    expect(orderDoorSub(true, "55 ₺")).toBe(
      "Uygulamadan; Tuzla içi kurye 55 ₺",
    );
  });

  it("the pages read the switch POST /orders enforces", () => {
    const props = readFileSync("src/lib/seo/app-props.ts", "utf8");
    expect(props).toContain(
      "courierEnabled: settings.mobileApp.ordering.deliveryEnabled",
    );
  });
});

describe("no page builds its footer settings by hand", () => {
  function files(dir: string): string[] {
    return readdirSync(dir).flatMap((name) => {
      const p = join(dir, name);
      return statSync(p).isDirectory()
        ? files(p)
        : /\.tsx?$/.test(name)
          ? [p]
          : [];
    });
  }

  it("every page and layout passes footerSettings(settings)", () => {
    const offenders = files("src/app")
      .filter((f) => !f.startsWith(join("src", "app", "admin")))
      .filter((f) =>
        /settings=\{\{\s*phone: \w+\.phone,/.test(readFileSync(f, "utf8")),
      );
    expect(offenders).toEqual([]);
  });
});
