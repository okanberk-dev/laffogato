import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * /admin/musteriler/[email]: the stats use the reports' rule (an abandoned
 * checkout or a cancelled order is not money spent), and the page lists the
 * address's karaoke bookings, which it never showed. Each booking opens its
 * own page and reads as it does there (the karaoke panel's row view).
 *
 * Package 4b: the page fits a phone (PEO-03), keeps the address out of the
 * tab title (PEO-25, D14), lists the newest 20 orders on the kit table with
 * the rest one link away (ORD-30), and speaks the panel's tokens and words
 * (PEO-10, PEO-17, PEO-18, PEO-20, PEO-21, PEO-26).
 */

const h = vi.hoisted(() => ({
  orders: [] as Record<string, unknown>[],
  member: null as Record<string, unknown> | null,
  ordersAsked: [] as Array<[string, number | undefined]>,
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
  customerOrdersByEmail: vi.fn(async (email: string, limit?: number) => {
    h.ordersAsked.push([email, limit]);
    return limit ? h.orders.slice(0, limit) : h.orders;
  }),
  customerLifetimeOrders: vi.fn(async () => h.orders),
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
  getAdminCustomerByEmail: vi.fn(async () => h.member),
}));
vi.mock("@/lib/customer/coupons", () => ({
  adminListCustomerCoupons: vi.fn(async () => []),
}));
vi.mock("@/lib/admin/invites", () => ({
  getAdminInviteTree: vi.fn(async () => ({
    inviteCode: "AYSE42",
    invitedBy: "davet.eden.uzun.bir.adres@ornek.com",
    invitees: [
      {
        id: "inv-1",
        inviteeEmail: "arkadas@ornek.com",
        status: "joined",
        createdAt: "2026-09-01T09:00:00.000Z",
        rewardedAt: "",
      },
    ],
    rewardedCount: 0,
    rewardCap: 5,
    capReached: false,
  })),
}));
vi.mock("@/lib/mobile/loyalty", () => ({
  getLoyalty: vi.fn(async () => ({
    stamps: 3,
    stampTarget: 10,
    rewardsReady: 0,
    lifetimeStamps: 3,
    tier: "bronze",
    tierLabel: "Bronz",
    ordersLast365: 1,
    badges: [],
  })),
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
  h.member = null;
  h.ordersAsked = [];
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
    expect(t).toMatch(/Ödenen sipariş 1 /);
    expect(t).toMatch(/Toplam harcama ₺300,00/);
    expect(t).not.toMatch(/Lifetime value/i);
    // The history still lists every attempt, and says which count is which
    // (PEO-26: the tile said 1 and the heading 3).
    expect(t).toContain("3 sipariş · 1 ödenen");
    expect(t).toContain("#10002");
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

  it("lists the newest 20 orders, counts them all, links to the rest (ORD-30)", async () => {
    h.orders = Array.from({ length: 25 }, (_, i) =>
      order(10100 - i, "completed", 1_000),
    );
    const html = await render();
    const t = text(html);
    // The table asks for 20 rows; the tiles count all 25.
    expect(h.ordersAsked).toEqual([["misafir@ornek.com", 20]]);
    expect(t).toMatch(/Ödenen sipariş 25 /);
    expect(t).toContain("Toplam harcama ₺250,00");
    expect(t).toContain("25 sipariş · 25 ödenen · en yeni 20 tanesi aşağıda");
    expect(html).toContain("#10100");
    expect(html).not.toContain("#10080");
    // "Tümünü gör" posts the address to the order list's search: it is
    // never in a link (the address bar, the history, the request log).
    expect(html).toContain(
      '<input type="hidden" name="_path" value="/admin/siparisler"/><input type="hidden" name="_do" value="apply"/><input type="hidden" name="q" value="misafir@ornek.com"/><button type="submit"',
    );
    expect(html).not.toMatch(/href="[^"]*\?q=/);
    expect(t).toContain("Tümünü gör");
    // Each row opens its order; the kit table names its columns, no "-".
    expect(html).toContain('href="/admin/siparisler/ord-10100"');
    expect(html).not.toMatch(/<th[^>]*>-<\/th>/);
  });

  it("has no link to the order list when every order is on the page", async () => {
    h.orders = [order(10001, "completed", 30_000)];
    const t = text(await render());
    expect(t).not.toContain("Tümünü gör");
  });
});

function member(over: Record<string, unknown> = {}) {
  return {
    id: "cst-1",
    email: "ayse.yilmaz.1990.uzun.adres@hotmail.com",
    name: "Ayşe Yılmaz",
    phone: "0532 000 00 00",
    birthday: "1990-05-14",
    addresses: [
      {
        id: "adr-1",
        label: "Ev",
        recipientName: "Ayşe Yılmaz",
        phone: "0532 000 00 00",
        line1: "Postane Mah., Atatürk Cad. No: 28",
        line2: "",
        district: "Tuzla",
        city: "İstanbul",
        zip: "34940",
        isDefault: true,
      },
    ],
    wishlist: [],
    notificationPrefs: {
      orderUpdates: true,
      marketing: false,
      newsletter: false,
    },
    emailVerified: true,
    verifiedAt: "2026-01-02T09:00:00.000Z",
    isActive: true,
    termsAcceptedAt: "",
    marketingConsentAt: "",
    createdAt: "2026-01-01T09:00:00.000Z",
    updatedAt: "2026-01-01T09:00:00.000Z",
    ...over,
  };
}

describe("member page layout and words (package 4b)", () => {
  const MEMBER_URL = "ayse.yilmaz.1990.uzun.adres%40hotmail.com";

  it("keeps the e-mail out of the browser tab title (PEO-25, D14)", async () => {
    const mod = await import("@/app/admin/musteriler/[email]/page");
    expect((mod as { metadata?: { title?: string } }).metadata?.title).toBe(
      "Admin · Müşteri",
    );
    expect("generateMetadata" in mod).toBe(false);
  });

  it("lets a long address wrap instead of widening a phone screen (PEO-03)", async () => {
    h.member = member();
    const html = await render(MEMBER_URL);
    // Every column track can shrink below its content...
    expect(html).toContain("xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]");
    expect(html).not.toContain("grid-cols-[90px_1fr]");
    // The side cards' own grids shrink too: the stamp history line kept
    // the Sadakat card wider than its column at 390 and at 1280 px.
    expect(html).toMatch(/class="rounded-xl[^"]* grid grid-cols-1 gap-4"/);
    expect(html).not.toMatch(/class="rounded-[23]xl[^"]* grid gap-[34]"/);
    // ...and the address itself may break anywhere, the badge drops under it.
    expect(html).toMatch(
      /<span class="flex flex-wrap items-center gap-x-2 gap-y-1"><span class="\[overflow-wrap:anywhere\]">ayse\.yilmaz\.1990\.uzun\.adres@hotmail\.com<\/span>/,
    );
    // The title of a guest without a name is the address: it wraps too.
    expect(html).toContain("[&amp;_h1]:[overflow-wrap:anywhere]");
  });

  it("uses the kit's lists, buttons, tokens and words (PEO-10/17/18/20/21)", async () => {
    h.member = member();
    h.orders = [order(10001, "completed", 30_000)];
    const html = await render(MEMBER_URL);
    const t = text(html);
    // No Tailwind palette greys or 9 px labels left on the page.
    expect(html).not.toMatch(
      /\b(?:text|bg|border)-(?:neutral|rose|green|orange|amber|blue)-\d/,
    );
    expect(html).not.toMatch(/text-\[9px\]/);
    // Header links are 44 px buttons, not 32 px pills (PEO-20); the way
    // back is the kit's BackLink above the header, 44 px too.
    const edit = html.match(/<a [^>]*>Düzenle<\/a>/)?.[0] ?? "";
    expect(edit).toContain("min-h-11");
    const back =
      html.match(
        /<a [^>]*data-admin-back=""[^>]*><span aria-hidden="true">←<\/span>Tüm müşteriler<\/a>/,
      )?.[0] ?? "";
    expect(back).toContain("min-h-11");
    // Davetler is a definition list and a real list: no <div> in a <ul>.
    expect(html).not.toMatch(/<ul[^>]*>\s*<div/);
    expect(t).toContain("Davet kodu AYSE42");
    // A birthday as the operator reads one, not raw ISO (PEO-21).
    expect(t).toContain("14.05.1990");
    expect(t).not.toContain("1990-05-14");
    expect(t).not.toMatch(/Lifetime value/i);
  });
});
