import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { KaraokeReservation } from "@/lib/mobile/karaoke-core";

/**
 * The karaoke panel's two pages rendered with their reads scripted: the list
 * (tabs with counts, filters, the table) and one booking's page (who, the
 * money and its evidence, the consents, the history). Bug 9 of
 * map-admin-other §2 was that none of the payment evidence was on screen
 * while the refund_unknown message sent the operator to PayNkolay with it.
 */

const h = vi.hoisted(() => ({
  role: "manager" as string,
  reservation: null as KaraokeReservation | null,
  list: [] as KaraokeReservation[],
  attention: [] as KaraokeReservation[] | Error,
  audit: [] as Array<Record<string, unknown>> | Error,
  released: new Set<string>() as Set<string> | Error,
  unverified: new Set<string>(),
  prepay: true,
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
  // The kit's status tabs and sort headers read the link's pending state.
  useLinkStatus: () => ({ pending: false }),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  unstable_rethrow: vi.fn(),
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
}));
vi.mock("@/app/admin/mobil/karaoke/actions", () => ({
  cancelReservationAction: vi.fn(),
  confirmReservationAction: vi.fn(),
  retryKaraokeRefundAction: vi.fn(),
  settleKaraokeRefundAction: vi.fn(),
}));
vi.mock("@/lib/admin/auth", () => ({
  requireRole: vi.fn(async () => ({
    email: "kosk@laffogato",
    role: h.role,
    expiresAt: 0,
  })),
}));
vi.mock("@/lib/admin/karaoke-audit", () => ({
  listKaraokeAudit: vi.fn(async () => {
    if (h.audit instanceof Error) throw h.audit;
    return h.audit;
  }),
  listReleasedHolds: vi.fn(async () => {
    if (h.released instanceof Error) throw h.released;
    return { staff: h.released, unverified: h.unverified };
  }),
}));
vi.mock("@/lib/admin/store", () => ({
  getSettings: vi.fn(async () => ({ karaokePrepay: h.prepay })),
}));
vi.mock("@/lib/mobile/karaoke", () => ({
  KARAOKE_ADMIN_LIST_LIMIT: 5000,
  getReservation: vi.fn(async () => h.reservation),
  listReservationsForAdmin: vi.fn(async () => h.list),
  listKaraokeAttention: vi.fn(async () => {
    if (h.attention instanceof Error) throw h.attention;
    return h.attention;
  }),
  listReservationsForDate: vi.fn(async () => []),
}));

const { default: ListPage } = await import("@/app/admin/mobil/karaoke/page");
const { default: DetailPage } =
  await import("@/app/admin/mobil/karaoke/[id]/page");

const html = (node: ReactNode) =>
  renderToStaticMarkup(node as ReturnType<typeof createElement>);

// The panel reads the köşk's clock from the real one: far-future dates keep
// the "upcoming" rows upcoming whenever the suite runs.
const FUTURE = "2099-06-20";

function booking(over: Partial<KaraokeReservation> = {}): KaraokeReservation {
  return {
    id: "krk-00042",
    customerEmail: "eda@example.com",
    customerName: "Eda Yılmaz",
    date: FUTURE,
    startHour: 20,
    hours: 2,
    guests: 4,
    status: "confirmed",
    priceMinor: 200_000,
    discountMinor: 0,
    totalMinor: 200_000,
    note: "Doğum günü",
    createdAt: "2026-10-16T10:00:00.000Z",
    updatedAt: "2026-10-16T10:05:00.000Z",
    contactEmail: "",
    contactPhone: "+905321234567",
    paymentStatus: "paid",
    paidAt: "2026-10-16T10:05:00.000Z",
    paidMinor: 200_000,
    paymentRef: "PNK2026101612345",
    channel: "app",
    legalConsent: {
      acceptedAt: "2026-10-16T10:01:00.000Z",
      documents: ["karaoke-on-bilgilendirme", "karaoke-hizmet-sozlesmesi"],
      version: "2026-10-16",
      confirmations: [
        "on-bilgilendirme",
        "hizmet-sozlesmesi",
        "kvkk-aydinlatma",
      ],
      surface: "app",
      ip: "10.1.2.3",
      userAgent: "LafMobil/1.0",
    },
    ...over,
  };
}

async function detail(
  id = "krk-00042",
  sp: Record<string, string> = {},
): Promise<string> {
  return html(
    await DetailPage({
      params: Promise.resolve({ id }),
      searchParams: Promise.resolve(sp),
    }),
  );
}

async function list(sp: Record<string, string> = {}): Promise<string> {
  return html(await ListPage({ searchParams: Promise.resolve(sp) }));
}

beforeEach(() => {
  h.role = "manager";
  h.prepay = true;
  h.reservation = booking();
  h.list = [];
  h.attention = [];
  h.audit = [];
  h.released = new Set();
  h.unverified = new Set();
});

describe("the booking's page", () => {
  it("shows the payment evidence the PayNkolay panel is searched with", async () => {
    const page = await detail();
    expect(page).toContain("PN…2345");
    expect(page).not.toContain("PNK2026101612345");
    expect(page).toContain("Tahsil edilen");
    expect(page).toMatch(/2\.000,00/);
    expect(page).toContain("Ödeme zamanı");
    expect(page).toContain("Uygulama");
  });

  it("a refunded booking says how much went back and when", async () => {
    h.reservation = booking({
      status: "cancelled",
      paymentStatus: "refunded",
      refundedAt: "2026-10-17T09:00:00.000Z",
    });
    const page = await detail();
    expect(page).toContain("İade edilen");
    expect(page).toContain("İade zamanı");
  });

  it("links a member to their customer page; a guest is said to be one", async () => {
    expect(await detail()).toContain(
      'href="/admin/musteriler/eda%40example.com"',
    );
    h.reservation = booking({ guest: true });
    const page = await detail();
    expect(page).toContain("Üyeliksiz (misafir)");
    expect(page).not.toContain("/admin/musteriler/");
  });

  it("Personel sees the booking and its consents, not the buyer's IP or the customer record", async () => {
    h.role = "staff";
    const page = await detail();
    expect(page).toContain("Mesafeli hizmet sözleşmesi");
    expect(page).not.toContain("10.1.2.3");
    expect(page).not.toContain("LafMobil/1.0");
    expect(page).not.toContain("/admin/musteriler/");
    // The refund is drawn, off, with the reason.
    expect(page).toContain("İade yetkisi gerekiyor");
    h.role = "manager";
    expect(await detail()).toContain("10.1.2.3");
  });

  it("tells the history from the audit log", async () => {
    h.audit = [
      {
        id: "aud-9",
        entityId: "krk-00042",
        actor: "kosk@laffogato",
        action: "transition",
        payload: { status: "confirmed" },
        createdAt: "2026-10-16T10:06:00.000Z",
      },
    ];
    const page = await detail();
    expect(page).toContain("Rezervasyon alındı");
    expect(page).toContain("Ödeme alındı");
    expect(page).toContain("Onaylandı");
    expect(page).toContain("kosk@laffogato");
  });

  it("explains a refund owed in words, with what to do", async () => {
    h.reservation = booking({ status: "cancelled" });
    const page = await detail();
    expect(page).toContain("İade borcu");
    expect(page).toContain("İadeyi başlat");
  });

  it("a hold the sweep let go unanswered says so and what to check", async () => {
    h.reservation = booking({
      status: "cancelled",
      paymentStatus: "expired",
      paidMinor: 0,
      paidAt: "",
      paymentRef: "",
    });
    h.audit = [
      {
        id: "aud-12",
        entityId: "krk-00042",
        actor: "system",
        action: "update",
        payload: { event: "hold_released_payment_unknown", amountMinor: 0 },
        createdAt: "2026-10-17T10:00:00.000Z",
      },
    ];
    const page = await detail();
    expect(page).toContain("Ödeme doğrulanamadı");
    expect(page).toContain("PayNkolay panelinde bu rezervasyona başarılı");
    expect(page).not.toContain("Ödenmedi");
  });

  it("stands when its history cannot be read, money actions included (KAR-15)", async () => {
    h.reservation = booking({ status: "cancelled" });
    h.audit = new Error("audit down");
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const page = await detail();
    spy.mockRestore();
    expect(page).toContain("Geçmiş okunamadı");
    // The row's own moments still show, and the refund owed can be started.
    expect(page).toContain("Rezervasyon alındı");
    expect(page).toContain("İadeyi başlat");
  });

  it("a released hold with an unreadable history is never called unpaid (rule 29)", async () => {
    h.reservation = booking({
      status: "cancelled",
      paymentStatus: "expired",
      paidMinor: 0,
      paidAt: "",
      paymentRef: "",
    });
    h.audit = new Error("audit down");
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const page = await detail();
    spy.mockRestore();
    expect(page).toContain("Ödeme doğrulanamadı");
    expect(page).not.toContain("Ödenmedi, süresi doldu");
    expect(page).toContain("denetlenemedi");
  });

  it("goes back to the list it was opened from, and only to that list (KAR-20)", async () => {
    const from = "/admin/mobil/karaoke?sekme=dikkat&q=eda";
    expect(await detail("krk-00042", { geri: from })).toContain(
      'href="/admin/mobil/karaoke?sekme=dikkat&amp;q=eda"',
    );
    for (const geri of [
      "https://evil.example/admin/mobil/karaoke",
      "//evil.example",
      "/admin/siparisler",
      "/admin/mobil/karaokex",
    ]) {
      const page = await detail("krk-00042", { geri });
      expect(page, geri).toContain('href="/admin/mobil/karaoke"');
      expect(page, geri).not.toContain("evil.example");
    }
  });

  it("names the consent's documents and reads amounts plainly (KAR-21)", async () => {
    h.reservation = booking({
      priceMinor: 330_000,
      discountMinor: 30_000,
      totalMinor: 300_000,
      legalConsent: {
        ...booking().legalConsent!,
        documents: ["karaoke-odasi-rezervasyon"],
      },
    });
    const page = await detail();
    expect(page).toContain(
      "Karaoke Odası Ön Bilgilendirme Formu ve Mesafeli Hizmet Sözleşmesi",
    );
    expect(page).toContain('href="/hukuk/karaoke-odasi-rezervasyon"');
    expect(page).toMatch(/Liste ₺3\.300,00 · indirim\s*₺300,00/);
    expect(page).not.toMatch(/₺3\.300,00, indirim/);
  });

  it("answers 404 for an unknown booking and for an id that is not one", async () => {
    h.reservation = null;
    await expect(detail()).rejects.toThrow("NEXT_NOT_FOUND");
    h.reservation = booking();
    await expect(detail("%E0")).rejects.toThrow("NEXT_NOT_FOUND");
    await expect(detail("ord-0001")).rejects.toThrow("NEXT_NOT_FOUND");
  });
});

describe("the list", () => {
  it("draws the five tabs with counts, the filters and a row per booking", async () => {
    h.list = [
      booking({ id: "krk-1" }),
      booking({ id: "krk-2", status: "cancelled" }),
    ];
    h.attention = [h.list[1]!];
    const page = await list({ sekme: "yaklasan" });
    for (const tab of [
      "Bugün",
      "Yaklaşan",
      "Geçmiş",
      "İptal / İade",
      "Dikkat",
    ]) {
      expect(page, tab).toContain(tab);
    }
    expect(page).toContain('role="search"');
    // Opened from Yaklaşan, the booking's page comes back to it.
    expect(page).toContain(
      'href="/admin/mobil/karaoke/krk-1?geri=%2Fadmin%2Fmobil%2Fkaraoke%3Fsekme%3Dyaklasan"',
    );
    expect(page).not.toContain('href="/admin/mobil/karaoke/krk-2');
    // krk-2 owes a refund: the banner points at Dikkat.
    expect(page).toContain("1 rezervasyon bir işlem bekliyor");
  });

  it("shows the door code on every row and card, and the settings link opens the Karaoke tab", async () => {
    h.role = "owner";
    h.list = [booking({ id: "krk-00077", date: "2099-06-21" })];
    const page = await list({ sekme: "yaklasan" });
    // Table cell and phone card both carry it (it showed from 1280 px only).
    expect(page.match(/>krk-00077</g)?.length ?? 0).toBeGreaterThanOrEqual(2);
    expect(page).toContain('href="/admin/ayarlar?sekme=karaoke"');
    expect(page).toContain("Satış · Karaoke");
    expect(page).toContain("Köşkte ödeme");
  });

  it("keeps a hold the köşk let go, and hides the lapsed ones behind a count", async () => {
    const released = {
      status: "cancelled" as const,
      paymentStatus: "expired" as const,
      paidMinor: 0,
      paidAt: "",
      paymentRef: "",
    };
    h.list = [
      booking({ id: "krk-7", ...released }),
      booking({ id: "krk-8", ...released }),
    ];
    h.released = new Set(["krk-7"]);
    const page = await list({ sekme: "iptal" });
    expect(page).toContain('href="/admin/mobil/karaoke/krk-7');
    expect(page).not.toContain('href="/admin/mobil/karaoke/krk-8');
    expect(page).toContain("Ödenmediği için süresi dolan 1 rezervasyon");
  });

  it("never calls a hold let go without the POS's answer unpaid, nor hides it (rule 29)", async () => {
    h.list = [
      booking({
        id: "krk-9",
        status: "cancelled",
        paymentStatus: "expired",
        paidMinor: 0,
        paidAt: "",
        paymentRef: "",
      }),
    ];
    h.unverified = new Set(["krk-9"]);
    const page = await list({ sekme: "iptal" });
    expect(page).toContain('href="/admin/mobil/karaoke/krk-9');
    expect(page).toContain("Ödeme doğrulanamadı");
    expect(page).not.toContain("Ödenmedi, süresi doldu");
    expect(page).not.toContain("rezervasyon denemesi gizli");
  });

  it("Dikkat reads its own set: an old refund owed past the list's rows is there", async () => {
    // The list holds only the newest rows; the owed refund is not among them.
    h.list = [booking({ id: "krk-5000" })];
    h.attention = [
      booking({ id: "krk-7", date: "2025-03-01", status: "cancelled" }),
    ];
    const page = await list({ sekme: "dikkat" });
    expect(page).toContain('href="/admin/mobil/karaoke/krk-7');
    expect(page).not.toContain('href="/admin/mobil/karaoke/krk-5000');
    // Other tabs count it too, and point at Dikkat.
    const other = await list();
    expect(other).toContain("1 rezervasyon bir işlem bekliyor");
  });

  it("falls back to the list's rows when the Dikkat read fails", async () => {
    h.list = [booking({ id: "krk-2", status: "cancelled" })];
    h.attention = new Error("db down");
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const page = await list({ sekme: "dikkat" });
    spy.mockRestore();
    expect(page).toContain('href="/admin/mobil/karaoke/krk-2');
  });

  it("stands when the audit log cannot be read: releases read as lapses", async () => {
    h.list = [
      booking({
        id: "krk-7",
        status: "cancelled",
        paymentStatus: "expired",
        paidMinor: 0,
      }),
    ];
    h.released = new Error("audit down");
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const page = await list({ sekme: "iptal" });
    spy.mockRestore();
    expect(page).toContain("Bu sekmede rezervasyon yok.");
    expect(page).toContain("Ödenmediği için süresi dolan 1 rezervasyon");
  });
});
