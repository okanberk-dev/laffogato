import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";

import type {
  CheckoutInput,
  CheckoutSession,
  PaymentProvider,
  RefundResult,
  ReturnConfirmation,
  WebhookEvent,
} from "./provider";

/**
 * iyzico sanal POS sağlayıcısı — Checkout Form (ödeme sayfası iyzico'da açılır).
 *
 * Neden Checkout Form: kart verisi hiçbir aşamada bu uygulamadan geçmez, 3D
 * Secure akışını iyzico yürütür ve PCI-DSS yükümlülüğü bizde doğmaz. Kart
 * numarası kabul eden bir API (`payment/auth`) bilinçli olarak kullanılmıyor.
 *
 * Akış:
 *   1. `createCheckoutSession` → `POST /payment/iyzipos/checkoutform/initialize/auth/ecom`
 *      `token` + `paymentPageUrl` döner; müşteri o sayfaya yönlendirilir.
 *   2. Müşteri ödemeyi tamamlar → iyzico `callbackUrl`'e POST eder ve ayrıca
 *      (panelden tanımlıysa) webhook gönderir.
 *   3. `verifyWebhook` bildirimin imzasını doğrular, sonra tutarı ve durumu
 *      **iyzico'ya sorarak** teyit eder — bildirim gövdesine güvenilmez.
 *   4. `refund` → `POST /payment/refund` (kısmi iade destekli).
 *
 * Kimlik doğrulama: iyzico'nun v2 `IYZWSv2` şeması. İmza, HMAC-SHA256 ile
 * `randomKey + uriPath + requestBody` üzerinden üretilir.
 */

const DEFAULT_BASE_URL = "https://api.iyzipay.com";

/** iyzico'nun döndürdüğü, bizim okuduğumuz alanlar. */
interface IyzicoInitializeResponse {
  status?: string;
  errorCode?: string;
  errorMessage?: string;
  token?: string;
  paymentPageUrl?: string;
  tokenExpireTime?: number;
}

interface IyzicoRetrieveResponse {
  status?: string;
  errorCode?: string;
  errorMessage?: string;
  paymentStatus?: string;
  paymentId?: string;
  /** Ana para birimi cinsinden, ondalıklı metin: "129.90". */
  paidPrice?: string;
  currency?: string;
  basketId?: string;
  conversationId?: string;
  /** Present when the buyer ticked "kartımı kaydet" on the hosted form. */
  cardUserKey?: string;
}

interface IyzicoRefundResponse {
  status?: string;
  errorCode?: string;
  errorMessage?: string;
  paymentTransactionId?: string;
  price?: string;
}

export interface IyzicoConfig {
  apiKey: string;
  secretKey: string;
  /** Sandbox için https://sandbox-api.iyzipay.com */
  baseUrl?: string;
  /** Bildirim imzasını doğrulamak için panelde tanımlanan gizli anahtar. */
  webhookSecret: string;
  /** Ödeme sonrası iyzico'nun POST edeceği mutlak URL. */
  callbackUrl: string;
}

/** Kuruş → iyzico'nun beklediği ondalıklı metin ("12990" → "129.90"). */
function toMajorString(minor: number): string {
  return (minor / 100).toFixed(2);
}

/** Ondalıklı metin → kuruş. Yuvarlama, kayan nokta hatasını engeller. */
function toMinor(major: string | undefined): number {
  const n = Number.parseFloat(major ?? "0");
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
}

/**
 * iyzico bir alanın boş kalmasını kabul etmez; eksik adres/şehir bilgisi
 * isteğin tamamını reddettirir. Misafir veya eksik profilde en azından geçerli
 * bir yer tutucu göndeririz.
 */
function orFallback(value: string | undefined, fallback: string): string {
  const v = (value ?? "").trim();
  return v.length > 0 ? v : fallback;
}

export class IyzicoPaymentProvider implements PaymentProvider {
  readonly name = "iyzico";

  private readonly cfg: Required<Omit<IyzicoConfig, "baseUrl">> & {
    baseUrl: string;
  };

  constructor(cfg: IyzicoConfig) {
    this.cfg = {
      ...cfg,
      baseUrl: (cfg.baseUrl ?? DEFAULT_BASE_URL).replace(/\/$/, ""),
    };
  }

  // ── İmzalama ─────────────────────────────────────────────────────────────

  /**
   * `IYZWSv2` yetkilendirme başlığı.
   *
   * imza = HMAC-SHA256(secretKey, randomKey + uriPath + requestBody) → hex
   * header = base64("apiKey:…&randomKey:…&signature:…")
   */
  private authorizationHeader(
    uriPath: string,
    body: string,
    randomKey: string,
  ): string {
    const signature = createHmac("sha256", this.cfg.secretKey)
      .update(randomKey + uriPath + body)
      .digest("hex");
    const payload = [
      `apiKey:${this.cfg.apiKey}`,
      `randomKey:${randomKey}`,
      `signature:${signature}`,
    ].join("&");
    return `IYZWSv2 ${Buffer.from(payload).toString("base64")}`;
  }

  private async post<T>(uriPath: string, body: unknown): Promise<T> {
    const raw = JSON.stringify(body);
    const randomKey = `${Date.now()}${randomUUID().replace(/-/g, "").slice(0, 12)}`;
    const res = await fetch(`${this.cfg.baseUrl}${uriPath}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: this.authorizationHeader(uriPath, raw, randomKey),
        "x-iyzi-rnd": randomKey,
      },
      body: raw,
      // Ödeme çağrıları asla önbelleğe alınmaz.
      cache: "no-store",
    });
    if (!res.ok) {
      throw new Error(`iyzico ${uriPath} HTTP ${res.status}`);
    }
    return (await res.json()) as T;
  }

  // ── PaymentProvider ──────────────────────────────────────────────────────

  async createCheckoutSession(input: CheckoutInput): Promise<CheckoutSession> {
    const [firstName, ...rest] = input.customer.fullName.trim().split(/\s+/);
    const address = [input.shippingAddress.line1, input.shippingAddress.line2]
      .filter(Boolean)
      .join(" ");

    const buyer = {
      id: input.customer.id,
      name: orFallback(firstName, "Misafir"),
      surname: orFallback(rest.join(" "), "Müşteri"),
      email: input.customer.email,
      gsmNumber: orFallback(input.customer.phone, "+905000000000"),
      identityNumber: "11111111111", // iyzico zorunlu tutar; TCKN toplamıyoruz.
      registrationAddress: orFallback(address, "Adres belirtilmedi"),
      city: orFallback(input.shippingAddress.city, "İstanbul"),
      country: "Turkey",
      ip: input.buyerIp ?? "0.0.0.0",
    };

    const toAddress = (label: string) => ({
      contactName: orFallback(input.customer.fullName, "Misafir Müşteri"),
      city: orFallback(input.shippingAddress.city, "İstanbul"),
      country: "Turkey",
      address: orFallback(address, label),
    });

    // Sepet kalemlerinin toplamı `price`; `paidPrice` kargo ve indirim
    // uygulandıktan sonra tahsil edilecek tutardır. iyzico ikisinin farklı
    // olmasına izin verir, ama kalem toplamı `price`'a eşit olmak zorundadır.
    const basketItems = input.items.map((it, i) => ({
      id: it.variantId || it.productId || `line-${i + 1}`,
      name: it.name.slice(0, 200),
      category1: "Bottega",
      itemType: "PHYSICAL",
      price: toMajorString(it.unitPriceMinor * it.quantity),
    }));
    const basketTotalMinor = input.items.reduce(
      (sum, it) => sum + it.unitPriceMinor * it.quantity,
      0,
    );

    const res = await this.post<IyzicoInitializeResponse>(
      "/payment/iyzipos/checkoutform/initialize/auth/ecom",
      {
        locale: "tr",
        conversationId: input.orderId,
        price: toMajorString(basketTotalMinor),
        paidPrice: toMajorString(input.amountMinor),
        currency: input.currency,
        basketId: input.orderId,
        paymentGroup: "PRODUCT",
        callbackUrl: this.cfg.callbackUrl,
        enabledInstallments: [1, 2, 3, 6, 9, 12],
        // Saved cards. `cardUserKey` makes iyzico's own form list the cards
        // this member stored before; `enabledCardStorage` is what draws the
        // "kartımı kaydet" tick on it. The card never leaves that page — we
        // only ever learn the key it comes back with.
        ...(input.cardUserKey ? { cardUserKey: input.cardUserKey } : {}),
        enabledCardStorage: true,
        buyer,
        shippingAddress: toAddress("Teslimat adresi"),
        billingAddress: toAddress("Fatura adresi"),
        basketItems,
      },
    );

    if (res.status !== "success" || !res.token || !res.paymentPageUrl) {
      throw new Error(
        `iyzico checkout init failed: ${res.errorCode ?? "?"} ${res.errorMessage ?? ""}`.trim(),
      );
    }

    return {
      providerRef: res.token,
      redirectUrl: res.paymentPageUrl,
      expiresAt: new Date(
        Date.now() + (res.tokenExpireTime ?? 1800) * 1000,
      ).toISOString(),
    };
  }

  /**
   * Bildirimin imzasını doğrular, ardından sonucu iyzico'dan **yeniden sorar**.
   *
   * Bildirim gövdesindeki tutar ve durum tek başına delil sayılmaz: imza sızsa
   * bile ödendi bilgisi yalnızca iyzico'nun kendi yanıtından okunur.
   */
  async verifyWebhook(req: Request): Promise<WebhookEvent> {
    const signature =
      req.headers.get("x-iyz-signature-v3") ?? req.headers.get("x-signature");
    if (!signature) throw new Error("missing_signature");

    const rawBody = await req.text();
    const expected = createHmac("sha256", this.cfg.webhookSecret)
      .update(rawBody)
      .digest("hex");
    const given = Buffer.from(signature, "hex");
    const want = Buffer.from(expected, "hex");
    if (given.length !== want.length || !timingSafeEqual(given, want)) {
      throw new Error("invalid_signature");
    }

    const notice = JSON.parse(rawBody) as {
      token?: string;
      paymentConversationId?: string;
      iyziEventType?: string;
    };
    const token = notice.token;
    if (!token) throw new Error("missing_token");

    const detail = await this.post<IyzicoRetrieveResponse>(
      "/payment/iyzipos/checkoutform/auth/ecom/detail",
      { locale: "tr", token, conversationId: notice.paymentConversationId },
    );

    const orderId = detail.basketId || detail.conversationId || "";
    if (!orderId) throw new Error("missing_order_reference");

    const refunded = notice.iyziEventType?.toUpperCase().includes("REFUND");
    const paid =
      detail.status === "success" && detail.paymentStatus === "SUCCESS";

    return {
      type: refunded
        ? "payment.refunded"
        : paid
          ? "payment.succeeded"
          : "payment.failed",
      orderId,
      // paymentId iadeler için gereken kalıcı referanstır; token tek seferliktir.
      providerRef: detail.paymentId || token,
      amountMinor: toMinor(detail.paidPrice),
      currency: "TRY",
      raw: { notice, detail },
      occurredAt: new Date().toISOString(),
    };
  }

  /**
   * iyzico, ödeme bittiğinde müşterinin TARAYICISINI `callbackUrl`e POST eder.
   * Gövdede yalnızca `token` vardır; tutar, durum ve sipariş referansı bu
   * token ile iyzico'ya sorularak alınır — POST edilen gövdeye güvenilmez.
   */
  async confirmReturn(
    params: Record<string, string>,
  ): Promise<ReturnConfirmation> {
    const token = params.token?.trim();
    if (!token) throw new Error("missing_token");

    const detail = await this.post<IyzicoRetrieveResponse>(
      "/payment/iyzipos/checkoutform/auth/ecom/detail",
      {
        locale: "tr",
        token,
        conversationId: params.conversationId || undefined,
      },
    );

    const orderId = detail.basketId || detail.conversationId || "";
    if (!orderId) throw new Error("missing_order_reference");

    return {
      status:
        detail.status === "success" && detail.paymentStatus === "SUCCESS"
          ? "succeeded"
          : "failed",
      orderId,
      // paymentId iadeler için gereken kalıcı referans; token tek seferlik.
      providerRef: detail.paymentId || token,
      amountMinor: toMinor(detail.paidPrice),
      currency: "TRY",
      raw: { source: "iyzico_return", detail },
      // Only when the buyer asked for it. Absent means "do not remember me",
      // and an absent key must never overwrite a stored one.
      cardUserKey: detail.cardUserKey?.trim() || undefined,
    };
  }

  async refund(
    providerRef: string,
    amountMinor?: number,
  ): Promise<RefundResult> {
    const res = await this.post<IyzicoRefundResponse>("/payment/refund", {
      locale: "tr",
      conversationId: providerRef,
      paymentTransactionId: providerRef,
      ...(amountMinor ? { price: toMajorString(amountMinor) } : {}),
      currency: "TRY",
    });

    return {
      providerRef: res.paymentTransactionId ?? providerRef,
      amountMinor: amountMinor ?? toMinor(res.price),
      status: res.status === "success" ? "succeeded" : "failed",
    };
  }
}
