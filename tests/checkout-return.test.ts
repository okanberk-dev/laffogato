import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { PaynkolayPaymentProvider } from "@/lib/payment/paynkolay";
import { CARD_FORM_FIELDS } from "@/lib/payment/paynkolay-card";
import { bankChallengePage } from "@/lib/payment/paynkolay-page";
import type { CheckoutInput } from "@/lib/payment/provider";

/**
 * `POST /odeme/paynkolay` with `return=checkout` - the card typed on /odeme
 * (docs/PAYNKOLAY.md §15.5). Every outcome that cannot go on to the bank
 * comes back to the checkout as `303 /odeme?odeme=<code>`, from a fixed list:
 * never the POS's own words, never a card detail. Without the marker (the
 * app's in-app browser on the standalone page) nothing changes.
 *
 * PayNkolay's published TEST card only; no real card, no network.
 */

const SECRET = "MERCHANT-SECRET-0001";
const NOW = new Date("2026-10-16T10:00:00Z");

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
  });
}

function input(
  successUrl = "https://laffogato.net/odeme/donus",
): CheckoutInput {
  return {
    orderId: "ord-0284",
    amountMinor: 128010,
    currency: "TRY",
    customer: { id: "c1", email: "a@b.com", fullName: "Ada Lovelace" },
    billingAddress: { city: "", district: "", line1: "Adres" },
    shippingAddress: { city: "", district: "", line1: "Adres" },
    items: [
      { productId: "", name: "Affogato", unitPriceMinor: 128010, quantity: 1 },
    ],
    successUrl,
    failureUrl: "https://laffogato.net/odeme?error=payment",
    buyerIp: "88.240.1.2",
  };
}

async function payload(successUrl?: string) {
  const session = await makeProvider().createCheckoutSession(input(successUrl));
  const url = new URL(session.redirectUrl);
  return {
    d: url.searchParams.get("d") ?? "",
    s: url.searchParams.get("s") ?? "",
  };
}

const SANDBOX_3D_HTML =
  '<html><body><form method="post" action="https://vpostest.qnb.com.tr/x" id="f">' +
  '<input type="hidden" name="PaReq" value="abc" /></form>' +
  "<script>document.getElementById('f').submit();</script></body></html>";

function stubPos(payload: unknown, status = 200) {
  const calls: string[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string | URL) => {
      calls.push(String(url));
      return new Response(JSON.stringify(payload), {
        status,
        headers: { "content-type": "application/json" },
      });
    }),
  );
  return calls;
}

const getPaymentProvider = vi.fn();
const reserveLoginAttempt = vi.fn();
const checkLoginLimit = vi.fn();
const recordLoginFailure = vi.fn();

vi.mock("@/lib/payment", () => ({ getPaymentProvider }));
vi.mock("@/lib/admin/rate-limit", () => ({
  reserveLoginAttempt,
  checkLoginLimit,
  recordLoginFailure,
  clientIpFrom: (h: Headers) =>
    h.get("x-forwarded-for")?.split(",")[0].trim() ?? "",
}));

const route = await import("@/app/odeme/paynkolay/route");

const OPEN = { blocked: false, retryAfterSeconds: 0, remaining: 4 };

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

async function checkoutBody(over: Record<string, string> = {}) {
  return {
    ...(await payload()),
    return: "checkout",
    [CARD_FORM_FIELDS.holderName]: "Ada Lovelace",
    [CARD_FORM_FIELDS.number]: "4155 6501 0041 6111",
    [CARD_FORM_FIELDS.expiry]: "01/30",
    [CARD_FORM_FIELDS.cvv]: "715",
    ...over,
  };
}

/** The redirect target, checked to carry nothing but the fixed parameters. */
function back(res: Response): URL {
  expect(res.status).toBe(303);
  const url = new URL(res.headers.get("location") ?? "");
  expect(url.origin).toBe("https://laffogato.net");
  expect(url.pathname).toBe("/odeme");
  for (const key of url.searchParams.keys()) {
    expect(["odeme", "alan", "dk"]).toContain(key);
  }
  const raw = url.toString();
  expect(raw).not.toContain("4155");
  expect(raw).not.toContain("715");
  expect(raw).not.toContain("ord-0284");
  expect(res.headers.get("cache-control")).toContain("no-store");
  return url;
}

describe("POST /odeme/paynkolay from the checkout (return=checkout)", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);
    getPaymentProvider.mockReset();
    getPaymentProvider.mockReturnValue(makeProvider());
    reserveLoginAttempt.mockReset();
    reserveLoginAttempt.mockResolvedValue(OPEN);
    checkLoginLimit.mockReset();
    checkLoginLimit.mockResolvedValue(OPEN);
    recordLoginFailure.mockReset();
    recordLoginFailure.mockResolvedValue(OPEN);
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("goes on to the bank exactly as the standalone page does", async () => {
    stubPos({
      RESPONSE_CODE: 2,
      REFERENCE_CODE: "REF",
      BANK_REQUEST_MESSAGE: SANDBOX_3D_HTML,
    });
    const res = await route.POST(post(await checkoutBody()));
    expect(res.status).toBe(200);
    expect(await res.text()).toBe(bankChallengePage(SANDBOX_3D_HTML).html);
  });

  it("a bad card comes back as kart_hatali with the field, never the card", async () => {
    const calls = stubPos({});
    const res = await route.POST(
      post(
        await checkoutBody({ [CARD_FORM_FIELDS.number]: "4155650100416112" }),
      ),
    );
    const url = back(res);
    expect(url.searchParams.get("odeme")).toBe("kart_hatali");
    expect(url.searchParams.get("alan")).toBe("numara");
    expect(calls).toHaveLength(0);
    expect(reserveLoginAttempt).not.toHaveBeenCalled();
  });

  it("names each card field by its own fixed word", async () => {
    stubPos({});
    const cases: [Record<string, string>, string][] = [
      [{ [CARD_FORM_FIELDS.holderName]: "" }, "ad"],
      [{ [CARD_FORM_FIELDS.expiry]: "01/20" }, "skt"],
      [{ [CARD_FORM_FIELDS.cvv]: "7" }, "guvenlik"],
    ];
    for (const [over, field] of cases) {
      const url = back(await route.POST(post(await checkoutBody(over))));
      expect(url.searchParams.get("alan"), field).toBe(field);
    }
  });

  it("the address limit comes back as cok_deneme with the wait", async () => {
    const calls = stubPos({});
    checkLoginLimit.mockResolvedValue({
      blocked: true,
      retryAfterSeconds: 3600,
      remaining: 0,
    });
    const url = back(await route.POST(post(await checkoutBody())));
    expect(url.searchParams.get("odeme")).toBe("cok_deneme");
    expect(url.searchParams.get("dk")).toBe("60");
    expect(calls).toHaveLength(0);
  });

  it("the order limit comes back as cok_deneme with the wait", async () => {
    stubPos({});
    reserveLoginAttempt.mockResolvedValue({
      blocked: true,
      retryAfterSeconds: 1800,
      remaining: 0,
    });
    const url = back(await route.POST(post(await checkoutBody())));
    expect(url.searchParams.get("odeme")).toBe("cok_deneme");
    expect(url.searchParams.get("dk")).toBe("30");
  });

  it("a POS that is down comes back as baslatilamadi", async () => {
    stubPos({ error: "down" }, 503);
    const url = back(await route.POST(post(await checkoutBody())));
    expect(url.searchParams.get("odeme")).toBe("baslatilamadi");
    expect(recordLoginFailure).toHaveBeenCalledWith(
      "card-payment-ip",
      "85.105.1.1",
      "*",
    );
  });

  it("a refusal comes back as reddedildi, without the POS's own words", async () => {
    stubPos({ RESPONSE_CODE: 0, ERROR_MESSAGE: "Kart limiti yetersiz" });
    const res = await route.POST(post(await checkoutBody()));
    const url = back(res);
    expect(url.searchParams.get("odeme")).toBe("reddedildi");
    expect(decodeURIComponent(url.toString())).not.toMatch(/limiti/);
    expect(recordLoginFailure).toHaveBeenCalled();
  });

  it("an expired payload comes back as sure_doldu", async () => {
    stubPos({});
    const body = await checkoutBody();
    vi.setSystemTime(new Date(NOW.getTime() + 31 * 60_000));
    const url = back(await route.POST(post(body)));
    expect(url.searchParams.get("odeme")).toBe("sure_doldu");
  });

  it("a forged payload comes back as baslatilamadi", async () => {
    stubPos({});
    const body = await checkoutBody();
    const url = back(await route.POST(post({ ...body, s: "forged" })));
    expect(url.searchParams.get("odeme")).toBe("baslatilamadi");
  });

  it("a saved card that is not there comes back as kart_yok", async () => {
    stubPos({});
    const url = back(
      await route.POST(
        post(
          await checkoutBody({
            cardChoice: "yes21405",
            [CARD_FORM_FIELDS.number]: "",
            [CARD_FORM_FIELDS.cvv]: "",
          }),
        ),
      ),
    );
    expect(url.searchParams.get("odeme")).toBe("kart_yok");
  });

  it("a new card typed under a saved-card choice comes back as kart_secimi", async () => {
    stubPos({});
    const url = back(
      await route.POST(post(await checkoutBody({ cardChoice: "yes21405" }))),
    );
    expect(url.searchParams.get("odeme")).toBe("kart_secimi");
  });

  it("never deletes a card for a checkout POST (the checkout has its own action)", async () => {
    const calls = stubPos({});
    const url = back(
      await route.POST(post(await checkoutBody({ deleteCard: "yes21405" }))),
    );
    expect(url.searchParams.get("odeme")).toBe("baslatilamadi");
    expect(calls).toHaveLength(0);
  });

  it("leaves the standalone page as it was without the marker", async () => {
    stubPos({});
    const body = await checkoutBody({ [CARD_FORM_FIELDS.number]: "1234" });
    delete (body as Record<string, string>).return;
    const res = await route.POST(post(body));
    expect(res.status).toBe(422);
    expect(await res.text()).toContain('autocomplete="cc-number"');
  });

  it("ignores the marker on an app order's payload", async () => {
    stubPos({});
    const app = await payload(
      "https://laffogato.net/odeme/donus?app=1&orderId=ord-0284",
    );
    const res = await route.POST(
      post({
        ...(await checkoutBody({ [CARD_FORM_FIELDS.number]: "1234" })),
        ...app,
      }),
    );
    expect(res.status).toBe(422);
  });
});

/**
 * No blank page around the payment step (operator, 16 Eki 2026; #113): every
 * answer of the card route that is not a redirect is a page with words and
 * a way on - a link or the form again.
 */
describe("POST /odeme/paynkolay never answers with an empty page", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);
    getPaymentProvider.mockReset();
    getPaymentProvider.mockReturnValue(makeProvider());
    reserveLoginAttempt.mockReset();
    reserveLoginAttempt.mockResolvedValue(OPEN);
    checkLoginLimit.mockReset();
    checkLoginLimit.mockResolvedValue(OPEN);
    recordLoginFailure.mockReset();
    recordLoginFailure.mockResolvedValue(OPEN);
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  async function standalone(over: Record<string, string> = {}) {
    const body: Record<string, string> = await checkoutBody(over);
    delete body.return;
    return body;
  }

  function expectVisible(html: string, label: string) {
    expect(html.length, label).toBeGreaterThan(200);
    expect(html, label).toMatch(/<h1>[^<]+<\/h1>/);
    expect(html, label).toMatch(/<a [^>]*href=|<form /);
  }

  it.each([
    ["a bad card (422)", { [CARD_FORM_FIELDS.number]: "1234" }, {}],
    ["a forged payload (400)", { s: "forged" }, {}],
    ["a refusal (200)", {}, { RESPONSE_CODE: 0, ERROR_MESSAGE: "Red" }],
  ] as const)("%s", async (label, over, pos) => {
    stubPos(pos);
    const res = await route.POST(post(await standalone(over)));
    expect(res.status, label).toBeLessThan(500);
    expectVisible(await res.text(), label);
  });

  it("a POS that is down (502)", async () => {
    stubPos({ error: "down" }, 503);
    const res = await route.POST(post(await standalone()));
    expect(res.status).toBe(502);
    expectVisible(await res.text(), "502");
  });

  it("a limit (429)", async () => {
    stubPos({});
    checkLoginLimit.mockResolvedValue({
      blocked: true,
      retryAfterSeconds: 60,
      remaining: 0,
    });
    const res = await route.POST(post(await standalone()));
    expect(res.status).toBe(429);
    expectVisible(await res.text(), "429");
  });

  it("a hosted-mode or misconfigured provider (405)", async () => {
    getPaymentProvider.mockReturnValue(undefined);
    const res = await route.POST(post(await standalone()));
    expect(res.status).toBe(405);
    expectVisible(await res.text(), "405");
  });

  it("a cross-site post (403)", async () => {
    const res = await route.POST(
      new NextRequest("https://laffogato.net/odeme/paynkolay", {
        method: "POST",
        body: new URLSearchParams(await standalone()),
        headers: {
          "content-type": "application/x-www-form-urlencoded",
          origin: "https://evil.example",
          "sec-fetch-site": "cross-site",
        },
      }),
    );
    expect(res.status).toBe(403);
    expectVisible(await res.text(), "403");
  });

  it("an unreadable body (400)", async () => {
    const res = await route.POST(
      new NextRequest("https://laffogato.net/odeme/paynkolay", {
        method: "POST",
        body: "%%%",
        headers: {
          "content-type": "multipart/form-data; boundary=x",
          origin: "https://laffogato.net",
          "sec-fetch-site": "same-origin",
        },
      }),
    );
    expect(res.status).toBe(400);
    expectVisible(await res.text(), "400");
  });

  it("GET with an unreadable link sends the app's browser back to the app", async () => {
    const res = await route.GET(
      new NextRequest("https://laffogato.net/odeme/paynkolay?d=x&s=y"),
    );
    expect(res.status).toBe(400);
    const html = await res.text();
    expectVisible(html, "GET 400");
    expect(html).toContain('href="laffogato://"');
    expect(html).toContain('href="/odeme"');
  });

  it("GET without the POS configured (503)", async () => {
    getPaymentProvider.mockReturnValue(undefined);
    const res = await route.GET(
      new NextRequest("https://laffogato.net/odeme/paynkolay?d=x&s=y"),
    );
    expect(res.status).toBe(503);
    expectVisible(await res.text(), "GET 503");
  });
});
