import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createDb, type Executor } from "@/lib/db/client";
import { findLegalDoc } from "@/lib/legal/documents";
import { CHECKOUT_CONSENT_DOCS, KARAOKE_CONSENT_DOCS } from "@/lib/legal/meta";
import { codedVersionDoc, legalVersionOf } from "@/lib/legal/version-core";

/**
 * The confirmed contract rides with the confirmation (decision ASK-DURABLE):
 * one HTML file, base64, in Resend's `attachments` - on a single send only,
 * never on the campaign batch. The sentence that says so is printed only
 * when the file really is in the message; a refusal of that message sends
 * it again without the file, and nothing about the file ever holds or
 * drops the mail itself.
 *
 * The first block runs the REAL path a card return takes
 * (`applyPaymentSucceeded` -> `notifyOrderPaid` -> the copy, read from
 * `legal_doc_versions` -> `sendOrderPaidEmail` -> the provider), with only
 * the database (an in-memory executor) and `fetch` faked.
 */

const [OBF, MSS] = CHECKOUT_CONSENT_DOCS;
const KARAOKE = KARAOKE_CONSENT_DOCS[0];
const obf = legalVersionOf(codedVersionDoc(findLegalDoc(OBF)!));
const mss = legalVersionOf(codedVersionDoc(findLegalDoc(MSS)!));

const PAID_SENTENCE =
  "Sipariş sırasında onayladığınız Ön Bilgilendirme Formu ve Mesafeli Satış Sözleşmesi'nin, sipariş bilgilerinizle doldurulmuş tam metni bu e-postanın ekindedir. Aynı sürüme şu bağlantıdan da ulaşabilirsiniz:";
const OLD_SENTENCE =
  "Sipariş sırasında onayladığınız belgeler (bağlantılar belgelerin güncel metnini açar):";
const KARAOKE_SENTENCE =
  "Onayladığın Karaoke Odası Ön Bilgilendirme Formu ve Mesafeli Hizmet Sözleşmesi'nin, rezervasyon bilgilerinle doldurulmuş tam metni bu e-postanın ekinde. Aynı sürümü buradan da okuyabilirsin:";

let stored = true;
let orderConsent: Record<string, unknown> = {};

const exec: Executor = async ({ text, params }) => {
  if (/^INSERT INTO "payment_transactions"/.test(text)) {
    return { rows: [], rowCount: 1 };
  }
  if (/^INSERT INTO "order_notice_emails"/.test(text)) {
    return { rows: [], rowCount: 1 };
  }
  if (/^UPDATE "orders"/.test(text)) {
    return { rows: [{ id: "ord-0001" }], rowCount: 1 };
  }
  if (/FROM "legal_doc_versions"/.test(text)) {
    if (!stored) return { rows: [], rowCount: 0 };
    const wanted = new Set(params.flat() as string[]);
    const rows = [obf, mss]
      .filter((v) => wanted.has(v.hash))
      .map((v) => ({ hash: v.hash, slug: v.slug, body: v.text }));
    return { rows, rowCount: rows.length };
  }
  if (/^SELECT \* FROM "orders"/.test(text)) {
    return {
      rows: [
        {
          id: "ord-0001",
          orderNo: 10001,
          customerName: "Ayşe <b>Yılmaz</b>",
          customerEmail: "ayse@example.com",
          shippingAddress: "Bağdat Cad. 1\nKadıköy",
          status: "pending_payment",
          paidAt: "",
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
          discountMinor: 0,
          shippingMinor: 0,
          totalMinor: 100000,
          promoCode: "",
          channel: "web",
          kind: "shop",
          fulfillment: "shipping",
          createdAt: "2026-10-21T10:00:00.000Z",
          legalConsent: orderConsent,
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
const send = await import("@/lib/email/send");

type Sent = { url: string; key: string | null; body: Record<string, unknown> };
let sent: Sent[] = [];
let answers: number[] = [];

beforeEach(() => {
  sent = [];
  answers = [];
  stored = true;
  orderConsent = {
    acceptedAt: "2026-10-21T10:00:00.000Z",
    documents: [...CHECKOUT_CONSENT_DOCS],
    version: "20 Ekim 2026",
    textHashes: { [OBF]: obf.hash, [MSS]: mss.hash },
  };
  process.env.RESEND_API_KEY = "re_test_key";
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "info").mockImplementation(() => {});
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init: RequestInit) => {
      const headers = init.headers as Record<string, string>;
      sent.push({
        url,
        key: headers["Idempotency-Key"] ?? null,
        body: JSON.parse(String(init.body)),
      });
      const status = answers.shift() ?? 200;
      return new Response(
        status === 200 ? '{"id":"re_1"}' : '{"message":"refused"}',
        { status },
      );
    }),
  );
});
afterEach(() => {
  delete process.env.RESEND_API_KEY;
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const flat = (s: unknown) => String(s).replace(/\s+/g, " ");

function attachmentsOf(s: Sent): { filename: string; content: string }[] {
  return (s.body.attachments as { filename: string; content: string }[]) ?? [];
}

describe("the paid mail carries the confirmed contract", () => {
  it("attaches the file built from the stored versions, and says so in both halves", async () => {
    await applyPaymentSucceeded({
      orderId: "ord-0001",
      provider: "paynkolay",
      providerRef: "ref-1",
      amountMinor: 100000,
      currency: "TRY",
    });
    expect(sent).toHaveLength(1);
    expect(sent[0].url).toBe("https://api.resend.com/emails");
    const [file] = attachmentsOf(sent[0]);
    expect(file.filename).toBe("siparis-10001-on-bilgilendirme-ve-sozlesme.html");
    const html = Buffer.from(file.content, "base64").toString("utf8");
    expect(html.startsWith("<!DOCTYPE html>")).toBe(true);
    expect(html).toContain("Ayşe &lt;b&gt;Yılmaz&lt;/b&gt;");
    expect(html).toContain(obf.doc.title);
    expect(html).toContain(mss.hash);
    // The mail itself: the sentence and the two version links.
    expect(flat(sent[0].body.html)).toContain(PAID_SENTENCE);
    expect(flat(sent[0].body.text)).toContain(PAID_SENTENCE);
    expect(String(sent[0].body.html)).not.toContain(OLD_SENTENCE);
    for (const v of [obf, mss]) {
      const url = `https://laffogato.net/hukuk/${v.slug}?surum=${v.hash.slice(0, 16)}`;
      expect(String(sent[0].body.html)).toContain(`href="${url}"`);
      expect(String(sent[0].body.text)).toContain(url);
    }
    expect(sent[0].key).toBe("order-ord-0001-paid");
  });

  it("sends the old sentence and no file for an order whose consent has no hashes", async () => {
    orderConsent = { acceptedAt: "2026-10-01T10:00:00.000Z", version: "1 Ekim 2026" };
    await applyPaymentSucceeded({
      orderId: "ord-0001",
      provider: "paynkolay",
      providerRef: "ref-2",
      amountMinor: 100000,
      currency: "TRY",
    });
    expect(sent).toHaveLength(1);
    expect(sent[0].body).not.toHaveProperty("attachments");
    expect(flat(sent[0].body.html)).toContain(OLD_SENTENCE);
    expect(flat(sent[0].body.html)).not.toContain("e-postanın ekindedir");
  });

  it("still sends the mail, without the file, when no version can be found", async () => {
    stored = false;
    // A recorded text that is neither stored nor today's: no copy.
    orderConsent = { ...orderConsent, textHashes: { [OBF]: "a".repeat(64), [MSS]: "b".repeat(64) } };
    await applyPaymentSucceeded({
      orderId: "ord-0001",
      provider: "paynkolay",
      providerRef: "ref-3",
      amountMinor: 100000,
      currency: "TRY",
    });
    expect(sent).toHaveLength(1);
    expect(sent[0].body).not.toHaveProperty("attachments");
    expect(flat(sent[0].body.html)).toContain(OLD_SENTENCE);
  });
});

describe("sendOrderPaidEmail and the attachment", () => {
  const copy = {
    filename: "siparis-10001-on-bilgilendirme-ve-sozlesme.html",
    html: "<!DOCTYPE html><p>Ön Bilgilendirme Formu</p>",
    links: [
      { slug: OBF, title: "ÖBF", url: `https://laffogato.net/hukuk/${OBF}?surum=${"a".repeat(16)}` },
      { slug: MSS, title: "MSS", url: `https://laffogato.net/hukuk/${MSS}?surum=${"b".repeat(16)}` },
    ],
  };
  const data = {
    to: "ayse@example.com",
    customerName: "Ayşe",
    orderNo: 10001,
    items: [{ productName: "Sirena", qty: 1, unitPriceMinor: 32_000 }],
    totalMinor: 32_000,
  };

  it("puts the file in the message as base64, UTF-8 intact", async () => {
    const r = await send.sendOrderPaidEmail({ ...data, durableCopy: copy }, "order-x-paid");
    expect(r.ok).toBe(true);
    const [file] = attachmentsOf(sent[0]);
    expect(file).toEqual({
      filename: copy.filename,
      content: Buffer.from(copy.html, "utf8").toString("base64"),
    });
    expect(Buffer.from(file.content, "base64").toString("utf8")).toBe(copy.html);
  });

  it("offers no file when a version link is missing", async () => {
    await send.sendOrderPaidEmail(
      { ...data, durableCopy: { ...copy, links: copy.links.slice(0, 1) } },
      "order-x-paid",
    );
    expect(sent[0].body).not.toHaveProperty("attachments");
    expect(flat(sent[0].body.html)).toContain(OLD_SENTENCE);
  });

  it("sends it again without the file when the provider refuses the message outright", async () => {
    answers = [422, 200];
    const r = await send.sendOrderPaidEmail({ ...data, durableCopy: copy }, "order-x-paid");
    expect(r.ok).toBe(true);
    expect(sent).toHaveLength(2);
    expect(attachmentsOf(sent[0])).toHaveLength(1);
    expect(sent[1].body).not.toHaveProperty("attachments");
    expect(flat(sent[1].body.html)).toContain(OLD_SENTENCE);
    expect(flat(sent[1].body.html)).not.toContain("e-postanın ekindedir");
    // A key of its own: the first one was refused, not used.
    expect(sent[0].key).toBe("order-x-paid");
    expect(sent[1].key).toBe("order-x-paid-ek-yok");
    // The warning names the order, never the address (rule 9).
    const warned = (console.warn as unknown as { mock: { calls: unknown[][] } }).mock.calls
      .map((c) => c.join(" "))
      .join("\n");
    expect(warned).toContain("odeme-onaylandi #10001");
    expect(warned).not.toContain("ayse@");
  });

  it("does not send a second copy after a 5xx: the first may have been delivered", async () => {
    answers = [503, 503];
    const r = await send.sendOrderPaidEmail({ ...data, durableCopy: copy }, "order-x-paid");
    expect(r.ok).toBe(false);
    // The one same-key retry the order mail always had, with the file both times.
    expect(sent).toHaveLength(2);
    for (const s of sent) {
      expect(s.key).toBe("order-x-paid");
      expect(attachmentsOf(s)).toHaveLength(1);
    }
  }, 15_000);

  it("never opens the sentence without its links, whatever a caller says", async () => {
    const { renderEmail } = await import("@/lib/email/render");
    const { EMAIL_TEXT } = await import("@/lib/email/text");
    const r = renderEmail("odeme-onaylandi", {
      vars: {
        AD: "",
        SIPARIS_NO: "1",
        SIPARIS_URL: "https://laffogato.net/uye/hesap/siparislerim/1",
        ARA_TOPLAM: "1",
        KARGO: "",
        INDIRIM: "",
        TOPLAM: "1",
        KALEMLER: "-",
        BELGELER: "-",
        DAMGA_HEDEFI: "6",
        DAMGA_SAYISI: "",
      },
      loops: { ITEMS: [] },
      text: EMAIL_TEXT["odeme-onaylandi"],
      flags: { BELGE_EKI: true },
    });
    expect(r.html).not.toContain("e-postanın ekindedir");
    expect(r.text).not.toContain("e-postanın ekindedir");
    // Exactly one documents line: the old one stands in.
    expect(flat(r.html)).toContain(OLD_SENTENCE);
    expect(flat(r.text)).toContain(OLD_SENTENCE);
  });
});

describe("the karaoke confirmation", () => {
  const url = `https://laffogato.net/hukuk/${KARAOKE}?surum=${"c".repeat(16)}`;
  const copy = {
    filename: "karaoke-sozlesme-KRK-00042.html",
    html: "<!DOCTYPE html><p>Karaoke</p>",
    links: [{ slug: KARAOKE, title: "Karaoke", url }],
  };
  const booking = {
    to: "eda@example.com",
    name: "Eda",
    date: "30 Ekim 2026",
    time: "20:00 - 22:00",
    guests: 4,
    code: "krk-00042",
    manageUrl: "https://laffogato.net/rezervasyon?t=x",
  };

  it("attaches the terms of a booking paid online, in sen", async () => {
    expect(
      await send.sendKaraokeConfirmationEmail({
        ...booking,
        payment: { kind: "online", paidMinor: 90_000 },
        durableCopy: copy,
      }),
    ).toBe(true);
    expect(attachmentsOf(sent[0])).toEqual([
      {
        filename: copy.filename,
        content: Buffer.from(copy.html, "utf8").toString("base64"),
      },
    ]);
    expect(flat(sent[0].body.html)).toContain(KARAOKE_SENTENCE);
    expect(flat(sent[0].body.text)).toContain(KARAOKE_SENTENCE);
    expect(String(sent[0].body.html)).toContain(`href="${url}"`);
    expect(String(sent[0].body.text)).toContain(url);
  });

  it("attaches nothing to a booking paid at the venue (it confirmed no terms)", async () => {
    await send.sendKaraokeConfirmationEmail({
      ...booking,
      payment: { kind: "venue" },
      durableCopy: copy,
    });
    expect(sent[0].body).not.toHaveProperty("attachments");
    expect(flat(sent[0].body.html)).not.toContain("e-postanın ekinde");
  });

  it("keeps the terms' page when there is no copy, and resends without one on a refusal", async () => {
    await send.sendKaraokeConfirmationEmail({
      ...booking,
      payment: { kind: "online", paidMinor: 90_000 },
    });
    expect(sent[0].body).not.toHaveProperty("attachments");
    expect(String(sent[0].body.html)).toContain(
      'href="https://laffogato.net/hukuk/karaoke-odasi-rezervasyon"',
    );
    sent = [];
    answers = [413, 200];
    expect(
      await send.sendKaraokeConfirmationEmail({
        ...booking,
        payment: { kind: "online", paidMinor: 90_000 },
        durableCopy: copy,
      }),
    ).toBe(true);
    expect(sent).toHaveLength(2);
    expect(sent[1].body).not.toHaveProperty("attachments");
    expect(flat(sent[1].body.html)).not.toContain(KARAOKE_SENTENCE);
  });
});

describe("the campaign batch never carries a file", () => {
  it("builds each message field by field, an attachment on a caller's object included", async () => {
    const message = {
      to: "uye@example.com",
      subject: "Kampanya",
      html: "<p>x</p>",
      text: "x",
      unsubscribeUrl: "https://laffogato.net/api/bulten/cikis?token=t",
      attachments: [{ filename: "x.html", content: "eA==" }],
    } as unknown as Parameters<typeof send.deliverBatch>[0][number];
    await send.deliverBatch([message], "cmp-1-b1");
    expect(sent[0].url).toBe("https://api.resend.com/emails/batch");
    const body = sent[0].body as unknown as Record<string, unknown>[];
    expect(JSON.stringify(body)).not.toContain("attachments");
  });
});
