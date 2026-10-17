import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  newPaynkolayMemberKey,
  PAYNKOLAY_MEMBER_KEY,
  PaynkolayPaymentProvider,
  paynkolayHash,
} from "@/lib/payment/paynkolay";
import { CARD_FORM_FIELDS, parseCardForm } from "@/lib/payment/paynkolay-card";
import { renderCardForm } from "@/lib/payment/paynkolay-page";
import type { CheckoutInput } from "@/lib/payment/provider";

/**
 * docs/PAYNKOLAY.md §16 - saved cards kept AT PayNkolay, never here.
 * Response shapes are the sandbox's own (15 Eki 2026); card numbers are
 * PayNkolay's published test cards.
 */

const SECRET = "MERCHANT-SECRET-0001";
const MEMBER = "L7F3A9C2E1B";
const TOKEN = "yesWi43AYdh7IXpR/59d0TqGKE90pGMl";

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
    checkoutMode: "direct",
    cardStorage: true,
  });
}

function checkoutInput(cardUserKey?: string): CheckoutInput {
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
    cardUserKey,
  };
}

async function session(cardUserKey?: string) {
  const s = await makeProvider().createCheckoutSession(
    checkoutInput(cardUserKey),
  );
  const url = new URL(s.redirectUrl);
  const data = url.searchParams.get("d") ?? "";
  const signature = url.searchParams.get("s") ?? "";
  return {
    url,
    data,
    signature,
    post: makeProvider().readBridgePost(data, signature)!,
  };
}

const LIST_ONE = {
  ClientId: MEMBER,
  Type: null,
  ProcReturnCode: "00",
  ErrMsg: "İşlem Başarılı",
  Data: {
    totalcount: 1,
    cards: {
      Card: {
        CardFileds: {
          Detail: [
            {
              Token: TOKEN,
              TranId: "yes21405",
              Maskedpan: "41556501****6111",
              CARDISSUER: "QNB BANK A.Ş.",
              CARDTYPE: "CREDIT",
              CARDBRAND: "VISA",
              CARD_ALIACE: "Test Kartim",
              EXP_DATE: null,
            },
          ],
        },
      },
    },
  },
};
const LIST_NONE = {
  ClientId: MEMBER,
  Type: null,
  ProcReturnCode: "02",
  ErrMsg: "Gecerli Kart Yok",
  Data: null,
};
const POS_3D = {
  RESPONSE_CODE: 2,
  RESPONSE_DATA: "Ödeme hazırlık süreci başarılı.",
  REFERENCE_CODE: "IKSIRPF2022536",
  BANK_REQUEST_MESSAGE:
    "<html><body><form id=f action='https://acs.example/x'></form><script>document.getElementById('f').submit();</script></body></html>",
};

/** POS taklidi: yanıt, çağrılan uca göre. */
function stubPos(byPath: Record<string, unknown>) {
  const calls: {
    path: string;
    fields: Record<string, string>;
    signal?: AbortSignal;
  }[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string | URL, init?: RequestInit) => {
      const path = new URL(String(url)).pathname;
      const fields: Record<string, string> = {};
      for (const [k, v] of (init?.body as FormData).entries()) {
        if (typeof v === "string") fields[k] = v;
      }
      calls.push({ path, fields, signal: init?.signal ?? undefined });
      return new Response(JSON.stringify(byPath[path] ?? {}), {
        headers: { "content-type": "application/json" },
      });
    }),
  );
  return calls;
}

const testCard = () =>
  (
    parseCardForm(
      (n) =>
        ({
          [CARD_FORM_FIELDS.holderName]: "Ada Lovelace",
          [CARD_FORM_FIELDS.number]: "4155650100416111",
          [CARD_FORM_FIELDS.expiry]: "01/30",
          [CARD_FORM_FIELDS.cvv]: "715",
        })[n] ?? null,
      new Date("2026-10-15T10:00:00Z"),
    ) as { ok: true; card: never }
  ).card;

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("the member key", () => {
  it("is 11 random characters - PayNkolay's limit, and no personal data", () => {
    const keys = new Set(Array.from({ length: 50 }, newPaynkolayMemberKey));
    expect(keys.size).toBe(50);
    for (const key of keys) expect(key).toMatch(PAYNKOLAY_MEMBER_KEY);
  });

  it("rides in the SIGNED payload, outside the hosted form's fields", async () => {
    const { post } = await session(MEMBER);
    expect(post.member).toBe(MEMBER);
    // The hosted form still saves nothing.
    expect(post.fields.customerKey).toBe("");
    expect(Object.values(post.fields)).not.toContain(MEMBER);
  });

  it("stays out of the payload until PayNkolay grants card storage", async () => {
    // Off by default (PAYNKOLAY_CARD_STORAGE unset): no member key, so no
    // saved-card list, no "kartımı kaydet", no cs* field to the POS.
    const off = new PaynkolayPaymentProvider({
      sx: "SX-TOKEN",
      sxList: "SX-LIST",
      sxCancel: "SX-CANCEL",
      merchantSecretKey: SECRET,
      merchantNo: "400000001",
      baseUrl: "https://paynkolaytest.nkolayislem.com.tr",
      successUrl: "https://laffogato.net/odeme/donus",
      failUrl: "https://laffogato.net/odeme/donus",
      checkoutMode: "direct",
    });
    expect(off.cardStorageEnabled).toBe(false);
    const session = await off.createCheckoutSession(checkoutInput(MEMBER));
    const url = new URL(session.redirectUrl);
    const post = off.readBridgePost(
      url.searchParams.get("d")!,
      url.searchParams.get("s")!,
    );
    expect(post?.member).toBeUndefined();
  });

  it("stays out of the hosted mode's plain, readable payload", async () => {
    const hosted = new PaynkolayPaymentProvider({
      sx: "SX-TOKEN",
      sxList: "SX-LIST",
      sxCancel: "SX-CANCEL",
      merchantSecretKey: SECRET,
      merchantNo: "400000001",
      baseUrl: "https://paynkolaytest.nkolayislem.com.tr",
      successUrl: "https://laffogato.net/odeme/donus",
      failUrl: "https://laffogato.net/odeme/donus",
      checkoutMode: "hosted",
    });
    const session = await hosted.createCheckoutSession(checkoutInput(MEMBER));
    const d = new URL(session.redirectUrl).searchParams.get("d")!;
    expect(Buffer.from(d, "base64url").toString("utf8")).not.toContain(MEMBER);
  });

  it("is dropped when it is not a valid key", async () => {
    expect((await session("05349893742x")).post.member).toBeUndefined();
    expect((await session()).post.member).toBeUndefined();
  });

  it("cannot be read or swapped - the direct-mode payload is sealed", async () => {
    const { data, signature } = await session(MEMBER);
    expect(data.startsWith("e1.")).toBe(true);
    expect(
      Buffer.from(data.slice(3), "base64url").toString("latin1"),
    ).not.toContain(MEMBER);
    // Any change to the ciphertext fails authentication (and the HMAC).
    const flipped =
      data.slice(0, 10) + (data[10] === "A" ? "B" : "A") + data.slice(11);
    expect(makeProvider().readBridgePost(flipped, signature)).toBeNull();
  });
});

describe("listSavedCards / deleteSavedCard", () => {
  it("reads the sandbox's nested list and keeps the token server-side", async () => {
    const calls = stubPos({ "/Vpos/Payment/CardStorageCardList": LIST_ONE });
    const cards = await makeProvider().listSavedCards(MEMBER);
    expect(calls[0].fields).toEqual({
      sx: "SX-TOKEN",
      customerKey: MEMBER,
      hashDatav2: paynkolayHash(["SX-TOKEN", MEMBER], SECRET),
    });
    expect(cards).toEqual([
      {
        token: TOKEN,
        tranId: "yes21405",
        maskedPan: "41556501****6111",
        bank: "QNB BANK A.Ş.",
        brand: "VISA",
        alias: "Test Kartim",
      },
    ]);
  });

  it("reads a single Detail object too, and 'no cards' as an empty list", async () => {
    const one = {
      ...LIST_ONE,
      Data: {
        ...LIST_ONE.Data,
        cards: {
          Card: {
            CardFileds: {
              Detail: LIST_ONE.Data.cards.Card.CardFileds.Detail[0],
            },
          },
        },
      },
    };
    stubPos({ "/Vpos/Payment/CardStorageCardList": one });
    expect(await makeProvider().listSavedCards(MEMBER)).toHaveLength(1);
    stubPos({ "/Vpos/Payment/CardStorageCardList": LIST_NONE });
    expect(await makeProvider().listSavedCards(MEMBER)).toEqual([]);
  });

  it("throws on any other answer rather than claiming there are no cards", async () => {
    stubPos({
      "/Vpos/Payment/CardStorageCardList": {
        ProcReturnCode: "99",
        ErrMsg: "Hata",
      },
    });
    await expect(makeProvider().listSavedCards(MEMBER)).rejects.toThrow(/99/);
  });

  it("deletes by token (tranId alone was refused in the sandbox)", async () => {
    const calls = stubPos({
      "/Vpos/Payment/CardStorageCardDelete": {
        RESPONSE_CODE: 2,
        RESPONSE_DATA: "İşlem Başarılı",
      },
    });
    await makeProvider().deleteSavedCard(MEMBER, TOKEN);
    expect(calls[0].fields).toEqual({
      sx: "SX-TOKEN",
      customerKey: MEMBER,
      tranId: "",
      token: TOKEN,
      hashDatav2: paynkolayHash(["SX-TOKEN", MEMBER, "", TOKEN], SECRET),
    });
    stubPos({
      "/Vpos/Payment/CardStorageCardDelete": {
        RESPONSE_CODE: 0,
        RESPONSE_DATA: "Gecersiz Veri",
      },
    });
    await expect(makeProvider().deleteSavedCard(MEMBER, TOKEN)).rejects.toThrow(
      /Gecersiz Veri/,
    );
  });
});

describe("startDirectPayment with card storage", () => {
  it("saves a new card only when asked AND the payload carries a member key", async () => {
    const { post } = await session(MEMBER);
    const calls = stubPos({ "/Vpos/v1/Payment": POS_3D });
    await makeProvider().startDirectPayment(
      post,
      { card: testCard(), save: { alias: "Kartım 6111" } },
      "85.105.1.1",
    );
    const f = calls[0].fields;
    expect(f).toMatchObject({
      csCustomerKey: MEMBER,
      csAutoSave: "true",
      csCardAlias: "Kartım 6111",
      cardNumber: "4155650100416111",
    });
    // The member key takes the hash's customerKey slot (Postman).
    expect(f.hashDatav2).toBe(
      paynkolayHash(
        [
          "SX-TOKEN",
          "ord-0284",
          "1280.10",
          f.successUrl,
          f.failUrl,
          f.rnd,
          MEMBER,
        ],
        SECRET,
      ),
    );

    const guest = (await session()).post;
    const guestCalls = stubPos({ "/Vpos/v1/Payment": POS_3D });
    await makeProvider().startDirectPayment(
      guest,
      { card: testCard(), save: { alias: "x" } },
      "",
    );
    expect(guestCalls[0].fields).not.toHaveProperty("csCustomerKey");
    expect(guestCalls[0].fields).not.toHaveProperty("csAutoSave");
  });

  it("pays with a saved card without any card field", async () => {
    const { post } = await session(MEMBER);
    const calls = stubPos({ "/Vpos/v1/Payment": POS_3D });
    const result = await makeProvider().startDirectPayment(
      post,
      { savedToken: TOKEN },
      "85.105.1.1",
    );
    expect(result.kind).toBe("3d");
    const f = calls[0].fields;
    expect(f).toMatchObject({
      csCustomerKey: MEMBER,
      csToken: TOKEN,
      use3D: "true",
    });
    for (const field of [
      "cardNumber",
      "cvv",
      "month",
      "year",
      "cardHolderName",
    ]) {
      expect(f).not.toHaveProperty(field);
    }
    expect(f.hashDatav2).toBe(
      paynkolayHash(
        [
          "SX-TOKEN",
          "ord-0284",
          "1280.10",
          f.successUrl,
          f.failUrl,
          f.rnd,
          MEMBER,
        ],
        SECRET,
      ),
    );
  });

  it("refuses a saved card without a member key", async () => {
    const { post } = await session();
    const calls = stubPos({ "/Vpos/v1/Payment": POS_3D });
    await expect(
      makeProvider().startDirectPayment(post, { savedToken: TOKEN }, ""),
    ).rejects.toThrow(/üye anahtarı/);
    expect(calls).toHaveLength(0);
  });
});

describe("the card page with saved cards", () => {
  const page = renderCardForm({
    data: "DATA",
    signature: "SIG",
    amount: "1280.10",
    savedCards: [
      {
        tranId: "yes21405",
        maskedPan: "41556501****6111",
        bank: "QNB BANK A.Ş.",
        brand: "VISA",
        alias: "Test Kartim",
      },
    ],
    canSave: true,
  });

  it("lists the card masked, preselected, with a delete button", () => {
    expect(page.html).toContain("•••• 6111");
    expect(page.html).toContain("QNB BANK A.Ş. · VISA · Test Kartim");
    expect(page.html).toMatch(/value="yes21405" checked/);
    expect(page.html).toMatch(
      /form="del-card" name="deleteCard" value="yes21405"/,
    );
    expect(page.html).toContain('value="new"');
  });

  // Implicit submission (Enter, a phone keyboard's Go) clicks the form's
  // default button: the first submit button whose form owner is that form.
  // A "Sil" owned by #pay and placed before the pay button made Enter delete
  // the first saved card instead of paying (review of PR #110).
  it("makes the pay button the pay form's only, so default, submit button", () => {
    const pay = /<form id="pay"[\s\S]*?<\/form>/.exec(page.html)![0];
    const owned = [...pay.matchAll(/<button\b[^>]*>/g)]
      .map((m) => m[0])
      .filter((tag) => /type="submit"/.test(tag) && !/\bform=/.test(tag));
    expect(owned).toHaveLength(1);
    expect(owned[0]).toContain('id="pay-btn"');
  });

  it("deletes through its own form, which carries no card field", () => {
    const del = /<form id="del-card"[\s\S]*?<\/form>/.exec(page.html)![0];
    expect(page.html.indexOf('<form id="del-card"')).toBeGreaterThan(
      page.html.indexOf("</form>"),
    );
    expect(del).toContain('name="d"');
    expect(del).toContain('name="s"');
    for (const field of Object.values(CARD_FORM_FIELDS)) {
      expect(del).not.toContain(`name="${field}"`);
    }
  });

  it("offers saving unticked, and does not force new-card fields", () => {
    expect(page.html).toMatch(
      /<input type="checkbox" name="saveCard" value="1">/,
    );
    expect(page.html).not.toMatch(/name="saveCard"[^>]*checked/);
    expect(page.html).not.toMatch(/id="cc-number"[^>]*required/);
  });

  it("keeps the new-card fields required when there is nothing saved", () => {
    const plain = renderCardForm({ data: "D", signature: "S", amount: "1.00" });
    expect(plain.html).toMatch(/id="cc-number"[^>]*required/);
    expect(plain.html).not.toContain('name="saveCard"');
  });
});

// ── Rota ────────────────────────────────────────────────────────────────────

const getPaymentProvider = vi.fn();
const reserveLoginAttempt = vi.fn();
vi.mock("@/lib/payment", () => ({ getPaymentProvider }));
const OPEN_LIMIT = { blocked: false, retryAfterSeconds: 0, remaining: 4 };
vi.mock("@/lib/admin/rate-limit", () => ({
  reserveLoginAttempt,
  checkLoginLimit: async () => OPEN_LIMIT,
  recordLoginFailure: async () => OPEN_LIMIT,
  clientIpFrom: (h: Headers) =>
    h.get("x-forwarded-for")?.split(",")[0].trim() ?? "",
}));
// Every order here still awaits its payment; the last look before the sale
// has its own tests (paynkolay-card-page.test.ts).
vi.mock("@/lib/payment/bridge-gate", () => ({
  bridgeChargeGate: async () => ({ kind: "open" }),
}));
const route = await import("@/app/odeme/paynkolay/route");

function post(body: Record<string, string>) {
  return new NextRequest("https://laffogato.net/odeme/paynkolay", {
    method: "POST",
    body: new URLSearchParams(body),
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      origin: "https://laffogato.net",
      "sec-fetch-site": "same-origin",
      "x-forwarded-for": "85.105.1.1",
    },
  });
}

describe("/odeme/paynkolay with saved cards", () => {
  beforeEach(() => {
    getPaymentProvider.mockReset();
    getPaymentProvider.mockReturnValue(makeProvider());
    reserveLoginAttempt.mockReset();
    reserveLoginAttempt.mockResolvedValue({
      blocked: false,
      retryAfterSeconds: 0,
      remaining: 4,
    });
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  it("GET lists the member's cards and never puts a token in the page", async () => {
    stubPos({ "/Vpos/Payment/CardStorageCardList": LIST_ONE });
    const { url } = await session(MEMBER);
    const html = await (await route.GET(new NextRequest(url))).text();
    expect(html).toContain("•••• 6111");
    expect(html).not.toContain(TOKEN);
    expect(html).toContain('name="saveCard"');
  });

  it("GET still takes a new card when the POS cannot list", async () => {
    stubPos({ "/Vpos/Payment/CardStorageCardList": { ProcReturnCode: "99" } });
    const { url } = await session(MEMBER);
    const res = await route.GET(new NextRequest(url));
    expect(res.status).toBe(200);
    expect(await res.text()).toMatch(/id="cc-number"[^>]*required/);
  });

  it("POST pays with the chosen saved card, token looked up server-side", async () => {
    const calls = stubPos({
      "/Vpos/Payment/CardStorageCardList": LIST_ONE,
      "/Vpos/v1/Payment": POS_3D,
    });
    const { data, signature } = await session(MEMBER);
    const res = await route.POST(
      post({ d: data, s: signature, cardChoice: "yes21405" }),
    );
    expect(res.status).toBe(200);
    const pay = calls.find((c) => c.path === "/Vpos/v1/Payment")!;
    expect(pay.fields.csToken).toBe(TOKEN);
    expect(pay.fields).not.toHaveProperty("cardNumber");
  });

  it("POST refuses a tranId that is not in the member's list", async () => {
    const calls = stubPos({
      "/Vpos/Payment/CardStorageCardList": LIST_ONE,
      "/Vpos/v1/Payment": POS_3D,
    });
    const { data, signature } = await session(MEMBER);
    const res = await route.POST(
      post({ d: data, s: signature, cardChoice: "yes99999" }),
    );
    expect(res.status).toBe(422);
    expect(calls.some((c) => c.path === "/Vpos/v1/Payment")).toBe(false);
  });

  it("POST saves a new card only when the box is ticked", async () => {
    const calls = stubPos({
      "/Vpos/Payment/CardStorageCardList": LIST_NONE,
      "/Vpos/v1/Payment": POS_3D,
    });
    const { data, signature } = await session(MEMBER);
    const card = {
      d: data,
      s: signature,
      cardChoice: "new",
      [CARD_FORM_FIELDS.holderName]: "Ada Lovelace",
      [CARD_FORM_FIELDS.number]: "4155 6501 0041 6111",
      [CARD_FORM_FIELDS.expiry]: "01/30",
      [CARD_FORM_FIELDS.cvv]: "715",
    };
    await route.POST(post(card));
    let pay = calls.filter((c) => c.path === "/Vpos/v1/Payment").at(-1)!;
    expect(pay.fields).not.toHaveProperty("csAutoSave");
    await route.POST(post({ ...card, saveCard: "1" }));
    pay = calls.filter((c) => c.path === "/Vpos/v1/Payment").at(-1)!;
    expect(pay.fields).toMatchObject({
      csAutoSave: "true",
      csCustomerKey: MEMBER,
      csCardAlias: "Kartım 6111",
    });
  });

  it("POST asks instead of charging the saved card when a new card was typed", async () => {
    const calls = stubPos({
      "/Vpos/Payment/CardStorageCardList": LIST_ONE,
      "/Vpos/v1/Payment": POS_3D,
    });
    const { data, signature } = await session(MEMBER);
    const res = await route.POST(
      post({
        d: data,
        s: signature,
        cardChoice: "yes21405",
        [CARD_FORM_FIELDS.number]: "4155 6501 0041 6111",
      }),
    );
    expect(res.status).toBe(422);
    expect(await res.text()).toContain("Yeni kartla öde");
    expect(calls.some((c) => c.path === "/Vpos/v1/Payment")).toBe(false);
  });

  it("POST pays with a new card without waiting on the saved-card list", async () => {
    const calls = stubPos({
      "/Vpos/Payment/CardStorageCardList": LIST_ONE,
      "/Vpos/v1/Payment": POS_3D,
    });
    const { data, signature } = await session(MEMBER);
    const res = await route.POST(
      post({
        d: data,
        s: signature,
        cardChoice: "new",
        [CARD_FORM_FIELDS.holderName]: "Ada Lovelace",
        [CARD_FORM_FIELDS.number]: "4155 6501 0041 6111",
        [CARD_FORM_FIELDS.expiry]: "01/30",
        [CARD_FORM_FIELDS.cvv]: "715",
      }),
    );
    expect(res.status).toBe(200);
    expect(calls.map((c) => c.path)).toEqual(["/Vpos/v1/Payment"]);
  });

  it("gives every POS call a deadline", async () => {
    const calls = stubPos({
      "/Vpos/Payment/CardStorageCardList": LIST_ONE,
      "/Vpos/Payment/CardStorageCardDelete": { RESPONSE_CODE: 2 },
      "/Vpos/v1/Payment": POS_3D,
    });
    const provider = makeProvider();
    await provider.listSavedCards(MEMBER);
    await provider.deleteSavedCard(MEMBER, TOKEN);
    const { post: payload } = await session(MEMBER);
    await provider.startDirectPayment(payload, { savedToken: TOKEN }, "");
    expect(calls).toHaveLength(3);
    for (const call of calls) expect(call.signal).toBeInstanceOf(AbortSignal);
  });

  it("POST deletes a saved card and redraws the page without it", async () => {
    const calls = stubPos({
      "/Vpos/Payment/CardStorageCardList": LIST_ONE,
      "/Vpos/Payment/CardStorageCardDelete": { RESPONSE_CODE: 2 },
      "/Vpos/v1/Payment": POS_3D,
    });
    const { data, signature } = await session(MEMBER);
    const res = await route.POST(
      post({ d: data, s: signature, deleteCard: "yes21405" }),
    );
    const html = await res.text();
    expect(res.status).toBe(200);
    expect(html).toContain("Kayıtlı kart silindi.");
    expect(html).not.toContain("•••• 6111");
    expect(
      calls.find((c) => c.path === "/Vpos/Payment/CardStorageCardDelete")!
        .fields.token,
    ).toBe(TOKEN);
    expect(calls.some((c) => c.path === "/Vpos/v1/Payment")).toBe(false);
    expect(reserveLoginAttempt).not.toHaveBeenCalled();
  });
});

describe("the payment record", () => {
  it("drops the cardholder's name before it is stored", async () => {
    stubPos({
      "/Vpos/Payment/PaymentList": {
        result: {
          LIST: [
            {
              STATUS: "SUCCESS",
              REFERENCE_CODE: "IKSIRPF102168",
              CLIENT_REFERENCE_CODE: "ord-0284",
              AUTHORIZATION_AMOUNT: "1280.10",
              TRANSACTION_TYPE: "sales",
              TRX_DATE: "2026-10-15",
              CARD_HOLDER_NAME: "ADA LOVELACE",
              CARD_NUMBER: "415565******6111",
            },
          ],
        },
      },
    });
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const result = await makeProvider().confirmReturn({
      CLIENT_REFERENCE_CODE: "ord-0284",
      REFERENCE_CODE: "IKSIRPF102168",
    });
    expect(result.status).toBe("succeeded");
    expect(JSON.stringify(result.raw)).not.toContain("ADA LOVELACE");
    expect(JSON.stringify(result.raw)).toContain("415565******6111");
  });
});
