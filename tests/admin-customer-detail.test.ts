import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * /admin/musteriler/[email]: the stats use the reports' rule (an abandoned
 * checkout or a cancelled order is not money spent), and the page lists the
 * address's karaoke bookings, which it never showed.
 */

const h = vi.hoisted(() => ({
  orders: [] as Record<string, unknown>[],
  bookings: [] as Record<string, unknown>[],
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

beforeEach(() => {
  h.orders = [];
  h.bookings = [];
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
    expect(html).toContain('href="/admin/mobil/karaoke"');
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
