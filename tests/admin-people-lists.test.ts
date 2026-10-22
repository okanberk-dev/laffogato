import { readFileSync } from "node:fs";

import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { expectReactGuard, formOpenTags } from "./_support/form-guard";

import type { SortState } from "@/lib/admin/list-params";
import type { AdminPromo } from "@/lib/admin/store";
import type { PublicAdminUser } from "@/lib/admin/users";
import type { NewsletterSubscriber } from "@/lib/newsletter/store";

/**
 * The PEOPLE lists on the panel's kit (admin audit P2b, PEO-12, PEO-14,
 * PEO-15, PEO-23, PEO-24 and the bülten / kampanya parts of PEO-10, 17, 18
 * and 21): promo codes, newsletter subscribers and panel users get tabs
 * with counts, a search where it helps, numbered pages and a view page;
 * the campaign composer's save bar gets a ground of its own.
 */

const h = vi.hoisted(() => ({
  role: "owner" as "owner" | "manager",
  promos: [] as AdminPromo[],
  promoOrders: { rows: [] as unknown[], total: 0 } as
    { rows: unknown[]; total: number } | Error,
  subscribers: [] as NewsletterSubscriber[],
  users: [] as PublicAdminUser[],
  twoFA: new Set<string>(),
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
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  unstable_rethrow: vi.fn(),
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
}));
vi.mock("@/lib/admin/auth", () => ({
  requireRole: vi.fn(async () => ({ email: "sahip@ornek.com", role: h.role })),
}));
vi.mock("@/lib/admin/store", () => ({
  listPromos: vi.fn(async () => h.promos),
  getPromo: vi.fn(
    async (id: string) => h.promos.find((p) => p.id === id) ?? null,
  ),
}));
vi.mock("@/lib/admin/promo-usage", () => ({
  PROMO_ORDERS_LIMIT: 20,
  listPromoOrders: vi.fn(async () => {
    if (h.promoOrders instanceof Error) throw h.promoOrders;
    return h.promoOrders;
  }),
}));
vi.mock("@/app/admin/promosyon/actions", () => ({
  createPromoAction: vi.fn(),
  updatePromoAction: vi.fn(),
  setPromoActiveAction: vi.fn(),
  deletePromoAction: vi.fn(),
}));
vi.mock("@/lib/newsletter/store", () => ({
  NEWSLETTER_CONFIRM_TTL_MS: 7 * 24 * 60 * 60 * 1000,
  listNewsletterSubscribers: vi.fn(async () => h.subscribers),
  getNewsletterSubscriber: vi.fn(
    async (id: string) => h.subscribers.find((s) => s.id === id) ?? null,
  ),
}));
vi.mock("@/app/admin/bulten/actions", () => ({
  deactivateNewsletterAction: vi.fn(),
  deleteNewsletterSubscriberAction: vi.fn(),
}));
vi.mock("@/lib/admin/users", () => ({
  MIN_ADMIN_PASSWORD_LENGTH: 10,
  normalizeAdminEmail: (e: string) => e.trim().toLowerCase(),
  listAdminUsers: vi.fn(async () => h.users),
}));
vi.mock("@/lib/admin/twofa", () => ({
  has2FA: vi.fn(async (email: string) => h.twoFA.has(email)),
}));
vi.mock("@/lib/admin/staff-members", () => ({
  listStaffMembers: vi.fn(async () => []),
}));
vi.mock("@/app/admin/kullanicilar/actions", () => ({
  createAdminUserAction: vi.fn(),
  deleteAdminUserAction: vi.fn(),
  grantBaristaAction: vi.fn(),
  reset2FAAction: vi.fn(),
  resetAdminPasswordAction: vi.fn(),
  revokeBaristaAction: vi.fn(),
  saveAdminUserAction: vi.fn(),
}));

const html = (node: unknown) =>
  renderToStaticMarkup(node as ReturnType<typeof createElement>);

const NOW = Date.parse("2026-10-18T12:00:00.000Z");

function promo(over: Partial<AdminPromo> = {}): AdminPromo {
  return {
    id: "prm-1",
    code: "YAZ25",
    kind: "pct",
    value: 25,
    minSubtotalMinor: 0,
    usageLimit: 0,
    usageCount: 3,
    expiresAt: "",
    isActive: true,
    createdAt: "2026-10-01T09:00:00.000Z",
    updatedAt: "2026-10-01T09:00:00.000Z",
    ...over,
  };
}

function subscriber(
  over: Partial<NewsletterSubscriber> = {},
): NewsletterSubscriber {
  return {
    id: "nws-1",
    email: "ali@ornek.com",
    name: "Ali",
    source: "footer",
    isActive: true,
    createdAt: "2026-10-01T09:00:00.000Z",
    unsubscribedAt: "",
    consentAt: "2026-10-01T09:05:00.000Z",
    consentIp: "203.0.113.7",
    consentText: "L'Affogato'dan kampanya duyurularını almak istiyorum.",
    unsubToken: "unsub-secret-token",
    ...over,
  };
}

function user(over: Partial<PublicAdminUser> = {}): PublicAdminUser {
  return {
    email: "mudur@ornek.com",
    role: "manager",
    name: "Müdür",
    isActive: true,
    createdAt: "2026-09-01T09:00:00.000Z",
    updatedAt: "2026-10-01T09:00:00.000Z",
    createdBy: "sahip@ornek.com",
    ...over,
  };
}

beforeEach(() => {
  h.role = "owner";
  h.promoOrders = { rows: [], total: 0 };
  h.promos = [
    promo(),
    promo({ id: "prm-2", code: "KIS10", isActive: false }),
    promo({
      id: "prm-3",
      code: "EYLUL",
      expiresAt: "2026-09-30T20:59:00.000Z",
      createdAt: "2026-09-01T09:00:00.000Z",
    }),
    promo({
      id: "prm-4",
      code: "ILK50",
      usageLimit: 50,
      usageCount: 50,
      createdAt: "2026-10-05T09:00:00.000Z",
    }),
  ];
  h.subscribers = [
    subscriber(),
    subscriber({
      id: "nws-2",
      email: "ismail@ornek.com",
      name: "İsmail",
      source: "register",
      isActive: false,
      confirmToken: "confirm-secret-token",
      confirmRequestedAt: "2026-10-17T09:00:00.000Z",
      confirmRequestIp: "198.51.100.4",
      consentAt: "",
      consentIp: "",
      consentText: "",
      createdAt: "2026-10-17T09:00:00.000Z",
    }),
    subscriber({
      id: "nws-3",
      email: "eda@ornek.com",
      name: "",
      source: "account",
      isActive: false,
      unsubscribedAt: "2026-10-10T09:00:00.000Z",
      createdAt: "2026-09-10T09:00:00.000Z",
    }),
  ];
  h.users = [
    user(),
    user({ email: "sahip@ornek.com", role: "owner", name: "Sahip" }),
    user({
      email: "kasa@ornek.com",
      role: "cashier",
      name: "",
      isActive: false,
    }),
  ];
  h.twoFA = new Set(["sahip@ornek.com"]);
});

// ── Promosyon ──────────────────────────────────────────────────────────

describe("promo list (PEO-24)", () => {
  it("puts each code in one tab and counts every tab", async () => {
    const { promoList, PROMO_DEFAULT_SORT } =
      await import("@/lib/admin/promo-list");
    const ids = (tab: Parameters<typeof promoList>[1]["tab"]) =>
      promoList(h.promos, {
        tab,
        filters: {},
        sort: PROMO_DEFAULT_SORT,
        page: 1,
        now: NOW,
      }).rows.map((p) => p.code);
    expect(ids("aktif")).toEqual(["YAZ25"]);
    expect(ids("pasif")).toEqual(["KIS10"]);
    expect(ids("suresi-dolmus")).toEqual(["EYLUL"]);
    expect(ids("limit-doldu")).toEqual(["ILK50"]);
    const all = promoList(h.promos, {
      tab: "tumu",
      filters: {},
      sort: PROMO_DEFAULT_SORT,
      page: 1,
      now: NOW,
    });
    expect(all.counts).toEqual({
      tumu: 4,
      aktif: 1,
      pasif: 1,
      "suresi-dolmus": 1,
      "limit-doldu": 1,
    });
    // Newest first by default.
    expect(all.rows.map((p) => p.code)[0]).toBe("ILK50");
  });

  it("searches the code, sorts by usage or expiry, pages", async () => {
    const { promoList } = await import("@/lib/admin/promo-list");
    const base = { tab: "tumu" as const, page: 1, now: NOW };
    const codes = (
      filters: Record<string, string>,
      sort: SortState = { key: "kod", dir: "asc" },
    ) =>
      promoList(h.promos, { ...base, filters, sort }).rows.map((p) => p.code);
    expect(codes({ q: "yaz" })).toEqual(["YAZ25"]);
    expect(codes({ q: "l" })).toEqual(["EYLUL", "ILK50"]);
    // The I family folds: "ılk" finds ILK50.
    expect(codes({ q: "ılk" })).toEqual(["ILK50"]);
    expect(codes({}, { key: "kullanim", dir: "desc" })[0]).toBe("ILK50");
    // A code without an end date never ends: last when sorted by expiry.
    expect(codes({}, { key: "gecerlilik", dir: "asc" })[0]).toBe("EYLUL");
    const many = Array.from({ length: 120 }, (_, i) =>
      promo({ id: `p${i}`, code: `KOD${String(i).padStart(3, "0")}` }),
    );
    const page3 = promoList(many, {
      ...base,
      filters: {},
      sort: { key: "kod", dir: "asc" },
      page: 9,
    });
    // A page past the end shows the last one.
    expect(page3.page).toBe(3);
    expect(page3.rows).toHaveLength(20);
    expect(page3.total).toBe(120);
  });

  it("draws tabs, the search, sortable headers and a link to each code's page", async () => {
    const { default: Page } = await import("@/app/admin/promosyon/page");
    const page = html(await Page({ searchParams: Promise.resolve({}) }));
    for (const label of [
      "Tümü",
      "Aktif",
      "Pasif",
      "Süresi dolmuş",
      "Limit doldu",
    ]) {
      expect(page, label).toContain(label);
    }
    expect(page).toContain('role="search"');
    expect(page).toContain('href="/admin/promosyon/prm-1"');
    expect(page).toContain('href="/admin/promosyon?sirala=kod&amp;yon=asc"');
    expect(page).toContain("YAZ25 işlemleri");

    const pasif = html(
      await Page({ searchParams: Promise.resolve({ durum: "pasif" }) }),
    );
    expect(pasif).toContain('href="/admin/promosyon/prm-2"');
    expect(pasif).not.toContain('href="/admin/promosyon/prm-1"');
  });

  it("a code's page says where it stands and lists the orders it went into", async () => {
    h.promoOrders = {
      rows: [
        {
          id: "ord-7",
          orderNo: 10007,
          status: "paid",
          discountMinor: 2500,
          totalMinor: 7500,
          createdAt: "2026-10-02T09:00:00.000Z",
        },
      ],
      total: 1,
    };
    const { default: View } = await import("@/app/admin/promosyon/[id]/page");
    const page = html(await View({ params: Promise.resolve({ id: "prm-4" }) }));
    expect(page).toContain("ILK50");
    expect(page).toContain("Limit doldu");
    expect(page).toContain("Kullanım limiti doldu");
    expect(page).toContain("50 / 50 · 0 kaldı");
    expect(page).toContain('href="/admin/promosyon/prm-4/duzenle"');
    expect(page).toContain('href="/admin/promosyon"');
    expect(page).toContain('href="/admin/siparisler/ord-7"');
    expect(page).toContain("#10007");
    // Only what the row needs: no customer on this list.
    expect(page).not.toContain("@ornek.com");
  });

  it("never says 'not used' beside a usage count: a renamed code says why", async () => {
    const { default: View } = await import("@/app/admin/promosyon/[id]/page");
    const view = async (id: string) =>
      html(await View({ params: Promise.resolve({ id }) }));
    const order = (n: number) => ({
      id: `ord-${n}`,
      orderNo: 10000 + n,
      status: "paid",
      discountMinor: 100,
      totalMinor: 900,
      createdAt: "2026-10-02T09:00:00.000Z",
    });
    h.promos.push(promo({ id: "prm-5", code: "YENI", usageCount: 0 }));

    // A fresh code with no orders: nothing to explain.
    h.promoOrders = { rows: [], total: 0 };
    let page = await view("prm-5");
    expect(page).toContain("Bu kod henüz bir siparişte kullanılmadı.");
    expect(page).not.toContain("eski adıyla");

    // YAZ25 was used 3 times, but no order carries this name (renamed).
    page = await view("prm-1");
    expect(page).not.toContain("henüz bir siparişte kullanılmadı");
    expect(page).toContain("Bu adı taşıyan sipariş yok.");
    expect(page).toContain("eski adıyla kayıtlı");

    // Fewer orders than uses: the note rides on the count.
    h.promoOrders = { rows: [order(1), order(2)], total: 2 };
    page = await view("prm-1");
    expect(page).toContain("2 sipariş. Kullanım sayısından az");

    // As many orders as uses, or more (a cancelled order gives its use
    // back and keeps the code): no note.
    h.promoOrders = { rows: [order(1), order(2), order(3)], total: 3 };
    page = await view("prm-1");
    expect(page).toContain("3 sipariş.");
    expect(page).not.toContain("eski adıyla");
  });

  it("a failed read of the orders says so and keeps the page", async () => {
    h.promoOrders = new Error("boom");
    const { default: View } = await import("@/app/admin/promosyon/[id]/page");
    const page = html(await View({ params: Promise.resolve({ id: "prm-1" }) }));
    expect(page).toContain("Siparişler şu an okunamadı.");
    expect(page).toContain("YAZ25");
  });

  it("an unknown code is a 404", async () => {
    const { default: View } = await import("@/app/admin/promosyon/[id]/page");
    await expect(
      View({ params: Promise.resolve({ id: "prm-9" }) }),
    ).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("the edit crumb links back to the code's page", async () => {
    const { breadcrumbTrail } = await import("@/lib/admin/nav-match");
    const links = [{ href: "/admin/promosyon", label: "Promosyon" }];
    expect(
      breadcrumbTrail("/admin/promosyon/prm-1/duzenle", links).map((c) => [
        c.label,
        c.href,
      ]),
    ).toEqual([
      ["Promosyon", "/admin/promosyon"],
      ["Ayrıntı", "/admin/promosyon/prm-1"],
      ["Düzenle", null],
    ]);
  });
});

// ── Bülten ─────────────────────────────────────────────────────────────

describe("newsletter list (PEO-14)", () => {
  it("tabs: Aktif, Onay bekliyor, Pasif, each counted", async () => {
    const { subscriberList, SUBSCRIBER_DEFAULT_SORT } =
      await import("@/lib/admin/newsletter-list");
    const run = (tab: Parameters<typeof subscriberList>[1]["tab"]) =>
      subscriberList(h.subscribers, {
        tab,
        filters: {},
        sort: SUBSCRIBER_DEFAULT_SORT,
        page: 1,
      });
    expect(run("aktif").rows.map((s) => s.id)).toEqual(["nws-1"]);
    expect(run("onay-bekliyor").rows.map((s) => s.id)).toEqual(["nws-2"]);
    expect(run("pasif").rows.map((s) => s.id)).toEqual(["nws-3"]);
    expect(run("tumu").counts).toEqual({
      tumu: 3,
      aktif: 1,
      "onay-bekliyor": 1,
      pasif: 1,
    });
    // Newest first.
    expect(run("tumu").rows[0].id).toBe("nws-2");
  });

  it("searches the address or the name the Turkish way, filters by source", async () => {
    const { subscriberList, SUBSCRIBER_DEFAULT_SORT } =
      await import("@/lib/admin/newsletter-list");
    const ids = (filters: Record<string, string>) =>
      subscriberList(h.subscribers, {
        tab: "tumu",
        filters,
        sort: SUBSCRIBER_DEFAULT_SORT,
        page: 1,
      }).rows.map((s) => s.id);
    expect(ids({ q: "İSMAİL" })).toEqual(["nws-2"]);
    expect(ids({ q: "eda@" })).toEqual(["nws-3"]);
    expect(ids({ kaynak: "footer" })).toEqual(["nws-1"]);
  });

  it("pages 50 at a time", async () => {
    const { subscriberList, SUBSCRIBER_DEFAULT_SORT } =
      await import("@/lib/admin/newsletter-list");
    const many = Array.from({ length: 120 }, (_, i) =>
      subscriber({
        id: `nws-${i}`,
        email: `uye${i}@ornek.com`,
        createdAt: new Date(NOW - i * 60_000).toISOString(),
      }),
    );
    const page2 = subscriberList(many, {
      tab: "tumu",
      filters: {},
      sort: SUBSCRIBER_DEFAULT_SORT,
      page: 2,
    });
    expect(page2.rows).toHaveLength(50);
    expect(page2.rows[0].id).toBe("nws-50");
    expect(page2.total).toBe(120);
  });

  it("draws the kit list: tabs, search, a page per subscriber, no tooltip-only consent", async () => {
    const { default: Page } = await import("@/app/admin/bulten/page");
    const page = html(await Page({ searchParams: Promise.resolve({}) }));
    for (const label of ["Tümü", "Aktif", "Onay bekliyor", "Pasif"]) {
      expect(page, label).toContain(label);
    }
    expect(page).toContain('role="search"');
    expect(page).toContain('href="/admin/bulten/nws-1"');
    expect(page).toContain("Site altı");
    expect(page).not.toContain("Footer");
    expect(page).not.toMatch(/title="L'Affogato/);
    // The consent date and IP stay on the list.
    expect(page).toContain("203.0.113.7");
    // The kit's tones, not Tailwind's palette (PEO-17, PEO-18); the old
    // white stat tiles are the tab counts now.
    expect(page).not.toMatch(/neutral-\d|green-50|amber-50/);
    expect(page).not.toContain("Toplam abone");
    // Tokens never reach the page.
    expect(page).not.toContain("secret-token");
  });

  it("a subscriber's page shows the consent wording whole", async () => {
    const { default: View } = await import("@/app/admin/bulten/[id]/page");
    const page = html(await View({ params: Promise.resolve({ id: "nws-1" }) }));
    expect(page).toContain("Onay kaydı (6563)");
    expect(page).toContain(
      "L&#x27;Affogato&#x27;dan kampanya duyurularını almak istiyorum.",
    );
    expect(page).toContain("203.0.113.7");
    expect(page).toContain('href="/admin/bulten"');
    expect(page).toContain("Pasifleştir");
    expect(page).not.toContain("secret-token");
  });

  it("a pending subscriber's page shows the request, not a consent", async () => {
    const { default: View } = await import("@/app/admin/bulten/[id]/page");
    const page = html(await View({ params: Promise.resolve({ id: "nws-2" }) }));
    expect(page).toContain("Onay bekliyor");
    expect(page).toContain("198.51.100.4");
    expect(page).not.toContain("Pasifleştir");
    expect(page).not.toContain("confirm-secret-token");
  });

  it("reads a confirmation link's deadline the way the store does", async () => {
    const { confirmLinkState } = await import("@/lib/admin/newsletter-list");
    const ttl = 7 * 24 * 60 * 60 * 1000;
    const at = Date.parse("2026-10-10T09:00:00.000Z");
    const deadline = "2026-10-17T09:00:00.000Z";
    // confirmNewsletterByToken refuses only once `now - requested > ttl`.
    expect(confirmLinkState("2026-10-10T09:00:00.000Z", ttl, at + ttl)).toEqual(
      { expiresAt: deadline, expired: false },
    );
    expect(
      confirmLinkState("2026-10-10T09:00:00.000Z", ttl, at + ttl + 1),
    ).toEqual({ expiresAt: deadline, expired: true });
    // A request time the store cannot read is a link it refuses.
    for (const raw of [undefined, "", "garbage"]) {
      expect(confirmLinkState(raw, ttl, at), String(raw)).toEqual({
        expiresAt: null,
        expired: true,
      });
    }
  });

  it("a pending subscriber's page dates the link and names the other way in", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    try {
      const { default: View } = await import("@/app/admin/bulten/[id]/page");
      // Two days after the request: the link still works, until the 24th.
      vi.setSystemTime(new Date("2026-10-19T09:00:00.000Z"));
      let page = html(await View({ params: Promise.resolve({ id: "nws-2" }) }));
      expect(page).toContain("24 Eki 2026 12:00 tarihine kadar geçerli");
      expect(page).not.toContain("7 gün geçerli");
      // A member's own verification confirms it whatever the link says.
      expect(page).toContain("e-postasını doğrularsa");
      // A week and a minute later the store refuses the link; so does the page.
      vi.setSystemTime(new Date("2026-10-24T09:01:00.000Z"));
      page = html(await View({ params: Promise.resolve({ id: "nws-2" }) }));
      expect(page).toContain("Süresi geçti (24 Eki 2026 12:00)");
      // No readable request time: the store treats the link as dead.
      h.subscribers[1] = { ...h.subscribers[1], confirmRequestedAt: "" };
      vi.setSystemTime(new Date("2026-10-19T09:00:00.000Z"));
      page = html(await View({ params: Promise.resolve({ id: "nws-2" }) }));
      expect(page).toContain("Süresi geçti");
      expect(page).not.toContain("tarihine kadar geçerli");
    } finally {
      vi.useRealTimers();
    }
  });

  it("an unknown or odd id is a 404", async () => {
    const { default: View } = await import("@/app/admin/bulten/[id]/page");
    for (const id of ["nws-9", "../x"]) {
      await expect(
        View({ params: Promise.resolve({ id }) }),
        id,
      ).rejects.toThrow("NEXT_NOT_FOUND");
    }
  });
});

// ── Kullanıcılar ───────────────────────────────────────────────────────

describe("users list and view", () => {
  it("finds a user's page by a key that is not the address", async () => {
    const { adminUserKey, adminUserHref, findAdminUserByKey } =
      await import("@/lib/admin/admin-users-list");
    const key = adminUserKey("mudur@ornek.com");
    expect(key).toMatch(/^[A-Za-z0-9_-]{16}$/);
    expect(key).toBe(adminUserKey(" Mudur@Ornek.com "));
    expect(adminUserHref("mudur@ornek.com")).not.toContain("mudur");
    expect(findAdminUserByKey(h.users, key)?.email).toBe("mudur@ornek.com");
    expect(findAdminUserByKey(h.users, "mudur@ornek.com")).toBeNull();
  });

  it("lists every account in a table, the owner first, with tabs", async () => {
    const { adminUserHref } = await import("@/lib/admin/admin-users-list");
    const { default: Page } = await import("@/app/admin/kullanicilar/page");
    const page = html(await Page({ searchParams: Promise.resolve({}) }));
    for (const label of ["Tümü", "Aktif", "Pasif"]) {
      expect(page, label).toContain(label);
    }
    expect(page).toContain(`href="${adminUserHref("mudur@ornek.com")}"`);
    expect(page.indexOf("Sahip</")).toBeLessThan(page.indexOf("Müdür"));
    expect(page).toContain("2FA açık");
    // The per-account edit cards left the list for the account's page.
    expect(page).not.toContain("Parolayı sıfırla");
    // The new-user form stays here.
    expect(page).toContain('id="yeni-kullanici"');

    const pasif = html(
      await Page({ searchParams: Promise.resolve({ durum: "pasif" }) }),
    );
    expect(pasif).toContain(`href="${adminUserHref("kasa@ornek.com")}"`);
    expect(pasif).not.toContain(`href="${adminUserHref("mudur@ornek.com")}"`);
  });

  it("an account's page shows its facts, its role's reach and its forms", async () => {
    const { adminUserKey } = await import("@/lib/admin/admin-users-list");
    const { default: View } =
      await import("@/app/admin/kullanicilar/[key]/page");
    const page = html(
      await View({
        params: Promise.resolve({ key: adminUserKey("mudur@ornek.com") }),
      }),
    );
    expect(page).toContain("Müdür");
    expect(page).toContain("mudur@ornek.com");
    expect(page).toContain("Yönetici");
    expect(page).toContain("Bu rol neyi açar");
    expect(page).toContain("Parolayı sıfırla");
    expect(page).toContain("Kullanıcıyı sil");
    expect(page).toContain('href="/admin/kullanicilar"');
    for (const tag of formOpenTags(page)) expectReactGuard(tag);
  });

  it("a key that matches nobody (a deleted account) offers the way back", async () => {
    const { default: View } =
      await import("@/app/admin/kullanicilar/[key]/page");
    const page = html(
      await View({ params: Promise.resolve({ key: "AAAAAAAAAAAAAAAA" }) }),
    );
    expect(page).toContain("Bu kullanıcı yok.");
    expect(page).toContain('href="/admin/kullanicilar"');
  });

  it("keeps the address out of the title", async () => {
    const mod = await import("@/app/admin/kullanicilar/[key]/page");
    expect(mod.metadata.title).toBe("Admin · Kullanıcı");
  });
});

// ── Kampanya ───────────────────────────────────────────────────────────

describe("campaign screens", () => {
  const read = (p: string) => readFileSync(p, "utf8");

  it("the composer's save bar has a ground, and the footnote is out of it (PEO-12)", async () => {
    const { CampaignMailForm } =
      await import("@/app/admin/bulten/kampanya/campaign-mail-form");
    const out = html(
      createElement(CampaignMailForm, {
        action: vi.fn(async () => ({})),
        submitLabel: "Taslağı oluştur",
      }),
    );
    const bar =
      /<div data-sticky-save-bar="[^"]*" class="([^"]*)">([\s\S]*?)<\/div><\/form>/.exec(
        out,
      );
    expect(bar).not.toBeNull();
    const [, cls, inner] = bar!;
    expect(cls).toContain("sticky");
    expect(cls).toContain("bg-[var(--admin-surface)]");
    expect(cls).toContain("border");
    expect(cls).toContain("p-3");
    expect(inner).not.toContain("işaretli alanlar");
    expect(out).toContain("işaretli alanlar");
    // Posted by hand: React's guard, no native post.
    for (const tag of formOpenTags(out)) expectReactGuard(tag);
  });

  it("the composer answers in blocks with a role, not pills", () => {
    const src = read("src/app/admin/bulten/kampanya/campaign-mail-form.tsx");
    expect(src).toContain("<FormError");
    expect(src).toContain("<FormSuccess");
    expect(src).toContain("useHandPost(");
    expect(src).toContain("withPanelCatch");
    expect(src).not.toMatch(/rounded-full|bg-red-50|bg-emerald-50|neutral-\d/);
  });

  it("the campaign screens use the kit's tokens (PEO-10, PEO-17, PEO-18)", () => {
    for (const p of [
      "src/app/admin/bulten/kampanya/page.tsx",
      "src/app/admin/bulten/kampanya/[id]/page.tsx",
      "src/app/admin/bulten/kampanya/campaign-status.tsx",
      "src/components/admin/campaign-send-table.tsx",
      "src/components/admin/campaign-send-log.tsx",
      "src/app/admin/bulten/page.tsx",
    ]) {
      const src = read(p);
      expect(src, p).not.toMatch(
        /neutral-\d|red-\d|amber-\d|emerald-\d|green-\d|blue-\d/,
      );
    }
  });

  it("the status pill is the kit's Badge", async () => {
    const { CampaignStatusPill } =
      await import("@/app/admin/bulten/kampanya/campaign-status");
    const out = html(
      createElement(CampaignStatusPill, { status: "cancelled" }),
    );
    expect(out).toContain("İptal edildi");
    expect(out).toContain("--admin-neutral-soft");
  });

  it("plain Turkish in the panel copy (PEO-21)", async () => {
    const schema = await import("@/lib/admin/campaign-mail-schema");
    expect(schema.CAMPAIGN_MAIL_TEMPLATE_LABELS["kampanya-happy-hour"]).toBe(
      "Mutlu saat",
    );
    expect(schema.CAMPAIGN_MAIL_APP_LINKS_MISSING).not.toMatch(/NEXT_PUBLIC/);
    expect(
      read("src/app/admin/bulten/kampanya/campaign-mail-controls.tsx"),
    ).not.toContain("Bana test");
  });

  it("a list-to-record click shows the panel skeleton (PEO-23)", async () => {
    // admin/loading.tsx wraps only the section a sidebar click changes: a
    // click from a list into a record kept the old page until the server
    // answered. Each PEOPLE folder with record pages gets the same skeleton.
    const { default: AdminLoading } = await import("@/app/admin/loading");
    for (const dir of [
      "promosyon",
      "promosyon/[id]",
      "bulten",
      "bulten/kampanya",
      "kullanicilar",
      "musteriler",
      "musteriler/[email]",
    ]) {
      const mod = (await import(`@/app/admin/${dir}/loading`)) as {
        default: unknown;
      };
      expect(mod.default, dir).toBe(AdminLoading);
    }
    expect(html(createElement(AdminLoading))).toContain('aria-busy="true"');
  });

  it("the sub-pages have a way back at the top (PEO-23)", () => {
    for (const [p, href] of [
      [
        "src/app/admin/bulten/kampanya/yeni/page.tsx",
        '"/admin/bulten/kampanya"',
      ],
      ["src/app/admin/promosyon/yeni/page.tsx", "{PROMOS_PATH}"],
      [
        "src/app/admin/promosyon/[id]/duzenle/page.tsx",
        "{promoHref(promo.id)}",
      ],
      [
        "src/app/admin/musteriler/[email]/duzenle/page.tsx",
        "encodeURIComponent",
      ],
    ] as const) {
      const src = read(p);
      expect(src, p).toContain("<BackLink");
      expect(src, p).toContain(href);
    }
    // One phone padding with the rest of the panel (PEO-18).
    for (const p of [
      "src/app/admin/promosyon/yeni/page.tsx",
      "src/app/admin/promosyon/[id]/duzenle/page.tsx",
    ]) {
      expect(read(p), p).toContain("w-full px-4 pt-5 pb-10 sm:px-5");
    }
  });
});
