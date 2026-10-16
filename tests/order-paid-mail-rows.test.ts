import { describe, expect, it } from "vitest";

import { renderEmail } from "@/lib/email/render";
import { EMAIL_TEXT } from "@/lib/email/text";

/**
 * "Ödemen alındı" (odeme-onaylandi) - the customer's one order mail, sent
 * once the payment is in: the rows above the total follow the order. A table
 * order is served across the room, so the cargo row is not in it; a
 * discount row appears only when there was a discount. Every other order
 * keeps the rows as before.
 */

function render(vars: { KARGO: string; INDIRIM: string }) {
  return renderEmail("odeme-onaylandi", {
    vars: {
      AD: "Eda",
      SIPARIS_NO: "10900",
      SIPARIS_URL: "https://laffogato.net/uye/hesap/siparislerim/10900",
      ARA_TOPLAM: "₺245,00",
      KARGO: vars.KARGO,
      INDIRIM: vars.INDIRIM,
      TOPLAM: "₺245,00",
      KALEMLER: "  • Cappuccino × 1 - ₺245,00",
      BELGELER: "- Mesafeli Satış Sözleşmesi: https://laffogato.net/hukuk/x",
      DAMGA_HEDEFI: "8",
    },
    loops: {
      ITEMS: [
        { URUN_AD: "Cappuccino", URUN_ADET: "1", URUN_TUTAR: "₺245,00" },
      ],
    },
    text: EMAIL_TEXT["odeme-onaylandi"],
  });
}

describe("odeme-onaylandi", () => {
  it("drops the cargo row for a table order (KARGO empty)", () => {
    const r = render({ KARGO: "", INDIRIM: "" });
    expect(r.html).not.toContain(">Kargo<");
    expect(r.text).not.toMatch(/Kargo:/);
    expect(r.html).toContain("Ara toplam");
    expect(r.text).toContain("Ödenen toplam: ₺245,00");
  });

  it("keeps the cargo row on every other order", () => {
    const r = render({ KARGO: "Ücretsiz", INDIRIM: "" });
    expect(r.html).toContain(">Kargo<");
    expect(r.text).toContain("Kargo: Ücretsiz");
  });

  it("shows the discount row only when there was a discount", () => {
    const none = render({ KARGO: "₺49,00", INDIRIM: "" });
    expect(none.html).not.toContain("İndirim");
    expect(none.text).not.toContain("İndirim");
    const some = render({ KARGO: "₺49,00", INDIRIM: "-₺100,00" });
    expect(some.html).toContain("İndirim");
    expect(some.text).toContain("İndirim: -₺100,00");
  });

  it("keeps the durable-medium links on the mail", () => {
    const r = render({ KARGO: "", INDIRIM: "" });
    for (const slug of [
      "on-bilgilendirme-formu",
      "mesafeli-satis-sozlesmesi",
      "iade-ve-cayma",
    ]) {
      expect(r.html).toContain(`/hukuk/${slug}`);
    }
    expect(r.text).toContain("Mesafeli Satış Sözleşmesi");
  });
});
