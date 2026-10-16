import { describe, expect, it } from "vitest";

import { renderEmail } from "@/lib/email/render";
import { EMAIL_TEXT } from "@/lib/email/text";

/**
 * "Siparişiniz alındı" for a table order: served across the room, so the
 * cargo row and the free-shipping line are not in it. Every other order
 * keeps them exactly as before.
 */

function render(kargo: string) {
  const r = renderEmail("siparis-alindi", {
    vars: {
      AD: "Eda",
      SIPARIS_NO: "10900",
      SIPARIS_URL: "https://laffogato.net/uye/hesap/siparislerim/10900",
      ARA_TOPLAM: "245,00 ₺",
      KARGO: kargo,
      TOPLAM: "245,00 ₺",
      KALEMLER: "  • Cappuccino × 1 - 245,00 ₺",
      BELGELER: "- Mesafeli Satış Sözleşmesi: https://laffogato.net/hukuk/x",
    },
    loops: {
      ITEMS: [
        { URUN_AD: "Cappuccino", URUN_ADET: "1", URUN_TUTAR: "245,00 ₺" },
      ],
    },
    text: EMAIL_TEXT["siparis-alindi"],
  });
  return r;
}

describe("siparis-alindi", () => {
  it("drops every mention of cargo for a table order (KARGO empty)", () => {
    const r = render("");
    expect(r.html).not.toMatch(/kargo/i);
    expect(r.text).not.toMatch(/kargo/i);
    expect(r.html).toContain("KDV dâhil");
    expect(r.text).toContain("KDV dâhil");
    expect(r.text).toContain("Toplam: 245,00 ₺");
  });

  it("keeps the cargo row and the free-shipping line on every other order", () => {
    const r = render("Ücretsiz");
    expect(r.html).toContain(">Kargo<");
    expect(r.html).toContain("kargo ücretsiz");
    expect(r.text).toContain("Kargo: Ücretsiz");
    expect(r.text).toContain("500,00 ₺ üzeri siparişlerde kargo ücretsiz");
  });
});
