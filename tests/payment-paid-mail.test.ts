import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createDb, type Executor } from "@/lib/db/client";

/**
 * The customer's one order mail, "ödemen alındı", through the REAL path:
 * `applyPaymentSucceeded` -> `notifyOrderPaid` (the once-only claim) ->
 * `sendOrderPaidEmail` -> the provider call, with only the database (an
 * in-memory executor that answers by statement) and `fetch` faked.
 *
 * - one retry in the same request on 429 / 5xx, same Idempotency-Key;
 * - a mail that never got out is offered again when the bank's return
 *   arrives a second time, and goes out exactly once;
 * - its rows add up to the total (Ara toplam, Kargo, İndirim).
 */

let noticeClaimed = false;
let confirmationIsRepeat = false;
let paidAt = new Date().toISOString();
const sql: string[] = [];

/** The notice row's status once it exists; a failed one does not block a claim. */
let noticeFailed = false;

const exec: Executor = async ({ text, params }) => {
  sql.push(text);
  if (/^INSERT INTO "payment_transactions"/.test(text)) {
    if (confirmationIsRepeat) {
      throw Object.assign(new Error("duplicate key"), { code: "23505" });
    }
    return { rows: [], rowCount: 1 };
  }
  if (/^INSERT INTO "order_notice_emails"/.test(text)) {
    if (noticeClaimed || noticeFailed) {
      throw Object.assign(new Error("duplicate key"), { code: "23505" });
    }
    noticeClaimed = true;
    return { rows: [], rowCount: 1 };
  }
  if (/^UPDATE "order_notice_emails"/.test(text)) {
    // A failed delivery keeps its row as `failed` (released for the next
    // trigger), and the next claim takes such a row over.
    if (params[0] === "failed") {
      noticeClaimed = false;
  noticeFailed = false;
      noticeFailed = true;
      return { rows: [], rowCount: 1 };
    }
    if (params[0] === "sending" && params.at(-1) === "failed") {
      if (!noticeFailed) return { rows: [], rowCount: 0 };
      noticeFailed = false;
      noticeClaimed = true;
      return { rows: [{ orderId: "ord-0001" }], rowCount: 1 };
    }
    return { rows: [], rowCount: 1 };
  }
  if (/^UPDATE "orders"/.test(text)) {
    // Guarded on pending_payment: a repeat has nothing to advance.
    return confirmationIsRepeat
      ? { rows: [], rowCount: 0 }
      : { rows: [{ id: "ord-0001" }], rowCount: 1 };
  }
  if (/^SELECT \* FROM "orders"/.test(text)) {
    return {
      rows: [
        {
          id: "ord-0001",
          orderNo: 10001,
          customerName: "Ayşe Yılmaz",
          customerEmail: "ayse@example.com",
          status: confirmationIsRepeat ? "paid" : "pending_payment",
          paidAt: confirmationIsRepeat ? paidAt : "",
          items: [
            {
              productName: "Sirena Espresso Harmanı",
              qty: 2,
              unitPriceMinor: 50000,
              status: "pending",
            },
          ],
          refunds: [],
          subtotalMinor: 100000,
          discountMinor: 10000,
          shippingMinor: 4900,
          totalMinor: 94900,
          promoCode: "KAHVE10",
          channel: "web",
          kind: "shop",
          fulfillment: "shipping",
          createdAt: "2026-10-16T10:00:00.000Z",
        },
      ],
      rowCount: 1,
    };
  }
  return { rows: [], rowCount: 0 };
};

vi.mock("@/lib/db", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/db")>();
  const db = createDb(exec);
  return { ...real, getDb: () => db };
});
vi.mock("@/lib/admin/audit", () => ({ logAudit: vi.fn(async () => {}) }));
vi.mock("@/lib/mobile/loyalty", () => ({
  onOrderPaid: vi.fn(async () => {}),
  onOrderReversed: vi.fn(async () => {}),
}));

const { applyPaymentSucceeded } = await import("@/lib/admin/store");

const payment = {
  orderId: "ord-0001",
  provider: "paynkolay",
  providerRef: "ref-1",
  amountMinor: 94900,
  currency: "TRY",
};

type Sent = {
  key: string | null;
  body: Record<string, string>;
  signal: AbortSignal | undefined;
};
let sent: Sent[] = [];
let answers: number[] = [];

function stubProvider() {
  sent = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (_url: string, init: RequestInit) => {
      const headers = init.headers as Record<string, string>;
      sent.push({
        key: headers["Idempotency-Key"] ?? null,
        body: JSON.parse(String(init.body)),
        signal: init.signal ?? undefined,
      });
      const status = answers.shift() ?? 200;
      return new Response(status === 200 ? "{}" : '{"message":"busy"}', {
        status,
        headers: status === 429 ? { "retry-after": "0" } : {},
      });
    }),
  );
}

beforeEach(() => {
  noticeClaimed = false;
  confirmationIsRepeat = false;
  paidAt = new Date().toISOString();
  sql.length = 0;
  answers = [];
  process.env.RESEND_API_KEY = "re_test_key";
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "info").mockImplementation(() => {});
  stubProvider();
});
afterEach(() => {
  delete process.env.RESEND_API_KEY;
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("the paid mail", () => {
  it("goes out once, with rows that add up to the total", async () => {
    await applyPaymentSucceeded(payment);
    expect(sent).toHaveLength(1);
    expect(sent[0].key).toBe("order-ord-0001-paid");
    const { subject, html, text } = sent[0].body;
    expect(subject).toContain("10001");
    for (const part of [html, text]) {
      expect(part).toContain("Ara toplam");
      expect(part).toContain("Kargo");
      expect(part).toContain("İndirim");
    }
    // 1.000,00 - 100,00 + 49,00 = 949,00
    expect(text).toMatch(/Ara toplam: ₺1\.000,00/);
    expect(text).toMatch(/Kargo: ₺49,00/);
    expect(text).toMatch(/İndirim: -₺100,00/);
    expect(text).toMatch(/Ödenen toplam: ₺949,00/);
    // The durable-medium links stay.
    for (const slug of [
      "on-bilgilendirme-formu",
      "mesafeli-satis-sozlesmesi",
      "iade-ve-cayma",
    ]) {
      expect(html).toContain(`/hukuk/${slug}`);
      expect(text).toContain(`/hukuk/${slug}`);
    }
  });

  it("never waits on the provider without a deadline", async () => {
    // The mail is awaited inside the payment return: a hung Resend must not
    // hold the customer on the bank's redirect.
    answers = [429, 200];
    await applyPaymentSucceeded(payment);
    expect(sent.length).toBeGreaterThan(0);
    for (const call of sent) expect(call.signal).toBeInstanceOf(AbortSignal);
  });

  it("retries once, in the same request, when the provider is busy", async () => {
    answers = [429, 200];
    await applyPaymentSucceeded(payment);
    expect(sent).toHaveLength(2);
    // The same key: an attempt that did reach the provider is not sent twice.
    expect(sent[1].key).toBe(sent[0].key);
    expect(noticeClaimed).toBe(true);
  }, 15_000);

  it("retries on a 5xx too, and only once", async () => {
    answers = [503, 503, 200];
    await applyPaymentSucceeded(payment);
    expect(sent).toHaveLength(2);
    // Both failed: the claim is released so the next trigger may try again.
    expect(noticeClaimed).toBe(false);
  }, 15_000);

  it("is offered again when the bank's return arrives a second time", async () => {
    answers = [500, 500];
    await applyPaymentSucceeded(payment);
    expect(noticeClaimed).toBe(false);
    expect(sent).toHaveLength(2);

    // The return is replayed: the same transaction, the order already paid.
    confirmationIsRepeat = true;
    answers = [200];
    await applyPaymentSucceeded(payment);
    expect(sent).toHaveLength(3);
    expect(sent[2].key).toBe("order-ord-0001-paid");
    expect(noticeClaimed).toBe(true);

    // And never a second copy once it is out.
    await applyPaymentSucceeded(payment);
    expect(sent).toHaveLength(3);
  }, 20_000);

  it("is not re-offered for a payment that is days old", async () => {
    confirmationIsRepeat = true;
    paidAt = new Date(Date.now() - 3 * 24 * 60 * 60_000).toISOString();
    await applyPaymentSucceeded(payment);
    expect(sent).toHaveLength(0);
  });
});
