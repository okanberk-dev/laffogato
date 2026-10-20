import { describe, expect, it } from "vitest";

import { findLegalDoc } from "@/lib/legal/documents";
import {
  karaokeDurableCopyFilename,
  karaokeDurableCopyHtml,
  lateRefundLabel,
  orderDurableCopyFilename,
  orderDurableCopyHtml,
  type DurableCopyBooking,
  type DurableCopyDocument,
  type DurableCopyOrder,
} from "@/lib/legal/durable-copy";
import { LEGAL_ADDRESS_LINE, LEGAL_ENTITY } from "@/lib/legal/entity";
import { CHECKOUT_CONSENT_DOCS, KARAOKE_CONSENT_DOCS } from "@/lib/legal/meta";
import {
  codedVersionDoc,
  legalVersionOf,
  overrideVersionDoc,
} from "@/lib/legal/version-core";

/**
 * The confirmed contract as a file (decision ASK-DURABLE, 21 Ekim 2026):
 * self-contained HTML at 16 px, nothing fetched and nothing run, every value
 * escaped (the customer typed the name and the address), every amount the
 * stored order's, the karaoke deadline and late refund the booking's own.
 */

const HOSTILE_NAME = "<img src=x onerror=alert(1)>";
const HOSTILE_ADDRESS =
  'Bağdat Cad. 1</td></tr><script>alert("x")</script>\nKadıköy "İstanbul"';

function docs(slugs: readonly string[]): DurableCopyDocument[] {
  return slugs.map((slug) => {
    const v = legalVersionOf(codedVersionDoc(findLegalDoc(slug)!));
    return {
      doc: v.doc,
      hash: v.hash,
      url: `https://laffogato.net/hukuk/${slug}?surum=${v.hash.slice(0, 16)}`,
    };
  });
}

const ORDER: DurableCopyOrder = {
  orderNo: 10042,
  customerName: HOSTILE_NAME,
  shippingAddress: HOSTILE_ADDRESS,
  items: [
    {
      productName: 'Sirena "Espresso" <b>250 g</b>',
      qty: 3,
      // An odd stored price: the copy must print the stored arithmetic.
      unitPriceMinor: 33_333,
    },
    {
      productName: "Latte",
      detail: "Yulaf sütü",
      qty: 1,
      unitPriceMinor: 14_050,
    },
  ],
  subtotalMinor: 114_049,
  discountMinor: 10_000,
  promoCode: "<KOD>",
  shippingMinor: 4_900,
  totalMinor: 108_949,
  fulfillment: "shipping",
};

const CONSENT = {
  acceptedAt: "2026-10-21T11:05:30.000Z",
  version: "20 Ekim 2026",
};

const orderHtml = () =>
  orderDurableCopyHtml({
    order: ORDER,
    consent: CONSENT,
    docs: docs(CHECKOUT_CONSENT_DOCS),
  });

describe("the file is self-contained and safe to open", () => {
  const pages = () => [
    orderHtml(),
    karaokeDurableCopyHtml({
      reservation: booking(),
      consent: CONSENT,
      docs: docs(KARAOKE_CONSENT_DOCS),
    }),
  ];

  it("is one HTML document with its CSS inline, 16 px body text and a print layout", () => {
    for (const html of pages()) {
      expect(html.startsWith("<!DOCTYPE html>")).toBe(true);
      expect(html).toContain('<html lang="tr">');
      expect(html).toContain('<meta charset="utf-8">');
      expect(html).toMatch(/<style>[\s\S]*body\{[^}]*font-size:16px[^}]*\}/);
      expect(html).toContain("@media print");
      expect(html.match(/<style>/g)).toHaveLength(1);
    }
  });

  it("fetches nothing and runs nothing", () => {
    for (const html of pages()) {
      // No element that loads, links or runs anything...
      expect(html).not.toMatch(
        /<(script|img|iframe|object|embed|link|svg|video|audio|source|form|base|a)\b/i,
      );
      // ...and no tag carries an attribute that would (text is escaped, so
      // every real tag is a `<` the builder wrote).
      const tags = html.match(/<[a-zA-Z][^<>]*>/g) ?? [];
      expect(tags.length).toBeGreaterThan(20);
      for (const tag of tags) {
        expect(tag).not.toMatch(
          /\s(src|href|srcset|action|formaction|poster|data|background|style|on[a-z]+)\s*=/i,
        );
      }
      expect(html).not.toMatch(/url\(|@import|expression\(/i);
      // And says so to a browser that opens it.
      expect(html).toContain(
        `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'">`,
      );
    }
  });

  it("escapes every value the customer or the panel typed", () => {
    const html = orderHtml();
    expect(html).not.toContain("<img src=x");
    expect(html).toContain("&lt;img src=x onerror=alert(1)&gt;");
    // The address cannot close its cell and open a script.
    expect(html).not.toContain("</td></tr><script>");
    expect(html).toContain(
      "Bağdat Cad. 1&lt;/td&gt;&lt;/tr&gt;&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;",
    );
    expect(html).toContain("Sirena &quot;Espresso&quot; &lt;b&gt;250 g&lt;/b&gt;");
    expect(html).toContain("(&lt;KOD&gt;)");
  });

  it("escapes a panel override's Markdown too, keeping only bold", () => {
    const doc = findLegalDoc(CHECKOUT_CONSENT_DOCS[1])!;
    const v = legalVersionOf(
      overrideVersionDoc(doc, {
        title: "MSS <i>yeni</i>",
        summary: "",
        effectiveDate: "2 Kasım 2026",
        bodyMarkdown:
          "## 1. <script>alert(1)</script>\n\n**Kalın** ve <img src=x onerror=1>\n\n- madde <a href=\"https://kötü\">x</a>",
        isPublished: true,
        updatedAt: "",
      }),
    );
    const html = orderDurableCopyHtml({
      order: ORDER,
      consent: CONSENT,
      docs: [{ doc: v.doc, hash: v.hash, url: "https://laffogato.net/x" }],
    });
    expect(html).not.toMatch(/<(script|img|a)\b/);
    expect(html).toContain("<h2>1. &lt;script&gt;alert(1)&lt;/script&gt;</h2>");
    expect(html).toContain("<strong>Kalın</strong> ve &lt;img src=x onerror=1&gt;");
    expect(html).toContain("<h1>MSS &lt;i&gt;yeni&lt;/i&gt;</h1>");
  });
});

describe("the order's facts come from the stored order", () => {
  it("names the seller, the order, the moment of consent and the buyer", () => {
    const html = orderHtml();
    expect(html).toContain(LEGAL_ENTITY.legalName);
    expect(html).toContain(`${LEGAL_ENTITY.taxOffice} / ${LEGAL_ENTITY.taxNo}`);
    expect(html).toContain(LEGAL_ADDRESS_LINE);
    expect(html).toContain("<td>#10042</td>");
    // 11:05 UTC is 14:05 on the köşk's clock (rule 22).
    expect(html).toContain("21 Ekim 2026, 14:05 (Türkiye saati)");
    expect(html).toContain("<td>20 Ekim 2026</td>");
  });

  it("prints each line, the totals and the address from the order, KDV dahil, in kuruş", () => {
    const html = orderHtml();
    // 3 x 333,33 = 999,99: the stored unit price times the stored quantity.
    expect(html).toContain(
      "Sirena &quot;Espresso&quot; &lt;b&gt;250 g&lt;/b&gt; × 3: 999,99₺ (KDV dahil)",
    );
    expect(html).toContain("Latte (Yulaf sütü) × 1: 140,50₺ (KDV dahil)");
    expect(html).toContain('<th scope="row">Ürün 1</th>');
    expect(html).toContain('<th scope="row">Ara toplam (KDV dahil)</th><td>1.140,49₺</td>');
    expect(html).toContain('<th scope="row">Kargo</th><td>49₺</td>');
    expect(html).toContain('<th scope="row">İndirim</th><td>-100₺ (&lt;KOD&gt;)</td>');
    expect(html).toContain('<th scope="row">Toplam (KDV dahil)</th><td>1.089,49₺</td>');
    expect(html).toContain('<th scope="row">Teslimat</th><td>Kargo</td>');
    expect(html).toContain(
      '<th scope="row">Teslimat adresi</th><td class="multiline">Bağdat Cad. 1',
    );
  });

  it("prints the stored total even when the lines would add up to another", () => {
    const html = orderDurableCopyHtml({
      order: { ...ORDER, totalMinor: 1 },
      consent: CONSENT,
      docs: docs(CHECKOUT_CONSENT_DOCS),
    });
    expect(html).toContain('<th scope="row">Toplam (KDV dahil)</th><td>0,01₺</td>');
  });

  it("says a table order is served at its table, with no cargo and no address", () => {
    const html = orderDurableCopyHtml({
      order: {
        ...ORDER,
        fulfillment: "table",
        tableCode: "AB12CD34EF",
        tableName: "Bahçe 3",
        shippingAddress: "",
        shippingMinor: 0,
      },
      consent: CONSENT,
      docs: docs(CHECKOUT_CONSENT_DOCS),
    });
    expect(html).toContain('<th scope="row">Teslimat</th><td>Masaya servis</td>');
    expect(html).toContain('<th scope="row">Masa</th><td>Bahçe 3</td>');
    expect(html).not.toContain('<th scope="row">Kargo</th>');
    expect(html).not.toContain('<th scope="row">Teslimat adresi</th>');
  });

  it("carries each document's full stored text, its date and its version", () => {
    const html = orderHtml();
    for (const d of docs(CHECKOUT_CONSENT_DOCS)) {
      expect(html).toContain(`<h1>${d.doc.title}</h1>`);
      expect(html).toContain(`Bu metin ${d.doc.updatedAt} tarihli sürümdür.`);
      expect(html).toContain(d.hash);
      expect(html).toContain(d.url);
      if (d.doc.source !== "coded") continue;
      // Every section heading of the document is there.
      for (const s of d.doc.sections) {
        expect(html).toContain(
          `<h2>${s.heading.replace(/&/g, "&amp;").replace(/'/g, "&#39;").replace(/"/g, "&quot;")}</h2>`,
        );
      }
    }
  });

  it("is the same bytes for the same order, whenever it is made", () => {
    expect(orderHtml()).toBe(orderHtml());
  });
});

function booking(patch: Partial<DurableCopyBooking> = {}): DurableCopyBooking {
  return {
    id: "krk-00042",
    customerName: HOSTILE_NAME,
    date: "2026-10-30",
    startHour: 20,
    hours: 2,
    guests: 4,
    totalMinor: 90_000,
    paidMinor: 90_000,
    freeCancelHours: 2,
    lateRefundPercent: 0,
    // The booking's own deadline (its snapshot): 30 Ekim, 18:00 Istanbul.
    cancelDeadline: "2026-10-30T15:00:00.000Z",
    ...patch,
  };
}

describe("the karaoke booking's facts are its own snapshot", () => {
  const html = (r: DurableCopyBooking) =>
    karaokeDurableCopyHtml({
      reservation: r,
      consent: CONSENT,
      docs: docs(KARAOKE_CONSENT_DOCS),
    });

  it("prints the code, the evening, the total and the booking's own deadline", () => {
    const out = html(booking());
    expect(out).toContain('<th scope="row">Rezervasyon kodu</th><td>KRK-00042</td>');
    expect(out).toContain("<td>30 Ekim 2026</td>");
    expect(out).toContain("<td>20:00 - 22:00</td>");
    expect(out).toContain("<td>2 saat</td>");
    expect(out).toContain("<td>4 kişi</td>");
    expect(out).toContain('<th scope="row">Toplam (KDV dahil)</th><td>900₺</td>');
    expect(out).toContain(
      '<th scope="row">Son ücretsiz iptal</th><td>30 Ekim 2026, 18:00</td>',
    );
    expect(out).toContain("&lt;img src=x onerror=alert(1)&gt;");
  });

  it("reads the stored deadline, not the policy in force today", () => {
    // A booking stored with 24 hours: 29 Ekim, 20:00.
    const out = html(
      booking({ freeCancelHours: 24, cancelDeadline: "2026-10-29T17:00:00.000Z" }),
    );
    expect(out).toContain("<td>29 Ekim 2026, 20:00</td>");
  });

  it("says 'iade yapılmaz' for a rule with no late refund, the amount otherwise", () => {
    expect(lateRefundLabel(booking())).toBe("iade yapılmaz");
    expect(html(booking())).toContain(
      '<th scope="row">Geç iptalde iade</th><td>iade yapılmaz</td>',
    );
    // 50 % of the 900,00 ₺ paid: round(paid x P / 100), kuruş.
    expect(lateRefundLabel(booking({ lateRefundPercent: 50 }))).toBe(
      "450₺ (KDV dahil)",
    );
    expect(
      lateRefundLabel(booking({ lateRefundPercent: 33, paidMinor: 1_001 })),
    ).toBe("3,30₺ (KDV dahil)");
    expect(lateRefundLabel(booking({ lateRefundPercent: 100 }))).toBe(
      "900₺ (KDV dahil)",
    );
    // A row from before the snapshot reads as the default rule (2 h / %0).
    expect(
      lateRefundLabel(booking({ lateRefundPercent: null, freeCancelHours: null })),
    ).toBe("iade yapılmaz");
  });
});

describe("file names", () => {
  it("are the decided names, with nothing but the number or the code in them", () => {
    expect(orderDurableCopyFilename(10042)).toBe(
      "siparis-10042-on-bilgilendirme-ve-sozlesme.html",
    );
    expect(karaokeDurableCopyFilename("krk-00042")).toBe(
      "karaoke-sozlesme-KRK-00042.html",
    );
    expect(orderDurableCopyFilename(Number.NaN)).toBe(
      "siparis-on-bilgilendirme-ve-sozlesme.html",
    );
    expect(karaokeDurableCopyFilename('krk-1"; x=<y>')).toBe(
      "karaoke-sozlesme.html",
    );
  });
});
