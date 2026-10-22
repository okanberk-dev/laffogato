import { describe, expect, it } from "vitest";

import { LEGAL_ENTITY } from "@/lib/legal/entity";
import {
  CONSUMER_TAX_NUMBER,
  contactBody,
  deadlineState,
  eArchiveBody,
  expectedTotalMinor,
  invoiceMarker,
  invoiceNote,
  invoicePdfName,
  invoiceRecipient,
  isValidVkn,
  istanbulDay,
  jobOutcome,
  karaokeInvoiceLines,
  lineNetMinor,
  linesKdvRows,
  maskText,
  matchCarrier,
  orderInvoiceLines,
  planKaraokeInvoice,
  planOrderInvoice,
  productBody,
  retryDelayMs,
  salesInvoiceBody,
  shipmentFor,
  totalsAgree,
  vatOfNet,
  type CarrierEntry,
  type InvoiceBooking,
  type InvoiceLine,
  type InvoiceOrder,
} from "@/lib/invoice/invoice-core";
import { deadlineBadge, invoiceDashboardAlert } from "@/lib/invoice/panel-core";
import { kdvBreakdown, orderKdvBreakdown } from "@/lib/utils/kdv";

import {
  PARASUT_FIELDS,
  PARASUT_PAYMENT_TYPES,
} from "./_support/parasut-fields";

/**
 * The e-Arşiv rules (src/lib/invoice/invoice-core.ts, docs/EARSIV.md): what
 * is billable and when, its legal deadline, the lines and amounts Paraşüt
 * is sent, and the request bodies, field by field against Paraşüt's own
 * spec (tests/_support/parasut-fields.ts).
 */

const START = "2026-10-22T00:00:00.000Z";
const PAID = [{ provider: "paynkolay", status: "succeeded" }];
const NOW = new Date("2026-10-22T12:00:00.000Z");
const DAY = 24 * 60 * 60_000;
const YURTICI: CarrierEntry = {
  name: "Yurtiçi",
  title: "Yurtiçi Kargo Servisi A.Ş.",
  vkn: LEGAL_ENTITY.taxNo, // a valid check digit; the real one comes from the panel
};

function order(over: Partial<InvoiceOrder> = {}): InvoiceOrder {
  return {
    id: "ord-1",
    orderNo: 10234,
    status: "paid",
    source: "",
    kind: "cafe",
    fulfillment: "pickup",
    customerEmail: "eda@example.com",
    shippingAddress: "",
    items: [
      { productName: "Latte", qty: 1, unitPriceMinor: 15_000, taxRatePct: 10 },
    ],
    subtotalMinor: 15_000,
    discountMinor: 0,
    shippingMinor: 0,
    totalMinor: 15_000,
    refunds: [],
    createdAt: "2026-10-22T07:00:00.000Z",
    paidAt: "2026-10-22T07:01:00.000Z",
    ...over,
  };
}

function parcel(over: Partial<InvoiceOrder> = {}): InvoiceOrder {
  return order({
    kind: "shop",
    fulfillment: "shipping",
    shippingAddress:
      "Ev - Eda Mancuso, +90 532 123 45 67\nModa Cad. No 5\nKadıköy / İstanbul 34710",
    items: [
      {
        productName: "Sirena Espresso 250 g",
        qty: 2,
        unitPriceMinor: 45_000,
        taxRatePct: 10,
      },
    ],
    subtotalMinor: 90_000,
    shippingMinor: 7_500,
    shippingTaxRatePct: 20,
    totalMinor: 97_500,
    carrier: "Yurtiçi Kargo",
    ...over,
  });
}

function plan(
  o: InvoiceOrder,
  extra: Partial<Parameters<typeof planOrderInvoice>[0]> = {},
) {
  return planOrderInvoice({
    order: o,
    payments: PAID,
    couponSource: null,
    startAt: START,
    production: true,
    carriers: [YURTICI],
    now: NOW,
    ...extra,
  });
}

describe("which orders are in scope", () => {
  it("leaves out a panel order (the till's receipt), an unpaid one and one paid before EARSIV_START_AT", () => {
    expect(plan(order({ source: "manual" }))).toBeNull();
    expect(plan(order({ paidAt: "" }))).toBeNull();
    expect(plan(order({ paidAt: "2026-10-21T23:59:59.000Z" }))).toBeNull();
    expect(plan(order())).not.toBeNull();
  });
});

describe("cafe orders: after delivery, at the latest 7 days", () => {
  it("is due 3 hours after payment when nobody marked it delivered", () => {
    const p = plan(order())!;
    expect(p.route).toBe("pickup");
    expect(p.dueAt).toBe("2026-10-22T10:01:00.000Z");
    expect(p.status).toBe("due"); // NOW is 12:00
    expect(p.deadlineAt).toBe(
      new Date(Date.parse("2026-10-22T07:01:00.000Z") + 7 * DAY).toISOString(),
    );
    const early = planOrderInvoice({
      order: order(),
      payments: PAID,
      couponSource: null,
      startAt: START,
      production: true,
      carriers: [],
      now: new Date("2026-10-22T09:00:00.000Z"),
    })!;
    expect(early.status).toBe("waiting");
  });

  it("is due when it was ready/served or handed to the courier, else when completed", () => {
    const ready = plan(
      order({ fulfillment: "table", shippedAt: "2026-10-22T07:20:00.000Z" }),
    )!;
    expect(ready.route).toBe("table");
    expect(ready.dueAt).toBe("2026-10-22T07:20:00.000Z");
    expect(ready.deadlineAt).toBe("2026-10-29T07:20:00.000Z");
    const done = plan(order({ completedAt: "2026-10-22T08:00:00.000Z" }))!;
    expect(done.dueAt).toBe("2026-10-22T08:00:00.000Z");
    const courier = plan(
      order({ fulfillment: "delivery", shippedAt: "2026-10-22T07:30:00.000Z" }),
    )!;
    expect(courier.route).toBe("courier");
  });

  it("bills a cafe order to the köşk's district and province, with the address text if any", () => {
    const p = plan(order({ shippingAddress: "Masa 4" }))!;
    expect(p.billing).toEqual({
      city: "İstanbul",
      district: "Tuzla",
      address: "Masa 4",
    });
    const courier = plan(
      order({
        fulfillment: "delivery",
        shippingAddress:
          "Ev - Eda, 05321234567\nPostane Mah. 3\nTuzla / İstanbul",
      }),
    )!;
    expect(courier.billing?.district).toBe("Tuzla");
    expect(courier.billing?.address).not.toMatch(/532/);
  });

  it("skips a cancelled order", () => {
    expect(plan(order({ status: "cancelled" }))!.status).toBe("skipped");
    expect(plan(order({ status: "refunded" }))!.status).toBe("skipped");
  });
});

describe("shop parcels: at dispatch, with the carrier", () => {
  it("waits until the parcel is handed over", () => {
    const p = plan(parcel())!;
    expect(p).toMatchObject({
      route: "parcel",
      status: "waiting",
      dueAt: "",
      deadlineAt: "",
    });
  });

  it("is due at dispatch with the deadline 7 days after it, billed to the parsed district", () => {
    const p = plan(parcel({ shippedAt: "2026-10-22T11:00:00.000Z" }))!;
    expect(p.status).toBe("due");
    expect(p.dueAt).toBe("2026-10-22T11:00:00.000Z");
    expect(p.deadlineAt).toBe("2026-10-29T11:00:00.000Z");
    expect(p.billing).toMatchObject({ city: "İstanbul", district: "Kadıköy" });
    expect(p.billing?.address).not.toContain("532");
  });

  it("goes to a person when the carrier is not listed or its VKN is wrong, never guessing one", () => {
    const shipped = { shippedAt: "2026-10-22T11:00:00.000Z" };
    const unknown = plan(parcel({ ...shipped, carrier: "Aras" }))!;
    expect(unknown).toMatchObject({
      status: "manual",
      manualCode: "carrier_vkn",
    });
    expect(unknown.reason).toContain(
      "kargo firmasının VKN'si eksik".replace("k", "K"),
    );
    const typo = plan(parcel(shipped), {
      carriers: [{ ...YURTICI, vkn: "6312110905" }],
    })!;
    expect(typo.manualCode).toBe("carrier_vkn");
  });

  it("goes to a person when the province and district cannot be read, and takes a person's address", () => {
    const shipped = parcel({
      shippedAt: "2026-10-22T11:00:00.000Z",
      shippingAddress: "Bağdat Cad. İstanbul",
    });
    const p = plan(shipped)!;
    expect(p).toMatchObject({ status: "manual", manualCode: "address" });
    expect(p.reason).toContain("Fatura ili/ilçesi okunamadı");
    const fixed = plan(shipped, {
      billingOverride: {
        city: "İstanbul",
        district: "Kadıköy",
        address: "Bağdat Cad.",
      },
    })!;
    expect(fixed.status).toBe("due");
    expect(fixed.billing?.district).toBe("Kadıköy");
  });
});

describe("what goes to a person instead (never guessed)", () => {
  it("names each payment method the automation does not cut", () => {
    for (const [provider, text] of [
      ["wallet", "Cüzdanla ödendi"],
      ["free", "Ödemesiz sipariş"],
      ["manual:nakit", "elle işlendi"],
      ["gift", "otomatik kesilmez"],
    ] as const) {
      const p = plan(order(), {
        payments: [{ provider, status: "succeeded" }],
      })!;
      expect(p.status, provider).toBe("manual");
      expect(p.manualCode).toBe("payment_method");
      expect(p.reason).toContain(text);
    }
    expect(plan(order(), { payments: [] })!.manualCode).toBe("no_payment");
  });

  it("treats the mock provider like PayNkolay only outside production", () => {
    const mock = [{ provider: "mock", status: "succeeded" }];
    expect(plan(order(), { payments: mock, production: true })!.status).toBe(
      "manual",
    );
    expect(plan(order(), { payments: mock, production: false })!.status).toBe(
      "due",
    );
  });

  it("hands over a refund before the invoice, a reward coupon and a coupon that paid everything", () => {
    expect(plan(order({ refunds: [{ amountMinor: 5_000 }] }))!.manualCode).toBe(
      "refund_before_issue",
    );
    const discounted = order({
      discountMinor: 1_500,
      totalMinor: 13_500,
      promoCode: "X",
    } as Partial<InvoiceOrder>);
    for (const source of ["loyalty", "milestone", "invite"]) {
      expect(
        plan(discounted, { couponSource: source })!.manualCode,
        source,
      ).toBe("reward_coupon");
    }
    // A welcome coupon or a shared code is a discount: cut automatically.
    expect(plan(discounted, { couponSource: "welcome" })!.status).toBe("due");
    expect(plan(discounted)!.status).toBe("due");
    const free = order({ discountMinor: 15_000, totalMinor: 0 });
    expect(plan(free)!.status).toBe("manual");
  });

  it("does not guess a rate the line was not sold at, nor split totals that do not add up", () => {
    expect(
      plan(
        order({
          items: [{ productName: "Eski", qty: 1, unitPriceMinor: 15_000 }],
        }),
      )!.manualCode,
    ).toBe("no_rates");
    expect(plan(order({ subtotalMinor: 14_000 }))!.manualCode).toBe(
      "totals_mismatch",
    );
  });
});

function booking(over: Partial<InvoiceBooking> = {}): InvoiceBooking {
  return {
    id: "krk-00042",
    date: "2026-10-22",
    startHour: 20,
    hours: 2,
    status: "confirmed",
    paymentStatus: "paid",
    paidMinor: 120_000,
    totalMinor: 120_000,
    refundMinor: null,
    taxRatePct: 20,
    makeGoodFor: null,
    customerEmail: "eda@example.com",
    contactEmail: "",
    createdAt: "2026-10-20T10:00:00.000Z",
    paidAt: "2026-10-20T10:05:00.000Z",
    ...over,
  };
}

function kplan(
  b: InvoiceBooking,
  now = new Date("2026-10-23T06:00:00.000Z"),
  payments = PAID,
) {
  return planKaraokeInvoice({
    booking: b,
    payments,
    startAt: START,
    production: true,
    now,
  });
}

describe("karaoke: after the evening, what the köşk keeps", () => {
  it("waits for the evening to end, then bills what was paid", () => {
    // 20:00-22:00 Istanbul = 17:00-19:00 UTC.
    const before = kplan(booking(), new Date("2026-10-22T18:00:00.000Z"))!;
    expect(before).toMatchObject({
      status: "waiting",
      dueAt: "2026-10-22T19:00:00.000Z",
    });
    const after = kplan(booking())!;
    expect(after).toMatchObject({
      status: "due",
      amountMinor: 120_000,
      route: "karaoke",
    });
    expect(after.deadlineAt).toBe("2026-10-29T19:00:00.000Z");
  });

  it("has no row for a booking with no online payment or an evening that ended before EARSIV_START_AT", () => {
    expect(kplan(booking({ paymentStatus: "none" }))).toBeNull();
    expect(kplan(booking({ paymentStatus: "pending" }))).toBeNull();
    expect(kplan(booking({ date: "2026-10-21", startHour: 20 }))).toBeNull();
  });

  it("waits while a refund goes back, skips a full refund and a free hour, bills a late cancel's kept share", () => {
    expect(kplan(booking({ paymentStatus: "refunding" }))!.status).toBe(
      "waiting",
    );
    expect(
      kplan(booking({ paymentStatus: "refunded", status: "cancelled" }))!
        .status,
    ).toBe("skipped");
    expect(kplan(booking({ makeGoodFor: "krk-00041" }))!.status).toBe(
      "skipped",
    );
    const late = kplan(
      booking({
        paymentStatus: "refunded",
        status: "cancelled",
        refundMinor: 30_000,
      }),
    )!;
    expect(late).toMatchObject({ status: "due", amountMinor: 90_000 });
  });

  it("hands a booking paid another way to a person", () => {
    expect(
      kplan(booking(), undefined, [
        { provider: "wallet", status: "succeeded" },
      ])!.status,
    ).toBe("manual");
  });

  it("writes the evening on its one line, at the booking's own rate", () => {
    const [line] = karaokeInvoiceLines(
      booking({ status: "cancelled" }),
      90_000,
      20,
    );
    // No date on the line (operator, 22 Oct 2026): the nature of the work
    // and how long, VUK 230/5; the invoice has its own date.
    expect(line.description).toBe("Karaoke odası geç iptal bedeli, 2 saat");
    expect(
      karaokeInvoiceLines(booking({ status: "confirmed" }), 90_000, 20)[0]
        .description,
    ).toBe("Karaoke odası kullanımı, 2 saat");
    // The product is just "Hizmet" (operator, 22 Oct 2026); the line says
    // which service, and the rate is the KDV column's.
    expect(line.productCode).toBe("LAF-HIZMET-20");
    expect(line.productName).toBe("Hizmet");
    expect(line.totalMinor).toBe(90_000);
    const older = karaokeInvoiceLines(
      booking({ taxRatePct: null }),
      50_000,
      20,
    )[0];
    expect(older.vatRate).toBe(20);
  });
});

/** What Paraşüt is expected to do with a line: net rounded, KDV on it half up. */
function parasutLineMinor(l: InvoiceLine): number {
  const net = Math.round((l.quantity * l.unitPrice - l.discountValue) * 100);
  return net + vatOfNet(net, l.vatRate);
}

describe("lines, net prices and the total Paraşüt must agree with", () => {
  it("3 × 90 TL at 10 %: a net of 245,45 whose KDV rounds back to 270,00", () => {
    const lines = orderInvoiceLines(
      order({
        items: [
          {
            productName: "Affogato",
            qty: 3,
            unitPriceMinor: 9_000,
            taxRatePct: 10,
          },
        ],
        subtotalMinor: 27_000,
        totalMinor: 27_000,
      }),
    )!;
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatchObject({
      quantity: 3,
      vatRate: 10,
      totalMinor: 27_000,
      netMinor: 24_545,
      discountValue: 0,
    });
    expect(lines[0].unitPrice).toBe(81.816667);
    expect(parasutLineMinor(lines[0])).toBe(27_000);
    expect(expectedTotalMinor(lines)).toBe(27_000);
  });

  it("shares the discount over the lines exactly like the receipt, and keeps shipping its own line", () => {
    const o = order({
      kind: "shop",
      fulfillment: "shipping",
      items: [
        {
          productName: "Kahve",
          qty: 1,
          unitPriceMinor: 10_000,
          taxRatePct: 10,
          detail: "250 g",
        },
        { productName: "Kupa", qty: 1, unitPriceMinor: 5_000, taxRatePct: 20 },
      ],
      subtotalMinor: 15_000,
      discountMinor: 1_500,
      shippingMinor: 6_000,
      shippingTaxRatePct: 20,
      totalMinor: 19_500,
    });
    const lines = orderInvoiceLines(o)!;
    expect(
      lines.map((l) => [l.productCode, l.discountMinor, l.totalMinor]),
    ).toEqual([
      ["LAF-MAGAZA-10", 1_000, 9_000],
      ["LAF-MAGAZA-20", 500, 4_500],
      ["LAF-TESLIMAT-20", 0, 6_000],
    ]);
    expect(lines[0].description).toBe("Kahve · 250 g");
    expect(lines[2].description).toBe("Kargo bedeli");
    // The discount is sent as a net amount on its line.
    expect(lines[0].unitPrice).toBe(90.909091);
    expect(lines[0].discountValue).toBeCloseTo(
      90.909091 - lines[0].netMinor / 100,
      6,
    );
    expect(expectedTotalMinor(lines)).toBe(19_500);
    // The same KDV rows as the receipt's split.
    expect(linesKdvRows(lines)).toEqual(orderKdvBreakdown(o)!.rows);
    for (const l of lines)
      expect(Math.abs(parasutLineMinor(l) - l.totalMinor)).toBeLessThanOrEqual(
        1,
      );
  });

  it("finds a net whose KDV rounds back to the total wherever one exists, a kuruş off otherwise", () => {
    let exact = 0;
    for (let total = 1; total <= 20_000; total += 1) {
      for (const rate of [10, 20]) {
        const n = lineNetMinor(total, rate);
        const back = n + vatOfNet(n, rate);
        expect(Math.abs(back - total)).toBeLessThanOrEqual(1);
        if (back === total) exact += 1;
      }
    }
    // A total can be out of reach only where the KDV steps by two kuruş
    // for one of net: r / (100 + r) of them, 9 % at 10 % and 17 % at 20 %.
    expect(exact / 40_000).toBeGreaterThan(0.86);
  });

  it("keeps a many-line order within Paraşüt's tolerance", () => {
    const items = [
      { productName: "Latte", qty: 2, unitPriceMinor: 15_500, taxRatePct: 10 },
      { productName: "Gelato", qty: 3, unitPriceMinor: 9_000, taxRatePct: 10 },
      { productName: "Su", qty: 1, unitPriceMinor: 2_500, taxRatePct: 10 },
      {
        productName: "Tiramisu",
        qty: 1,
        unitPriceMinor: 21_000,
        taxRatePct: 10,
      },
    ];
    const subtotal = items.reduce((s, i) => s + i.qty * i.unitPriceMinor, 0);
    const o = order({
      items,
      subtotalMinor: subtotal,
      discountMinor: 1_234,
      shippingMinor: 4_990,
      shippingTaxRatePct: 20,
      totalMinor: subtotal - 1_234 + 4_990,
      fulfillment: "delivery",
    });
    const lines = orderInvoiceLines(o)!;
    const parasut = lines.reduce((s, l) => s + parasutLineMinor(l), 0);
    expect(Math.abs(parasut - o.totalMinor)).toBeLessThanOrEqual(1);
    expect(lines.at(-1)?.description).toBe("Kurye bedeli");
  });

  it("refuses an order whose lines do not add up", () => {
    expect(orderInvoiceLines(order({ subtotalMinor: 1 }))).toBeNull();
    expect(
      orderInvoiceLines(
        order({
          items: [{ productName: "x", qty: 1, unitPriceMinor: 15_000 }],
        }),
      ),
    ).toBeNull();
  });

  it("agrees with Paraşüt's total within 0,01 TL only", () => {
    expect(totalsAgree("150.0", 15_000)).toBe(true);
    expect(totalsAgree(150.01, 15_000)).toBe(true);
    expect(totalsAgree(149.99, 15_000)).toBe(true);
    expect(totalsAgree(150.02, 15_000)).toBe(false);
    expect(totalsAgree(undefined, 15_000)).toBe(false);
    expect(
      kdvBreakdown({
        lines: [{ grossMinor: 27_000, ratePct: 10 }],
        discountMinor: 0,
        shippingMinor: 0,
      }).taxMinor,
    ).toBe(2_455);
  });
});

function keys(o: object): string[] {
  return Object.keys(o);
}

describe("request bodies, against Paraşüt's spec", () => {
  const billing = {
    city: "İstanbul",
    district: "Kadıköy",
    address: "Moda Cad. No 5",
  };
  const lines = orderInvoiceLines(
    parcel({ discountMinor: 9_000, totalMinor: 88_500 }),
  )!;
  const si = salesInvoiceBody({
    marker: invoiceMarker("order", "#10234"),
    note: invoiceNote("order", "#10234", "parcel"),
    issueDate: "2026-10-22",
    orderNo: "10234",
    orderDate: "2026-10-22",
    contactId: "555",
    billing,
    lines: lines.map((l) => ({ ...l, productId: "77" })),
    cashSale: { accountId: 12, paymentDate: "2026-10-22" },
  });

  it("a consumer contact: placeholder tax number, no phone, no TCKN", () => {
    const body = contactBody({
      name: "Eda Mancuso",
      email: "eda@example.com",
      billing,
    });
    for (const k of keys(body.data.attributes))
      expect(PARASUT_FIELDS.contacts, k).toContain(k);
    expect(body.data.type).toBe("contacts");
    expect(body.data.attributes).toMatchObject({
      contact_type: "person",
      account_type: "customer",
      tax_number: CONSUMER_TAX_NUMBER,
      city: "İstanbul",
      district: "Kadıköy",
    });
    expect(JSON.stringify(body)).not.toMatch(/phone|tckn/);
  });

  it("a product per kind and rate", () => {
    const body = productBody("KAFE", 10);
    for (const k of keys(body.data.attributes))
      expect(PARASUT_FIELDS.products, k).toContain(k);
    expect(body.data.attributes).toMatchObject({
      code: "LAF-KAFE-10",
      name: "Kafe siparişi (KDV %10)",
      vat_rate: 10,
      currency: "TRL",
    });
    expect(productBody("KARAOKE", 20).data.attributes).toMatchObject({
      code: "LAF-HIZMET-20",
      name: "Hizmet",
      vat_rate: 20,
    });
  });

  it("the sales invoice: TRL, order no and date together, the marker, lines with products, a cash sale", () => {
    for (const k of keys(si.data.attributes))
      expect(PARASUT_FIELDS.sales_invoices, k).toContain(k);
    expect(si.data.attributes).toMatchObject({
      item_type: "invoice",
      currency: "TRL",
      description: "L'Affogato #10234",
      invoice_note: "Sipariş no: 10234. İrsaliye yerine geçer.",
      order_no: "10234",
      order_date: "2026-10-22",
      issue_date: "2026-10-22",
      tax_number: CONSUMER_TAX_NUMBER,
      cash_sale: true,
      payment_account_id: 12,
      payment_date: "2026-10-22",
    });
    expect(si.data.relationships.contact.data).toEqual({
      id: "555",
      type: "contacts",
    });
    for (const d of si.data.relationships.details.data) {
      expect(d.type).toBe("sales_invoice_details");
      for (const k of keys(d.attributes))
        expect(PARASUT_FIELDS.sales_invoice_details, k).toContain(k);
      expect(d.relationships.product.data).toEqual({
        id: "77",
        type: "products",
      });
    }
    const discounted = si.data.relationships.details.data[0]
      .attributes as Record<string, unknown>;
    expect(discounted.discount_type).toBe("amount");
    expect(Number(discounted.discount_value)).toBeGreaterThan(0);
    // No payment account: no cash sale fields at all.
    const plain = salesInvoiceBody({
      marker: "x",
      note: "y",
      issueDate: "2026-10-22",
      orderNo: "1",
      orderDate: "2026-10-22",
      contactId: "1",
      billing,
      lines: [],
      cashSale: null,
    });
    expect(keys(plain.data.attributes)).not.toContain("cash_sale");
  });

  it("the e-Arşiv: an internet sale paid by card through PayNkolay, the carrier for a parcel, the köşk for its courier", () => {
    const body = eArchiveBody({
      salesInvoiceId: "9",
      siteUrl: "https://laffogato.net",
      paymentDate: "2026-10-22",
      shipment: shipmentFor("parcel", YURTICI, "2026-10-22"),
    });
    for (const k of keys(body.data.attributes))
      expect(PARASUT_FIELDS.e_archives, k).toContain(k);
    for (const k of keys(body.data.attributes.internet_sale))
      expect(PARASUT_FIELDS.internet_sale, k).toContain(k);
    for (const k of keys(body.data.attributes.shipment!))
      expect(PARASUT_FIELDS.shipment, k).toContain(k);
    expect(PARASUT_PAYMENT_TYPES).toContain(
      body.data.attributes.internet_sale.payment_type,
    );
    expect(body.data.attributes.internet_sale).toEqual({
      url: "https://laffogato.net",
      payment_type: "KREDIKARTI/BANKAKARTI",
      payment_platform: "PayNkolay",
      payment_date: "2026-10-22",
    });
    expect(body.data.attributes.shipment).toEqual({
      title: YURTICI.title,
      vkn: YURTICI.vkn,
      date: "2026-10-22",
    });
    expect(body.data.relationships.sales_invoice.data).toEqual({
      id: "9",
      type: "sales_invoices",
    });
    // The köşk's own courier: its own title and VKN, never a courier's name or TCKN.
    expect(shipmentFor("courier", null, "2026-10-22")).toEqual({
      title: LEGAL_ENTITY.legalName,
      vkn: LEGAL_ENTITY.taxNo,
      date: "2026-10-22",
    });
    expect(shipmentFor("pickup", null, "2026-10-22")).toBeNull();
    expect(shipmentFor("table", null, "2026-10-22")).toBeNull();
    expect(shipmentFor("karaoke", null, "2026-10-22")).toBeNull();
    const none = eArchiveBody({
      salesInvoiceId: "9",
      siteUrl: "https://laffogato.net",
      paymentDate: "2026-10-22",
      shipment: null,
    });
    expect(keys(none.data.attributes)).toEqual(["internet_sale"]);
  });

  it("reads a job the safe way: only done and error end it", () => {
    expect(PARASUT_FIELDS.trackable_jobs).toEqual(["status", "errors"]);
    expect(jobOutcome("done")).toBe("done");
    expect(jobOutcome("error")).toBe("error");
    for (const s of ["pending", "queued", "running", undefined])
      expect(jobOutcome(s)).toBe("running");
    expect(PARASUT_FIELDS.e_archive_read).toEqual(
      expect.arrayContaining(["invoice_number", "uuid"]),
    );
  });
});

describe("small checks", () => {
  it("validates a VKN's check digit", () => {
    expect(isValidVkn(LEGAL_ENTITY.taxNo)).toBe(true);
    expect(isValidVkn("6312110905")).toBe(false);
    expect(isValidVkn("631211090")).toBe(false);
    expect(isValidVkn("63121109O4")).toBe(false);
  });

  it("matches a carrier by its typed name, never ambiguously", () => {
    expect(matchCarrier("Yurtiçi Kargo", [YURTICI])).toBe(YURTICI);
    expect(matchCarrier("YURTICI", [YURTICI])).toBe(YURTICI);
    expect(matchCarrier("Aras", [YURTICI])).toBeNull();
    expect(matchCarrier("", [YURTICI])).toBeNull();
    const two = [YURTICI, { ...YURTICI, name: "Yurtiçi Kargo" }];
    expect(matchCarrier("Yurtiçi Kargo", two)).toBeNull();
  });

  it("mails an invoice only to a real address", () => {
    expect(invoiceRecipient("eda@example.com")).toBe("eda@example.com");
    expect(invoiceRecipient("x@laffogato.local")).toBeNull();
    expect(invoiceRecipient("x@anon.local")).toBeNull();
    expect(invoiceRecipient("not-an-address")).toBeNull();
  });

  it("masks e-mail addresses and long numbers in what it logs and stores", () => {
    const t = maskText(
      "Email eda@example.com taken; phone +90 532 123 45 67; TCKN 12345678901; job 42",
    );
    expect(t).not.toContain("eda@example.com");
    expect(t).not.toContain("532");
    expect(t).not.toContain("12345678901");
    expect(t).toContain("job 42");
  });

  it("dates by the Istanbul calendar", () => {
    expect(istanbulDay("2026-10-22T21:30:00.000Z")).toBe("2026-10-23");
    expect(istanbulDay("2026-10-22T20:59:00.000Z")).toBe("2026-10-22");
  });

  it("backs off 5 min, 15 min, 1 h, 3 h", () => {
    expect([1, 2, 3, 4].map(retryDelayMs)).toEqual(
      [5, 15, 60, 180].map((m) => m * 60_000),
    );
  });

  it("names the PDF in ASCII only", () => {
    expect(
      invoicePdfName({ invoiceNo: "GIB2026000000123", sourceLabel: "#10234" }),
    ).toBe("L-Affogato-e-Arsiv-GIB2026000000123.pdf");
    expect(invoicePdfName({ invoiceNo: "", sourceLabel: "#10234" })).toBe(
      "L-Affogato-e-Arsiv-10234.pdf",
    );
    expect(invoicePdfName({ invoiceNo: 'a"b\r\nc', sourceLabel: "" })).toBe(
      "L-Affogato-e-Arsiv-abc.pdf",
    );
  });
});

describe("deadlines in the panel", () => {
  const row = (deadlineAt: string, status = "due") =>
    ({ status, deadlineAt }) as Parameters<typeof deadlineState>[0];

  it("warns two days ahead and loudly after", () => {
    expect(deadlineState(row("2026-10-29T12:00:00.000Z"), NOW)).toBe("ok");
    expect(deadlineState(row("2026-10-24T11:00:00.000Z"), NOW)).toBe("soon");
    expect(deadlineState(row("2026-10-22T11:00:00.000Z"), NOW)).toBe("late");
    expect(deadlineState(row("2026-10-22T11:00:00.000Z", "issued"), NOW)).toBe(
      "done",
    );
    expect(deadlineState(row(""), NOW)).toBe("none");
    expect(deadlineBadge(row("2026-10-20T11:00:00.000Z"), NOW)).toEqual({
      label: "Süre geçti (3 gün)",
      tone: "danger",
    });
    expect(deadlineBadge(row("2026-10-23T06:00:00.000Z"), NOW)?.tone).toBe(
      "warning",
    );
  });

  it("says on the dashboard what is late, near, manual, refunded after the invoice, and a config error", () => {
    const base = {
      kdvRows: [],
      refundNotedAt: "",
      emailedAt: "",
      emailError: "",
      nextAttemptAt: "",
      emailAttempts: 0,
    };
    const rows = [
      { ...base, status: "due", deadlineAt: "2026-10-20T00:00:00.000Z" },
      { ...base, status: "manual", deadlineAt: "2026-10-23T00:00:00.000Z" },
      {
        ...base,
        status: "issued",
        deadlineAt: "",
        refundNotedAt: "2026-10-22T00:00:00.000Z",
      },
    ] as unknown as Parameters<typeof invoiceDashboardAlert>[0];
    const alert = invoiceDashboardAlert(rows, NOW, {
      mode: "live",
      errors: [],
    })!;
    expect(alert.tone).toBe("danger");
    expect(alert.parts.join("; ")).toMatch(
      /1 faturanın 7 günlük süresi geçti.*1 faturanın süresi 2 gün içinde.*1 fatura elle kesilecek.*1 faturalı siparişte iade/,
    );
    expect(
      invoiceDashboardAlert([], NOW, { mode: "live", errors: [] }),
    ).toBeNull();
    expect(
      invoiceDashboardAlert([], NOW, {
        mode: "draft",
        errors: ["Eksik ortam değişkeni: EARSIV_START_AT."],
      })?.parts[0],
    ).toContain("ayar hatası");
    expect(
      invoiceDashboardAlert([], NOW, { mode: "off", errors: ["x"] }),
    ).toBeNull();
  });
});
