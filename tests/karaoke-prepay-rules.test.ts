import { readFileSync } from "node:fs";

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

/**
 * The pure rules of karaoke prepayment (16 Eki 2026): the clock, the exact
 * wording the operator asked for, the deep links, and what the booking page
 * and the reservation page render. The money paths themselves are
 * tests/db-integration-karaoke-prepay.test.ts.
 */

vi.mock("@/app/karaoke/actions", () => ({ bookKaraokeAction: vi.fn() }));

const time = await import("@/lib/mobile/karaoke-time");
const { appKaraokeDeepLink, appOrderDeepLink } =
  await import("@/lib/mobile/deep-link");
const { isKaraokeRef } = await import("@/lib/mobile/karaoke-ref");
const { karaokeExpiredNotice } =
  await import("@/lib/mobile/karaoke-bridge-copy");
const { DIRECT_FORM_MAX_AGE_MS } = await import("@/lib/payment/paynkolay");
const { KaraokeReservationView } =
  await import("@/components/uye/karaoke-reservation-view");
const { KaraokeBooking } =
  await import("@/components/laffogato/karaoke-booking");
const { KARAOKE_RESULT_NOTICES } = await import("@/lib/mobile/karaoke-notices");

const REFUND =
  "Rezervasyon saatine 2 saatten fazla varken iptal edersen ödediğin tutarın tamamı kartına iade edilir.";
const NO_REFUND =
  "Rezervasyon saatine 2 saatten az kala yapılan iptallerde ve rezervasyona gelinmediğinde ücret iadesi yapılmaz.";

const read = (p: string) => readFileSync(p, "utf8");

describe("the two-hour rule, on the köşk's clock", () => {
  const r = { date: "2026-10-30", startHour: 20, hours: 2 };
  const start = Date.parse("2026-10-30T17:00:00.000Z"); // 20:00 in Tuzla

  it("starts at the Tuzla hour, whatever the server's zone", () => {
    expect(time.karaokeStartInstant(r.date, r.startHour).getTime()).toBe(start);
    expect(time.karaokeEndInstant({ ...r, startHour: 22 }).toISOString()).toBe(
      "2026-10-30T21:00:00.000Z", // 24:00 Tuzla
    );
  });

  it("is MORE than two hours: at exactly two the window has closed", () => {
    expect(time.withinFreeCancel(r, new Date(start - 2 * 3600_000 - 1))).toBe(
      true,
    );
    expect(time.withinFreeCancel(r, new Date(start - 2 * 3600_000))).toBe(
      false,
    );
    expect(time.withinFreeCancel(r, new Date(start - 3600_000))).toBe(false);
  });

  it("a payment page never outlives its hold", () => {
    expect(time.KARAOKE_PAYMENT_PAGE_MINUTES * 60_000).toBe(
      DIRECT_FORM_MAX_AGE_MS,
    );
  });
});

describe("the operator's exact wording (16 Eki 2026)", () => {
  it("is the constant every surface prints", () => {
    expect(time.KARAOKE_REFUND_RULE).toBe(REFUND);
    expect(time.KARAOKE_NO_REFUND_RULE).toBe(NO_REFUND);
    expect(time.KARAOKE_TOO_LATE_MESSAGE).toContain(NO_REFUND);
    expect(KARAOKE_RESULT_NOTICES["gec-iptal"]!.text).toContain(NO_REFUND);
  });

  it("is in both halves of the confirmation e-mail, verbatim", () => {
    // The mail prints the booking's own two sentences (18 Eki 2026); a
    // booking made under the default rule gets exactly these.
    for (const file of [
      "src/lib/email/templates/karaoke-rezervasyon.html",
      "src/lib/email/text.ts",
    ]) {
      const src = read(file);
      expect(src, file).toContain("[KARAOKE_IADE_KURALI]");
      expect(src, file).toContain("[KARAOKE_GEC_KURALI]");
    }
    expect(time.karaokeRulesOf({})).toEqual([REFUND, NO_REFUND]);
  });

  it("is printed by the booking form, the reservation page and the late-cancel API", () => {
    for (const file of [
      "src/components/laffogato/karaoke-booking.tsx",
      "src/components/uye/karaoke-reservation-view.tsx",
    ]) {
      const src = read(file);
      expect(src, file).toContain("KARAOKE_REFUND_RULE");
      expect(src, file).toContain("KARAOKE_NO_REFUND_RULE");
    }
    expect(
      read("src/app/api/mobile/v1/karaoke/reservations/[id]/cancel/route.ts"),
    ).toContain("KARAOKE_TOO_LATE_MESSAGE");
  });

  it("no long dash slips into the new copy (U+2014, U+2013)", () => {
    for (const file of [
      "src/lib/mobile/karaoke-time.ts",
      "src/lib/mobile/karaoke-notices.ts",
      "src/lib/mobile/karaoke-bridge-copy.ts",
      "src/lib/legal/content-karaoke.ts",
      "src/components/uye/karaoke-reservation-view.tsx",
      "src/components/laffogato/karaoke-booking.tsx",
      "src/app/rezervasyon/page.tsx",
      "src/app/api/mobile/v1/karaoke/reservations/[id]/cancel/route.ts",
    ]) {
      expect(read(file), file).not.toMatch(/[–—]/);
    }
  });
});

describe("deep links and the card page", () => {
  it("a karaoke reference never opens the app's order screen", () => {
    expect(isKaraokeRef("krk-00042")).toBe(true);
    expect(isKaraokeRef("ord-0042")).toBe(false);
    expect(isKaraokeRef("krk-00042/../x")).toBe(false);
    expect(appOrderDeepLink("krk-00042", "success")).toBe("laffogato://");
    expect(appKaraokeDeepLink("krk-00042", "success")).toBe(
      "laffogato://karaoke?status=success&ref=krk-00042",
    );
    expect(appKaraokeDeepLink("javascript:x", "failed")).toBe(
      "laffogato://karaoke",
    );
  });

  it("the expired card page speaks of the booking, not a basket", () => {
    expect(karaokeExpiredNotice("ord-1", false)).toBeNull();
    const web = karaokeExpiredNotice("krk-00042", false)!;
    expect(web.link.href).toBe("/karaoke");
    expect(web.body).not.toContain("Sepet");
    expect(web.body).toContain("kartından para çekilmedi");
    expect(karaokeExpiredNotice("krk-00042", true)!.link.href).toBe(
      "laffogato://karaoke?status=failed&ref=krk-00042",
    );
  });

  it("the card route's change is one call into a module with no store (rule 28)", () => {
    const route = read("src/app/odeme/paynkolay/route.ts");
    expect(route).toContain("karaokeExpiredNotice(post.fields.clientRefCode");
    const copy = read("src/lib/mobile/karaoke-bridge-copy.ts");
    expect(copy).not.toMatch(/@\/lib\/(db|admin|customer)/);
    expect(read("src/lib/mobile/karaoke-ref.ts")).not.toMatch(/^import /m);
  });
});

describe("the reservation page (profile and signed link)", () => {
  const BASE = {
    id: "krk-00042",
    date: "2026-10-30",
    startHour: 20,
    hours: 2,
    guests: 4,
    status: "confirmed" as "requested" | "confirmed" | "cancelled",
    paymentStatus: "paid",
    priceMinor: 200_000,
    discountMinor: 0,
    totalMinor: 200_000,
    paidMinor: 200_000,
    createdAt: "2026-10-16T10:00:00.000Z",
    customerName: "Eda",
  };
  const early = new Date("2026-10-30T10:00:00.000Z");
  const late = new Date("2026-10-30T15:30:00.000Z"); // 18:30 Tuzla
  const render = (
    over: Partial<typeof BASE> = {},
    now = early,
    confirming = false,
  ) =>
    renderToStaticMarkup(
      createElement(KaraokeReservationView, {
        r: { ...BASE, ...over },
        now,
        hidden: { id: "krk-00042" },
        cancelAction: async () => {},
        payAction: async () => {},
        cancelHref: "/x?iptal=1",
        backHref: "/x",
        confirming,
      }),
    );

  it("shows the rule and only a quiet text link at the bottom - no cancel button", () => {
    const html = render();
    expect(html).toContain(REFUND);
    expect(html).toContain(NO_REFUND);
    expect(html).toMatch(
      /<a[^>]*class="karaoke-mine-cancel"[^>]*>Rezervasyonu iptal et<\/a>/,
    );
    expect(html).not.toContain("Evet, iptal et");
    expect(html.lastIndexOf("karaoke-mine-cancel")).toBeGreaterThan(
      html.indexOf("karaoke-mine-rules"),
    );
  });

  it("the step says the money comes back, then asks for the final confirm", () => {
    const html = render({}, early, true);
    expect(html).toContain("Şimdi iptal edersen ödediğin");
    expect(html).toContain('name="confirm" value="yes"');
    expect(html).toContain("Evet, iptal et");
    expect(html).toContain("Vazgeç, rezervasyonum kalsın");
  });

  it("inside two hours the step says no refund and offers no confirm", () => {
    const html = render({}, late, true);
    expect(html).toContain(NO_REFUND);
    expect(html).not.toContain("Evet, iptal et");
  });

  it("a cancelled booking has nothing to cancel; an unpaid hold can still be paid", () => {
    expect(
      render({ status: "cancelled", paymentStatus: "refunded" }),
    ).not.toContain("Rezervasyonu iptal et");
    const pending = render(
      {
        status: "requested",
        paymentStatus: "pending",
        createdAt: new Date().toISOString(),
      },
      new Date(),
    );
    expect(pending).toContain("Ödemeyi tamamla");
  });
});

describe("the booking form", () => {
  const props = {
    days: ["2026-10-30", "2026-10-31"],
    date: "2026-10-30",
    availability: {
      date: "2026-10-30",
      slots: [
        { startHour: 20, available: true },
        { startHour: 21, available: true },
      ],
      hourlyMinor: 100_000,
      capacity: 8,
      oroDiscountPct: 15,
      firstHour: 12,
      closeHour: 24,
      maxHours: 4,
      bookingWindowDays: 60,
      paymentRequired: true,
      freeCancelHours: 2,
      lateRefundPercent: 0,
      consentDocs: ["karaoke-odasi-rezervasyon"],
      privacyDoc: "kvkk-aydinlatma-metni",
      cancellationRules: [REFUND, NO_REFUND],
      taxRatePct: 20,
    },
    unavailable: false,
    capacity: 8,
    hourlyMinor: 100_000,
    closeHour: 24,
    tier: null,
    tierLabel: null,
    isAuthenticated: false,
    emailVerified: false,
    phone: "+90 536 429 09 19",
    address: "Postane Mah. Atatürk Cad. No: 28, Tuzla",
    prepay: true,
  };
  const render = (over: Record<string, unknown> = {}) =>
    renderToStaticMarkup(createElement(KaraokeBooking, { ...props, ...over }));

  it("lets a guest book: name, surname, phone, e-mail - no login wall", () => {
    const html = render();
    for (const name of [
      "guestFirstName",
      "guestLastName",
      "contactPhone",
      "contactEmail",
    ]) {
      expect(html).toContain(`name="${name}"`);
    }
    expect(html).not.toContain("Giriş yap ve rezerve et");
  });

  it("puts the pre-payment box above three separate, unticked boxes and the pay button", () => {
    const html = render();
    const box = html.indexOf(">Ödemeden önce</h2>");
    const boxes = ["consentPreInfo", "consentContract", "consentKvkk"].map(
      (n) => html.indexOf(`name="${n}"`),
    );
    const pay = html.indexOf("Rezervasyonu onayla ve");
    expect(box).toBeGreaterThan(-1);
    for (const at of boxes) {
      expect(at).toBeGreaterThan(box);
      expect(at).toBeLessThan(pay);
    }
    expect(html).not.toMatch(/name="consent\w+"[^>]*checked=""/);
    expect(html).toContain("cayma hakkı yoktur (MSY m.15/1-g)");
    expect(html).toContain(REFUND);
    expect(html).toContain(NO_REFUND);
    expect(html).toContain("KDV dahil");
    expect(html).toContain("ödeme yükümlülüğü altına girersin");
    expect(html).toContain("Ön Bilgilendirme Formu");
    expect(html).toContain("Mesafeli Hizmet Sözleşmesi");
    expect(html).toContain("Aydınlatma Metni");
  });

  it("prints the two rules once, and keeps the seller in sight outside Ayrıntılar", () => {
    const html = render();
    // The summary card used to repeat both sentences right above the box.
    expect(html.split(REFUND)).toHaveLength(2);
    expect(html.split(NO_REFUND)).toHaveLength(2);
    const open = html.indexOf("<details");
    const close = html.indexOf("</details>");
    expect(open).toBeGreaterThan(html.indexOf(">Ödemeden önce</h2>"));
    expect(html.slice(open, close)).toContain("<summary>Ayrıntılar</summary>");
    // Payment and confirmation terms sit behind the disclosure; who sells
    // stays outside it (MSY m.5/1-c), above the boxes.
    expect(html.slice(open, close)).toContain("3D Secure");
    const seller = html.indexOf("Satıcı:");
    expect(seller).toBeGreaterThan(close);
    expect(html.slice(seller)).toContain(props.address);
    expect(seller).toBeLessThan(html.indexOf('name="consentPreInfo"'));
  });

  it("takes the room size from the setting and speaks sen throughout", () => {
    const html = render({ capacity: 6 });
    expect(html).toContain("6 kişilik oda");
    expect(html).toContain("En fazla 6 kişi");
    expect(html).not.toContain("sekiz");
    expect(html).not.toContain("arayın");
  });

  it("asks a visitor to sign in when prepayment is off (no guest request flow)", () => {
    const html = render({ prepay: false });
    expect(html).toContain("Giriş yap ve rezerve et");
    expect(html).not.toContain('name="guestFirstName"');
  });

  it("names the checkout section only by a heading that is there", () => {
    // Prepayment off: a verified member books, the box and its heading are
    // gone, so the section must not point at a missing id.
    const html = render({
      prepay: false,
      isAuthenticated: true,
      emailVerified: true,
    });
    expect(html).toContain('class="karaoke-checkout"');
    expect(html).not.toContain("karaoke-preinfo-title");
    const on = render();
    expect(on).toContain('aria-labelledby="karaoke-preinfo-title"');
    expect(on).toContain('id="karaoke-preinfo-title"');
  });
});
