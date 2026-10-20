import { readFileSync } from "node:fs";

import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import type { AdminOrder, AdminSettings } from "@/lib/admin/store";

/**
 * The order page as markup. What is pinned: the fixes that are only
 * visible on the page (the receipt adds up, the barista sees the cafe
 * details, the lines lock once the order is undone, no free tracking form)
 * and the timeline built from what the order records.
 */

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    prefetch: _p,
    ...rest
  }: {
    href: string;
    children?: ReactNode;
    prefetch?: boolean;
  }) => createElement("a", { href, ...rest }, children),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  unstable_rethrow: vi.fn(),
  redirect: vi.fn(),
}));

const { OrderDetail, PrintableReceipt, maskRef } =
  await import("@/components/admin/order-detail");
const { orderActions } = await import("@/lib/admin/order-actions");
const { orderTimeline } = await import("@/lib/admin/order-timeline");
const { orderDetailsRules } = await import("@/lib/admin/order-details");

const settings = {
  name: "L'Affogato",
  tagline: "",
  phone: "",
  address: "Tuzla",
} as AdminSettings;

function order(over: Partial<AdminOrder> = {}): AdminOrder {
  return {
    id: "ord-1",
    orderNo: 10023,
    customerName: "Eda",
    customerEmail: "eda@example.com",
    customerPhone: "",
    shippingAddress: "Tuzla",
    internalNote: "",
    status: "paid",
    items: [
      {
        productName: "Latte",
        detail: "Büyük · yulaf sütü · +1 shot",
        qty: 1,
        unitPriceMinor: 15_000,
        status: "pending",
      },
    ],
    subtotalMinor: 15_000,
    discountMinor: 3_000,
    promoCode: "HOSGELDIN",
    shippingMinor: 0,
    totalMinor: 12_000,
    refunds: [],
    createdAt: "2026-10-17T08:00:00.000Z",
    paidAt: "2026-10-17T08:01:00.000Z",
    channel: "app",
    kind: "cafe",
    fulfillment: "pickup",
    legalConsent: {},
    ...over,
  } as AdminOrder;
}

const money = {
  collected: true,
  collectedMinor: 12_000,
  destination: "card" as const,
};

function detail(o: AdminOrder, role: "owner" | "staff" = "owner") {
  return renderToStaticMarkup(
    createElement(OrderDetail, {
      order: o,
      settings,
      money,
      actions: orderActions(o, role, true, 12_000),
      payments: [
        {
          provider: "paynkolay",
          providerRef: "IKSIRPF102168",
          status: "succeeded",
          amountMinor: 12_000,
          currency: "TRY",
          trxDate: "2026-10-17",
          createdAt: "2026-10-17T08:01:00.000Z",
        },
      ],
      timeline: [],
      notices: [],
      customerHref: null,
      detailsRules: orderDetailsRules(o, role),
      canSeeEvidence: role === "owner",
    }),
  );
}

describe("the printed receipt", () => {
  it("has the discount row, so a receipt with a promo code adds up", () => {
    const out = renderToStaticMarkup(
      createElement(PrintableReceipt, { order: order(), settings }),
    );
    expect(out).toContain("data-receipt-discount");
    expect(out).toContain("İndirim (HOSGELDIN)");
    // 150 - 30 = 120.
    expect(out).toMatch(/-₺30,00/);
    expect(out).toMatch(/₺120,00/);
    // The cafe details reach the receipt too.
    expect(out).toContain("Büyük · yulaf sütü · +1 shot");
  });

  it("says it is not a fiscal document, on every kind of order (X-FIS)", () => {
    for (const over of [
      {},
      { kind: "shop", fulfillment: "shipping", channel: "web" },
      { source: "manual", channel: "web", fulfillment: "pickup" },
      { fulfillment: "table", tableCode: "K7P42M9XQA", tableName: "Bahçe 5" },
      { status: "pending_payment", paidAt: "" },
    ] as Partial<AdminOrder>[]) {
      const out = renderToStaticMarkup(
        createElement(PrintableReceipt, { order: order(over), settings }),
      );
      const footer = out.slice(out.indexOf("<footer"));
      expect(footer, JSON.stringify(over)).toMatch(
        /<p data-receipt-fiscal-note="true"[^>]*>Bu fiş mali belge değildir\.(<\/p>| )/,
      );
    }
  });

  // Where the real fiscal document comes from (ASK-INVOICE; the company
  // issues its invoices electronically, operator 19 Eki 2026).
  const fiscalLine = (
    over: Partial<AdminOrder>,
    payments: { provider: string; status: string }[] = [],
  ) => {
    const out = renderToStaticMarkup(
      createElement(PrintableReceipt, {
        order: order(over),
        settings,
        payments: payments.map((p) => ({
          ...p,
          providerRef: "ref",
          amountMinor: 12_000,
          currency: "TRY",
          trxDate: "",
          createdAt: "2026-10-17T08:01:00.000Z",
        })),
      }),
    );
    return /<p data-receipt-fiscal-note="true"[^>]*>([^<]*)<\/p>/.exec(
      out,
    )?.[1];
  };
  const NOT_FISCAL = "Bu fiş mali belge değildir.";
  const BY_MAIL = `${NOT_FISCAL} Faturan elektronik olarak e-postana gönderilir.`;
  const AT_TILL = `${NOT_FISCAL} Mali belgen kasadan verilen fiştir.`;
  const manual = { source: "manual", channel: "web" as const };

  it("sends the customer of an order paid online to the e-mailed invoice", () => {
    // App and web orders are paid only through the POS, the wallet or a
    // total brought to zero: paidAt alone says it was paid online.
    expect(fiscalLine({})).toBe(BY_MAIL);
    expect(
      fiscalLine({ kind: "shop", fulfillment: "shipping", channel: "web" }, [
        { provider: "paynkolay", status: "succeeded" },
      ]),
    ).toBe(BY_MAIL);
  });

  it("sends a counter sale to the till's fiş, a transfer to the e-mail", () => {
    for (const method of ["nakit", "kart"]) {
      expect(
        fiscalLine(manual, [
          { provider: `manual:${method}`, status: "succeeded" },
        ]),
        method,
      ).toBe(AT_TILL);
    }
    expect(
      fiscalLine(manual, [{ provider: "manual:havale", status: "succeeded" }]),
    ).toBe(BY_MAIL);
  });

  it("promises nothing it cannot tell", () => {
    // Not paid yet.
    expect(
      fiscalLine({ status: "pending_payment", paidAt: "" }, [
        { provider: "paynkolay", status: "failed" },
      ]),
    ).toBe(NOT_FISCAL);
    // A manual order paid by transfer with no e-mail to send the invoice to.
    expect(
      fiscalLine({ ...manual, customerEmail: "" }, [
        { provider: "manual:havale", status: "succeeded" },
      ]),
    ).toBe(NOT_FISCAL);
    // A manual order marked paid before the method was recorded (ORD-19):
    // cash and transfer look the same.
    expect(fiscalLine(manual)).toBe(NOT_FISCAL);
    // "Diğer" names no method: it may be a counter sale whose fiş is the
    // fiscal document, and no invoice e-mail would ever come.
    for (const over of [manual, { channel: "web" as const }]) {
      expect(
        fiscalLine(over, [{ provider: "manual:diger", status: "succeeded" }]),
        JSON.stringify(over),
      ).toBe(NOT_FISCAL);
    }
  });

  it("reads the order page's own payment rows", () => {
    const out = detail(
      order({ ...manual, kind: "cafe", fulfillment: "pickup" }),
    );
    const footer = out.slice(out.indexOf("<footer"));
    // detail() passes a PayNkolay charge: an online payment.
    expect(footer).toContain(BY_MAIL);
  });

  it("has no discount row without a discount", () => {
    const out = renderToStaticMarkup(
      createElement(PrintableReceipt, {
        order: order({ discountMinor: 0, promoCode: "", totalMinor: 15_000 }),
        settings,
      }),
    );
    expect(out).not.toContain("data-receipt-discount");
  });
});

describe("KDV on the page and the receipt (17 Eki 2026)", () => {
  // Beans at 10% and a mug at 20%, a 40 TL coupon and 40 TL shipping: the
  // coupon is shared over the lines by amount, the shipping fee is its own
  // 20% amount (18 Eki 2026, a transport service on its own line).
  const rated = (over: Partial<AdminOrder> = {}) =>
    order({
      kind: "shop",
      fulfillment: "shipping",
      items: [
        {
          productName: "Sirena",
          qty: 1,
          unitPriceMinor: 30_000,
          status: "pending",
          taxRatePct: 10,
        },
        {
          productName: "Kupa",
          qty: 1,
          unitPriceMinor: 10_000,
          status: "pending",
          taxRatePct: 20,
        },
      ],
      subtotalMinor: 40_000,
      discountMinor: 4_000,
      shippingMinor: 4_000,
      totalMinor: 40_000,
      ...over,
    });

  function withCoupon(
    o: AdminOrder,
    couponSource: string | null,
    couponUnread = false,
  ) {
    return renderToStaticMarkup(
      createElement(OrderDetail, {
        order: o,
        settings,
        money,
        actions: orderActions(o, "owner", true, o.totalMinor),
        payments: [],
        timeline: [],
        notices: [],
        customerHref: null,
        detailsRules: orderDetailsRules(o, "owner"),
        canSeeEvidence: true,
        couponSource,
        couponUnread,
      }),
    );
  }

  /** The Tutar card's KDV table, as text. */
  function kdvTable(out: string): string {
    const at = out.indexOf("data-kdv-breakdown");
    return out.slice(at, out.indexOf("</div>", out.indexOf("</table>", at)));
  }

  it("the receipt prints the KDV inside the total, per rate", () => {
    const out = renderToStaticMarkup(
      createElement(PrintableReceipt, { order: rated(), settings }),
    );
    expect(out.match(/data-receipt-kdv/g)).toHaveLength(2);
    // %20: 9.000 + the whole 4.000 fee = 13.000 → KDV 2.166,67 → 2.167.
    expect(out).toContain("İçindeki KDV %20 (matrah ₺108,33)");
    expect(out).toMatch(/₺21,67/);
    // %10: 27.000, no share of the fee → KDV 2.454,55 → 2.455.
    expect(out).toContain("İçindeki KDV %10 (matrah ₺245,45)");
    expect(out).toMatch(/₺24,55/);
  });

  it("the page shows the per-rate table and each line's rate", () => {
    const out = detail(rated());
    expect(out).toContain("data-kdv-breakdown");
    expect(out).toContain("KDV %10 dahil");
    expect(out).toContain("KDV %20 dahil");
    expect(out).toContain("Matrah");
    // The note says how the split was made: the fee its own line.
    expect(out).toContain("İndirim satırlara tutarlarıyla orantılı dağıtıldı.");
    expect(out).toContain("Kargo ya da kurye ücreti ayrı kalem, KDV %20.");
    expect(out).not.toContain("kargo ya da kurye ücreti satırlara");
    expect(out).not.toContain("data-kdv-reward");
  });

  it("a reward coupon pays for the goods: the table is the invoice's, at full price", () => {
    // A 120 TL stamp-card drink on a 150 TL cafe order (ASK-COUPON).
    const o = order({
      items: [
        {
          productName: "Latte",
          qty: 1,
          unitPriceMinor: 15_000,
          status: "pending",
          taxRatePct: 10,
        },
      ],
      subtotalMinor: 15_000,
      discountMinor: 12_000,
      promoCode: "SD-7K2M9Q",
      totalMinor: 3_000,
    });
    const out = withCoupon(o, "loyalty");
    const table = kdvTable(out);
    // 150 TL at 10% → KDV 13,64 TL, not the 30 TL the member paid.
    expect(table).toContain("₺136,36");
    expect(table).toContain("₺13,64");
    expect(table).toContain("₺150,00");
    expect(out).toContain(
      "Ödül kuponu SD-7K2M9Q: ₺120,00 ödeme olarak düşülür, KDV matrahından düşülmez.",
    );
    expect(out).toContain("Faturadaki döküm: ürünler tam fiyatla.");
    // The receipt keeps the KDV inside what was paid.
    const receipt = renderToStaticMarkup(
      createElement(PrintableReceipt, { order: o, settings }),
    );
    expect(receipt).toContain("İçindeki KDV %10 (matrah ₺27,27)");

    // The same coupon as a 20% gift (HD) is a discount: the member's split.
    const gift = withCoupon(
      order({
        items: o.items,
        subtotalMinor: 15_000,
        discountMinor: 3_000,
        promoCode: "HD-7K2M9Q",
        totalMinor: 12_000,
      }),
      "manual",
    );
    expect(gift).not.toContain("data-kdv-reward");
    expect(kdvTable(gift)).toContain("₺120,00");
  });

  it("a coupon that covers every line is not a discount either", () => {
    const o = order({
      items: [
        {
          productName: "Latte",
          qty: 1,
          unitPriceMinor: 15_000,
          status: "pending",
          taxRatePct: 10,
        },
      ],
      subtotalMinor: 15_000,
      discountMinor: 15_000,
      promoCode: "HD-ALL100",
      totalMinor: 0,
    });
    const out = withCoupon(o, "manual");
    expect(kdvTable(out)).toContain("₺13,64");
    expect(out).toContain(
      "Kupon HD-ALL100 ürünlerin tamamını karşılıyor: ₺150,00 ödeme olarak düşülür, KDV matrahından düşülmez.",
    );
  });

  it("the order page reads the coupon behind the order and hands it to the table", () => {
    const page = readFileSync("src/app/admin/siparisler/[id]/page.tsx", "utf8");
    expect(page).toContain("couponSourcesForOrders([order])");
    // A failed read is flagged, never taken for "no reward".
    expect(page).toMatch(/readOrFlag\(\s*couponSourcesForOrders/);
    expect(page).toContain("couponSource={couponRead.rows[0] ?? null}");
    expect(page).toContain("couponUnread={couponRead.failed}");
  });

  it("says so when the coupon could not be read, instead of guessing", () => {
    const out = withCoupon(rated({ promoCode: "SD-READFAIL" }), null, true);
    expect(out).toContain("Kuponun türü okunamadı.");
    expect(out).not.toContain("data-kdv-reward");
  });

  it("the per-rate table fits a 375 px phone: no forced width", () => {
    const out = detail(rated());
    const table = out.slice(out.indexOf("data-kdv-breakdown"));
    const open = table.indexOf("<table");
    const tag = table.slice(open, table.indexOf(">", open) + 1);
    expect(tag).toContain("w-full");
    expect(tag).not.toMatch(/min-w-\[/);
  });

  it("an order from before rates were kept shows no split and says why", () => {
    const out = detail(order());
    expect(out).not.toContain("data-kdv-breakdown");
    expect(out).toContain("KDV dökümü yok");
    const receipt = renderToStaticMarkup(
      createElement(PrintableReceipt, { order: order(), settings }),
    );
    expect(receipt).not.toContain("data-receipt-kdv");
  });
});

describe("the order page", () => {
  it("shows the cafe details on the line, as the list does", () => {
    expect(detail(order())).toContain("Büyük · yulaf sütü · +1 shot");
  });

  it("shows the payment rows with the reference masked", () => {
    const out = detail(order());
    expect(out).toContain("IKSI…2168");
    expect(out).not.toContain("IKSIRPF102168");
    expect(maskRef("SHORT")).toBe("SHORT");
  });

  it("lets the lines be edited only while the order is live", () => {
    expect(detail(order({ status: "preparing" }))).toContain("<select");
    const cancelled = detail(order({ status: "cancelled" }));
    expect(cancelled).not.toContain("<select");
    expect(cancelled).toContain("Bekliyor");
  });

  it("has no free tracking form at all: Kargoya ver and the menu carry it", () => {
    const out = detail(
      order({ fulfillment: "shipping", kind: "shop", status: "cancelled" }),
    );
    expect(out).not.toContain('name="trackingNumber"');
    expect(out).not.toContain("Kargo bilgisini kaydet");
  });
});

describe("consent evidence on the page (ORD-29, karar D3)", () => {
  const consented = () =>
    order({
      legalConsent: {
        acceptedAt: "2026-10-17T08:00:00.000Z",
        documents: ["mesafeli-satis-sozlesmesi"],
        version: "2026-10-16",
        ip: "85.105.12.34",
        userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0)",
      } as never,
    });

  it("shows staff that the IP and browser are recorded, not what they are", () => {
    const out = detail(consented(), "staff");
    expect(out).not.toContain("85.105.12.34");
    expect(out).not.toContain("iPhone OS 18_0");
    expect(out.match(/Kayıtlı/g)?.length).toBe(2);
    // The rest of the evidence is the shift's to see.
    expect(out).toContain("/hukuk/mesafeli-satis-sozlesmesi");
    expect(out).toContain("2026-10-16");
  });

  it("shows them to the owner, who answers the chargeback", () => {
    const out = detail(consented(), "owner");
    expect(out).toContain("85.105.12.34");
    expect(out).toContain("iPhone OS 18_0");
  });

  it("the page decides it from the customers section", () => {
    const page = readFileSync("src/app/admin/siparisler/[id]/page.tsx", "utf8");
    expect(page).toContain(
      'canSeeEvidence={canAccess("customers", session.role)}',
    );
    // Stamps or a member coupon under the e-mail lock it (verifier C1).
    expect(page).toContain(
      "detailsRules={orderDetailsRules(order, session.role, ledgerHeld)}",
    );
    expect(page).toContain("await orderEmailLedgerHeld(order)");
  });
});

describe("the customer card (ORD-16, karar D2)", () => {
  it("staff may not open a closed order's card, and the card says why", () => {
    const out = detail(order({ status: "completed" }), "staff");
    expect(out).toMatch(/<button[^>]*disabled=""[^>]*>Düzenle<\/button>/);
    expect(out).toContain("yalnız sahip ya da yönetici düzeltebilir");
    expect(out).not.toContain("ile ekleyebilirsin");
  });

  it("staff open the card of an open order", () => {
    const parcel = order({
      status: "preparing",
      shippingAddress: "",
      kind: "shop",
      fulfillment: "shipping",
    });
    const out = detail(parcel, "staff");
    expect(out).not.toMatch(/<button[^>]*disabled=""[^>]*>Düzenle<\/button>/);
    expect(out).toContain("ile ekleyebilirsin");
  });

  it("offers the e-mail only with a confirm box that starts unticked", () => {
    const src = readFileSync(
      "src/components/admin/order-customer-editor.tsx",
      "utf8",
    );
    expect(src).toContain("rules.emailEditable ? (");
    expect(src).toContain('name="emailConfirm"');
    expect(src).not.toMatch(/emailConfirm"[^>]*(defaultChecked|checked)/);
  });
});

describe("the customer card on the kit (ORD-11, ORD-05)", () => {
  it("is a kit Section, with no legacy Card, pills or raw greys", () => {
    const out = detail(order());
    expect(out).toMatch(
      /<h2[^>]*class="text-base font-semibold[^"]*">Müşteri<\/h2>/,
    );
    const src = readFileSync(
      "src/components/admin/order-customer-editor.tsx",
      "utf8",
    );
    expect(src).not.toMatch(/neutral-\d|red-\d|rounded-full|rounded-md/);
    expect(src).not.toContain("<Card");
    // Posted by hand, so a refusal keeps the typing and the confirm box.
    expect(src).toContain("useHandPost(formAction, pending)");
    // ...and still carries an action: React's guard against the browser's
    // own GET, which would put the name, e-mail, phone and address in the
    // address bar (main's tests/form-native-submit.test.ts holds every form
    // to it). onSubmit prevents the post, so React never runs or resets it.
    expect(src).toMatch(
      /<form\s+action=\{post\.action\}\s+onSubmit=\{post\.onSubmit\}/,
    );
    expect(src).not.toMatch(/<form\s+onSubmit=/);
    // A save says so.
    expect(src).toContain(
      'toast.show({ message: "Müşteri bilgisi kaydedildi." })',
    );
  });

  it("shows no address on a gel-al or table order, and no 'Teslimat adresi yok'", () => {
    for (const fulfillment of ["pickup", "table"] as const) {
      const out = detail(
        order({ status: "preparing", fulfillment, shippingAddress: "" }),
        "staff",
      );
      expect(out, fulfillment).not.toContain("Teslimat adresi");
      expect(out, fulfillment).not.toContain("ile ekleyebilirsin");
      expect(out, fulfillment).not.toMatch(/>Adres<\/dt>/);
    }
  });

  it("shows a parcel's or a courier run's address in the Teslimat section", () => {
    for (const fulfillment of ["shipping", "delivery"] as const) {
      const out = detail(
        order({
          fulfillment,
          kind: "shop",
          shippingAddress: "Postane Mah. No: 28\nTuzla",
        }),
      );
      const delivery = out.slice(out.indexOf(">Teslimat</h2>"));
      expect(delivery, fulfillment).toMatch(/>Adres<\/dt>/);
      expect(delivery, fulfillment).toContain("Postane Mah. No: 28");
    }
  });

  it("edits the address only where the order travels, and posts the stored one back elsewhere", () => {
    const src = readFileSync(
      "src/components/admin/order-customer-editor.tsx",
      "utf8",
    );
    expect(src).toContain("hasAddress ? (");
    // A gel-al order's save must not clear an address it happens to carry.
    expect(src).toMatch(
      /<input\s+type="hidden"\s+name="shippingAddress"\s+value=\{shippingAddress\}/,
    );
    const page = readFileSync("src/components/admin/order-detail.tsx", "utf8");
    expect(page).toContain("hasAddress={orderHasAddress(order)}");
  });
});

describe("the order lines on a phone (ORD-24)", () => {
  it("stack below sm and in the narrow lg column, with the status control under each line", () => {
    const out = detail(order({ status: "preparing" }));
    const stacked = out.slice(
      out.indexOf("<ul data-order-lines-stacked"),
      out.indexOf("</ul>", out.indexOf("<ul data-order-lines-stacked")),
    );
    expect(stacked).toMatch(
      /^<ul data-order-lines-stacked="true" class="[^"]*sm:hidden lg:block xl:hidden"/,
    );
    expect(stacked).toContain("Latte");
    expect(stacked).toContain("Büyük · yulaf sütü · +1 shot");
    expect(stacked).toContain("1 × ₺150,00");
    expect(stacked).toContain('<select aria-label="Latte: kalem durumu"');
  });

  it("keep the table from sm (and from xl beside the sidebar), with no forced width", () => {
    const out = detail(order());
    expect(out).toContain(
      '<div class="hidden overflow-x-auto sm:block lg:hidden xl:block"><table class="w-full text-sm">',
    );
    expect(out).not.toContain("min-w-[520px]");
  });
});

describe("the timeline", () => {
  it("merges stages, refunds, mails and audit rows, each move read once", () => {
    const items = orderTimeline(
      order({
        status: "cancelled",
        preparingAt: "2026-10-17T08:05:00.000Z",
        refunds: [
          {
            id: "rfn-1",
            amountMinor: 12_000,
            reason: "Sağlayıcı iadesi (paynkolay)",
            createdAt: "2026-10-17T09:00:00.000Z",
          },
        ],
      }),
      [
        {
          id: "aud-1",
          actor: "mudur@laffogato.net",
          action: "transition",
          entity: "order",
          entityId: "ord-1",
          payload: {
            transition: "cancel",
            to: "cancelled",
            reason: "Müşteri vazgeçti",
            restock: false,
          },
          createdAt: "2026-10-17T08:30:00.000Z",
        },
        {
          id: "aud-2",
          actor: "barista@laffogato.net",
          action: "update",
          entity: "order_item",
          entityId: "ord-1#0",
          payload: { status: "ready" },
          createdAt: "2026-10-17T08:10:00.000Z",
        },
      ],
      [
        {
          kind: "paid",
          status: "sent",
          error: "",
          createdAt: "2026-10-17T08:01:00.000Z",
          sentAt: "2026-10-17T08:01:02.000Z",
        },
        {
          kind: "cancelled#resend-1",
          status: "failed",
          error: "down",
          createdAt: "2026-10-17T08:31:00.000Z",
          sentAt: "",
        },
      ],
    );
    const titles = items.map((i) => i.title);
    expect(titles).toContain("Sipariş verildi");
    expect(titles).toContain("Ödendi");
    expect(titles).toContain("Hazırlanıyor");
    expect(titles).toContain("Durum: İptal edildi");
    expect(titles).toContain("1. kalem: Hazır");
    expect(titles).toContain('"Ödemen alındı" e-postası gönderildi');
    expect(titles).toContain("İptal e-postası (yeniden) gönderilemedi");
    // A provider refund has no audit row: the ledger shows it.
    expect(titles).toContain("İade ₺120,00");
    const cancel = items.find((i) => i.title === "Durum: İptal edildi")!;
    expect(cancel.description).toBe("Müşteri vazgeçti · stoğa alınmadı");
    expect(cancel.actor).toBe("mudur@laffogato.net");
  });

  it("names the KDV correction the migration recorded, with the lines sold at 1%", () => {
    const items = orderTimeline(
      order(),
      [
        {
          id: "aud-0000042",
          actor: "system",
          action: "update",
          entity: "order",
          entityId: "ord-1",
          payload: {
            event: "kdv_rate_corrected",
            migration: "20261019150000_cafe_food_rate_10.sql",
            orderNo: 10001,
            from: 1,
            to: 10,
            count: 2,
            lines: [
              { index: 0, productName: "Etiyopya Yirgacheffe", qty: 2 },
              { index: 2, productName: "Yenilebilir Kup", qty: 1 },
            ],
          },
          createdAt: "2026-10-22T08:00:00.000Z",
        },
      ],
      [],
    );
    const fix = items.find((i) => i.id === "aud-aud-0000042")!;
    expect(fix.title).toBe("KDV oranı %1'den %10'a düzeltildi (2 kalem)");
    expect(fix.tone).toBe("warning");
    expect(fix.description).toBe(
      "Satıştaki oran %1: 1. kalem Etiyopya Yirgacheffe, 3. kalem Yenilebilir Kup. %1 ile fatura kesildiyse mali müşavire ilet.",
    );
  });
});
