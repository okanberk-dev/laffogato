import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * /admin/musteriler/[email]: the stats use the reports' rule (an abandoned
 * checkout or a cancelled order is not money spent), and the page lists the
 * address's karaoke bookings, which it never showed. Each booking opens its
 * own page and reads as it does there (the karaoke panel's row view).
 */

const h = vi.hoisted(() => ({
  orders: [] as Record<string, unknown>[],
  bookings: [] as Record<string, unknown>[],
  released: {
    staff: new Set<string>(),
    unverified: new Set<string>(),
  },
  releasedFails: false,
  releasedAsked: [] as string[][],
}));

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...rest
  }: {
    href: string;
    children?: ReactNode;
  }) => createElement("a", { href, ...rest }, children),
}));
vi.mock("next/navigation", () => ({
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
  unstable_rethrow: vi.fn(),
  useRouter: () => ({ push: vi.fn() }),
}));
vi.mock("@/lib/admin/auth", () => ({ requireRole: vi.fn(async () => ({})) }));
vi.mock("@/lib/admin/store", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/admin/store")>()),
  customerOrdersByEmail: vi.fn(async () => h.orders),
  listProducts: vi.fn(async () => []),
  getSettings: vi.fn(async () => ({ karaokePrepay: true })),
}));
vi.mock("@/lib/admin/karaoke-audit", () => ({
  listReleasedHolds: vi.fn(async (ids: readonly string[]) => {
    h.releasedAsked.push([...ids]);
    if (h.releasedFails) throw new Error("audit down");
    return h.released;
  }),
}));
vi.mock("@/lib/customer/store", () => ({
  getAdminCustomerByEmail: vi.fn(async () => null),
}));
vi.mock("@/lib/customer/coupons", () => ({
  adminListCustomerCoupons: vi.fn(async () => []),
}));
vi.mock("@/lib/admin/invites", () => ({
  getAdminInviteTree: vi.fn(async () => null),
}));
vi.mock("@/lib/mobile/loyalty", () => ({
  getLoyalty: vi.fn(async () => null),
  listStamps: vi.fn(async () => []),
}));
vi.mock("@/lib/mobile/karaoke", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/mobile/karaoke")>()),
  listByAddress: vi.fn(async () => h.bookings),
}));
const stub = () => vi.fn(async () => ({ ok: true as const, message: "" }));
vi.mock("@/app/admin/musteriler/actions", () => ({
  closeCustomerAccountAction: stub(),
  grantCustomerCouponAction: stub(),
  resendVerificationAction: stub(),
  revokeCustomerCouponAction: stub(),
  setCustomerActiveAction: stub(),
}));
vi.mock("@/app/admin/musteriler/[email]/actions", () => ({
  addCounterStampAction: stub(),
  reverseCounterStampAction: stub(),
}));

const { default: CustomerDetailPage } =
  await import("@/app/admin/musteriler/[email]/page");

function order(n: number, status: string, totalMinor: number) {
  return {
    id: `ord-${n}`,
    orderNo: n,
    status,
    fulfillment: "pickup",
    customerEmail: "misafir@ornek.com",
    customerName: "Misafir",
    customerPhone: "",
    totalMinor,
    refunds: [],
    items: [],
    createdAt: "2026-10-10T10:00:00.000Z",
  };
}

function booking(over: Record<string, unknown>) {
  return {
    id: "krk-0001",
    customerEmail: "misafir@ornek.com",
    customerName: "Misafir",
    date: "2026-10-24",
    startHour: 21,
    hours: 2,
    guests: 6,
    status: "confirmed",
    priceMinor: 200_000,
    discountMinor: 0,
    totalMinor: 200_000,
    note: "",
    createdAt: "2026-10-10T10:00:00.000Z",
    updatedAt: "2026-10-10T10:00:00.000Z",
    paymentStatus: "paid",
    paidMinor: 200_000,
    guest: true,
    ...over,
  };
}

async function render(email = "misafir%40ornek.com"): Promise<string> {
  const el = await CustomerDetailPage({
    params: Promise.resolve({ email }),
  });
  return renderToStaticMarkup(el);
}

const text = (html: string) =>
  html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");

/** The text of the karaoke row that carries `id`. */
function rowText(html: string, id: string): string {
  const part = html.split("<li").find((p) => p.includes(id)) ?? "";
  return text(`<li${part.split("</li>")[0]}`);
}

beforeEach(() => {
  h.orders = [];
  h.bookings = [];
  h.released = { staff: new Set(), unverified: new Set() };
  h.releasedFails = false;
  h.releasedAsked = [];
});

describe("customer detail", () => {
  it("counts only orders that were paid for", async () => {
    h.orders = [
      order(10001, "completed", 30_000),
      order(10002, "pending_payment", 99_000),
      order(10003, "cancelled", 40_000),
    ];
    const t = text(await render());
    expect(t).toMatch(/Sipariş 1 /);
    expect(t).toMatch(/Lifetime value ₺300,00/);
    // The history still lists every attempt.
    expect(t).toContain("Sipariş geçmişi (3)");
  });

  it("lists the address's karaoke bookings with their state", async () => {
    h.orders = [order(10001, "completed", 30_000)];
    h.bookings = [
      booking({}),
      booking({
        id: "krk-0002",
        date: "2026-09-12",
        status: "cancelled",
        paymentStatus: "refunded",
        guest: false,
      }),
    ];
    const html = await render();
    const t = text(html);
    expect(t).toContain("Karaoke rezervasyonları (2)");
    expect(t).toContain("krk-0001");
    expect(t).toContain("Üyeliksiz");
    expect(t).toContain("Ödendi");
    expect(t).toContain("İade edildi");
    expect(t).toContain("ödenen ₺2.000,00");
    // Newest first.
    expect(html.indexOf("krk-0001")).toBeLessThan(html.indexOf("krk-0002"));
    // Each row opens its booking's own page; the header opens the list.
    expect(html).toContain('href="/admin/mobil/karaoke/krk-0001"');
    expect(html).toContain('href="/admin/mobil/karaoke/krk-0002"');
    expect(html).toContain('href="/admin/mobil/karaoke"');
    // Nothing was released, so the audit log is not read.
    expect(h.releasedAsked).toEqual([]);
  });

  it("says what the karaoke page says about a released hold", async () => {
    h.bookings = [
      booking({
        id: "krk-0010",
        date: "2026-10-03",
        status: "cancelled",
        paymentStatus: "expired",
        paidMinor: 0,
      }),
      booking({
        id: "krk-0011",
        date: "2026-10-02",
        status: "cancelled",
        paymentStatus: "expired",
        paidMinor: 0,
      }),
      booking({
        id: "krk-0012",
        date: "2026-10-01",
        status: "cancelled",
        paymentStatus: "expired",
        paidMinor: 0,
      }),
    ];
    h.released = {
      staff: new Set(["krk-0011"]),
      unverified: new Set(["krk-0010"]),
    };
    const html = await render();
    // Let go without the POS's answer: never "not paid" (rule 29).
    expect(rowText(html, "krk-0010")).toContain("Ödeme doğrulanamadı");
    expect(rowText(html, "krk-0010")).not.toContain("Ödenmedi");
    // A panel user let it go before it was paid.
    expect(rowText(html, "krk-0011")).toContain("Ödeme alınmamıştı");
    // Lapsed on its own.
    expect(rowText(html, "krk-0012")).toContain("Ödenmedi, süresi doldu");
    expect(h.releasedAsked).toEqual([["krk-0010", "krk-0011", "krk-0012"]]);
  });

  it("flags a cancelled booking whose money is still in", async () => {
    h.bookings = [
      booking({ status: "cancelled", paymentStatus: "paid" }),
      booking({ id: "krk-0002", date: "2026-10-01" }),
    ];
    const html = await render();
    expect(rowText(html, "krk-0001")).toContain("İade borcu");
    expect(rowText(html, "krk-0002")).not.toContain("İade borcu");
  });

  it("stands when the audit log cannot be read", async () => {
    h.releasedFails = true;
    h.bookings = [
      booking({ status: "cancelled", paymentStatus: "expired", paidMinor: 0 }),
    ];
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const t = text(await render());
      expect(t).toContain("Karaoke rezervasyonları (1)");
      expect(t).toContain("Ödenmedi, süresi doldu");
    } finally {
      errors.mockRestore();
    }
  });

  it("opens for an address that only ever booked karaoke", async () => {
    h.bookings = [booking({})];
    const t = text(await render());
    expect(t).toContain("Karaoke rezervasyonları (1)");
  });

  it("is still a 404 for an address with nothing at all", async () => {
    await expect(render("yok%40ornek.com")).rejects.toThrow("NEXT_NOT_FOUND");
  });
});
