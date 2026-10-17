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
  default: ({ href, children, prefetch: _p, ...rest }: { href: string; children?: ReactNode; prefetch?: boolean }) =>
    createElement("a", { href, ...rest }, children),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  unstable_rethrow: vi.fn(),
  redirect: vi.fn(),
}));

const { OrderDetail, PrintableReceipt, maskRef } = await import(
  "@/components/admin/order-detail"
);
const { orderActions } = await import("@/lib/admin/order-actions");
const { orderTimeline } = await import("@/lib/admin/order-timeline");

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

const money = { collected: true, collectedMinor: 12_000, destination: "card" as const };

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
    const out = detail(order({ fulfillment: "shipping", kind: "shop", status: "cancelled" }));
    expect(out).not.toContain('name="trackingNumber"');
    expect(out).not.toContain("Kargo bilgisini kaydet");
  });
});

describe("the timeline", () => {
  it("merges stages, refunds, mails and audit rows, each move read once", () => {
    const items = orderTimeline(
      order({
        status: "cancelled",
        preparingAt: "2026-10-17T08:05:00.000Z",
        refunds: [
          { id: "rfn-1", amountMinor: 12_000, reason: "Sağlayıcı iadesi (paynkolay)", createdAt: "2026-10-17T09:00:00.000Z" },
        ],
      }),
      [
        {
          id: "aud-1",
          actor: "mudur@laffogato.net",
          action: "transition",
          entity: "order",
          entityId: "ord-1",
          payload: { transition: "cancel", to: "cancelled", reason: "Müşteri vazgeçti", restock: false },
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
        { kind: "paid", status: "sent", error: "", createdAt: "2026-10-17T08:01:00.000Z", sentAt: "2026-10-17T08:01:02.000Z" },
        { kind: "cancelled#resend-1", status: "failed", error: "down", createdAt: "2026-10-17T08:31:00.000Z", sentAt: "" },
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
});
