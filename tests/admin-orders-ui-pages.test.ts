import { createElement, isValidElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AdminOrder } from "@/lib/admin/store";

/**
 * The two order pages with the store mocked (admin audit, package 2b
 * orders-ui): the list sends a page past the end to the last page and hands
 * its empty state a way out; the order page says when a history read
 * failed instead of showing it as empty, and tells staff, who cannot clear
 * the attention mark, whom to ask.
 */

const h = vi.hoisted(() => ({
  role: "staff" as string,
  order: null as unknown,
  total: 1,
  noticesFail: false,
  auditFail: false,
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
  useLinkStatus: () => ({ pending: false }),
}));
vi.mock("next/navigation", () => ({
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
  redirect: vi.fn((url: string) => {
    throw Object.assign(new Error("NEXT_REDIRECT"), { url });
  }),
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
  listOrderAuditLogs: vi.fn(async () => {
    if (h.auditFail) throw new Error("audit read down");
    return [];
  }),
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
  listOrderNotices: vi.fn(async () => {
    if (h.noticesFail) throw new Error("notice read down");
    return [];
  }),
  orderEmailLedgerHeld: vi.fn(async () => false),
  listOrdersFiltered: vi.fn(async () => ({
    orders: h.total > 0 ? [h.order] : [],
    total: h.total,
  })),
  countOrdersByStatus: vi.fn(async () => ({
    pending_payment: 0,
    paid: h.total,
    preparing: 0,
    shipped: 0,
    completed: 0,
    cancelled: 0,
    refunded: 0,
  })),
  listOrderMoney: vi.fn(async () => new Map()),
}));

function anOrder(over: Partial<AdminOrder> = {}): AdminOrder {
  return {
    id: "ord-1",
    orderNo: 10023,
    customerName: "Eda",
    customerEmail: "eda@example.com",
    customerPhone: "",
    shippingAddress: "",
    internalNote: "",
    status: "paid",
    items: [
      {
        productName: "Latte",
        qty: 1,
        unitPriceMinor: 15_000,
        status: "pending",
      },
    ],
    subtotalMinor: 15_000,
    discountMinor: 0,
    promoCode: "",
    shippingMinor: 0,
    totalMinor: 15_000,
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
  h.role = "staff";
  h.order = anOrder();
  h.total = 1;
  h.noticesFail = false;
  h.auditFail = false;
  h.passed = [];
});

async function listProps(sp: Record<string, string>) {
  const tree = await listPage({ searchParams: Promise.resolve(sp) });
  const list = elements(tree).find((e) => e.type === OrdersList);
  expect(list).toBeDefined();
  return list!.props as {
    emptyTitle: string;
    emptyAction: { href: string; label: string } | null;
  };
}

async function redirectOf(sp: Record<string, string>): Promise<string | null> {
  try {
    await listPage({ searchParams: Promise.resolve(sp) });
    return null;
  } catch (err) {
    return (err as { url?: string }).url ?? null;
  }
}

describe("the list's pages and empty state (ORD-25)", () => {
  it("sends a page past the end to the last page, keeping the filters", async () => {
    // 137 orders at 50 a page: three pages.
    h.total = 137;
    expect(await redirectOf({ sayfa: "9", kanal: "app" })).toBe(
      "/admin/siparisler?sayfa=3&kanal=app",
    );
    // An empty result has one page, and page 1 has no param.
    h.total = 0;
    expect(await redirectOf({ sayfa: "2", durum: "paid" })).toBe(
      "/admin/siparisler?durum=paid",
    );
  });

  it("leaves a page in range alone", async () => {
    h.total = 137;
    expect(await redirectOf({ sayfa: "3" })).toBeNull();
  });

  it("offers 'Filtreleri temizle' behind a filter, keeping the tab", async () => {
    h.total = 0;
    const props = await listProps({ durum: "acik", kanal: "app" });
    expect(props.emptyTitle).toBe("Bu süzgece uyan sipariş yok.");
    expect(props.emptyAction).toEqual({
      href: "/admin/siparisler?durum=acik",
      label: "Filtreleri temizle",
    });
  });

  it("leads an empty tab back to every order, and an empty shop to its first order", async () => {
    h.total = 0;
    expect((await listProps({ durum: "refunded" })).emptyAction).toEqual({
      href: "/admin/siparisler",
      label: "Tüm siparişler",
    });
    const first = await listProps({});
    expect(first.emptyTitle).toBe("Henüz sipariş yok.");
    expect(first.emptyAction).toEqual({
      href: "/admin/siparisler/yeni",
      label: "+ Yeni sipariş",
    });
  });
});

describe("history reads that failed (ORD-20)", () => {
  it("says the mail read failed instead of 'no mail was sent'", async () => {
    h.noticesFail = true;
    const html = renderToStaticMarkup(
      await detailPage({ params: Promise.resolve({ id: "ord-1" }) }),
    );
    expect(html).toContain("E-posta kaydı okunamadı, sayfayı yenile.");
    expect(html).not.toContain("Bu sipariş için e-posta kaydı yok.");
    expect(html).toContain("E-posta kaydı okunamadı: e-postalar burada eksik.");
  });

  it("says the audit read failed above the timeline", async () => {
    h.auditFail = true;
    const html = renderToStaticMarkup(
      await detailPage({ params: Promise.resolve({ id: "ord-1" }) }),
    );
    expect(html).toContain("Olay kaydı okunamadı");
    // The mails were read: their section reads as usual.
    expect(html).toContain("Bu sipariş için e-posta kaydı yok.");
  });

  it("says nothing when both reads worked", async () => {
    const html = renderToStaticMarkup(
      await detailPage({ params: Promise.resolve({ id: "ord-1" }) }),
    );
    expect(html).not.toContain("okunamadı");
  });
});

describe("the attention band's instruction (ORD-26)", () => {
  beforeEach(() => {
    h.order = anOrder({
      attention: "refund_unknown" as AdminOrder["attention"],
    });
  });

  it("tells staff, who cannot clear the mark, to tell a manager", async () => {
    h.role = "staff";
    const html = renderToStaticMarkup(
      await detailPage({ params: Promise.resolve({ id: "ord-1" }) }),
    );
    expect(html).toContain("Çözülmesi için bir yöneticiye haber ver.");
    expect(html).not.toContain("Dikkat işaretini kaldır");
  });

  it("points the refunds role at the menu", async () => {
    h.role = "manager";
    const html = renderToStaticMarkup(
      await detailPage({ params: Promise.resolve({ id: "ord-1" }) }),
    );
    expect(html).toContain("Çözünce ⋯ menüsünden");
    expect(html).toContain("Dikkat işaretini kaldır");
    expect(html).not.toContain("bir yöneticiye haber ver");
  });
});
