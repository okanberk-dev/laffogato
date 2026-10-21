import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  PaynkolayPaymentProvider,
  formatPaynkolayRnd,
  minorToPaynkolayAmount,
  parsePaynkolayDay,
  paynkolayAmountToMinor,
  paynkolayHash,
  verifyPaynkolayReturnHash,
} from "@/lib/payment/paynkolay";
import type { CheckoutInput } from "@/lib/payment/provider";

const SECRET = "MERCHANT-SECRET-0001";

function makeProvider() {
  return new PaynkolayPaymentProvider({
    sx: "SX-TOKEN",
    sxList: "SX-LIST",
    sxCancel: "SX-CANCEL",
    merchantSecretKey: SECRET,
    merchantNo: "400000001",
    baseUrl: "https://paynkolaytest.nkolayislem.com.tr",
    successUrl: "https://laffogato.net/odeme/donus",
    failUrl: "https://laffogato.net/odeme/donus",
  });
}

function checkoutInput(over: Partial<CheckoutInput> = {}): CheckoutInput {
  return {
    orderId: "ord-0284",
    amountMinor: 128010,
    currency: "TRY",
    customer: { id: "c1", email: "a@b.com", fullName: "Ada Lovelace" },
    billingAddress: { city: "İstanbul", district: "Tuzla", line1: "Adres" },
    shippingAddress: { city: "İstanbul", district: "Tuzla", line1: "Adres" },
    items: [
      {
        productId: "p1",
        name: "Affogato",
        unitPriceMinor: 128010,
        quantity: 1,
      },
    ],
    successUrl: "https://laffogato.net/odeme/donus",
    failureUrl: "https://laffogato.net/odeme?error=payment",
    buyerIp: "88.240.1.2",
    ...over,
  };
}

/** Bir oturumun ara sayfa URL'sinden form alanlarını geri okur. */
function fieldsOf(redirectUrl: string): Record<string, string> {
  const url = new URL(redirectUrl);
  const post = makeProvider().readBridgePost(
    url.searchParams.get("d") ?? "",
    url.searchParams.get("s") ?? "",
  );
  expect(post).not.toBeNull();
  return post!.fields;
}

// ── Tutar dönüşümü (§5) ─────────────────────────────────────────────────────

describe("minorToPaynkolayAmount", () => {
  it("daima iki ondalık basamak, nokta ayraç, binlik ayracı yok", () => {
    expect(minorToPaynkolayAmount(0)).toBe("0.00");
    expect(minorToPaynkolayAmount(5)).toBe("0.05");
    expect(minorToPaynkolayAmount(50)).toBe("0.50");
    expect(minorToPaynkolayAmount(100)).toBe("1.00");
    expect(minorToPaynkolayAmount(25_050)).toBe("250.50");
    expect(minorToPaynkolayAmount(128_010)).toBe("1280.10");
  });

  it("büyük tutarda da kuruş kaybolmaz", () => {
    // Dönüşüm hiç kayan noktaya uğramıyor: lira ve kuruş integer bölme ve
    // moddan geliyor, dize onlardan kuruluyor.
    expect(minorToPaynkolayAmount(1_000_000_000_01)).toBe("1000000000.01");
    expect(minorToPaynkolayAmount(90_071_992_547_409)).toBe("900719925474.09");
  });

  it("kuruş olmayan bir değeri kabul etmez", () => {
    expect(() => minorToPaynkolayAmount(250.5)).toThrow();
    expect(() => minorToPaynkolayAmount(-1)).toThrow();
    expect(() => minorToPaynkolayAmount(Number.NaN)).toThrow();
  });
});

describe("paynkolayAmountToMinor", () => {
  it("dizeyi integer aritmetiğiyle kuruşa çevirir", () => {
    expect(paynkolayAmountToMinor("1280.10")).toBe(128_010);
    expect(paynkolayAmountToMinor("1.00")).toBe(100);
    expect(paynkolayAmountToMinor("0.05")).toBe(5);
    expect(paynkolayAmountToMinor("250")).toBe(25_000);
    expect(paynkolayAmountToMinor("250,50")).toBe(25_050);
  });

  it("okunamayan değer sıfır değil null döner", () => {
    expect(paynkolayAmountToMinor("")).toBeNull();
    expect(paynkolayAmountToMinor(undefined)).toBeNull();
    expect(paynkolayAmountToMinor("1.234")).toBeNull();
    expect(paynkolayAmountToMinor("1.280,10")).toBeNull();
  });

  it("gidiş-dönüş kuruşu korur", () => {
    for (const minor of [0, 1, 99, 100, 128_010, 999_999_99]) {
      expect(paynkolayAmountToMinor(minorToPaynkolayAmount(minor))).toBe(minor);
    }
  });
});

// ── Hash (§10, §1.2, §2, §3) ────────────────────────────────────────────────

describe("paynkolayHash", () => {
  it("SHA-512'nin HAM özetini base64'ler, hex'lemez", () => {
    const digest = paynkolayHash(["a"], SECRET);
    expect(digest).toHaveLength(88); // 64 bayt → base64
    expect(digest.endsWith("==")).toBe(true);
    expect(digest).not.toMatch(/^[0-9a-f]+$/);
  });

  it("dokümandaki alan sırasını pinler - istek hash'i (§10)", () => {
    expect(
      paynkolayHash(
        [
          "SX-TOKEN",
          "ord-0284",
          "1280.10",
          "https://laffogato.net/odeme/donus",
          "https://laffogato.net/odeme/donus",
          "09.08.2021 15:24:22",
          "",
        ],
        SECRET,
      ),
    ).toBe(
      "P+6xHQ0ClHHJoh27ZusYvwUe1rIurjlnyV5wwIdhAUBVp6oagzsgDl1cpOnmjkqoatJJnwt4ILhg1Gv6BO4KbA==",
    );
  });

  it("dokümandaki alan sırasını pinler - yanıt, liste ve iptal hash'leri", () => {
    expect(
      paynkolayHash(
        [
          "400000001",
          "IKSIRPF102168",
          "S00586",
          "2",
          "true",
          "1630051651137",
          "1",
          "1280.10",
          "949",
        ],
        SECRET,
      ),
    ).toBe(
      "ttYNpDljBnZjdaicZzafecDCSBvdzyoL/82FMs6TVUNWc9LIKifK2WrAJGwJZKyML2gaANfFC7LPwfRmhkVdgw==",
    );
    expect(
      paynkolayHash(
        ["SX-LIST", "09.08.2021", "10.08.2021", "ord-0284"],
        SECRET,
      ),
    ).toBe(
      "PUB+R/G1Cgr8AXdehMmS4MthT8otbjFZ2bunenBqBCdrdUfwak2ZFuOWtAPqfXFps5CgnQNwmGu8Abso3AslzQ==",
    );
    expect(
      paynkolayHash(
        ["SX-CANCEL", "IKSIRPF102168", "refund", "1280.10", "2021.08.09"],
        SECRET,
      ),
    ).toBe(
      "iuCZnb5jeDVbRDj+KWNbafSF5PuuEGviXxHJkw4okYZcxf5RWna7Zvd61u6EVYwExPzxXVGM2wyFEgwxzdv/kQ==",
    );
  });

  it("boş alan konumu atlanmaz - ardışık iki boru işareti kalır", () => {
    // §9.1: kart saklama kullanılmadığında `customerKey` boş gider ama
    // hash'teki KONUMU korunur. Konumu atlamak hash'i sessizce bozar.
    expect(paynkolayHash(["a", "", "b"], SECRET)).not.toBe(
      paynkolayHash(["a", "b"], SECRET),
    );
  });
});

describe("verifyPaynkolayReturnHash", () => {
  const params: Record<string, string> = {
    MERCHANT_NO: "400000001",
    REFERENCE_CODE: "IKSIRPF102168",
    AUTH_CODE: "S00586",
    RESPONSE_CODE: "2",
    USE_3D: "true",
    RND: "1630051651137",
    INSTALLMENT: "1",
    AUTHORIZATION_AMOUNT: "1280.10",
    hashDataV2:
      "ttYNpDljBnZjdaicZzafecDCSBvdzyoL/82FMs6TVUNWc9LIKifK2WrAJGwJZKyML2gaANfFC7LPwfRmhkVdgw==",
  };

  it("CURRENCY_CODE POST edilmediğinde 949'u aday olarak dener (§1.3)", () => {
    expect(verifyPaynkolayReturnHash(params, SECRET)).toBe(true);
  });

  it("kurcalanmış tutarı reddeder", () => {
    expect(
      verifyPaynkolayReturnHash(
        { ...params, AUTHORIZATION_AMOUNT: "1.00" },
        SECRET,
      ),
    ).toBe(false);
  });

  it("hash yoksa ya da başka bir sırla üretilmişse reddeder", () => {
    expect(
      verifyPaynkolayReturnHash({ ...params, hashDataV2: "" }, SECRET),
    ).toBe(false);
    expect(verifyPaynkolayReturnHash(params, "BASKA-SIR")).toBe(false);
  });
});

// ── Tarih biçimleri (§3, §6) ────────────────────────────────────────────────

describe("tarih biçimleri", () => {
  it("rnd Europe/Istanbul saatiyle dd.MM.yyyy HH:mm:ss üretir", () => {
    // 2021-08-09T12:24:22Z → İstanbul'da 15:24:22 (UTC+3).
    expect(formatPaynkolayRnd(new Date("2021-08-09T12:24:22Z"))).toBe(
      "09.08.2021 15:24:22",
    );
  });

  it("TRX_DATE'i saat dilimine bulaşmadan takvim gününe indirger", () => {
    expect(parsePaynkolayDay("2021-08-27")).toEqual({
      key: "2021-08-27",
      trxDate: "2021.08.27",
    });
    expect(parsePaynkolayDay("27.08.2021 23:40:00")).toEqual({
      key: "2021-08-27",
      trxDate: "2021.08.27",
    });
    expect(parsePaynkolayDay("bilinmiyor")).toBeNull();
  });
});

// ── Ödeme formu (§9, §10) ───────────────────────────────────────────────────

describe("createCheckoutSession", () => {
  it("hash'e giren dize ile forma giden dize birebir aynıdır", async () => {
    const session = await makeProvider().createCheckoutSession(checkoutInput());
    const f = fieldsOf(session.redirectUrl);

    expect(f.amount).toBe("1280.10");
    expect(f.hashDataV2).toBe(
      paynkolayHash(
        [
          f.sx,
          f.clientRefCode,
          f.amount,
          f.successUrl,
          f.failUrl,
          f.rnd,
          f.customerKey,
        ],
        SECRET,
      ),
    );
  });

  it("sözleşmede sabitlenen alanları gönderir", async () => {
    const session = await makeProvider().createCheckoutSession(checkoutInput());
    const f = fieldsOf(session.redirectUrl);

    expect(f.sx).toBe("SX-TOKEN");
    expect(f.clientRefCode).toBe("ord-0284");
    expect(f.currencyCode).toBe("949");
    expect(f.use3D).toBe("true"); // §8 - ters ibraz sorumluluğu bankada kalsın
    expect(f.transactionType).toBe("SALES");
    expect(f.cardHolderIP).toBe("88.240.1.2");
    expect(f.customerKey).toBe(""); // kart saklama v1 dışında (§9.1)
    expect(f.agentCode).toBeUndefined(); // bayi yok (§7)
    expect(session.providerRef).toBe("ord-0284");
  });

  it("dönüş adresi env'den gelir, çağıranın sorgu parametreleri korunur", async () => {
    const session = await makeProvider().createCheckoutSession(
      checkoutInput({
        successUrl: "https://laffogato.net/odeme/donus?promo=dropped",
      }),
    );
    const f = fieldsOf(session.redirectUrl);
    expect(f.successUrl).toBe(
      "https://laffogato.net/odeme/donus?promo=dropped",
    );
    // failUrl da POST kabul eden uca gider; /odeme/app-hata bir sayfadır ve
    // form POST'una 405 dönerdi. Çağıranın sorgusu yine taşınıyor - uygulama
    // siparişini oraya `orderId` olarak koyuyor ve dönüş onu okuyor.
    expect(f.failUrl).toBe("https://laffogato.net/odeme/donus?error=payment");
  });

  it("merchantSecretKey'i URL'ye koymaz", async () => {
    const session = await makeProvider().createCheckoutSession(checkoutInput());
    expect(session.redirectUrl).not.toContain(SECRET);
    expect(
      Buffer.from(
        new URL(session.redirectUrl).searchParams.get("d") ?? "",
        "base64url",
      ).toString("utf8"),
    ).not.toContain(SECRET);
  });

  it("ara sayfaya giden yük kurcalanırsa form kurulmaz", async () => {
    const session = await makeProvider().createCheckoutSession(checkoutInput());
    const url = new URL(session.redirectUrl);
    const payload = JSON.parse(
      Buffer.from(url.searchParams.get("d") ?? "", "base64url").toString(
        "utf8",
      ),
    ) as { action: string; fields: Record<string, string> };

    // `use3D` ve `transactionType` PayNkolay'ın hash'inin DIŞINDA: imza
    // olmasa müşteri 3D'yi kapatabilir ya da tahsilatı askıda bırakabilirdi.
    payload.fields.use3D = "";
    payload.fields.transactionType = "PRESALES";
    const tampered = Buffer.from(JSON.stringify(payload), "utf8").toString(
      "base64url",
    );

    expect(
      makeProvider().readBridgePost(tampered, url.searchParams.get("s") ?? ""),
    ).toBeNull();
  });
});

// ── Dönüş teyidi (§1.3, §2) ─────────────────────────────────────────────────

const RETURN_PARAMS: Record<string, string> = {
  RESPONSE_CODE: "2",
  RESPONSE_DATA: "İşlem Başarılı",
  USE_3D: "true",
  RND: "1630051651137",
  MERCHANT_NO: "400000001",
  AUTH_CODE: "S00586",
  REFERENCE_CODE: "IKSIRPF102168",
  CLIENT_REFERENCE_CODE: "ord-0284",
  TRANSACTION_AMOUNT: "1280.10",
  AUTHORIZATION_AMOUNT: "1280.10",
  INSTALLMENT: "1",
  hashDataV2:
    "ttYNpDljBnZjdaicZzafecDCSBvdzyoL/82FMs6TVUNWc9LIKifK2WrAJGwJZKyML2gaANfFC7LPwfRmhkVdgw==",
};

function transactionRow(over: Record<string, string> = {}) {
  return {
    STATUS: "SUCCESS",
    REFERENCE_CODE: "IKSIRPF102168",
    CLIENT_REFERENCE_CODE: "ord-0284",
    AUTHORIZATION_AMOUNT: "1280.10",
    TRANSACTION_TYPE: "sales",
    TRX_DATE: "2021-08-09",
    ...over,
  };
}

/** Servis yanıtlarını sırayla veren bir fetch taklidi. */
function stubFetch(...payloads: unknown[]) {
  const calls: { url: string; fields: Record<string, string> }[] = [];
  const fetchMock = vi.fn(async (url: string | URL, init?: RequestInit) => {
    const body = init?.body as FormData;
    const fields: Record<string, string> = {};
    for (const [k, v] of body.entries()) {
      if (typeof v === "string") fields[k] = v;
    }
    calls.push({ url: String(url), fields });
    const payload = payloads[Math.min(calls.length - 1, payloads.length - 1)];
    return new Response(JSON.stringify(payload), {
      headers: { "content-type": "application/json" },
    });
  });
  vi.stubGlobal("fetch", fetchMock);
  return calls;
}

describe("confirmReturn", () => {
  beforeEach(() => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("kararı dönen parametreden değil, sorgudan verir", async () => {
    const calls = stubFetch({ Data: [transactionRow()] });
    const result = await makeProvider().confirmReturn(RETURN_PARAMS);

    expect(calls[0].url).toContain("/Vpos/Payment/PaymentList");
    expect(calls[0].fields.clientRefCode).toBe("ord-0284");
    expect(calls[0].fields.sx).toBe("SX-LIST"); // satış sx'i değil (§7)
    expect(result.status).toBe("succeeded");
    expect(result.amountMinor).toBe(128_010);
    // İade PayNkolay'ın referansını ister, bizim clientRefCode'umuzu değil.
    expect(result.providerRef).toBe("IKSIRPF102168");
    // İşlemin POS günü ödeme satırına yazılsın diye döner (iade onu ister).
    expect(result.trxDate).toBe("2021-08-09");
  });

  it("gün okunamıyorsa trxDate hiç dönmez; iade eski aramaya kalır", async () => {
    stubFetch({ Data: [transactionRow({ TRX_DATE: "bilinmiyor" })] });
    const result = await makeProvider().confirmReturn(RETURN_PARAMS);
    expect(result.status).toBe("succeeded");
    expect(result).not.toHaveProperty("trxDate");
  });

  it("sorguda karşılığı olmayan sahte dönüşü reddeder", async () => {
    // Müşteri RESPONSE_CODE=2 ve bir AUTH_CODE uydurabilir; sorgu boş döner.
    stubFetch({ Data: [] });
    const result = await makeProvider().confirmReturn({
      ...RETURN_PARAMS,
      REFERENCE_CODE: "UYDURMA1",
      hashDataV2: "sahte",
    });
    expect(result.status).toBe("failed");
  });

  it("reddedilen dönüşün kaydına kart sahibinin adını yazmaz", async () => {
    // Belgelenen gövde adı taşımıyor; taşırsa da `payment_transactions.raw`'a
    // girmesin (kural 28, withoutHolderName).
    stubFetch({ Data: [] });
    const result = await makeProvider().confirmReturn({
      ...RETURN_PARAMS,
      CARD_HOLDER_NAME: "AYSE YILMAZ",
    });
    expect(result.status).toBe("failed");
    const raw = result.raw as { params: Record<string, string> };
    expect(raw.params).not.toHaveProperty("CARD_HOLDER_NAME");
    expect(raw.params.CLIENT_REFERENCE_CODE).toBe("ord-0284");
    expect(JSON.stringify(result.raw)).not.toContain("AYSE");
  });

  it("tutar uyuşmazlığında başarısız sayar", async () => {
    stubFetch({ Data: [transactionRow({ AUTHORIZATION_AMOUNT: "1.00" })] });
    const result = await makeProvider().confirmReturn(RETURN_PARAMS);
    expect(result.status).toBe("failed");
    expect(result.amountMinor).toBe(0);
  });

  it("STATUS=NEW'i ödendi saymaz (§8.1 AUTOCOMPLETE tuzağı)", async () => {
    stubFetch({ Data: [transactionRow({ STATUS: "NEW" })] });
    expect((await makeProvider().confirmReturn(RETURN_PARAMS)).status).toBe(
      "failed",
    );
  });

  it("üye işyeri numarası uyuşmazlığında uyarır, kararı yine sorgu verir", async () => {
    // Yanlış girilmiş bir PAYNKOLAY_MERCHANT_NO her gerçek ödemeyi
    // reddettirmesin: sorgu bizim sx List'imizle yapılıyor ve yalnız bizim
    // işlemlerimizi döndürüyor.
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const calls = stubFetch({ Data: [transactionRow()] });
    const result = await makeProvider().confirmReturn({
      ...RETURN_PARAMS,
      MERCHANT_NO: "999999999",
    });
    expect(calls).toHaveLength(1);
    expect(result.status).toBe("succeeded");
    expect(warn.mock.calls.flat().join(" ")).toMatch(/MERCHANT_NO/);
  });

  it("başka üye işyerinden gelen sahte dönüş sorguda karşılık bulamaz", async () => {
    stubFetch({ result: { RESPONSE_CODE: "0", LIST: null } });
    const result = await makeProvider().confirmReturn({
      ...RETURN_PARAMS,
      MERCHANT_NO: "999999999",
    });
    expect(result.status).toBe("failed");
  });

  it("sipariş referansı olmadan çalışmaz", async () => {
    stubFetch({ Data: [] });
    await expect(
      makeProvider().confirmReturn({
        ...RETURN_PARAMS,
        CLIENT_REFERENCE_CODE: "",
      }),
    ).rejects.toThrow(/CLIENT_REFERENCE_CODE/);
  });

  it("merchantSecretKey'i hiçbir isteğe koymaz", async () => {
    const calls = stubFetch({ Data: [transactionRow()] });
    await makeProvider().confirmReturn(RETURN_PARAMS);
    for (const value of Object.values(calls[0].fields)) {
      expect(value).not.toContain(SECRET);
    }
  });
});

// ── Dönüşsüz sorgu (süpürme, §14.6/2) ───────────────────────────────────────

describe("lookupPayment", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("dönüş gelmemiş başarılı ödemeyi bulur", async () => {
    const calls = stubFetch({
      Data: [transactionRow({ STATUS: "NEW" }), transactionRow()],
    });
    const found = await makeProvider().lookupPayment(
      "ord-0284",
      new Date("2026-09-23T10:00:00Z"),
    );
    expect(calls[0].url).toContain("/Vpos/Payment/PaymentList");
    expect(calls[0].fields.clientRefCode).toBe("ord-0284");
    expect(found?.status).toBe("succeeded");
    expect(found?.amountMinor).toBe(128_010);
    expect(found?.providerRef).toBe("IKSIRPF102168");
    expect(found?.trxDate).toBe("2021-08-09");
  });

  it("NEW ya da boş sorguyu ödeme saymaz", async () => {
    stubFetch({ Data: [transactionRow({ STATUS: "NEW" })] });
    expect(
      await makeProvider().lookupPayment("ord-0284", new Date()),
    ).toBeNull();
    stubFetch({ Data: [] });
    expect(
      await makeProvider().lookupPayment("ord-0284", new Date()),
    ).toBeNull();
  });

  it("tutarı okunamayan başarılı işlemde 'ödenmedi' demez, fırlatır", async () => {
    stubFetch({ Data: [transactionRow({ AUTHORIZATION_AMOUNT: "" })] });
    await expect(
      makeProvider().lookupPayment("ord-0284", new Date()),
    ).rejects.toThrow(/tutarı okunamadı/);
  });

  it("siparişin gününden bir gün geriden, birkaç günlük pencereyle sorar", async () => {
    // Servis bir aydan uzun aralık kabul etmiyor (§2): eski bir siparişte
    // pencere bugüne kadar uzasaydı sorgu reddedilirdi.
    const calls = stubFetch({ Data: [] });
    await makeProvider().lookupPayment(
      "ord-0284",
      new Date("2026-01-20T12:00:00Z"),
    );
    expect(calls[0].fields.startDate).toBe("19.01.2026");
    expect(calls[0].fields.endDate).toBe("23.01.2026");
  });

  it("POS'ta iptal ya da iade edilmiş satışı ödeme saymaz", async () => {
    stubFetch({
      Data: [
        transactionRow(),
        transactionRow({ TRANSACTION_TYPE: "cancel", REFERENCE_CODE: "X2" }),
      ],
    });
    expect(
      await makeProvider().lookupPayment("ord-0284", new Date()),
    ).toBeNull();
  });
});

// ── İptal / iade (§3) ───────────────────────────────────────────────────────

describe("refund", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  function reportPayload(trxDate: string) {
    return {
      data: [
        {
          referenceCode: "IKSIRPF102168",
          authorizationAmount: "1280.10",
          trxDate,
          status: "SUCCESS",
        },
      ],
    };
  }

  it("aynı gün yapılan işlemi cancel eder", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-06T09:00:00Z"));
    const calls = stubFetch(reportPayload("2026-09-06"), { responseCode: "2" });

    const res = await makeProvider().refund("IKSIRPF102168", 128_010);

    const cancel = calls[calls.length - 1];
    expect(cancel.url).toContain("/Vpos/v1/CancelRefundPayment");
    expect(cancel.fields.type).toBe("cancel");
    expect(cancel.fields.amount).toBe("1280.10");
    expect(cancel.fields.trxDate).toBe("2026.09.06"); // yyyy.aa.gg
    expect(cancel.fields.sx).toBe("SX-CANCEL");
    expect(cancel.fields.hashDatav2).toBe(
      paynkolayHash(
        ["SX-CANCEL", "IKSIRPF102168", "cancel", "1280.10", "2026.09.06"],
        SECRET,
      ),
    );
    expect(res.status).toBe("succeeded");
    expect(res.amountMinor).toBe(128_010);
  });

  it("sonraki günlerde refund'a düşer", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-06T09:00:00Z"));
    const calls = stubFetch(reportPayload("2026-09-01"), { responseCode: "2" });

    await makeProvider().refund("IKSIRPF102168");
    expect(calls[calls.length - 1].fields.type).toBe("refund");
  });

  it("kısmi iadeyi sessizce yapmak yerine reddeder (§3.2)", async () => {
    stubFetch(reportPayload("2026-09-01"));
    await expect(
      makeProvider().refund("IKSIRPF102168", 50_000),
    ).rejects.toThrow(/kısmi iade/);
  });

  it("POS reddederse fırlatır - 'iade edildi' kaydı doğmasın", async () => {
    stubFetch(reportPayload("2026-09-01"), {
      responseCode: "99",
      responseData: "Yetersiz bakiye",
    });
    await expect(makeProvider().refund("IKSIRPF102168")).rejects.toThrow(
      /reddedildi/,
    );
  });

  it("işlemi bulamazsa iade denemez", async () => {
    stubFetch({ data: [] });
    await expect(makeProvider().refund("BULUNMAYAN")).rejects.toThrow(
      /bulunamadı/,
    );
  });

  describe("ödeme satırı günü biliyorsa (payment_transactions.trxDate)", () => {
    it("raporlama servisini hiç aramadan doğrudan iade eder", async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-09-06T09:00:00Z"));
      const calls = stubFetch({ responseCode: "2" });

      const res = await makeProvider().refund("IKSIRPF102168", 128_010, {
        trxDate: "2026-09-01",
        paidMinor: 128_010,
      });

      // Tek istek: iptal/iade. On üç aylık pencere taranmadı.
      expect(calls).toHaveLength(1);
      expect(calls[0].url).toContain("/Vpos/v1/CancelRefundPayment");
      expect(calls[0].fields.type).toBe("refund");
      expect(calls[0].fields.amount).toBe("1280.10");
      expect(calls[0].fields.trxDate).toBe("2026.09.01");
      expect(calls[0].fields.hashDatav2).toBe(
        paynkolayHash(
          ["SX-CANCEL", "IKSIRPF102168", "refund", "1280.10", "2026.09.01"],
          SECRET,
        ),
      );
      expect(res).toEqual({
        providerRef: "IKSIRPF102168",
        amountMinor: 128_010,
        status: "succeeded",
      });
    });

    it("aynı gün ise yine cancel seçer", async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-09-06T09:00:00Z"));
      const calls = stubFetch({ responseCode: "2" });
      await makeProvider().refund("IKSIRPF102168", undefined, {
        trxDate: "2026-09-06",
        paidMinor: 128_010,
      });
      expect(calls).toHaveLength(1);
      expect(calls[0].fields.type).toBe("cancel");
      expect(calls[0].fields.trxDate).toBe("2026.09.06");
    });

    it("kısmi iadeyi burada da reddeder, POS'a hiç gitmeden", async () => {
      const calls = stubFetch({ responseCode: "2" });
      await expect(
        makeProvider().refund("IKSIRPF102168", 50_000, {
          trxDate: "2026-09-01",
          paidMinor: 128_010,
        }),
      ).rejects.toThrow(/kısmi iade/);
      expect(calls).toHaveLength(0);
    });

    it.each([
      ["boş gün (kolondan önceki satır)", { trxDate: "", paidMinor: 128_010 }],
      ["okunamayan gün", { trxDate: "09/01/2026", paidMinor: 128_010 }],
      ["sıfır tahsilat", { trxDate: "2026-09-01", paidMinor: 0 }],
      ["tutarsız ipucu", { trxDate: "2026-09-01" }],
    ])("%s: eski aramaya düşer", async (_label, hint) => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-09-06T09:00:00Z"));
      const calls = stubFetch(reportPayload("2026-09-02"), {
        responseCode: "2",
      });
      await makeProvider().refund("IKSIRPF102168", 128_010, hint);
      expect(calls[0].url).not.toContain("CancelRefundPayment");
      const cancel = calls[calls.length - 1];
      expect(cancel.url).toContain("/Vpos/v1/CancelRefundPayment");
      // Tarih raporlama servisinden okundu, ipucundan değil.
      expect(cancel.fields.trxDate).toBe("2026.09.02");
    });
  });
});

// ── Webhook (§4) ────────────────────────────────────────────────────────────

describe("verifyWebhook", () => {
  it("sessizce başarılı dönmez; nedenini söyleyerek patlar", async () => {
    await expect(
      makeProvider().verifyWebhook(new Request("https://laffogato.net/x")),
    ).rejects.toThrow(/webhook/i);
  });
});

// ── Sağlayıcı seçimi ve yapılandırma ────────────────────────────────────────

describe("getPaymentProvider", () => {
  const ENV = [
    ["PAYNKOLAY_SX", "SX-TOKEN"],
    ["PAYNKOLAY_SX_LIST", "SX-LIST"],
    ["PAYNKOLAY_SX_CANCEL", "SX-CANCEL"],
    ["PAYNKOLAY_MERCHANT_SECRET_KEY", SECRET],
    ["PAYNKOLAY_MERCHANT_NO", "400000001"],
    ["PAYNKOLAY_SUCCESS_URL", "https://laffogato.net/odeme/donus"],
    ["PAYNKOLAY_FAIL_URL", "https://laffogato.net/odeme/donus"],
  ] as const;

  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv("PAYMENT_PROVIDER", "paynkolay");
    for (const [key, value] of ENV) vi.stubEnv(key, value);
  });
  afterEach(() => vi.unstubAllEnvs());

  it("paynkolay'ı kurar", async () => {
    const { getPaymentProvider } = await import("@/lib/payment");
    expect(getPaymentProvider().name).toBe("paynkolay");
  });

  it("eksik bir değişkenle açılmaz (fail-closed)", async () => {
    vi.stubEnv("PAYNKOLAY_MERCHANT_SECRET_KEY", "");
    const { getPaymentProvider } = await import("@/lib/payment");
    expect(() => getPaymentProvider()).toThrow(/PAYNKOLAY_MERCHANT_SECRET_KEY/);
  });

  it("üretimde mock'u reddeder", async () => {
    vi.stubEnv("PAYMENT_PROVIDER", "mock");
    vi.stubEnv("NODE_ENV", "production");
    const { getPaymentProvider } = await import("@/lib/payment");
    expect(() => getPaymentProvider()).toThrow(/mock/);
  });

  it("PayNkolay tek gerçek sağlayıcıdır; iyzico kaldırıldı (15 Eki 2026)", async () => {
    const index = readFileSync("src/lib/payment/index.ts", "utf8");
    expect(index).toContain('case "paynkolay"');
    expect(index).not.toMatch(/iyzico/i);
    vi.stubEnv("PAYMENT_PROVIDER", "iyzico");
    const { getPaymentProvider } = await import("@/lib/payment");
    expect(() => getPaymentProvider()).toThrow(/Unknown PAYMENT_PROVIDER/);
  });

  it("ödeme modunu PAYNKOLAY_CHECKOUT_MODE'dan okur, yazım hatasında açılmaz", async () => {
    vi.stubEnv("PAYNKOLAY_CHECKOUT_MODE", "direct");
    let mod = await import("@/lib/payment");
    expect(
      (mod.getPaymentProvider() as PaynkolayPaymentProvider).checkoutMode,
    ).toBe("direct");

    vi.resetModules();
    vi.stubEnv("PAYNKOLAY_CHECKOUT_MODE", "");
    mod = await import("@/lib/payment");
    expect(
      (mod.getPaymentProvider() as PaynkolayPaymentProvider).checkoutMode,
    ).toBe("hosted");

    vi.resetModules();
    vi.stubEnv("PAYNKOLAY_CHECKOUT_MODE", "dirct");
    mod = await import("@/lib/payment");
    expect(() => mod.getPaymentProvider()).toThrow(/PAYNKOLAY_CHECKOUT_MODE/);
  });
});

// ── Ortam belgesi ───────────────────────────────────────────────────────────

describe(".env.example", () => {
  const envExample = readFileSync(".env.example", "utf8");

  it("operatörün gireceği dokuz değişkeni ve ödeme modunu sayar", () => {
    for (const name of [
      "PAYNKOLAY_CHECKOUT_MODE",
      "PAYMENT_PROVIDER",
      "PAYNKOLAY_SX",
      "PAYNKOLAY_SX_LIST",
      "PAYNKOLAY_SX_CANCEL",
      "PAYNKOLAY_MERCHANT_SECRET_KEY",
      "PAYNKOLAY_MERCHANT_NO",
      "PAYNKOLAY_BASE_URL",
      "PAYNKOLAY_SUCCESS_URL",
      "PAYNKOLAY_FAIL_URL",
    ]) {
      expect(envExample).toContain(name);
    }
  });

  it("dönüş adreslerini POST kabul eden uca yönlendirir", () => {
    // /odeme/app-hata bir sayfadır; PayNkolay'ın form POST'una 405 döner.
    for (const line of envExample
      .split("\n")
      .filter((l) => /PAYNKOLAY_(SUCCESS|FAIL)_URL=/.test(l))) {
      expect(line).toContain("/odeme/donus");
    }
  });

  it("gerçek sırrı gerçek sır diye işaretler", () => {
    expect(envExample).toContain("PAYNKOLAY_MERCHANT_SECRET_KEY");
    expect(envExample).toMatch(/TEK GERÇEK SIR/);
  });
});
