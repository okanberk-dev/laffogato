import { NextResponse, type NextRequest } from "next/server";

import {
  checkLoginLimit,
  clientIpFrom,
  recordLoginFailure,
  reserveLoginAttempt,
} from "@/lib/admin/rate-limit";
import {
  checkoutReturnPath,
  type CheckoutReturnCode,
  type CheckoutReturnField,
} from "@/lib/checkout/return-codes";
import { APP_SCHEME, appOrderDeepLink } from "@/lib/mobile/deep-link";
import { karaokeExpiredNotice } from "@/lib/mobile/karaoke-bridge-copy";
import { getPaymentProvider } from "@/lib/payment";
import { bridgeChargeGate } from "@/lib/payment/bridge-gate";
import {
  PaynkolayPaymentProvider,
  type DirectPaymentMethod,
  type PaynkolayFormPost,
  type SavedCard,
} from "@/lib/payment/paynkolay";
import {
  CARD_FORM_FIELDS,
  parseCardForm,
  type CardField,
} from "@/lib/payment/paynkolay-card";
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
 *
 * İki istemci (§15.5): uygulamanın tarayıcısı `GET ?d&s` ile bu sayfanın
 * kendi formunu açar; web'de ise kart `/odeme`'nin kendi formunda yazılır ve
 * buraya `return=checkout` ile POST edilir. O zaman bankaya gidemeyen her
 * sonuç (kart hatası, ret, deneme sınırı, POS hatası, süre, saklı kart)
 * formu burada yeniden çizmek yerine `303 /odeme?odeme=<kod>` döner: sabit
 * bir kod listesi (`return-codes.ts`), POS'un serbest metni ya da kartın
 * herhangi bir parçası adrese girmez. Bankaya giden yol iki istemcide aynı.
 */
export async function GET(req: NextRequest) {
  const provider = safeProvider();
  if (!(provider instanceof PaynkolayPaymentProvider)) {
    return respond(unreadableNotice(), 503);
  }

  const data = req.nextUrl.searchParams.get("d") ?? "";
  const signature = req.nextUrl.searchParams.get("s") ?? "";
  const post = provider.readBridgePost(data, signature);
  if (!post) {
    console.error("[odeme/paynkolay] imzasız ya da bozuk ödeme yükü");
    return respond(unreadableNotice(), 400);
  }

  if (provider.checkoutMode !== "direct") {
    return respond(renderHostedRedirect(post.action, post.fields));
  }
  if (!provider.isBridgeFresh(post)) return respond(expiredNotice(post));
  const saved = await savedCardsOf(provider, post);
  return respond(
    renderCardForm({
      data,
      signature,
      amount: post.fields.amount,
      savedCards: publicCards(saved),
      canSave: !!post.member,
    }),
  );
}

export async function POST(req: NextRequest) {
  const base = req.nextUrl.origin;
  const provider = safeProvider();
  if (
    !(provider instanceof PaynkolayPaymentProvider) ||
    provider.checkoutMode !== "direct"
  ) {
    const res = respond(
      renderPaymentNotice(
        "Ödeme başlatılamadı",
        "Bu ödeme sayfası şu an kart kabul etmiyor; kartından para çekilmedi. Ödeme adımına dönüp yeniden dene.",
        { href: "/odeme", label: "Ödemeye dön" },
      ),
      405,
    );
    res.headers.set("allow", "GET");
    return res;
  }
  // Kart yalnızca bu sitenin kendi formundan kabul edilir. Başka bir siteden
  // POST edilen form, kart denemesi için bir yan kapı olurdu.
  // Gövdesiz bir 403 müşteriye beyaz sayfa olarak görünürdü; ne olduğunu
  // söyleyen bir not verilir (kart işlenmez, POS'a gidilmez).
  if (!sameOrigin(req)) {
    return respond(
      renderPaymentNotice(
        "Ödeme doğrulanamadı",
        "Kart bilgisi bu sitenin kendi ödeme sayfasından gelmediği için işlenmedi; kartından para çekilmedi. Ödeme adımına dönüp yeniden dene.",
        { href: "/odeme", label: "Ödemeye dön" },
      ),
      403,
    );
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return respond(unreadableNotice(), 400);
  }
  const read = (name: string): string | null => {
    const value = form.get(name);
    return typeof value === "string" ? value : null;
  };

  const data = read("d") ?? "";
  const signature = read("s") ?? "";
  const back = (
    code: CheckoutReturnCode,
    extra: { field?: CheckoutReturnField; minutes?: number } = {},
  ) => backToCheckout(base, code, extra);
  const post = provider.readBridgePost(data, signature);
  if (!post) {
    console.error("[odeme/paynkolay] imzasız ya da bozuk ödeme yükü (POST)");
    // `/odeme`'nin formu: ödeme başlamadı; sayfa yeni bir yükle yeniden
    // dener (bozuk yük eski siparişi yeniden kullandırmaz).
    return read("return") === "checkout"
      ? back("baslatilamadi")
      : respond(unreadableNotice(), 400);
  }
  // `/odeme`'deki form (§15.5): hatalar kendi sayfasına, sabit bir kodla
  // döner. Uygulama siparişinin yükü bu yola hiç girmez - uygulamanın
  // tarayıcısı bu sayfanın kendi formunu kullanır ve web ödeme sayfası onun
  // için değildir.
  const toCheckout =
    read("return") === "checkout" && !post.fields.successUrl.includes("app=1");
  if (!provider.isBridgeFresh(post)) {
    return toCheckout ? back("sure_doldu") : respond(expiredNotice(post));
  }

  // Hata sonrası forma geri yazılabilenler: ad ve son kullanma. Kart
  // numarası ve CVV hiçbir yanıta geri basılmaz.
  const choice = read("cardChoice") ?? "new";
  const state: CardFormState = {
    data,
    signature,
    amount: post.fields.amount,
    holderName: (read(CARD_FORM_FIELDS.holderName) ?? "").slice(0, 60),
    expiry: (read(CARD_FORM_FIELDS.expiry) ?? "").slice(0, 7),
    choice,
    canSave: !!post.member,
  };
  // Saklı kart listesi yalnızca gerektiğinde istenir: silmede, saklı kartla
  // ödemede ve formu bir hatayla yeniden çizerken. Yeni kartla ödeme liste
  // ucuna hiç bağlı değildir; liste ucu yavaşsa ödeme beklemez.
  let savedPromise: Promise<SavedCard[]> | null = null;
  const savedCards = () => (savedPromise ??= savedCardsOf(provider, post));
  const withCards = async (
    extra: Partial<CardFormState>,
  ): Promise<PaynkolayPage> =>
    renderCardForm({
      ...state,
      savedCards: publicCards(await savedCards()),
      ...extra,
    });

  // Saklı kartı silmek (§16): ödeme değil, POS'a kart gitmez. `/odeme`
  // kartı kendi eylemiyle siler (oturumdaki üyenin anahtarıyla); oradan
  // gelen bir POST'ta silme alanı varsa form bizim değildir - hiçbir şey
  // yapılmaz.
  const toDelete = read("deleteCard");
  if (toDelete && toCheckout) return back("baslatilamadi");
  if (toDelete) {
    const saved = await savedCards();
    const card = saved.find((c) => c.tranId === toDelete);
    if (!post.member || !card) {
      return respond(
        await withCards({
          error: { message: "Silinecek kart bulunamadı." },
        }),
        404,
      );
    }
    try {
      await provider.deleteSavedCard(post.member, card.token);
    } catch (err) {
      console.error(
        `[odeme/paynkolay] saklı kart silinemedi order=${post.fields.clientRefCode}:`,
        err instanceof Error ? err.message : "bilinmeyen hata",
      );
      return respond(
        await withCards({
          error: { message: "Kart şu an silinemedi. Birazdan yeniden dene." },
        }),
        502,
      );
    }
    const left = saved.filter((c) => c.token !== card.token);
    return respond(
      await withCards({
        savedCards: publicCards(left),
        choice: left[0]?.tranId ?? "new",
        notice: "Kayıtlı kart silindi.",
      }),
    );
  }

  // Ödeme aracı: saklı kart ya da yeni kart. Saklı kartın token'ı formdan
  // değil, üyenin anahtarıyla POS'tan alınan listeden gelir - başka birinin
  // kartı seçilemez.
  let method: DirectPaymentMethod;
  if (choice !== "new") {
    const saved = await savedCards();
    // Betik, saklı kart seçiliyken yeni kart alanlarını kapatır ve
    // göndermez. Alan yine de doluysa (betiksiz tarayıcı) müşteri yeni kartı
    // yazmış ama seçimi değiştirmemiştir: saklı karttan sessizce çekmek
    // yerine sorulur.
    if (/\d/.test(read(CARD_FORM_FIELDS.number) ?? "")) {
      if (toCheckout) return back("kart_secimi");
      return respond(
        await withCards({
          error: {
            message:
              "Yeni bir kart yazdın ama kayıtlı kartın seçili. Yeni kartla ödemek için “Yeni kartla öde”yi seç.",
          },
        }),
        422,
      );
    }
    const card = saved.find((c) => c.tranId === choice);
    if (!post.member || !card) {
      if (toCheckout) return back("kart_yok");
      return respond(
        await withCards({
          choice: "new",
          error: {
            message: "Seçtiğin kayıtlı kart bulunamadı; yeni kartla öde.",
          },
        }),
        422,
      );
    }
    method = { savedToken: card.token };
  } else {
    const check = parseCardForm(read);
    if (!check.ok) {
      if (toCheckout) {
        return back("kart_hatali", { field: RETURN_FIELD[check.field] });
      }
      return respond(
        await withCards({
          error: { message: check.message, field: check.field },
        }),
        422,
      );
    }
    const wantsSave = read("saveCard") === "1" && !!post.member;
    method = wantsSave
      ? {
          card: check.card,
          save: { alias: `Kartım ${check.card.number.slice(-4)}` },
        }
      : { card: check.card };
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
    if (toCheckout) return back("cok_deneme", { minutes });
    return respond(
      await withCards({
        error: {
          message: `Çok fazla deneme yapıldı. Güvenliğin için ${minutes} dakika sonra yeniden dene.`,
        },
      }),
      429,
    );
  }

  // Son bakış, satıştan hemen önce (docs/PAYNKOLAY.md §14.7): imzalı form iki
  // sekmeden ya da geri tuşuyla ikinci kez gelebilir ve PayNkolay aynı
  // `clientRefCode` ile ikinci satışı kabul eder. Ödenmiş ya da artık ödeme
  // beklemeyen bir sipariş / rezervasyon için satış başlamaz; kayıt
  // okunamazsa da başlamaz (alınan para hiçbir yere işlenemezdi). Modüle
  // yalnız sipariş referansı gider, kart değil.
  const gate = await bridgeChargeGate(
    orderRef,
    post.fields.successUrl.includes("app=1"),
  );
  if (gate.kind === "unreadable") {
    if (toCheckout) return back("baslatilamadi");
    return respond(
      await withCards({
        error: {
          message:
            "Ödeme şu an başlatılamadı ve kartından para çekilmedi. Birazdan yeniden dene.",
        },
      }),
      503,
    );
  }
  if (gate.kind === "settled") {
    if (toCheckout) {
      return gate.paid
        ? seeOther(base, gate.notice.link.href)
        : back("sure_doldu");
    }
    const { title, body, link } = gate.notice;
    return respond(renderPaymentNotice(title, body, link), 409);
  }

  let result: Awaited<
    ReturnType<PaynkolayPaymentProvider["startDirectPayment"]>
  >;
  try {
    result = await provider.startDirectPayment(post, method, ip);
  } catch (err) {
    // Yalnız mesaj: `postForm`'un hataları istek gövdesini taşımaz.
    console.error(
      `[odeme/paynkolay] kartlı ödeme başlatılamadı order=${orderRef}:`,
      err instanceof Error ? err.message : "bilinmeyen hata",
    );
    await recordLoginFailure("card-payment-ip", ip, "*");
    if (toCheckout) return back("baslatilamadi");
    return respond(
      await withCards({
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
  // POS'un metni (`result.message`) adrese girmez: dışarıdan gelen serbest
  // metin, sitenin adresinde müşteriye okunacak bir bağlantı olurdu.
  if (toCheckout) return back("reddedildi");
  return respond(
    await withCards({
      error: {
        message: result.message
          ? `Ödeme başlatılamadı: ${result.message}`
          : "Kartın bu ödemeyi kabul etmedi. Bilgileri kontrol edip yeniden dene ya da başka bir kart kullan.",
      },
    }),
  );
}

/**
 * Üyenin saklı kartları - yalnızca imzalı yükte üye anahtarı varsa. POS'a
 * ulaşılamazsa ödeme engellenmez: liste boş gelir, yeni kartla ödenir.
 */
async function savedCardsOf(
  provider: PaynkolayPaymentProvider,
  post: PaynkolayFormPost,
): Promise<SavedCard[]> {
  if (!post.member) return [];
  try {
    return await provider.listSavedCards(post.member);
  } catch (err) {
    console.error(
      `[odeme/paynkolay] saklı kartlar okunamadı order=${post.fields.clientRefCode}:`,
      err instanceof Error ? err.message : "bilinmeyen hata",
    );
    return [];
  }
}

/** Tarayıcıya giden kart listesi: token'sız. */
function publicCards(cards: SavedCard[]): CardFormState["savedCards"] {
  return cards.map(({ tranId, maskedPan, bank, brand, alias }) => ({
    tranId,
    maskedPan,
    bank,
    brand,
    alias,
  }));
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
  const karaoke = karaokeExpiredNotice(post.fields.clientRefCode, fromApp);
  if (karaoke) {
    return renderPaymentNotice(karaoke.title, karaoke.body, karaoke.link);
  }
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

/** Kart alanının `/odeme` adresindeki adı (`alan=`): sabit, kartsız. */
const RETURN_FIELD: Record<CardField, CheckoutReturnField> = {
  holderName: "ad",
  number: "numara",
  expiry: "skt",
  cvv: "guvenlik",
};

/** `/odeme`'ye dönüş: 303, önbelleğe alınmaz, yalnız sabit kodlar. */
function backToCheckout(
  base: string,
  code: CheckoutReturnCode,
  extra: { field?: CheckoutReturnField; minutes?: number },
): NextResponse {
  return seeOther(base, checkoutReturnPath(code, extra));
}

/** Sitenin kendi bir sayfasına 303; önbelleğe alınmaz. */
function seeOther(base: string, path: string): NextResponse {
  const res = NextResponse.redirect(new URL(path, base), 303);
  res.headers.set("cache-control", "no-store, max-age=0");
  return res;
}

/**
 * An unreadable payment link - forged, cut short, or from a deployment whose
 * key has changed - on the standalone page. That page is the APP's (the web
 * checkout posts with `return=checkout` and is answered above), and its
 * in-app browser used to be sent to the web checkout with an empty cart.
 * The payload cannot be trusted to say which order it was, so the page says
 * what happened and offers both ways on: back to the app, or the site's
 * checkout. Never a blank page, never a card processed.
 */
function unreadableNotice(): PaynkolayPage {
  return renderPaymentNotice(
    "Ödeme sayfası açılamadı",
    "Bu ödeme bağlantısı okunamadı; kartından para çekilmedi. Uygulamadan geldiysen uygulamaya dönüp siparişinin ödemesini yeniden başlat. Sitedeysen ödeme adımından yeniden devam edebilirsin.",
    { href: APP_SCHEME, label: "Uygulamaya dön" },
    { href: "/odeme", label: "Sitede ödemeye dön" },
  );
}
