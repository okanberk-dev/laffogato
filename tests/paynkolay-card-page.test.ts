import { createHash } from "node:crypto";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  PaynkolayPaymentProvider,
  extractRows,
  parsePaynkolayRnd,
  formatPaynkolayRnd,
  paynkolayHash,
  unwrapPaynkolayResult,
  type PaynkolayCheckoutMode,
} from "@/lib/payment/paynkolay";
import {
  CARD_FORM_FIELDS,
  luhnValid,
  maskCardLikeDigits,
  parseCardForm,
  parseExpiry,
} from "@/lib/payment/paynkolay-card";
import {
  bankChallengePage,
  renderCardForm,
  renderHostedRedirect,
} from "@/lib/payment/paynkolay-page";
import type { CheckoutInput } from "@/lib/payment/provider";

/**
 * docs/PAYNKOLAY.md §15 - the card typed on the site's own payment page,
 * forwarded to `/Vpos/v1/Payment`, and the bank's 3D form handed back.
 *
 * The card numbers here are PayNkolay's published TEST cards
 * (paynkolay.com.tr/entegrasyon/07-test-cards.php); no real card is used.
 */

const SECRET = "MERCHANT-SECRET-0001";
const TEST_CARD = "4155650100416111";
const NOW = new Date("2026-10-15T10:00:00Z");

function makeProvider(checkoutMode: PaynkolayCheckoutMode = "direct") {
  return new PaynkolayPaymentProvider({
    sx: "SX-TOKEN",
    sxList: "SX-LIST",
    sxCancel: "SX-CANCEL",
    merchantSecretKey: SECRET,
    merchantNo: "400000001",
    baseUrl: "https://paynkolaytest.nkolayislem.com.tr",
    successUrl: "https://laffogato.net/odeme/donus",
    failUrl: "https://laffogato.net/odeme/donus",
    checkoutMode,
  });
}

function checkoutInput(): CheckoutInput {
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
  };
}

async function signedPayload(provider = makeProvider()) {
  const session = await provider.createCheckoutSession(checkoutInput());
  const url = new URL(session.redirectUrl);
  const data = url.searchParams.get("d") ?? "";
  const signature = url.searchParams.get("s") ?? "";
  const post = provider.readBridgePost(data, signature)!;
  return { url, data, signature, post };
}

const sha256 = (text: string) =>
  `'sha256-${createHash("sha256").update(text, "utf8").digest("base64")}'`;

function cardForm(over: Record<string, string> = {}) {
  const values: Record<string, string> = {
    [CARD_FORM_FIELDS.holderName]: "Ada Lovelace",
    [CARD_FORM_FIELDS.number]: "4155 6501 0041 6111",
    [CARD_FORM_FIELDS.expiry]: "01/30",
    [CARD_FORM_FIELDS.cvv]: "715",
    ...over,
  };
  return (name: string) => values[name] ?? null;
}

/** The sandbox's real answer (15 Eki 2026), PaReq and MD shortened. */
const SANDBOX_3D_HTML =
  "<!DOCTYPE html><html><head><title>Payment MPI Service</title></head><body>" +
  '<form method="post" action="./Default.aspx" id="step1Form">' +
  '<input type="hidden" name="PaReq" value="eJxVUttygjAQ" />' +
  '<input type="hidden" name="TermUrl" value="https://vpostest.qnb.com.tr/Gateway/Mpi/FromMPIToGateway.aspx" />' +
  '<input type="hidden" name="MD" value="UGF5bWVudFZQT1NE" />' +
  "<script type='text/javascript'>var frm = document.getElementById('step1Form');" +
  "frm.action = 'https://vpostest.qnb.com.tr/PayforACSSimulator/Default.aspx' ;" +
  'frm.method = "POST";frm.submit();</script></form></body></html>';

// ── Kart doğrulama ──────────────────────────────────────────────────────────

describe("parseCardForm", () => {
  it("accepts a published test card, spaces and all", () => {
    const check = parseCardForm(cardForm(), NOW);
    expect(check).toEqual({
      ok: true,
      card: {
        holderName: "Ada Lovelace",
        number: TEST_CARD,
        expMonth: "01",
        expYear: "2030",
        cvv: "715",
      },
    });
  });

  it("refuses a mistyped number before it reaches the POS (Luhn)", () => {
    expect(luhnValid(TEST_CARD)).toBe(true);
    expect(luhnValid("4155650100416112")).toBe(false);
    const check = parseCardForm(
      cardForm({ [CARD_FORM_FIELDS.number]: "4155650100416112" }),
      NOW,
    );
    expect(check).toMatchObject({ ok: false, field: "number" });
  });

  it("refuses an expired card by Istanbul's month, not UTC's", () => {
    // 30 Eyl 2026 22:30 UTC is already 1 Eki in Istanbul: 09/26 has expired.
    const lateSeptemberUtc = new Date("2026-09-30T22:30:00Z");
    expect(
      parseCardForm(
        cardForm({ [CARD_FORM_FIELDS.expiry]: "09/26" }),
        lateSeptemberUtc,
      ),
    ).toMatchObject({ ok: false, field: "expiry" });
    expect(
      parseCardForm(cardForm({ [CARD_FORM_FIELDS.expiry]: "10/26" }), NOW).ok,
    ).toBe(true);
  });

  it("reads the expiry the ways a customer types it", () => {
    expect(parseExpiry("01/30")).toEqual({ month: 1, year: 2030 });
    expect(parseExpiry("1/2030")).toEqual({ month: 1, year: 2030 });
    expect(parseExpiry("0130")).toEqual({ month: 1, year: 2030 });
    expect(parseExpiry("13/30")).toBeNull();
    expect(parseExpiry("abc")).toBeNull();
  });

  it("refuses a short CVV and a name that is not a name", () => {
    expect(
      parseCardForm(cardForm({ [CARD_FORM_FIELDS.cvv]: "71" }), NOW),
    ).toMatchObject({ ok: false, field: "cvv" });
    expect(
      parseCardForm(
        cardForm({ [CARD_FORM_FIELDS.holderName]: "<script>" }),
        NOW,
      ),
    ).toMatchObject({ ok: false, field: "holderName" });
    expect(
      parseCardForm(
        cardForm({ [CARD_FORM_FIELDS.holderName]: "Şükrü Öğütçü" }),
        NOW,
      ).ok,
    ).toBe(true);
  });

  it("never puts what was typed into its messages", () => {
    const cases: Record<string, string>[] = [
      { [CARD_FORM_FIELDS.number]: "4155650100416112" },
      { [CARD_FORM_FIELDS.cvv]: "71" },
      { [CARD_FORM_FIELDS.expiry]: "13/99" },
    ];
    for (const over of cases) {
      const check = parseCardForm(cardForm(over), NOW);
      expect(check.ok).toBe(false);
      if (!check.ok) {
        expect(check.message).not.toMatch(/4155|715|13\/99/);
      }
    }
  });

  it("masks anything shaped like a card number in outside text", () => {
    expect(maskCardLikeDigits(`Kart ${TEST_CARD} reddedildi`)).toBe(
      "Kart **** reddedildi",
    );
    expect(maskCardLikeDigits("4155 6501 0041 6111")).toBe("****");
    expect(maskCardLikeDigits("Hata kodu 05")).toBe("Hata kodu 05");
  });
});

// ── Ödeme yükünün yaşı ──────────────────────────────────────────────────────

describe("isBridgeFresh", () => {
  it("reads the payload's own rnd back as an instant", () => {
    expect(parsePaynkolayRnd(formatPaynkolayRnd(NOW))?.toISOString()).toBe(
      NOW.toISOString(),
    );
    expect(parsePaynkolayRnd("dün")).toBeNull();
  });

  it("accepts a payload for thirty minutes, then refuses it", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    try {
      const provider = makeProvider();
      const { post } = await signedPayload(provider);
      expect(provider.isBridgeFresh(post, NOW)).toBe(true);
      expect(
        provider.isBridgeFresh(post, new Date(NOW.getTime() + 29 * 60_000)),
      ).toBe(true);
      expect(
        provider.isBridgeFresh(post, new Date(NOW.getTime() + 31 * 60_000)),
      ).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });
});

// ── POS'a giden istek ───────────────────────────────────────────────────────

function stubPos(payload: unknown, status = 200) {
  const calls: { url: string; fields: Record<string, string> }[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string | URL, init?: RequestInit) => {
      const fields: Record<string, string> = {};
      for (const [k, v] of (init?.body as FormData).entries()) {
        if (typeof v === "string") fields[k] = v;
      }
      calls.push({ url: String(url), fields });
      return new Response(JSON.stringify(payload), {
        status,
        headers: { "content-type": "application/json" },
      });
    }),
  );
  return calls;
}

const POS_3D = {
  RESPONSE_CODE: 2,
  RESPONSE_DATA: "Ödeme hazırlık süreci başarılı.",
  REFERENCE_CODE: "IKSIRPF2022529",
  MERCHANT_NO: "400000273",
  USE_3D: true,
  BANK_REQUEST_MESSAGE: SANDBOX_3D_HTML,
};

describe("startDirectPayment", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("sends the signed payload's values with the card, as the sandbox took them", async () => {
    const { post } = await signedPayload();
    const calls = stubPos(POS_3D);
    const card = (parseCardForm(cardForm(), NOW) as { ok: true; card: never })
      .card;
    const result = await makeProvider().startDirectPayment(
      post,
      card,
      "85.105.1.1",
    );

    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe(
      "https://paynkolaytest.nkolayislem.com.tr/Vpos/v1/Payment",
    );
    const f = calls[0].fields;
    expect(f).toMatchObject({
      sx: "SX-TOKEN",
      clientRefCode: "ord-0284",
      amount: "1280.10",
      successUrl: post.fields.successUrl,
      failUrl: post.fields.failUrl,
      rnd: post.fields.rnd,
      installmentNo: "1",
      cardHolderName: "Ada Lovelace",
      cardNumber: TEST_CARD,
      month: "01",
      year: "2030",
      cvv: "715",
      use3D: "true",
      transactionType: "SALES",
      environment: "API",
      currencyNumber: "949",
      cardHolderIP: "85.105.1.1",
    });
    // The same request hash as the hosted form (§10), small `v` (§11.1).
    expect(f.hashDatav2).toBe(
      paynkolayHash(
        ["SX-TOKEN", "ord-0284", "1280.10", f.successUrl, f.failUrl, f.rnd, ""],
        SECRET,
      ),
    );
    for (const value of Object.values(f)) expect(value).not.toContain(SECRET);

    expect(result).toEqual({
      kind: "3d",
      html: SANDBOX_3D_HTML,
      referenceCode: "IKSIRPF2022529",
    });
  });

  it("reports a refusal without echoing the card back", async () => {
    const { post } = await signedPayload();
    stubPos({
      RESPONSE_CODE: 0,
      ERROR_CODE: "VPS-1005",
      ERROR_MESSAGE: `Kart ${TEST_CARD} için <b>işlem</b> yapılamadı`,
    });
    const card = (parseCardForm(cardForm(), NOW) as { ok: true; card: never })
      .card;
    const result = await makeProvider().startDirectPayment(post, card, "");
    expect(result).toEqual({
      kind: "declined",
      code: "VPS-1005",
      message: "Kart **** için işlem yapılamadı",
    });
  });

  it("fails without the card in the error when the POS is down", async () => {
    const { post } = await signedPayload();
    stubPos({}, 503);
    const card = (parseCardForm(cardForm(), NOW) as { ok: true; card: never })
      .card;
    const err = await makeProvider()
      .startDirectPayment(post, card, "")
      .catch((e: unknown) => e as Error);
    expect(err).toBeInstanceOf(Error);
    expect(String((err as Error).message)).not.toMatch(/4155|715/);
  });

  it("refuses a payload whose 3D flag is not on, without calling the POS", async () => {
    const { post } = await signedPayload();
    const calls = stubPos(POS_3D);
    const card = (parseCardForm(cardForm(), NOW) as { ok: true; card: never })
      .card;
    await expect(
      makeProvider().startDirectPayment(
        { ...post, fields: { ...post.fields, use3D: "" } },
        card,
        "",
      ),
    ).rejects.toThrow(/3D/);
    expect(calls).toHaveLength(0);
  });
});

// ── Servis yanıtının gerçek biçimi (canlıda ölçüldü, §12) ───────────────────

describe("the services' real response shape", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  const LIVE_EMPTY = {
    id: "",
    result: {
      RESPONSE_CODE: "0",
      RESPONSE_DATA: "Listelenecek kayıt bulunamadı.",
      LIST: null,
      ERROR_CODE: "CORE0305",
    },
    error: null,
  };
  const LIVE_HASH_ERROR = {
    result:
      '{"RESPONSE_CODE":0,"ERROR_CODE":"","RESPONSE_DATA":"API : hashData error :: "}',
  };
  const row = {
    STATUS: "SUCCESS",
    REFERENCE_CODE: "IKSIRPF102168",
    CLIENT_REFERENCE_CODE: "ord-0284",
    AUTHORIZATION_AMOUNT: "1280.10",
    TRANSACTION_TYPE: "sales",
    TRX_DATE: "2026-10-15",
  };

  it("finds the rows under result.LIST", () => {
    expect(extractRows({ ...LIVE_EMPTY, result: { LIST: [row] } })).toEqual([
      row,
    ]);
    expect(extractRows(LIVE_EMPTY)).toEqual([]);
    expect(unwrapPaynkolayResult(LIVE_HASH_ERROR)).toMatchObject({
      RESPONSE_DATA: "API : hashData error :: ",
    });
  });

  it("confirms a real payment returned in that shape", async () => {
    stubPos({ id: "", result: { LIST: [row] }, error: null });
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const result = await makeProvider().confirmReturn({
      CLIENT_REFERENCE_CODE: "ord-0284",
      REFERENCE_CODE: "IKSIRPF102168",
      AUTHORIZATION_AMOUNT: "1280.10",
    });
    expect(result.status).toBe("succeeded");
    expect(result.amountMinor).toBe(128010);
  });

  it("does not read a wrong-key answer as 'not paid' (rule 29)", async () => {
    stubPos(LIVE_HASH_ERROR);
    await expect(makeProvider().lookupPayment("ord-0284", NOW)).rejects.toThrow(
      /hashData/,
    );
    stubPos(LIVE_EMPTY);
    await expect(makeProvider().lookupPayment("ord-0284", NOW)).resolves.toBe(
      null,
    );
  });
});

// ── Sayfalar ve CSP'leri ────────────────────────────────────────────────────

function inline(html: string, tag: "script" | "style"): string[] {
  return [
    ...html.matchAll(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`, "g")),
  ].map((m) => m[1]);
}

describe("the card form page", () => {
  const page = renderCardForm({
    data: "DATA",
    signature: "SIG",
    amount: "1280.10",
  });

  it("allows exactly its own inline script and style, nothing else", () => {
    const csp = page.csp;
    expect(csp).toContain("default-src 'none'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("form-action 'self'");
    expect(csp).toContain("base-uri 'none'");
    expect(csp).not.toContain("unsafe-inline");
    expect(csp).not.toContain("googletagmanager");
    const [script] = inline(page.html, "script");
    const [style] = inline(page.html, "style");
    expect(csp).toContain(`script-src ${sha256(script)}`);
    expect(csp).toContain(`style-src ${sha256(style)}`);
    // No external resource of any kind.
    expect(page.html).not.toMatch(/\b(src|href)="https?:/);
  });

  it("asks for the card with the browser's autofill names", () => {
    for (const ac of ["cc-name", "cc-number", "cc-exp", "cc-csc"]) {
      expect(page.html).toContain(`autocomplete="${ac}"`);
    }
    expect(page.html).toContain('action="/odeme/paynkolay"');
    expect(page.html).toContain("1.280,10₺ öde");
    expect(page.html).toMatch(/Kart bilgilerin kaydedilmez/);
  });

  it("escapes what it writes back after an error", () => {
    const again = renderCardForm({
      data: "DATA",
      signature: "SIG",
      amount: "1280.10",
      holderName: '"><script>alert(1)</script>',
      expiry: "01/30",
      error: { message: "Kart <b>reddedildi</b>", field: "number" },
    });
    expect(again.html).not.toContain("<script>alert(1)</script>");
    expect(again.html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
    expect(again.html).toContain("Kart &lt;b&gt;reddedildi&lt;/b&gt;");
    expect(again.html).toMatch(/id="cc-number"[^>]*aria-invalid="true"/);
    // The number and CVV inputs carry no value attribute at all.
    expect(again.html).not.toMatch(/id="cc-number"[^>]*value=/);
    expect(again.html).not.toMatch(/id="cc-csc"[^>]*value=/);
  });
});

describe("the hosted redirect page", () => {
  it("may post only to the POS it names", () => {
    const page = renderHostedRedirect(
      "https://paynkolaytest.nkolayislem.com.tr/Vpos",
      { sx: "SX-TOKEN", amount: "1.00" },
    );
    expect(page.csp).toContain(
      "form-action https://paynkolaytest.nkolayislem.com.tr;",
    );
    const [script] = inline(page.html, "script");
    expect(page.csp).toContain(`script-src ${sha256(script)}`);
    expect(page.csp).not.toContain("unsafe-inline");
  });
});

describe("the bank's 3D page", () => {
  it("lets the bank's own inline script run, by its hash", () => {
    const page = bankChallengePage(SANDBOX_3D_HTML);
    // The bank's markup goes out untouched; only our wait note is added
    // before </body>.
    expect(
      page.html.replace(/<div id="laf-bank-wait"[\s\S]*?<\/script><\/div>/, ""),
    ).toBe(SANDBOX_3D_HTML);
    const script = /<script[^>]*>([\s\S]*?)<\/script>/.exec(
      SANDBOX_3D_HTML,
    )![1];
    expect(page.csp).toContain(sha256(script));
    expect(page.csp).not.toMatch(/script-src[^;]*unsafe-inline/);
    // The ACS host differs per bank; plain http stays out.
    expect(page.csp).toContain("form-action https:");
    expect(page.csp).toContain("frame-ancestors 'none'");
  });

  it("covers an onload handler and an https script, but not an http one", () => {
    const page = bankChallengePage(
      '<body onload="document.forms[0].submit()">' +
        '<script src="https://acs.bank.example/x.js"></script>' +
        '<script src="http://insecure.example/y.js"></script>' +
        '<form action="https://acs.bank.example/auth"></form></body>',
    );
    expect(page.csp).toContain("'unsafe-hashes'");
    expect(page.csp).toContain(sha256("document.forms[0].submit()"));
    expect(page.csp).toContain("https://acs.bank.example");
    expect(page.csp).not.toContain("insecure.example");
  });
});

// ── İnceleme turu (PR #109) ─────────────────────────────────────────────────

describe("the direct-mode payload", () => {
  it("is sealed: the browser cannot read sx or a valid hash out of it", async () => {
    const { data, post } = await signedPayload();
    expect(data.startsWith("e1.")).toBe(true);
    const visible = Buffer.from(data.slice(3), "base64url").toString("latin1");
    expect(visible).not.toContain("SX-TOKEN");
    expect(visible).not.toContain(post.fields.hashDataV2);
    expect(post.fields.sx).toBe("SX-TOKEN");
  });

  it("opens only in the mode it was made for", async () => {
    const sealed = await signedPayload(makeProvider("direct"));
    expect(
      makeProvider("hosted").readBridgePost(sealed.data, sealed.signature),
    ).toBeNull();
    const plain = await signedPayload(makeProvider("hosted"));
    expect(
      makeProvider("direct").readBridgePost(plain.data, plain.signature),
    ).toBeNull();
  });

  it("refuses a sealed payload whose ciphertext was touched", async () => {
    const { data, signature } = await signedPayload();
    const flipped =
      data.slice(0, -2) + (data.at(-2) === "A" ? "B" : "A") + data.at(-1);
    expect(makeProvider().readBridgePost(flipped, signature)).toBeNull();
  });
});

describe("confirmReturn after a same-day cancel", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("does not take the rewritten CANCEL/SUCCESS row as a payment", async () => {
    // Measured on the sandbox: the cancel rewrites the SAME row.
    stubPos({
      id: "",
      result: {
        LIST: [
          {
            STATUS: "SUCCESS",
            TRANSACTION_TYPE: "CANCEL",
            REFERENCE_CODE: "IKSIRPF2022539",
            CLIENT_REFERENCE_CODE: "ord-0284",
            AUTHORIZATION_AMOUNT: "1280.10",
            TRX_DATE: "2026-10-15",
          },
        ],
      },
      error: null,
    });
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const result = await makeProvider().confirmReturn({
      CLIENT_REFERENCE_CODE: "ord-0284",
      REFERENCE_CODE: "IKSIRPF2022539",
    });
    expect(result.status).toBe("failed");
  });

  it("reads LIST: null as 'no payment' only for CORE0305", async () => {
    stubPos({
      result: {
        RESPONSE_CODE: "0",
        LIST: null,
        ERROR_CODE: "CORE9999",
        RESPONSE_DATA: "Servis hatası",
      },
    });
    await expect(makeProvider().lookupPayment("ord-0284", NOW)).rejects.toThrow(
      /Servis hatası/,
    );
  });
});

/** Runs the card page's own script against a minimal fake DOM. */
function runCardScript(html: string) {
  const [script] = inline(html, "script");
  const handlers: Record<string, Record<string, (ev: object) => void>> = {};
  const make = (id: string) => ({
    id,
    value: "",
    textContent: "Öde",
    disabled: false,
    hidden: false,
    attrs: {} as Record<string, string>,
    addEventListener(type: string, fn: (ev: object) => void) {
      (handlers[id] ??= {})[type] = fn;
    },
    getAttribute(k: string) {
      return this.attrs[k] ?? null;
    },
    setAttribute(k: string, v: string) {
      this.attrs[k] = v;
    },
    removeAttribute(k: string) {
      delete this.attrs[k];
    },
    querySelectorAll: () => [],
  });
  const els: Record<string, ReturnType<typeof make>> = {};
  for (const id of [
    "pay",
    "cc-number",
    "cc-exp",
    "cc-csc",
    "pay-btn",
    "new-card",
  ]) {
    els[id] = make(id);
  }
  const document = {
    getElementById: (id: string) => els[id],
    querySelectorAll: () => [],
  };
  const window = {
    addEventListener(type: string, fn: (ev: object) => void) {
      (handlers.window ??= {})[type] = fn;
    },
  };
  new Function("document", "window", script)(document, window);
  return {
    els,
    type(id: string, value: string, inputType = "insertText") {
      els[id].value = value;
      handlers[id].input({ inputType });
      return els[id].value;
    },
    fire(target: string, type: string, ev: object) {
      handlers[target][type](ev);
    },
  };
}

describe("the card page script", () => {
  const html = renderCardForm({
    data: "D",
    signature: "S",
    amount: "1.00",
  }).html;

  it("keeps Chrome's MM/YYYY autofill instead of cutting it to an expired MM/20", () => {
    const page = runCardScript(html);
    expect(page.type("cc-exp", "08/2029", "")).toBe("08/2029");
    expect(page.type("cc-exp", "05/2028", "insertFromPaste")).toBe("05/2028");
    expect(page.type("cc-exp", "082029", "")).toBe("08/2029");
    // And the server reads what the script leaves.
    expect(parseExpiry("08/2029")).toEqual({ month: 8, year: 2029 });
  });

  it("formats what a customer types", () => {
    const page = runCardScript(html);
    expect(page.type("cc-exp", "0829")).toBe("08/29");
    expect(page.type("cc-exp", "1/")).toBe("01/");
    expect(page.type("cc-exp", "08 / 29")).toBe("08/29");
    expect(page.type("cc-number", "4155650100416111")).toBe(
      "4155 6501 0041 6111",
    );
  });

  it("clears the card number and CVV whenever the page is shown again", () => {
    const page = runCardScript(html);
    page.els["cc-number"].value = "4155 6501 0041 6111";
    page.els["cc-csc"].value = "715";
    page.fire("window", "pageshow", { persisted: false });
    expect(page.els["cc-number"].value).toBe("");
    expect(page.els["cc-csc"].value).toBe("");
  });
});

describe("the bank's 3D page, as banks actually write it", () => {
  it("normalises CRLF so the served script matches its hash", () => {
    const crlf =
      "<html><body><form id=f action='https://acs.bank.example/x'></form>\r\n<script>\r\nvar f=document.getElementById('f');\r\nf.submit();\r\n</script></body></html>";
    const page = bankChallengePage(crlf);
    expect(page.html).not.toContain("\r");
    const [script] = inline(
      page.html.replace(/<script>/, "<script>"),
      "script",
    );
    expect(page.csp).toContain(sha256(script));
  });

  it("covers an unquoted onload and hashes an entity-encoded one decoded", () => {
    const unquoted = bankChallengePage(
      "<body onload=OnLoadEvent();><form action='https://acs.example/a'></form></body>",
    );
    expect(unquoted.csp).toContain(sha256("OnLoadEvent();"));
    expect(unquoted.csp).toContain("'unsafe-hashes'");
    const encoded = bankChallengePage(
      '<body onload="document.title=&#39;x&#39;;document.forms[0].submit()"></body>',
    );
    expect(encoded.csp).toContain(
      sha256("document.title='x';document.forms[0].submit()"),
    );
  });

  // The EST / Asseco template (Ziraat, Akbank, Denizbank, ING in the
  // PayNkolay sandbox, 2026-10-16) writes its submit as an UNQUOTED handler
  // holding double quotes. The browser keeps the quotes in the value (a parse
  // error, not a terminator) and hashes all of it; reading the value only up
  // to the first `"` gave the hash of `document.forms[`, the browser blocked
  // the handler and the customer sat on a blank page.
  const EST_3D_HTML =
    '<html>\r\n<body onload=document.forms["form"].submit()>\r\n' +
    '    <form name="form" id="form" action="https://acs.bank.example/fim/est3Dgate" method="POST">\r\n' +
    '       <input name="amount" type="hidden" id="amount" value="1.00" />\r\n' +
    '       <input name="oid" type="hidden" id="oid" value="IKSIRPF2030812">\r\n' +
    "    </form>\r\n</body>\r\n</html>";

  it("hashes the EST template's unquoted onload whole, quotes included", () => {
    const page = bankChallengePage(EST_3D_HTML);
    expect(page.csp).toContain("'unsafe-hashes'");
    expect(page.csp).toContain(sha256('document.forms["form"].submit()'));
    expect(page.csp).not.toContain(sha256("document.forms["));
  });

  it("reads quoted, unquoted and odd attribute values as the browser does", () => {
    const page = bankChallengePage(
      "<body onload=a(\"x\")'y'=z ONCLICK = 'b(1)' onfocus=\"c(&quot;q&quot;)\" onblur=d()/>" +
        '<!-- <p onload="commented()"> -->' +
        '<textarea><b onload="inTextarea()"></textarea>' +
        "<script>var s = '<b onload=\"inScript()\">';</script></body>",
    );
    expect(page.csp).toContain(sha256("a(\"x\")'y'=z"));
    expect(page.csp).toContain(sha256("b(1)"));
    expect(page.csp).toContain(sha256('c("q")'));
    // An unquoted value runs to whitespace or `>`; a trailing `/` is part of
    // it, not a self-closing mark.
    expect(page.csp).toContain(sha256("d()/"));
    for (const skipped of ["commented()", "inTextarea()", "inScript()"]) {
      expect(page.csp).not.toContain(sha256(skipped));
    }
    expect(page.csp).toContain(sha256("var s = '<b onload=\"inScript()\">';"));
  });

  it("shows a wait note, and a delayed no-script button only for an absolute https form", () => {
    const est = bankChallengePage(EST_3D_HTML);
    expect(est.html).toContain(
      "3D Secure doğrulama sayfasına yönlendiriliyorsun",
    );
    expect(est.html).toMatch(
      /<button type="button" data-form="form"[^>]*>Bankanın sayfasına git<\/button>/,
    );
    // The note sits inside the body, before it closes.
    expect(est.html.indexOf("laf-bank-wait")).toBeLessThan(
      est.html.indexOf("</body>"),
    );
    // QNB's static action is relative (its script writes the real one): a
    // button would post to our own site, so none is offered.
    const qnb = bankChallengePage(SANDBOX_3D_HTML);
    expect(qnb.html).toContain("laf-bank-wait");
    expect(qnb.html).not.toContain("<button");
    // The note's CSS reveal needs no script: the script-src list is only
    // the bank's own.
    expect(est.csp).not.toMatch(/script-src[^;]*unsafe-inline/);
  });

  it("escapes the bank's form id where it reuses it", () => {
    const page = bankChallengePage(
      '<form id="x&quot;&gt;&lt;img src=x onerror=alert(1)&gt;" action="https://acs.bank.example/a"></form>',
    );
    expect(page.html).not.toContain('data-form="x"><img');
    expect(page.html).toContain(
      'data-form="x&quot;&gt;&lt;img src=x onerror=alert(1)&gt;"',
    );
  });

  // ── Review round on the fix (PR #113) ──

  it("keeps every hash right after a Turkish İ (no whole-page lowercasing)", () => {
    // "İ".toLowerCase() is two UTF-16 units; lowercasing the page shifted
    // every later index, so the script after it went unhashed.
    const page = bankChallengePage(
      "<html><head><title>İŞLEM İŞLENİYOR</title></head>" +
        '<body onload=document.forms["form"].submit()>' +
        '<form id="form" action="https://acs.bank.example/a"></form>' +
        "<script>var İ=1;document.forms[0].submit();</script></body></html>",
    );
    expect(page.csp).toContain(sha256('document.forms["form"].submit()'));
    expect(page.csp).toContain(sha256("var İ=1;document.forms[0].submit();"));
  });

  it("places the note right after <body>, before the bank's submitting script", () => {
    // Chrome stops parsing once a script starts the navigation (Garanti,
    // QNB): a note after that script never rendered (PR #113 re-review).
    const script = "var s='</body>';document.getElementById('f').submit();";
    const html =
      `<html><body><form id="f" action="https://acs.bank.example/a">` +
      `<input type="hidden" name="x" value="</body><img src=x onerror=alert(1)>">` +
      `</form><script>${script}</script></body></html>`;
    const page = bankChallengePage(html);
    // The bank's markup is served byte for byte, only the note is added.
    expect(
      page.html.replace(/<div id="laf-bank-wait"[\s\S]*?<\/script><\/div>/, ""),
    ).toBe(html);
    expect(page.html.indexOf('<div id="laf-bank-wait"')).toBe(
      "<html><body>".length,
    );
    // Nothing from inside the value becomes an allowed handler.
    expect(page.csp).not.toContain(sha256("alert(1)"));
    expect(page.csp).toContain(sha256(script));
  });

  it("puts the note before the first element when the bank writes no <body>", () => {
    const garanti =
      '<form id="PostForm" name="PostForm" action="https://acs.bank.example/g" method="POST">' +
      '<input type="hidden" name="a" value="1" /></form>' +
      '<script language="javascript">var v = document.PostForm; v.submit();</script>';
    const page = bankChallengePage(garanti);
    expect(page.html.startsWith('<div id="laf-bank-wait"')).toBe(true);
    expect(page.html.endsWith(garanti)).toBe(true);
    expect(page.csp).toContain(
      sha256("var v = document.PostForm; v.submit();"),
    );
  });

  it("allows the note's own script by its hash, and nothing broader", () => {
    const page = bankChallengePage(EST_3D_HTML);
    const ours =
      /<div id="laf-bank-wait"[\s\S]*?<script>([\s\S]*?)<\/script>/.exec(
        page.html,
      )![1];
    expect(page.csp).toContain(sha256(ours));
    expect(ours).toContain("beforeunload");
    expect(page.csp).not.toMatch(/script-src[^;]*unsafe-inline/);
  });

  it("does not promise a button where none is offered", () => {
    const qnb = bankChallengePage(SANDBOX_3D_HTML);
    expect(qnb.html).not.toContain("düğmeyle devam");
    expect(qnb.html).toContain("kartından para çekilmedi");
  });

  it("survives an out-of-range character reference instead of throwing", () => {
    expect(() =>
      bankChallengePage(
        '<body onload="a(&#x110000;)" title="&#0;&#xD800;"></body>',
      ),
    ).not.toThrow();
    expect(
      bankChallengePage('<body onload="a(&#x110000;)"></body>').csp,
    ).toContain(sha256("a(\uFFFD)"));
  });

  it("follows the browser on comments, noscript and protocol-relative scripts", () => {
    const page = bankChallengePage(
      "<!--><body onload=early()>" +
        "<!-- x --!><p onclick=afterBang()>" +
        "<noscript><p onload=inNoscript()></noscript>" +
        '<script src="//cdn.bank.example/x.js"></script></body>',
    );
    expect(page.csp).toContain(sha256("early()"));
    expect(page.csp).toContain(sha256("afterBang()"));
    expect(page.csp).not.toContain(sha256("inNoscript()"));
    expect(page.csp).toContain("https://cdn.bank.example");
  });

  it("hashes a legacy <!-- document.write('<script>') //--> script whole", () => {
    // Script-data escape states: the inner </script> does not end the outer
    // script in a browser.
    const body =
      '<!--\ndocument.write(\'<script type="text/javascript">window.x=1</script>\');\nfunction go(){ document.forms["form"].submit(); }\n//-->';
    const page = bankChallengePage(
      `<html><body onload="go()"><script language="javascript">${body}</script>` +
        '<form name="form" id="form" action="https://acs.bank.example/3d"></form></body></html>',
    );
    expect(page.csp).toContain(sha256(body));
    expect(page.csp).toContain(sha256("go()"));
  });

  it("decodes handler values like the browser (named and legacy references)", () => {
    const page = bankChallengePage(
      '<body onload="a(&nbsp;&quot;x&quot;&amp)"></body>',
    );
    expect(page.csp).toContain(sha256('a(\u00a0"x"&)'));
  });

  it("does not end a script at </script followed by a non-HTML space", () => {
    const body = "var a='</script\u00a0>';document.forms[0].submit();";
    const page = bankChallengePage(
      `<html><body><form action="https://acs.bank.example/a"></form><script>${body}</script></body></html>`,
    );
    expect(page.csp).toContain(sha256(body));
  });

  it("skips the note when the bank page already uses its id", () => {
    const html =
      '<html><body><div id="laf-bank-wait"></div><form id="f" action="https://acs.bank.example/a"></form><script>document.forms[0].submit();</script></body></html>';
    const page = bankChallengePage(html);
    expect(page.html).toBe(html);
  });

  it("loads no image or font from elsewhere", () => {
    const page = bankChallengePage("<p>x</p>");
    expect(page.csp).toContain("img-src data:;");
    expect(page.csp).toContain("font-src data:;");
  });
});

// ── Rota ────────────────────────────────────────────────────────────────────

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

function postRequest(
  body: Record<string, string>,
  headers: Record<string, string> = {},
) {
  return new NextRequest("https://laffogato.net/odeme/paynkolay", {
    method: "POST",
    body: new URLSearchParams(body),
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      origin: "https://laffogato.net",
      "sec-fetch-site": "same-origin",
      "x-forwarded-for": "85.105.1.1",
      ...headers,
    },
  });
}

describe("/odeme/paynkolay", () => {
  beforeEach(() => {
    getPaymentProvider.mockReset();
    getPaymentProvider.mockReturnValue(makeProvider("direct"));
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
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  async function validBody(over: Record<string, string> = {}) {
    const { data, signature } = await signedPayload();
    return {
      d: data,
      s: signature,
      [CARD_FORM_FIELDS.holderName]: "Ada Lovelace",
      [CARD_FORM_FIELDS.number]: "4155 6501 0041 6111",
      [CARD_FORM_FIELDS.expiry]: "01/30",
      [CARD_FORM_FIELDS.cvv]: "715",
      ...over,
    };
  }

  it("GET shows the card form under its own CSP", async () => {
    const { url } = await signedPayload();
    const res = await route.GET(new NextRequest(url));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-security-policy")).toContain(
      "default-src 'none'",
    );
    expect(res.headers.get("cache-control")).toContain("no-store");
    expect(await res.text()).toContain('autocomplete="cc-number"');
  });

  it("GET in hosted mode still sends the customer to the POS's page", async () => {
    getPaymentProvider.mockReturnValue(makeProvider("hosted"));
    const { url } = await signedPayload(makeProvider("hosted"));
    const res = await route.GET(new NextRequest(url));
    const html = await res.text();
    expect(html).toContain(
      'action="https://paynkolaytest.nkolayislem.com.tr/Vpos"',
    );
    expect(html).not.toContain("cc-number");
  });

  it("POST in hosted mode takes no card at all", async () => {
    getPaymentProvider.mockReturnValue(makeProvider("hosted"));
    const res = await route.POST(postRequest(await validBody()));
    expect(res.status).toBe(405);
    // Never a blank page: the customer is told what happened.
    expect(await res.text()).toContain("kartından para çekilmedi");
  });

  it("POST hands back the bank's 3D form under a CSP made for it", async () => {
    const calls = stubPos(POS_3D);
    const res = await route.POST(postRequest(await validBody()));
    expect(res.status).toBe(200);
    expect(await res.text()).toBe(bankChallengePage(SANDBOX_3D_HTML).html);
    expect(res.headers.get("content-security-policy")).toContain(
      "form-action https:",
    );
    expect(calls[0].fields.cardHolderIP).toBe("85.105.1.1");
    // The address is checked, the order is counted - both before the POS.
    // A payment that reaches 3D is not a failure: the café's shared Wi-Fi
    // must not lock itself out after ten paying customers.
    expect(checkLoginLimit.mock.calls).toEqual([
      ["card-payment-ip", "85.105.1.1", "*"],
    ]);
    expect(reserveLoginAttempt.mock.calls).toEqual([
      ["card-payment-order", "*", "ord-0284"],
    ]);
    expect(recordLoginFailure).not.toHaveBeenCalled();
  });

  it("refuses a card posted from another site", async () => {
    const calls = stubPos(POS_3D);
    const res = await route.POST(
      postRequest(await validBody(), {
        origin: "https://evil.example",
        "sec-fetch-site": "cross-site",
      }),
    );
    expect(res.status).toBe(403);
    // Never a blank page: the customer is told what happened.
    expect(await res.text()).toContain("kartından para çekilmedi");
    expect(calls).toHaveLength(0);
  });

  it("refuses a tampered payload without asking the POS", async () => {
    const calls = stubPos(POS_3D);
    const body = await validBody();
    const res = await route.POST(postRequest({ ...body, s: "forged" }));
    expect(res.status).toBe(303);
    expect(calls).toHaveLength(0);
  });

  it("re-draws the form for a bad card without the number or CVV in it", async () => {
    const calls = stubPos(POS_3D);
    const res = await route.POST(
      postRequest(
        await validBody({ [CARD_FORM_FIELDS.number]: "4155650100416112" }),
      ),
    );
    expect(res.status).toBe(422);
    const html = await res.text();
    expect(html).toMatch(/Kart numarası geçerli görünmüyor/);
    expect(html).not.toContain("4155650100416112");
    expect(html).not.toContain('value="715"');
    expect(calls).toHaveLength(0);
    expect(reserveLoginAttempt).not.toHaveBeenCalled();
  });

  it("stops at the address limit before the POS is asked", async () => {
    const calls = stubPos(POS_3D);
    checkLoginLimit.mockResolvedValue({
      blocked: true,
      retryAfterSeconds: 3600,
      remaining: 0,
    });
    const res = await route.POST(postRequest(await validBody()));
    expect(res.status).toBe(429);
    expect(calls).toHaveLength(0);
    expect(reserveLoginAttempt).not.toHaveBeenCalled();
  });

  it("stops at the order limit before the POS is asked", async () => {
    const calls = stubPos(POS_3D);
    reserveLoginAttempt.mockResolvedValue({
      blocked: true,
      retryAfterSeconds: 1800,
      remaining: 0,
    });
    const res = await route.POST(postRequest(await validBody()));
    expect(res.status).toBe(429);
    expect(await res.text()).toMatch(/30 dakika sonra/);
    expect(calls).toHaveLength(0);
  });

  it("shows the POS's refusal and lets the customer try again", async () => {
    stubPos({ RESPONSE_CODE: 0, ERROR_MESSAGE: "Kart limiti yetersiz" });
    const res = await route.POST(postRequest(await validBody()));
    const html = await res.text();
    expect(res.status).toBe(200);
    expect(html).toMatch(/Ödeme başlatılamadı: Kart limiti yetersiz/);
    expect(html).toContain('autocomplete="cc-number"');
    expect(html).not.toContain(TEST_CARD);
    // A refusal is what card testing produces: it counts against the address.
    expect(recordLoginFailure.mock.calls).toEqual([
      ["card-payment-ip", "85.105.1.1", "*"],
    ]);
  });

  it("sends an expired page onward: the app to its order, the web to checkout", async () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(NOW);
      const web = await signedPayload();
      const app = await (async () => {
        const provider = makeProvider();
        const session = await provider.createCheckoutSession({
          ...checkoutInput(),
          successUrl: "https://laffogato.net/odeme/donus?app=1",
        });
        return new URL(session.redirectUrl);
      })();
      vi.setSystemTime(new Date(NOW.getTime() + 31 * 60_000));
      const webHtml = await (await route.GET(new NextRequest(web.url))).text();
      expect(webHtml).toMatch(/Ödeme süresi doldu/);
      expect(webHtml).toContain('href="/odeme"');
      const appHtml = await (await route.GET(new NextRequest(app))).text();
      expect(appHtml).toContain(
        'href="laffogato://siparis/ord-0284?status=failed"',
      );
    } finally {
      vi.useRealTimers();
    }
  });

  it("never logs the card, whatever happens", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    stubPos({}, 503);
    await route.POST(postRequest(await validBody()));
    stubPos({ RESPONSE_CODE: 0, ERROR_MESSAGE: `Kart ${TEST_CARD}` });
    await route.POST(postRequest(await validBody()));
    const logged = JSON.stringify([error.mock.calls, warn.mock.calls]);
    expect(logged).not.toContain(TEST_CARD);
    expect(logged).not.toContain("715");
  });
});
