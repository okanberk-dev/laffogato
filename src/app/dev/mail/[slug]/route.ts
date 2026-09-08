import { NextResponse } from "next/server";

import { renderEmail } from "@/lib/email/render";
import {
  EMAIL_TEMPLATES,
  type EmailTemplateName,
} from "@/lib/email/templates.generated";
import { EMAIL_TEXT } from "@/lib/email/text";

/**
 * `/dev/mail/<slug>` — one template, rendered with stand-in values.
 *
 * E-mail is the one surface with no staging: the first time a template is seen
 * in an inbox is usually the first time it is seen at all. This serves each one
 * as a plain document so it can be opened in a browser, resized, and forwarded
 * to Litmus or a real address before anything ships.
 *
 * Development only — it renders commercial mail without a real consent record,
 * which must never be reachable in production. `?format=text` shows the
 * plain-text half instead.
 */

const SAMPLE: Record<string, string> = {
  AD: "Ayşe",
  DOGRULAMA_URL: "https://laffogato.net/uye/dogrula?token=ornek",
  SIFIRLAMA_URL: "https://laffogato.net/uye/sifre-sifirla?token=ornek",
  SIPARIS_NO: "1042",
  ARA_TOPLAM: "355,00 ₺",
  KARGO: "49,00 ₺",
  TOPLAM: "404,00 ₺",
  KALEMLER: "  • Affogato Classico × 2 — 260,00 ₺",
  BELGELER: "- Ön Bilgilendirme Formu: https://laffogato.net/hukuk/…",
  DAMGA_HEDEFI: "6",
  ODUL_BASLIGI: "Bir içecek bizden",
  KUPON_KODU: "KOSK-7F2A",
  SON_KULLANIM: "30 Eylül 2026",
  KARAOKE_TARIH: "12 Eylül 2026, Cumartesi",
  KARAOKE_SAAT: "20:00 – 22:00",
  KARAOKE_KISI: "4 kişi",
  KARAOKE_KOD: "KRK-8H31",
  KAMPANYA_BASLIK: "Eylülde köşkte matcha haftası",
  KAMPANYA_METIN:
    "Ay boyunca matcha bar'da üç yeni demleme ve yanına eşleşen bir dolce.",
  KAMPANYA_BUTON: "Menüyü gör",
  KAMPANYA_URL: "https://laffogato.net/menu",
  URUN_1_AD: "Matcha Affogato",
  URUN_1_NOT: "Tören sınıfı matcha, fior di latte gelato.",
  URUN_1_FIYAT: "165,00 ₺",
  URUN_2_AD: "Cornetto Pistacchio",
  URUN_2_NOT: "Bronte fıstığı, sabah çekilmiş hamur.",
  URUN_2_FIYAT: "95,00 ₺",
  URUN_3_AD: "Sirena Espresso 250 g",
  URUN_3_NOT: "Ev harmanı, haftalık kavrum.",
  URUN_3_FIYAT: "320,00 ₺",
};

const ITEMS = [
  { URUN_AD: "Affogato Classico", URUN_ADET: "2", URUN_TUTAR: "260,00 ₺" },
  { URUN_AD: "Cornetto Pistacchio", URUN_ADET: "1", URUN_TUTAR: "95,00 ₺" },
];

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  if (process.env.NODE_ENV === "production") {
    return new NextResponse("Not found", { status: 404 });
  }

  const { slug } = await params;
  const template = EMAIL_TEMPLATES[slug];
  if (!template) {
    return NextResponse.json(
      { error: "Bilinmeyen şablon", mevcut: Object.keys(EMAIL_TEMPLATES) },
      { status: 404 },
    );
  }

  const name = slug as EmailTemplateName;
  const rendered = renderEmail(name, {
    vars: SAMPLE,
    loops: { ITEMS },
    text: EMAIL_TEXT[name],
    ...(template.commercial
      ? { unsubscribeUrl: "https://laffogato.net/bulten/cikis?token=ornek" }
      : {}),
  });

  const wantsText = new URL(request.url).searchParams.get("format") === "text";

  return new NextResponse(wantsText ? rendered.text : rendered.html, {
    headers: {
      "content-type": wantsText
        ? "text/plain; charset=utf-8"
        : "text/html; charset=utf-8",
      // A preview is never the thing to cache.
      "cache-control": "no-store",
      "x-mail-subject": encodeURIComponent(rendered.subject),
    },
  });
}
