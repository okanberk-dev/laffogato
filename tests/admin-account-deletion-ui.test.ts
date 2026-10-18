import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The panel's side of the web deletion request (18 Eki 2026): Müşteriler
 * badges the member and lists the open requests oldest first, and the
 * member's page leads with the request and "Hesabı sil" as its primary
 * action - once, not a second time in the Yönetim card.
 */

const h = vi.hoisted(() => ({
  member: null as Record<string, unknown> | null,
  members: [] as Record<string, unknown>[],
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
  customerOrdersByEmail: vi.fn(async () => []),
  listCustomers: vi.fn(async () => []),
  listProducts: vi.fn(async () => []),
  getSettings: vi.fn(async () => ({ karaokePrepay: true })),
}));
vi.mock("@/lib/admin/karaoke-audit", () => ({
  listReleasedHolds: vi.fn(async () => ({
    staff: new Set(),
    unverified: new Set(),
  })),
}));
vi.mock("@/lib/customer/store", () => ({
  getAdminCustomerByEmail: vi.fn(async () => h.member),
  listAllCustomers: vi.fn(async () => h.members),
}));
vi.mock("@/lib/customer/coupons", () => ({
  adminListCustomerCoupons: vi.fn(async () => []),
}));
vi.mock("@/lib/admin/invites", () => ({
  getAdminInviteTree: vi.fn(async () => ({
    inviteCode: "",
    invitedBy: "",
    rewardedCount: 0,
    rewardCap: 5,
    capReached: false,
    invitees: [],
  })),
}));
vi.mock("@/lib/mobile/loyalty", () => ({
  getLoyalty: vi.fn(async () => null),
  listStamps: vi.fn(async () => []),
}));
vi.mock("@/lib/mobile/karaoke", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/mobile/karaoke")>()),
  listByAddress: vi.fn(async () => []),
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
vi.mock("@/components/admin/customer-stamps", () => ({
  CustomerStamps: () => null,
}));
vi.mock("@/components/admin/customer-coupons", () => ({
  CustomerCoupons: () => null,
}));

const { default: CustomerDetailPage } =
  await import("@/app/admin/musteriler/[email]/page");
const { default: CustomersPage } = await import("@/app/admin/musteriler/page");

function member(over: Record<string, unknown> = {}) {
  return {
    id: "cus-0042",
    email: "uye@ornek.com",
    name: "Ayşe Yılmaz",
    phone: "",
    birthday: "",
    addresses: [],
    wishlist: [],
    notificationPrefs: {
      orderUpdates: true,
      marketing: false,
      newsletter: false,
    },
    emailVerified: true,
    verifiedAt: "",
    isActive: true,
    termsAcceptedAt: "",
    marketingConsentAt: "",
    deletionRequest: null,
    createdAt: "2026-09-01T10:00:00.000Z",
    updatedAt: "2026-09-01T10:00:00.000Z",
    ...over,
  };
}

const text = (html: string) =>
  html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");

/** Every button whose visible text is exactly `label`. */
const triggers = (html: string, label: string) =>
  [...html.matchAll(/<button[^>]*>([\s\S]*?)<\/button>/g)].filter(
    (m) => text(m[1]).trim() === label,
  );

beforeEach(() => {
  h.member = null;
  h.members = [];
  // "Süre doldu" is measured against the clock: pin it.
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-18T12:00:00.000Z"));
});

afterEach(() => {
  vi.useRealTimers();
});

describe("the member page", () => {
  it("leads with an open request and offers Hesabı sil once, as the primary action", async () => {
    h.member = member({
      deletionRequest: {
        requestedAt: "2026-10-18T09:15:00.000Z",
        reason: "Şehir değiştiriyorum",
      },
    });
    const html = renderToStaticMarkup(
      await CustomerDetailPage({
        params: Promise.resolve({ email: "uye%40ornek.com" }),
      }),
    );
    const t = text(html);
    expect(t).toContain("Silme talebi · 18 Ekim 2026");
    expect(t).toContain("17 Kasım 2026");
    expect(t).toContain("Şehir değiştiriyorum");
    expect(t).toMatch(/Durum Silme talebi/);
    // One "Hesabı sil", drawn primary (the kit's primary class), not danger.
    const del = triggers(html, "Hesabı sil");
    expect(del).toHaveLength(1);
    expect(del[0][0]).toContain("bg-[var(--admin-primary)]");
    // The card comes before the profile.
    expect(html.indexOf("Silme talebi ·")).toBeLessThan(html.indexOf("Profil"));
  });

  it("keeps the ordinary danger button and no card without a request", async () => {
    h.member = member();
    const html = renderToStaticMarkup(
      await CustomerDetailPage({
        params: Promise.resolve({ email: "uye%40ornek.com" }),
      }),
    );
    expect(text(html)).not.toContain("Silme talebi");
    const del = triggers(html, "Hesabı sil");
    expect(del).toHaveLength(1);
    expect(del[0][0]).not.toContain("bg-[var(--admin-primary)]");
  });
});

describe("Müşteriler", () => {
  const render = async (sp: Record<string, string> = {}) =>
    renderToStaticMarkup(
      await CustomersPage({ searchParams: Promise.resolve(sp) }),
    );

  beforeEach(() => {
    h.members = [
      member({
        id: "cus-1",
        email: "yeni@ornek.com",
        name: "Yeni Talep",
        deletionRequest: {
          requestedAt: "2026-10-17T09:00:00.000Z",
          reason: "",
        },
      }),
      member({ id: "cus-2", email: "sade@ornek.com", name: "Sade Üye" }),
      member({
        id: "cus-3",
        email: "eski@ornek.com",
        name: "Eski Talep",
        deletionRequest: {
          requestedAt: "2026-09-01T09:00:00.000Z",
          reason: "",
        },
      }),
    ];
  });

  it("badges a member with an open request, and says how many are open", async () => {
    const t = text(await render());
    expect(t).toContain("Silme talebi · 17 Ekim 2026");
    // Thirty days past 1 Eylül: shown as overdue.
    expect(t).toContain("Silme talebi · süre doldu");
    expect(t).toContain("2 açık hesap silme talebi var");
    expect(t).toContain("En eskisinin son günü 1 Ekim 2026");
  });

  it("lists only the requests, oldest first, behind ?filter=deletion", async () => {
    const html = await render({ filter: "deletion" });
    const t = text(html);
    expect(t).not.toContain("Sade Üye");
    expect(html.indexOf("Eski Talep")).toBeLessThan(html.indexOf("Yeni Talep"));
    // The filter is one of the select's options, so the mail's link works.
    expect(html).toMatch(/<option value="deletion" selected="">Silme talebi/);
  });
});
