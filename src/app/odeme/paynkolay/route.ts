import { NextResponse, type NextRequest } from "next/server";

import {
  checkLoginLimit,
  clientIpFrom,
  recordLoginFailure,
  reserveLoginAttempt,
} from "@/lib/admin/rate-limit";
import { appOrderDeepLink } from "@/lib/mobile/deep-link";
import { getPaymentProvider } from "@/lib/payment";
import {
  PaynkolayPaymentProvider,
  type PaynkolayFormPost,
} from "@/lib/payment/paynkolay";
import { CARD_FORM_FIELDS, parseCardForm } from "@/lib/payment/paynkolay-card";
import {
  bankChallengePage,
  renderCardForm,
  renderHostedRedirect,
  renderPaymentNotice,
  type CardFormState,
  type PaynkolayPage,
} from "@/lib/payment/paynkolay-page";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * PayNkolay ödeme sayfası - sitenin kendi ara sayfası.
 *
 * PayNkolay yönlendirilecek bir URL vermiyor, form-POST bekliyor
 * (docs/PAYNKOLAY.md §9). Oysa `CheckoutSession` tek bir `redirectUrl`
 * taşıyor ve mobil uygulama o adresi `WebBrowser` ile açıyor - uygulama form
 * POST edemez. Aradaki farkı kapatan yer burası: alanlar imzalı olarak URL'de
 * gelir (`d` + `s`) ve imza tutmazsa hiçbir şey kurulmaz - yoksa müşteri
 * `use3D`'yi boşaltıp 3D'siz ödeyebilirdi (§14.1).
 *
 * İki mod (§15, `PAYNKOLAY_CHECKOUT_MODE`):
 *
 * - `direct`: GET sitenin kart formunu çizer; POST kartı doğrular, PayNkolay'a
 *   iletir ve bankanın 3D formunu müşteriye verir - müşteri doğrudan bankanın
 *   ekranına gider. Kart saklanmaz ve loglanmaz (kural 28): yalnız bu isteğin
 *   gövdesinde ve PayNkolay'a giden isteğin gövdesinde durur.
 * - `hosted`: GET alanları gizli inputlara yazıp PayNkolay'ın ortak ödeme
 *   sayfasına kendiliğinden gönderir; POST yoktur.
 *
 * Bu yol sitenin genel CSP'sinin dışındadır ve her yanıtta kendi, daha dar
 * CSP'sini gönderir (`paynkolay-page.ts`, `next.config.ts`).
 */
export async function GET(req: NextRequest) {
  const base = req.nextUrl.origin;
  const provider = safeProvider();
  if (!(provider instanceof PaynkolayPaymentProvider)) {
    return failure(base);
  }

  const data = req.nextUrl.searchParams.get("d") ?? "";
  const signature = req.nextUrl.searchParams.get("s") ?? "";
  const post = provider.readBridgePost(data, signature);
  if (!post) {
    console.error("[odeme/paynkolay] imzasız ya da bozuk ödeme yükü");
    return failure(base);
  }

  if (provider.checkoutMode !== "direct") {
    return respond(renderHostedRedirect(post.action, post.fields));
  }
  if (!provider.isBridgeFresh(post)) return respond(expiredNotice(post));
  return respond(
    renderCardForm({ data, signature, amount: post.fields.amount }),
  );
}

export async function POST(req: NextRequest) {
  const base = req.nextUrl.origin;
  const provider = safeProvider();
  if (
    !(provider instanceof PaynkolayPaymentProvider) ||
    provider.checkoutMode !== "direct"
  ) {
    return new NextResponse(null, { status: 405, headers: { allow: "GET" } });
  }
  // Kart yalnızca bu sitenin kendi formundan kabul edilir. Başka bir siteden
  // POST edilen form, kart denemesi için bir yan kapı olurdu.
  if (!sameOrigin(req)) {
    return new NextResponse(null, { status: 403 });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return failure(base);
  }
  const read = (name: string): string | null => {
    const value = form.get(name);
    return typeof value === "string" ? value : null;
  };

  const data = read("d") ?? "";
  const signature = read("s") ?? "";
  const post = provider.readBridgePost(data, signature);
  if (!post) {
    console.error("[odeme/paynkolay] imzasız ya da bozuk ödeme yükü (POST)");
    return failure(base);
  }
  if (!provider.isBridgeFresh(post)) return respond(expiredNotice(post));

  // Hata sonrası forma geri yazılabilenler: ad ve son kullanma. Kart
  // numarası ve CVV hiçbir yanıta geri basılmaz.
  const state: CardFormState = {
    data,
    signature,
    amount: post.fields.amount,
    holderName: (read(CARD_FORM_FIELDS.holderName) ?? "").slice(0, 60),
    expiry: (read(CARD_FORM_FIELDS.expiry) ?? "").slice(0, 7),
  };

  const check = parseCardForm(read);
  if (!check.ok) {
    return respond(
      renderCardForm({
        ...state,
        error: { message: check.message, field: check.field },
      }),
      422,
    );
  }

  // Kart denemesine (çalıntı kart listesini sınama) karşı iki bütçe
  // (`rate-limit.ts` gerekçesi):
  // - Sipariş başına: POS'a giden HER deneme, sonucundan önce sayılır.
  // - Adres başına: yalnızca POS'un REDDETTİĞİ ya da yanıtlayamadığı
  //   denemeler sayılır. Başarılıları saymak, kafenin Wi-Fi'ı gibi tek
  //   adresi paylaşan müşterileri birbirine kilitliyordu.
  const ip = clientIpFrom(req.headers);
  const orderRef = post.fields.clientRefCode;
  const perIp = await checkLoginLimit("card-payment-ip", ip, "*");
  const perOrder = perIp.blocked
    ? perIp
    : await reserveLoginAttempt("card-payment-order", "*", orderRef);
  if (perOrder.blocked) {
    const minutes = Math.max(1, Math.ceil(perOrder.retryAfterSeconds / 60));
    console.warn(
      `[odeme/paynkolay] kartlı ödeme deneme sınırı order=${orderRef}`,
    );
    return respond(
      renderCardForm({
        ...state,
        error: {
          message: `Çok fazla deneme yapıldı. Güvenliğin için ${minutes} dakika sonra yeniden dene.`,
        },
      }),
      429,
    );
  }

  let result: Awaited<
    ReturnType<PaynkolayPaymentProvider["startDirectPayment"]>
  >;
  try {
    result = await provider.startDirectPayment(post, check.card, ip);
  } catch (err) {
    // Yalnız mesaj: `postForm`'un hataları istek gövdesini taşımaz.
    console.error(
      `[odeme/paynkolay] kartlı ödeme başlatılamadı order=${orderRef}:`,
      err instanceof Error ? err.message : "bilinmeyen hata",
    );
    await recordLoginFailure("card-payment-ip", ip, "*");
    return respond(
      renderCardForm({
        ...state,
        error: {
          message:
            "Ödeme şu an başlatılamadı ve kartından para çekilmedi. Birazdan yeniden dene.",
        },
      }),
      502,
    );
  }

  if (result.kind === "3d") return respond(bankChallengePage(result.html));

  console.warn(
    `[odeme/paynkolay] POS ödemeyi başlatmadı order=${orderRef} code=${result.code}`,
  );
  await recordLoginFailure("card-payment-ip", ip, "*");
  return respond(
    renderCardForm({
      ...state,
      error: {
        message: result.message
          ? `Ödeme başlatılamadı: ${result.message}`
          : "Kartın bu ödemeyi kabul etmedi. Bilgileri kontrol edip yeniden dene ya da başka bir kart kullan.",
      },
    }),
  );
}

function safeProvider() {
  try {
    return getPaymentProvider();
  } catch (err) {
    console.error("[odeme/paynkolay] payment provider unavailable", err);
    return null;
  }
}

/**
 * `Sec-Fetch-Site` ya da `Origin` başka bir siteyi gösteriyorsa reddeder.
 * İkisi de yoksa (çok eski tarayıcı) imza ve deneme sınırı yine korur.
 */
function sameOrigin(req: NextRequest): boolean {
  const site = req.headers.get("sec-fetch-site");
  if (site && site !== "same-origin") return false;
  const origin = req.headers.get("origin");
  if (origin && origin !== req.nextUrl.origin) return false;
  return true;
}

function respond(page: PaynkolayPage, status = 200): NextResponse {
  return new NextResponse(page.html, {
    status,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store, max-age=0",
      "content-security-policy": page.csp,
      "x-robots-tag": "noindex, nofollow",
    },
  });
}

/**
 * Süresi dolmuş ödeme sayfası - ve bir sonraki adım.
 *
 * Uygulama siparişinde (`successUrl`'de `app=1`) sipariş uygulamada durur ve
 * ödeme oradan yeniden açılır: bağlantı, `/odeme/app-hata`'nın kullandığı
 * derin bağlantıdır. Web'de mevcut bir siparişi yeniden ödeme adımı yok;
 * sepet tarayıcıda durduğu için yol `/odeme`'dir.
 */
function expiredNotice(post: PaynkolayFormPost): PaynkolayPage {
  const fromApp = post.fields.successUrl.includes("app=1");
  return fromApp
    ? renderPaymentNotice(
        "Ödeme süresi doldu",
        "Bu ödeme sayfasının süresi doldu; kartından para çekilmedi. Siparişin uygulamada duruyor, ödemeyi oradan yeniden başlatabilirsin.",
        {
          href: appOrderDeepLink(post.fields.clientRefCode, "failed"),
          label: "Uygulamaya dön",
        },
      )
    : renderPaymentNotice(
        "Ödeme süresi doldu",
        "Bu ödeme sayfasının süresi doldu; kartından para çekilmedi. Sepetin duruyor, ödeme adımından yeniden devam edebilirsin.",
        { href: "/odeme", label: "Ödemeye dön" },
      );
}

function failure(base: string) {
  // `?error=payment` is what /odeme renders a notice for (CHECKOUT_NOTICES);
  // `?durum=basarisiz` was read by nothing, so a declined card came back to
  // the checkout with no word about what had happened.
  return NextResponse.redirect(new URL("/odeme?error=payment", base), 303);
}
