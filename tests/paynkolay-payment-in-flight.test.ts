import { afterEach, describe, expect, it, vi } from "vitest";

import { PaynkolayPaymentProvider } from "@/lib/payment/paynkolay";

/**
 * `hasPaymentInFlight`: does PayNkolay hold a sale for this order that was
 * started and not finished (`STATUS: NEW`, docs/PAYNKOLAY.md §2) - the
 * customer on the bank's 3-D Secure step at this very moment?
 *
 * The account closure asks it before cancelling a young unpaid order
 * (`cancelUnpaidOrdersOfClosingAccount`): a sale that completes after the
 * cancel is money with no order behind it. `lookupPayment` cannot answer
 * this - it sees only SUCCESS rows - so the same PaymentList query is read
 * for the other question. A POS that cannot be asked throws: "nothing in
 * flight" would let the cancel through (rule 29).
 */

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

/** A PaymentList row, as the verification service writes it (§2). */
function row(over: Record<string, string> = {}) {
  return {
    STATUS: "SUCCESS",
    REFERENCE_CODE: "IKSIRPF102168",
    CLIENT_REFERENCE_CODE: "ord-0284",
    AUTHORIZATION_AMOUNT: "1280.10",
    TRANSACTION_TYPE: "sales",
    TRX_DATE: "2026-10-27",
    ...over,
  };
}

/** The service's answers in order, as the other PayNkolay tests stub them. */
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

/** The live envelope (§12.1): rows under `result.LIST`. */
function listOf(...rows: Record<string, string>[]) {
  return { id: "", result: { RESPONSE_CODE: "0", LIST: rows }, error: null };
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("hasPaymentInFlight", () => {
  it("asks PaymentList with the list sx and the order's reference", async () => {
    const calls = stubFetch(listOf());
    await makeProvider().hasPaymentInFlight("ord-0284", new Date());
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe(
      "https://paynkolaytest.nkolayislem.com.tr/Vpos/Payment/PaymentList",
    );
    expect(calls[0].fields.clientRefCode).toBe("ord-0284");
    expect(calls[0].fields.sx).toBe("SX-LIST"); // not the sales sx (§7)
    for (const value of Object.values(calls[0].fields)) {
      expect(value).not.toContain(SECRET);
    }
  });

  it("looks over the same days lookupPayment does", async () => {
    const since = new Date("2026-01-20T12:00:00Z");
    const calls = stubFetch(listOf());
    await makeProvider().lookupPayment("ord-0284", since);
    await makeProvider().hasPaymentInFlight("ord-0284", since);
    expect(calls).toHaveLength(2);
    expect(calls[1].fields.startDate).toBe(calls[0].fields.startDate);
    expect(calls[1].fields.endDate).toBe(calls[0].fields.endDate);
    expect(calls[1].fields.startDate).toBe("19.01.2026");
    expect(calls[1].fields.endDate).toBe("23.01.2026");
  });

  it("a NEW sale with no SUCCESS row is in flight", async () => {
    stubFetch(listOf(row({ STATUS: "NEW" })));
    await expect(
      makeProvider().hasPaymentInFlight("ord-0284", new Date()),
    ).resolves.toBe(true);
  });

  it("an untyped NEW row counts as a sale", async () => {
    stubFetch(listOf(row({ STATUS: "NEW", TRANSACTION_TYPE: "" })));
    await expect(
      makeProvider().hasPaymentInFlight("ord-0284", new Date()),
    ).resolves.toBe(true);
  });

  it("reads the reporting service's camelCase spelling too", async () => {
    stubFetch(
      listOf({
        status: "new",
        transactionType: "SALES",
        clientReferenceCode: "ord-0284",
      }),
    );
    await expect(
      makeProvider().hasPaymentInFlight("ord-0284", new Date()),
    ).resolves.toBe(true);
  });

  it("a SUCCESS row means the sale finished: nothing in flight", async () => {
    // The lookup books that payment; the closure then waits for the order.
    stubFetch(listOf(row()));
    await expect(
      makeProvider().hasPaymentInFlight("ord-0284", new Date()),
    ).resolves.toBe(false);
  });

  it("a SUCCESS row beside an unfinished attempt: nothing in flight", async () => {
    stubFetch(
      listOf(row({ STATUS: "NEW", REFERENCE_CODE: "IKSIRPF102167" }), row()),
    );
    await expect(
      makeProvider().hasPaymentInFlight("ord-0284", new Date()),
    ).resolves.toBe(false);
  });

  it("an ERROR row is a finished, failed attempt: nothing in flight", async () => {
    stubFetch(listOf(row({ STATUS: "ERROR" })));
    await expect(
      makeProvider().hasPaymentInFlight("ord-0284", new Date()),
    ).resolves.toBe(false);
  });

  it("a NEW retry after a failed attempt is in flight", async () => {
    stubFetch(
      listOf(
        row({ STATUS: "ERROR", REFERENCE_CODE: "IKSIRPF102166" }),
        row({ STATUS: "NEW" }),
      ),
    );
    await expect(
      makeProvider().hasPaymentInFlight("ord-0284", new Date()),
    ).resolves.toBe(true);
  });

  it("a NEW cancel or refund is not a sale in flight", async () => {
    for (const kind of ["cancel", "refund", "refundp"]) {
      stubFetch(listOf(row({ STATUS: "NEW", TRANSACTION_TYPE: kind })));
      await expect(
        makeProvider().hasPaymentInFlight("ord-0284", new Date()),
        kind,
      ).resolves.toBe(false);
    }
  });

  it("no record at the POS (CORE0305): nothing in flight", async () => {
    stubFetch({
      id: "",
      result: {
        RESPONSE_CODE: "0",
        ERROR_CODE: "CORE0305",
        RESPONSE_DATA: "Listelenecek kayıt bulunamadı",
        LIST: null,
      },
      error: null,
    });
    await expect(
      makeProvider().hasPaymentInFlight("ord-0284", new Date()),
    ).resolves.toBe(false);
  });

  it("throws on a refused key: 'cannot ask' is not 'nothing in flight'", async () => {
    stubFetch({
      id: "",
      result: JSON.stringify({
        RESPONSE_CODE: 0,
        RESPONSE_DATA: "API : hashData error",
        ERROR_CODE: "",
        LIST: null,
      }),
      error: null,
    });
    await expect(
      makeProvider().hasPaymentInFlight("ord-0284", new Date()),
    ).rejects.toThrow(/PAYNKOLAY_MERCHANT_SECRET_KEY/);
  });

  it("throws when the service fails or answers something unreadable", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("bad gateway", { status: 502 })),
    );
    await expect(
      makeProvider().hasPaymentInFlight("ord-0284", new Date()),
    ).rejects.toThrow(/HTTP 502/);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("<html>bakım</html>", { status: 200 })),
    );
    await expect(
      makeProvider().hasPaymentInFlight("ord-0284", new Date()),
    ).rejects.toThrow(/JSON değil/);
  });

  it("asks nothing for an empty order id", async () => {
    const calls = stubFetch(listOf(row({ STATUS: "NEW" })));
    await expect(
      makeProvider().hasPaymentInFlight("  ", new Date()),
    ).resolves.toBe(false);
    expect(calls).toHaveLength(0);
  });
});
