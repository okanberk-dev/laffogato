import { readFileSync } from "node:fs";

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { CheckoutDocPanel } from "@/app/odeme/checkout-doc-panel";
import {
  CheckoutLegalBody,
  checkoutDocument,
} from "@/app/odeme/checkout-documents";
import {
  CARD_PAYMENT_METHOD,
  istanbulDateLabel,
  OrderBrief,
  type OrderBriefLine,
  type OrderFacts,
  OrderFactsTable,
  WITHDRAWAL_SENTENCES,
  WithdrawalNote,
} from "@/app/odeme/checkout-preinfo";
import { findLegalDoc } from "@/lib/legal/documents";
import { CHECKOUT_CONSENT_DOCS } from "@/lib/legal/meta";
import type { LegalDocOverride } from "@/lib/legal/store";

/**
 * The payment step's pre-contract information (operator decision ASK-OTH-2,
 * 18 Eki 2026; MSY m.6/1, m.6/2-a, m.6/2-b): "Siparişin" and "Cayma
 * hakkın" right above the card on every screen size, the Ön Bilgilendirme
 * Formu and the Mesafeli Satış Sözleşmesi opening in a panel filled with
 * the order (the 16px: tests/legal-text-size.test.ts). The pixels were
 * looked at in Chrome at 390, 1024 and 1280 px.
 */

const checkout = readFileSync("src/app/odeme/checkout.tsx", "utf8");
const css = readFileSync("src/app/globals.css", "utf8");

/** Rendered markup back to the words a reader sees. */
function text(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&#x27;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

const LINES: OrderBriefLine[] = [
  {
    key: "prd-0001::v-250g",
    label: "Ethiopia Yirgacheffe · 250 g",
    qty: 2,
    lineMinor: 49000,
  },
  { key: "prd-0007::", label: "Moka Pot", qty: 1, lineMinor: 85000 },
];

const FACTS: OrderFacts = {
  buyer: "Ayşe Yılmaz",
  email: "ayse@example.com",
  phone: "+90 532 000 00 00",
  address: "Postane Mah. Atatürk Cad. No: 1, Tuzla / İstanbul 34940",
  lines: LINES,
  shippingMinor: 0,
  discountMinor: 5000,
  totalMinor: 129000,
  promoCode: "HOSGELDIN",
  kdvParts: "%1 · 4,62₺, %20 · 135,48₺",
  paymentMethod: CARD_PAYMENT_METHOD,
  date: "18 Ekim 2026",
};

describe("'Siparişin': the order right above the card", () => {
  const brief = (kdvParts: string | null, discountMinor = 0, shipping = 0) =>
    renderToStaticMarkup(
      createElement(OrderBrief, {
        lines: LINES,
        totals: {
          shippingMinor: shipping,
          discountMinor,
          totalMinor: 134000 - discountMinor + shipping,
          promoCode: discountMinor ? "HOSGELDIN" : undefined,
        },
        kdvParts,
      }),
    );

  it("lists every line as '<ad> <varyant> × <adet>   <tutar>', then shipping and the KDV-included total", () => {
    const html = brief(null);
    const words = text(html);
    expect(words).toMatch(/^Siparişin /);
    expect(words).toContain("Ethiopia Yirgacheffe · 250 g × 2 490₺");
    expect(words).toContain("Moka Pot × 1 850₺");
    expect(words).toContain("Kargo Ücretsiz");
    expect(words).toContain("Toplam (KDV dahil) 1.340₺");
    // Lines, then shipping, then the total: the order MSY m.6/2-a reads.
    expect(words.indexOf("Moka Pot")).toBeLessThan(words.indexOf("Kargo"));
    expect(words.indexOf("Kargo")).toBeLessThan(words.indexOf("Toplam"));
    // No discount row when there is none, and no KDV row without a rate.
    expect(words).not.toContain("İndirim");
    expect(words).not.toContain("KDV dahil:");
    // Its own heading, so a screen reader can jump to it.
    expect(html).toContain('aria-labelledby="co-brief-title"');
  });

  it("shows the shipping fee, the discount with its code, and the KDV inside the total", () => {
    const words = text(brief("%1 · 4,62₺, %20 · 135,48₺", 5000, 6000));
    expect(words).toContain("Kargo 60₺");
    expect(words).toContain("İndirim · HOSGELDIN −50₺");
    expect(words).toContain("Toplam (KDV dahil) 1.350₺");
    expect(words).toContain("KDV dahil: %1 · 4,62₺, %20 · 135,48₺");
    expect(words.indexOf("Toplam")).toBeLessThan(words.indexOf("KDV dahil:"));
  });
});

describe("'Cayma hakkın': the withdrawal terms in a few sentences", () => {
  const DECIDED =
    "Kargo siparişlerinde ürünü teslim aldığın günden itibaren 14 gün içinde gerekçe göstermeden cayabilirsin; teslimattan önce de cayabilirsin. Bildirimini merhaba@laffogato.com adresine yazman yeterli. Ürünü bildiriminden sonraki 14 gün içinde geri gönder: sana e-postayla göndereceğimiz iade koduyla gönderirsen ücret ödemezsin, başka bir kargoyla gönderirsen ödediğin ücreti geri öderiz. Çabuk bozulabilen gıdalarda (gelato gibi soğuk zincir gerektiren ürünler), ambalajı açılmış olup iadesi sağlık ve hijyen açısından uygun olmayan ürünlerde (açılmış kahve paketi, yenilebilir kup kutusu, krema, şurup) ve isteğine göre öğütülen ya da kişiye özel hazırlanan ürünlerde cayma hakkı yoktur. Ürün ayıplı, bozuk, eksik veya yanlış gelirse yasal hakların her hâlükârda saklıdır.";

  it("says the decided text word for word, with the seller's address, then links the full document", () => {
    const html = renderToStaticMarkup(
      createElement(WithdrawalNote, { sellerEmail: "merhaba@laffogato.com" }),
    );
    expect(text(html)).toBe(`Cayma hakkın ${DECIDED} İptal, iade ve cayma`);
    expect(html).toContain('href="mailto:merhaba@laffogato.com"');
    expect(html).toMatch(
      /<a href="\/hukuk\/iade-ve-cayma" target="_blank" rel="noopener">İptal, iade ve cayma<\/a>/,
    );
    // No long dash in anything the customer reads here.
    expect(text(html)).not.toMatch(/[\u2013\u2014]/);
  });

  it("without a seller address, says where the address is instead of an empty one", () => {
    const words = text(
      renderToStaticMarkup(createElement(WithdrawalNote, { sellerEmail: " " })),
    );
    expect(words).toContain(WITHDRAWAL_SENTENCES.notifyWithout);
    expect(words).not.toContain("mailto");
    expect(words).not.toContain("adresine yazman");
  });
});

describe("'Bu siparişin bilgileri': the documents open filled with the order", () => {
  it("names the buyer, the address, every line, shipping, discount, total, the payment method and the date", () => {
    const words = text(
      renderToStaticMarkup(createElement(OrderFactsTable, { facts: FACTS })),
    );
    const rows = [
      "Bu siparişin bilgileri",
      "Alıcı Ayşe Yılmaz",
      "E-posta ayse@example.com",
      "Telefon +90 532 000 00 00",
      "Teslimat adresi Postane Mah. Atatürk Cad. No: 1, Tuzla / İstanbul 34940",
      "Ürün 1 Ethiopia Yirgacheffe · 250 g × 2: 490₺ (KDV dahil)",
      "Ürün 2 Moka Pot × 1: 850₺ (KDV dahil)",
      "Kargo Ücretsiz",
      "İndirim −50₺ (HOSGELDIN)",
      "Toplam (KDV dahil) 1.290₺",
      "Toplamdaki KDV %1 · 4,62₺, %20 · 135,48₺",
      "Ödeme yöntemi Kart, tek çekim (PayNkolay, 3D Secure)",
      "Tarih 18 Ekim 2026",
    ];
    let from = 0;
    for (const row of rows) {
      const at = words.indexOf(row, from);
      expect(at, row).toBeGreaterThanOrEqual(from);
      from = at + row.length;
    }
  });

  it("one line reads 'Ürün', no discount reads 'Yok', and an empty field never prints blank", () => {
    const words = text(
      renderToStaticMarkup(
        createElement(OrderFactsTable, {
          facts: {
            ...FACTS,
            lines: [LINES[1]],
            discountMinor: 0,
            promoCode: undefined,
            phone: "",
            kdvParts: null,
          },
        }),
      ),
    );
    expect(words).toContain("Ürün Moka Pot × 1: 850₺ (KDV dahil)");
    expect(words).toContain("İndirim Yok");
    expect(words).toContain("Telefon Belirtilmedi");
    expect(words).not.toContain("Toplamdaki KDV");
  });

  it("dates the reading by the venue's clock, not the server's (rule 22)", () => {
    // 00:30 in Tuzla on 18 Ekim is still 17 Ekim in UTC.
    expect(istanbulDateLabel(new Date("2026-10-17T21:30:00Z"))).toBe(
      "18 Ekim 2026",
    );
    expect(istanbulDateLabel(new Date("2026-10-18T20:59:00Z"))).toBe(
      "18 Ekim 2026",
    );
  });

  it("the panel starts with this order's facts, then the document, and keeps a way to its own page", () => {
    const doc = findLegalDoc("on-bilgilendirme-formu")!;
    const html = renderToStaticMarkup(
      createElement(CheckoutDocPanel, {
        doc: checkoutDocument("on-bilgilendirme-formu", doc, null),
        facts: FACTS,
        onClose: () => {},
      }),
    );
    expect(html).toMatch(/^<dialog class="co-docpanel"/);
    const facts = html.indexOf("Bu siparişin bilgileri");
    const body = html.indexOf('class="legal-article"');
    expect(facts).toBeGreaterThan(-1);
    expect(body).toBeGreaterThan(facts);
    expect(html).toContain(`>${doc.title}</h2>`);
    expect(html).toContain(`Son güncelleme: ${doc.updatedAt}`);
    expect(html).toContain('href="/hukuk/on-bilgilendirme-formu"');
    expect(html).toContain('aria-label="Belgeyi kapat"');
  });

  it("closed, the panel renders nothing inside its dialog", () => {
    const html = renderToStaticMarkup(
      createElement(CheckoutDocPanel, {
        doc: null,
        facts: null,
        onClose: () => {},
      }),
    );
    expect(text(html)).toBe("");
  });
});

describe("the documents in the panel are the ones /hukuk shows", () => {
  it.each(CHECKOUT_CONSENT_DOCS)(
    "%s: every heading, paragraph, item and table row of the coded text",
    (slug) => {
      const doc = findLegalDoc(slug)!;
      const words = text(
        renderToStaticMarkup(
          createElement(CheckoutLegalBody, { doc, override: null }),
        ),
      );
      const parts = doc.sections.flatMap((s) => [
        s.heading,
        ...(s.paragraphs ?? []),
        ...(s.bullets ?? []),
        ...(s.ordered ?? []),
        ...(s.table ?? []).flatMap((r) => [r.key, r.value]),
      ]);
      expect(parts.length).toBeGreaterThan(20);
      for (const part of parts) {
        expect(words, part.slice(0, 60)).toContain(
          part.replace(/\s+/g, " ").trim(),
        );
      }
    },
  );

  it("a published panel override replaces the coded text, with its own title and date", () => {
    const doc = findLegalDoc("mesafeli-satis-sozlesmesi")!;
    const override: LegalDocOverride = {
      slug: "mesafeli-satis-sozlesmesi",
      title: "Mesafeli Satış Sözleşmesi (panel)",
      summary: "",
      effectiveDate: "20 Ekim 2026",
      bodyMarkdown: "## 1. Taraflar\n\nPanelden yayımlanan metin.",
      isPublished: true,
      updatedAt: "2026-10-20T09:00:00.000Z",
    };
    const shown = checkoutDocument("mesafeli-satis-sozlesmesi", doc, override);
    expect(shown.title).toBe("Mesafeli Satış Sözleşmesi (panel)");
    expect(shown.updatedAt).toBe("20 Ekim 2026");
    const words = text(renderToStaticMarkup(shown.body as never));
    expect(words).toBe("1. Taraflar Panelden yayımlanan metin.");
  });
});

describe("where the checkout puts them", () => {
  const step2 = checkout.slice(checkout.indexOf('className="co-step2"'));
  const docs = checkout.slice(checkout.indexOf('className="co-docs"'));
  const docsBlock = docs.slice(0, docs.indexOf("</div>"));

  it("'Siparişin' and 'Cayma hakkın' sit in step 2, before the card form, in no folded part", () => {
    const brief = step2.indexOf("<OrderBrief");
    const note = step2.indexOf("<WithdrawalNote");
    const card = step2.search(/<CardPayment\s/);
    expect(brief).toBeGreaterThan(-1);
    expect(note).toBeGreaterThan(brief);
    expect(card).toBeGreaterThan(note);
    // Inside the documents block, with the seller line: not in the side
    // summary, whose body folds on a phone.
    expect(docsBlock).toContain("<OrderBrief");
    expect(docsBlock).toContain(
      "<WithdrawalNote sellerEmail={seller.email} />",
    );
    const summary = checkout.slice(
      checkout.indexOf('className="co-summary"'),
      checkout.indexOf('className="co-main"'),
    );
    expect(summary).not.toContain("<OrderBrief");
    // The amounts are the ones the pay button is compared against.
    expect(docsBlock).toContain("totalMinor: totals.totalMinor");
    expect(docsBlock).toContain("lines={briefLines}");
  });

  it("no screen size hides them", () => {
    for (const cls of ["co-brief", "co-withdrawal"]) {
      expect(css).not.toMatch(
        new RegExp(`\\.${cls}[^{]*\\{[^}]*display:\\s*none`),
      );
    }
  });

  it("the lines are the quote's once the server has priced the basket", () => {
    const helper = checkout.slice(
      checkout.indexOf("const lineMinorOf = "),
      checkout.indexOf("const briefLines"),
    );
    expect(helper).toContain("quoted?.lines.find(");
    expect(helper).toContain("line.unitPriceMinor * qty");
    // The side summary reads the same lines.
    expect(checkout).toContain("const lineMinor = lineMinorOf(it);");
  });

  it("the KDV note reads each line's own rate and the shipping rule the page passes", () => {
    expect(checkout).toContain(
      "ratePct: it.productId ? kdv.products[it.productId] : null,",
    );
    expect(checkout).toContain("shippingRatePct: kdv.shippingRatePct,");
    // Under the total in the side summary too, never in the pay bar (its
    // height is reserved on a phone).
    expect(checkout).toContain('<div className="co-totals-kdv">');
    const bar = checkout.slice(
      checkout.indexOf('className="co-paybar"'),
      checkout.indexOf("</section>", checkout.indexOf('className="co-paybar"')),
    );
    expect(bar).not.toContain("kdvParts");
  });

  it("the delivery row says the shop sends only within Türkiye (MSY m.6/2-b)", () => {
    expect(checkout).toMatch(
      /<span className="co-ship-method-meta">\s*Yalnız Türkiye içindeki adreslere gönderiyoruz\s*<\/span>/,
    );
    expect(checkout).not.toContain("Türkiye geneli");
  });

  it("the document links open the panel, and both sets of links do", () => {
    expect(docsBlock).toContain('onClick={docLink("on-bilgilendirme-formu")}');
    expect(docsBlock).toContain(
      'onClick={docLink("mesafeli-satis-sozlesmesi")}',
    );
    expect(checkout).toContain("onDocClick={openDocFrom}");
    expect(checkout).toContain("<CheckoutDocPanel");
    // A modifier key or the middle button still opens a new tab.
    const open = checkout.slice(
      checkout.indexOf("const openDocFrom = ("),
      checkout.indexOf("const docLink ="),
    );
    for (const key of ["metaKey", "ctrlKey", "shiftKey", "altKey"]) {
      expect(open).toContain(`event.${key}`);
    }
    expect(open).toContain("event.button !== 0");
    expect(open).toContain("event.preventDefault();");
  });
});

describe("the contracts stay out of the browser bundle", () => {
  // The panel's text is rendered on the server (checkout-documents.tsx) and
  // reaches the client as markup; the 25-document registry must not ride
  // along in the checkout's JavaScript (src/lib/legal/documents.ts).
  it.each([
    "src/app/odeme/checkout.tsx",
    "src/app/odeme/checkout-consent.tsx",
    "src/app/odeme/checkout-doc-panel.tsx",
    "src/app/odeme/checkout-preinfo.tsx",
  ])("%s imports the documents module for its types only", (file) => {
    const source = readFileSync(file, "utf8");
    for (const m of source.matchAll(
      /^import\s+([^;]*?)\s+from\s+"([^"]+)";/gm,
    )) {
      const [, what, from] = m;
      if (from === "./checkout-documents" || from.startsWith("@/lib/legal/")) {
        expect(what, `${file}: ${from}`).toMatch(/^type\s/);
      }
    }
    expect(source).not.toContain("@/lib/legal/documents");
    expect(source).not.toContain("@/lib/legal/content");
  });
});
