import { createElement, isValidElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AdminOrder } from "@/lib/admin/store";

/**
 * The consent's IP address and browser string must not reach the browser
 * of a role without the customer view (ORD-29, karar D3), and hiding them in
 * the markup is not enough: every prop a server page hands a "use client"
 * component is serialized whole into the page's RSC payload (the
 * self.__next_f scripts), read or not. The order page gave the header
 * buttons the whole row and the list gave every row's order to the client
 * list, legalConsent included (verifier C2).
 *
 * The client modules are replaced with recorders: whatever a page passes
 * them is what the payload would carry.
 */

const h = vi.hoisted(() => ({
  role: "staff" as string,
  order: null as unknown,
  passed: [] as { name: string; props: unknown }[],
}));

function recorder(name: string) {
  return (props: unknown) => {
    h.passed.push({ name, props });
    return null;
  };
}

vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children?: ReactNode }) =>
    createElement("a", { href }, children),
}));
vi.mock("next/navigation", () => ({
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
  redirect: vi.fn(),
  unstable_rethrow: vi.fn(),
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));
vi.mock("@/components/admin/order-actions-ui", () => ({
  OrderHeaderActions: recorder("OrderHeaderActions"),
  OrderActionMenu: recorder("OrderActionMenu"),
  BulkOrderButtons: recorder("BulkOrderButtons"),
  ItemStatusSelect: recorder("ItemStatusSelect"),
  OrderNoteForm: recorder("OrderNoteForm"),
}));
vi.mock("@/components/admin/orders-list", () => ({
  OrdersList: recorder("OrdersList"),
}));
vi.mock("@/components/admin/order-customer-editor", () => ({
  OrderCustomerEditor: recorder("OrderCustomerEditor"),
}));
vi.mock("@/lib/admin/auth", () => ({
  requireRole: vi.fn(async () => ({ role: h.role })),
}));
vi.mock("@/lib/admin/audit", () => ({
  listOrderAuditLogs: vi.fn(async () => []),
}));
// "Masa çağrıları" on Siparişler (6 Kas 2026): none open here.
vi.mock("@/lib/admin/table-calls", () => ({
  listOpenTableCallsForPanel: vi.fn(async () => []),
}));
vi.mock("@/lib/admin/store", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/admin/store")>()),
  getOrder: vi.fn(async () => h.order),
  getSettings: vi.fn(async () => ({
    name: "L'Affogato",
    tagline: "",
    phone: "",
    address: "Tuzla",
  })),
  listPaymentTransactions: vi.fn(async () => []),
  listOrderNotices: vi.fn(async () => []),
  orderEmailLedgerHeld: vi.fn(async () => false),
  listOrdersFiltered: vi.fn(async () => ({ orders: [h.order], total: 1 })),
  countOrdersByStatus: vi.fn(async () => ({
    pending_payment: 0,
    paid: 1,
    preparing: 0,
    shipped: 0,
    completed: 0,
    cancelled: 0,
    refunded: 0,
  })),
  listOrderMoney: vi.fn(async () => new Map()),
}));

const IP = "203.0.113.7";
const UA = "Mozilla/5.0 (Probe; C2) Safari/605";

function consentedOrder(): AdminOrder {
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
        productName: "Sirena",
        qty: 1,
        unitPriceMinor: 30_000,
        status: "pending",
      },
    ],
    subtotalMinor: 30_000,
    discountMinor: 0,
    promoCode: "",
    shippingMinor: 0,
    totalMinor: 30_000,
    refunds: [],
    createdAt: "2026-10-17T08:00:00.000Z",
    paidAt: "2026-10-17T08:01:00.000Z",
    channel: "web",
    kind: "shop",
    fulfillment: "shipping",
    legalConsent: {
      acceptedAt: "2026-10-17T08:00:00.000Z",
      documents: ["mesafeli-satis-sozlesmesi"],
      version: "2026-10-16",
      ip: IP,
      userAgent: UA,
    },
  } as AdminOrder;
}

/** Every element in a tree a page returned, without rendering it. */
function elements(
  node: unknown,
  out: { type: unknown; props: unknown }[] = [],
) {
  if (Array.isArray(node)) {
    for (const n of node) elements(n, out);
  } else if (isValidElement(node)) {
    out.push({ type: node.type, props: node.props });
    elements((node.props as { children?: unknown }).children, out);
  }
  return out;
}

const detailPage = (await import("@/app/admin/siparisler/[id]/page")).default;
const listPage = (await import("@/app/admin/siparisler/page")).default;
const { OrdersList } = await import("@/components/admin/orders-list");

beforeEach(() => {
  h.order = consentedOrder();
  h.passed = [];
});

describe("consent evidence in the order pages' client props (ORD-29, verifier C2)", () => {
  it("the order page hands staff's client islands no IP or browser", async () => {
    h.role = "staff";
    const tree = await detailPage({ params: Promise.resolve({ id: "ord-1" }) });
    const html = renderToStaticMarkup(tree);
    const header = h.passed.find((p) => p.name === "OrderHeaderActions");
    expect(header).toBeDefined();
    const sent = JSON.stringify(h.passed);
    expect(sent).not.toContain(IP);
    expect(sent).not.toContain(UA);
    // The header still gets the order it acts on.
    expect(JSON.stringify(header!.props)).toContain('"orderNo":10023');
    // And the screen says only that they are recorded.
    expect(html).not.toContain(IP);
    expect(html).toContain("Kayıtlı");
  });

  it("the owner sees them in the consent section, drawn on the server, not in a client prop", async () => {
    h.role = "owner";
    const tree = await detailPage({ params: Promise.resolve({ id: "ord-1" }) });
    const html = renderToStaticMarkup(tree);
    expect(html).toContain(IP);
    expect(JSON.stringify(h.passed)).not.toContain(IP);
  });

  it("the list hands its client rows no IP or browser, whoever looks", async () => {
    for (const role of ["staff", "owner"]) {
      h.role = role;
      const tree = await listPage({ searchParams: Promise.resolve({}) });
      const list = elements(tree).find((e) => e.type === OrdersList);
      expect(list).toBeDefined();
      const sent = JSON.stringify((list!.props as { rows: unknown }).rows);
      expect(sent).toContain('"orderNo":10023');
      expect(sent).not.toContain(IP);
      expect(sent).not.toContain(UA);
    }
  });
});
