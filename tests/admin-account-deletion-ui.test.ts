import { createElement, type ReactElement, type ReactNode } from "react";
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
  // Müşteriler reads one page and the tab counts from SQL
  // (lib/admin/customer-list.ts); the SQL side of the deletion tab runs in
  // tests/db-integration-customer-list.test.ts.
  rows: [] as Record<string, unknown>[],
  counts: {} as Record<string, Record<string, unknown>>,
  wholeCounts: null as Record<string, Record<string, unknown>> | null,
  pageInput: null as Record<string, unknown> | null,
}));

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    prefetch: _prefetch,
    ...rest
  }: {
    href: string;
    children?: ReactNode;
    prefetch?: boolean;
  }) => createElement("a", { href, ...rest }, children),
  useLinkStatus: () => ({ pending: false }),
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
  customerLifetimeOrders: vi.fn(async () => []),
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
}));
vi.mock("@/lib/admin/customer-list", () => ({
  listCustomerPage: vi.fn(async (input: Record<string, unknown>) => {
    h.pageInput = input;
    return h.rows;
  }),
  countCustomers: vi.fn(async (query: { search: string }) =>
    query.search === "" && h.wholeCounts ? h.wholeCounts : h.counts,
  ),
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
  h.rows = [];
  h.counts = {};
  h.wholeCounts = null;
  h.pageInput = null;
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

  it("posts the request the card showed, so a withdrawn one is refused", async () => {
    // The dialog's hidden inputs exist only once it opens; read the props
    // the card hands the dialog instead.
    const { CustomerDeletionRequest } =
      await import("@/components/admin/customer-deletion-request");
    const { CloseAccountButton } =
      await import("@/components/admin/customer-actions");
    const find = (node: unknown, type: unknown): ReactElement | null => {
      if (!node || typeof node !== "object") return null;
      if (Array.isArray(node)) {
        for (const child of node) {
          const hit = find(child, type);
          if (hit) return hit;
        }
        return null;
      }
      const el = node as ReactElement<{ children?: unknown }>;
      if (el.type === type) return el;
      return find(el.props?.children, type);
    };
    const card = CustomerDeletionRequest({
      email: "uye@ornek.com",
      request: { requestedAt: "2026-10-18T09:15:00.000Z", reason: "" },
    });
    const button = find(card, CloseAccountButton) as ReactElement<
      Parameters<typeof CloseAccountButton>[0]
    > | null;
    expect(button?.props.requestedAt).toBe("2026-10-18T09:15:00.000Z");
    const modal = CloseAccountButton(button!.props) as ReactElement<{
      hidden: Record<string, string>;
    }>;
    expect(modal.props.hidden).toEqual({
      email: "uye@ornek.com",
      requestedAt: "2026-10-18T09:15:00.000Z",
    });
    // The Yönetim card's closure posts the address alone.
    const plain = CloseAccountButton({
      email: "uye@ornek.com",
    }) as ReactElement<{
      hidden: Record<string, string>;
    }>;
    expect(plain.props.hidden).toEqual({ email: "uye@ornek.com" });
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

describe("a paid karaoke booking on the request card", () => {
  // Asked at 12:15 on 16 Ekim; the page is read at 15:00 on 18 Ekim (Tuzla).
  const ASKED = "2026-10-16T09:15:00.000Z";
  function booking(over: Record<string, unknown>) {
    return {
      id: "krk-00001",
      customerEmail: "uye@ornek.com",
      customerName: "Ayşe Yılmaz",
      date: "2026-10-25",
      startHour: 20,
      hours: 2,
      guests: 4,
      status: "confirmed",
      priceMinor: 200_000,
      discountMinor: 0,
      totalMinor: 200_000,
      note: "",
      createdAt: "2026-10-10T09:00:00.000Z",
      updatedAt: "2026-10-10T09:00:00.000Z",
      paymentStatus: "paid",
      paidMinor: 200_000,
      paymentRef: "PNK-1",
      guest: false,
      ...over,
    };
  }

  async function card(rows: Record<string, unknown>[]) {
    const { listByAddress } = await import("@/lib/mobile/karaoke");
    vi.mocked(listByAddress).mockResolvedValueOnce(rows as never);
    h.member = member({ deletionRequest: { requestedAt: ASKED, reason: "" } });
    const html = renderToStaticMarkup(
      await CustomerDetailPage({
        params: Promise.resolve({ email: "uye%40ornek.com" }),
      }),
    );
    const from = html.indexOf("Ödenmiş karaoke rezervasyonu");
    return from === -1 ? "" : text(html.slice(from, html.indexOf("Profil")));
  }

  it("names each one by its start and its refund, and the evening whose start came since the request", async () => {
    const shown = await card([
      booking({ id: "krk-00001" }),
      // In its free window on the 16th, started on the 17th: refunded on
      // closure unless the room is recorded as used.
      booking({ id: "krk-00002", date: "2026-10-17", startHour: 20 }),
      // Not the account's, and not money any more.
      booking({ id: "krk-00003", guest: true }),
      booking({ id: "krk-00004", status: "cancelled" }),
      // Already inside its window, with no late share, when the member
      // asked: the closure refunds nothing, nothing to race.
      booking({ id: "krk-00005", date: "2026-10-16", startHour: 13 }),
      // Inside its window at the request, with a 50 % late share.
      booking({
        id: "krk-00006",
        date: "2026-10-16",
        startHour: 14,
        freeCancelHours: 2,
        lateRefundPercent: 50,
      }),
    ]);
    expect(shown).toContain("25 Ekim 2026, 20:00 - 22:00 tam iade");
    expect(shown).toContain(
      "17 Ekim 2026, 20:00 - 22:00 tam iade Saati talepten sonra geçti",
    );
    expect(shown).toContain(
      "16 Ekim 2026, 14:00 - 16:00 %50 iade Saati talepten sonra geçti",
    );
    expect(shown).toContain("başlangıç saatinden önce kapat");
    expect(shown).toContain("Oda kullanıldıysa hesabı kapatırken işaretle");
    expect(shown).not.toContain("16 Ekim 2026, 13:00");
    // The guest and the cancelled booking share the first's slot: one line.
    expect(shown.match(/25 Ekim 2026, 20:00/g)).toHaveLength(1);
  });

  it("judges a booking made after the request at the closure", async () => {
    // Booked at 14:30 today for 16:00, inside its two hours: closing refunds
    // nothing, though the request (two days earlier) predates the window.
    const shown = await card([
      booking({
        id: "krk-00007",
        date: "2026-10-18",
        startHour: 16,
        createdAt: "2026-10-18T11:30:00.000Z",
      }),
    ]);
    expect(shown).toBe("");
  });

  it("asks, unticked, whether the room was used for each evening past its start", async () => {
    const { CloseAccountButton } =
      await import("@/components/admin/customer-actions");
    const modal = CloseAccountButton({
      email: "uye@ornek.com",
      requestedAt: ASKED,
      passedKaraoke: [
        {
          id: "krk-00002",
          label: "17 Ekim 2026, 20:00 - 22:00",
          refundPercent: 100,
          startedSinceRequest: true,
        },
        {
          id: "krk-00006",
          label: "16 Ekim 2026, 14:00 - 16:00",
          refundPercent: 50,
          startedSinceRequest: true,
        },
      ],
    }) as ReactElement<{ children?: ReactNode }>;
    const box = renderToStaticMarkup(modal.props.children as ReactElement);
    expect(box).toMatch(
      /<input type="checkbox"[^>]* name="karaokeRoomUsed" value="krk-00002"\/>/,
    );
    expect(box).not.toContain("checked");
    // A group with a legend, not a label around the boxes (RC-LABEL).
    expect(box).toContain("<fieldset");
    // The tick's own label says what the tick does: the room was used and
    // the payment stays. The refund is what happens when it stays empty, so
    // it sits outside the label, under the row it belongs to. It once read
    // "Oda kullanıldı: ... (tam iade)", as if ticking refunded.
    const labels = [...box.matchAll(/<label[^>]*>([\s\S]*?)<\/label>/g)].map(
      (m) => text(m[1]).trim(),
    );
    expect(labels).toEqual([
      "Oda kullanıldı, iade yapılmaz: 17 Ekim 2026, 20:00 - 22:00",
      "Oda kullanıldı, iade yapılmaz: 16 Ekim 2026, 14:00 - 16:00",
    ]);
    for (const l of labels) expect(l).not.toMatch(/tam iade|%\d+ iade/);
    for (const [id, refund] of [
      ["krk-00002", "İşaretlemezsen tam iade yapılır."],
      ["krk-00006", "İşaretlemezsen %50 iade yapılır."],
    ]) {
      const input = box
        .match(/<input [^>]*>/g)
        ?.find((tag) => tag.includes(`value="${id}"`));
      const described = input?.match(/aria-describedby="([^"]+)"/)?.[1];
      expect(described, id).toBeTruthy();
      const note = box.match(
        new RegExp(`<span[^>]* id="${described}"[^>]*>([\\s\\S]*?)</span>`),
      );
      expect(text(note?.[1] ?? "").trim()).toBe(refund);
    }
    // Nothing to ask without such an evening.
    const plain = CloseAccountButton({
      email: "uye@ornek.com",
    }) as ReactElement<{ children?: ReactNode }>;
    expect(plain.props.children ?? null).toBeNull();
  });
});

describe("Müşteriler", () => {
  const render = async (sp: Record<string, string> = {}) =>
    renderToStaticMarkup(
      await CustomersPage({ searchParams: Promise.resolve(sp) }),
    );

  function row(over: Record<string, unknown>) {
    return {
      email: "uye@ornek.com",
      name: "Ayşe Yılmaz",
      phone: "",
      isMember: true,
      isActive: true,
      emailVerified: true,
      memberSince: "2026-09-01T10:00:00.000Z",
      marketingConsent: false,
      orderCount: 0,
      lifetimeValueMinor: 0,
      refundedMinor: 0,
      lastOrderAt: "",
      lastActivity: "2026-09-01T10:00:00.000Z",
      deletionRequestedAt: "",
      ...over,
    };
  }

  function tab(customers: number, oldestDeletionAt = "") {
    return {
      customers,
      orderCount: 0,
      lifetimeValueMinor: 0,
      refundedMinor: 0,
      oldestDeletionAt,
    };
  }

  beforeEach(() => {
    h.rows = [
      row({
        email: "yeni@ornek.com",
        name: "Yeni Talep",
        deletionRequestedAt: "2026-10-17T09:00:00.000Z",
      }),
      row({ email: "sade@ornek.com", name: "Sade Üye" }),
      row({
        email: "eski@ornek.com",
        name: "Eski Talep",
        deletionRequestedAt: "2026-09-01T09:00:00.000Z",
      }),
    ];
    h.counts = {
      all: tab(3, "2026-09-01T09:00:00.000Z"),
      members: tab(3, "2026-09-01T09:00:00.000Z"),
      guests: tab(0),
      inactive: tab(0),
      deletion: tab(2, "2026-09-01T09:00:00.000Z"),
    };
  });

  it("badges a member with an open request, and says how many are open", async () => {
    const t = text(await render());
    // Asked 17 Ekim: thirty days to 16 Kasım.
    expect(t).toContain("Silme talebi Son gün 16 Kasım 2026");
    // Thirty days past 1 Eylül: shown as overdue.
    expect(t).toContain("Silme talebi Süre doldu (son gün 1 Ekim 2026)");
    expect(t).toContain("2 açık hesap silme talebi var");
    expect(t).toContain("En eskisinin son günü 1 Ekim 2026");
  });

  it("counts the open requests of the whole list, not of a search", async () => {
    h.wholeCounts = h.counts;
    h.counts = {
      all: tab(1),
      members: tab(1),
      guests: tab(0),
      inactive: tab(0),
      deletion: tab(0),
    };
    const t = text(await render({ q: "sade" }));
    expect(t).toContain("2 açık hesap silme talebi var");
  });

  it("asks SQL for the requests behind ?filter=deletion, the staff mail's link", async () => {
    const { DELETION_ADMIN_PATH } =
      await import("@/lib/customer/deletion-request-core");
    expect(DELETION_ADMIN_PATH).toBe("/admin/musteriler?filter=deletion");
    h.rows = h.rows.filter((r) => r.deletionRequestedAt);
    const html = await render({ filter: "deletion" });
    expect(h.pageInput).toMatchObject({ kind: "deletion" });
    // A tab of its own, with its count; the banner is not repeated there.
    expect(text(html)).toMatch(/Silme talebi 2/);
    expect(text(html)).not.toContain("açık hesap silme talebi var");
    // Oldest first is the order (SQL): no column sorts this tab.
    expect(html).not.toContain("sirala=");
  });
});
