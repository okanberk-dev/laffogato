import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createDb, type Executor } from "@/lib/db/client";

/**
 * The panel's landing page (admin audit SHE-06, SHE-14, SHE-15, SHE-17,
 * SHE-22, SHE-29, SHE-31, KAR-07, ORD-30; decisions D1, D35, D38).
 *
 * - Staff read the shop's net revenue here while the role matrix kept
 *   revenue reports from them.
 * - The greeting and the date read the server's UTC clock: "İyi geceler"
 *   until 09:00, and yesterday's date after midnight above a karaoke card
 *   listing today.
 * - The tiles were not links, "Acil dolum" stood under a 0, and a mail
 *   check that threw took the page down.
 * - Innex (22 Eki 2026): one KPI strip, each figure read against a
 *   reference (the same weekday last week up to this hour, the open orders
 *   by kind, the shelves running low), and "Yeni" in the header instead of
 *   a row of twelve chips.
 */

const seen: { text: string; params: readonly unknown[] }[] = [];
let openRows: Record<string, unknown>[] = [];
let productRows: Record<string, unknown>[] = [];
let keepaliveRows: Record<string, unknown>[] = [];
let migrationRows: Record<string, unknown>[] = [];
const exec: Executor = async ({ text, params }) => {
  seen.push({ text, params });
  if (/FROM "supabase_keepalive"/.test(text)) {
    return { rows: keepaliveRows, rowCount: keepaliveRows.length };
  }
  if (/FROM "_migrations"/.test(text)) {
    return { rows: migrationRows, rowCount: migrationRows.length };
  }
  if (/count\(\*\)/i.test(text)) return { rows: [{ count: 2 }], rowCount: 1 };
  if (/FROM "orders"/.test(text)) {
    return { rows: openRows, rowCount: openRows.length };
  }
  if (/FROM "products"/.test(text)) {
    return { rows: productRows, rowCount: productRows.length };
  }
  return { rows: [], rowCount: 0 };
};

/** The executor the stub db sends to; a test may swap it for one run. */
let current: Executor = exec;

vi.mock("@/lib/db", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/db")>();
  const db = createDb((q) => current(q));
  return { ...real, getDb: () => db };
});

const core = await import("@/lib/admin/dashboard-core");

beforeEach(() => {
  seen.length = 0;
  openRows = [];
  productRows = [];
  keepaliveRows = [];
  migrationRows = [];
});

afterEach(() => {
  vi.useRealTimers();
  vi.doUnmock("@/lib/admin/store");
  vi.doUnmock("@/lib/admin/auth");
  vi.doUnmock("@/lib/email/health");
  vi.doUnmock("@/lib/admin/karaoke-today");
});

describe("the köşk's clock (SHE-15, KAR-M02)", () => {
  it("greets and dates by Tuzla time at 00:30", () => {
    // 00:30 on Sunday 18 Oct in Tuzla is 21:30 UTC on Saturday 17 Oct.
    const now = new Date("2026-10-17T21:30:00.000Z");
    expect(core.dashboardGreeting(now)).toBe("İyi geceler");
    expect(core.dashboardDateLabel(now)).toBe("18 Ekim Pazar");
  });

  it("says good morning at 08:00 in Tuzla (05:00 UTC)", () => {
    const now = new Date("2026-10-18T05:00:00.000Z");
    expect(core.dashboardGreeting(now)).toBe("Günaydın");
    expect(core.dashboardGreeting(new Date("2026-10-18T12:30:00.000Z"))).toBe(
      "İyi günler",
    );
    expect(core.dashboardGreeting(new Date("2026-10-18T15:00:00.000Z"))).toBe(
      "İyi akşamlar",
    );
  });
});

describe("tiles by role (SHE-14, SHE-22, SHE-31)", () => {
  // Friday 23 Oct 2026, 15:00 in Tuzla.
  const now = new Date("2026-10-23T12:00:00.000Z");
  const input = {
    openOrderCount: 3,
    openByKind: { cafe: 2, shop: 1 },
    oldestCafeWaitingAt: null,
    attentionOrderCount: 0,
    outOfStockCount: 0,
    lowStockCount: 0,
    revenue: {
      todayMinor: 123_456_78,
      todayOrders: 12,
      lastWeekMinor: 100_000_00,
      lastWeekOrders: 9,
    },
    now,
  };

  it("never gives staff a revenue tile", () => {
    const tiles = core.dashboardTiles(input, "staff");
    expect(tiles.map((t) => t.key)).toEqual(["open", "attention", "soldOut"]);
    expect(JSON.stringify(tiles)).not.toContain("ciro");
  });

  it("gives owner and manager today's net revenue and orders first, against last Friday up to this hour", () => {
    for (const role of ["owner", "manager"] as const) {
      const tiles = core.dashboardTiles(input, role);
      expect(tiles.map((t) => t.key)).toEqual([
        "revenue",
        "orders",
        "open",
        "attention",
        "soldOut",
      ]);
      expect(tiles[0]).toMatchObject({
        key: "revenue",
        label: "Bugün net ciro",
        value: "₺123.456,78",
        reference: "Geçen cuma bu saate kadar ₺100.000,00",
        delta: { label: "%23", direction: "up", good: true },
        href: "/admin/raporlar",
        money: true,
      });
      expect(tiles[1]).toMatchObject({
        key: "orders",
        value: "12",
        reference: "Geçen cuma bu saate kadar 9",
        delta: { label: "+3", direction: "up", good: true },
      });
    }
  });

  it("links every tile to the list it counts", () => {
    const owner = core.dashboardTiles(input, "owner");
    expect(Object.fromEntries(owner.map((t) => [t.key, t.href]))).toEqual({
      revenue: "/admin/raporlar",
      orders: "/admin/siparisler?odeme=odendi&bas=2026-10-23&bit=2026-10-23",
      open: "/admin/siparisler?durum=acik",
      attention: "/admin/siparisler?dikkat=1",
      soldOut: "/admin/urunler?status=out_of_stock",
    });
    // Staff may move stock but not open Ürünler.
    const staff = core.dashboardTiles(input, "staff");
    expect(staff.find((t) => t.key === "soldOut")!.href).toBe(
      "/admin/stok-hareketleri",
    );
    expect(core.stockLinks("staff").product("prd-0003")).toBe(
      "/admin/stok-hareketleri?productId=prd-0003",
    );
    expect(core.stockLinks("owner").product("prd-0003")).toBe(
      "/admin/urunler/prd-0003",
    );
  });

  it("reads every figure against a fact, and asks for a person only above a 0", () => {
    const quiet = core.dashboardTiles(input, "owner");
    expect(quiet.find((t) => t.key === "soldOut")).toMatchObject({
      reference: "Azalan ürün yok",
    });
    expect(quiet.find((t) => t.key === "soldOut")!.tone).toBeUndefined();
    expect(quiet.find((t) => t.key === "attention")!.tone).toBeUndefined();
    expect(quiet.find((t) => t.key === "open")!.reference).toBe(
      "Kafe 2 · Mağaza 1",
    );
    // No "Dolum gerekiyor" under a 0 (SHE-22): a reference is a fact.
    expect(JSON.stringify(quiet)).not.toContain("gerekiyor");
    const busy = core.dashboardTiles(
      {
        ...input,
        attentionOrderCount: 2,
        outOfStockCount: 4,
        lowStockCount: 6,
        // A café order paid 24 minutes ago and not handed over yet.
        oldestCafeWaitingAt: "2026-10-23T11:36:00.000Z",
      },
      "owner",
    );
    expect(busy.find((t) => t.key === "soldOut")).toMatchObject({
      reference: "Azalan stokta 6 ürün",
      tone: "warning",
    });
    expect(busy.find((t) => t.key === "attention")!.tone).toBe("danger");
    expect(busy.find((t) => t.key === "open")).toMatchObject({
      reference: "Kafe 2 · Mağaza 1 · barda en eskisi 24 dk",
      tone: "warning",
    });
  });

  it("measures a change only where it has a size: no pill against nothing or no change", () => {
    expect(core.dashboardDelta(5, 5, "percent")).toBeUndefined();
    expect(core.dashboardDelta(500, 0, "percent")).toBeUndefined();
    expect(core.dashboardDelta(0, 0, "count")).toBeUndefined();
    expect(core.dashboardDelta(3, 7, "count")).toMatchObject({
      label: "−4",
      direction: "down",
      good: false,
      spoken: "düşüş",
    });
    // More money back is not good news.
    expect(core.dashboardDelta(200, 100, "percent", "down")).toMatchObject({
      label: "%100",
      direction: "up",
      good: false,
    });
    expect(core.waitedFor("2026-10-23T10:55:00.000Z", now)).toBe("1 sa 5 dk");
    expect(core.waitedFor("2026-10-23T11:00:00.000Z", now)).toBe("1 sa");
    expect(core.venueWeekday(new Date("2026-10-25T21:30:00.000Z"))).toBe(
      "pazartesi",
    );
    expect(core.venueDay(new Date("2026-10-25T21:30:00.000Z"))).toBe(
      "2026-10-26",
    );
  });
});

describe("the stat tile (SHE-06)", () => {
  // "₺123.456,78" in the old 30 px serif ran 17 px past its card on a phone
  // and past the grid on a laptop: no min-w-0, no wrap, no shrink.
  async function tile(props: {
    label: string;
    value: string;
    money?: boolean;
  }) {
    const { StatCard } = await import("@/components/admin/dashboard/stat-card");
    const html = renderToStaticMarkup(createElement(StatCard, props));
    const value = html.match(
      new RegExp(`<span title="${props.value}" class="([^"]*)"`),
    );
    return { html, value: value?.[1] ?? "" };
  }

  it("keeps the tile inside its grid cell", async () => {
    const { html } = await tile({ label: "Açık sipariş", value: "7" });
    expect(html).toMatch(/^<div class="@container flex min-w-0 /);
  });

  it("never cuts a money figure short: it shrinks with the tile and wraps last", async () => {
    const { value } = await tile({
      label: "Bugün net ciro",
      value: "₺123.456,78",
      money: true,
    });
    expect(value).toContain("text-[clamp(1rem,11cqi,1.5rem)]");
    expect(value).toContain("[overflow-wrap:anywhere]");
    expect(value).not.toContain("truncate");
    expect(value).not.toContain("text-3xl");
  });

  it("truncates a count, with the whole figure in its title", async () => {
    const { value } = await tile({ label: "Sipariş", value: "1.245" });
    expect(value).toContain("truncate");
    expect(value).toContain("text-xl");
  });
});

describe("getDashboardStats", () => {
  it("counts the open orders by status and reads no revenue", async () => {
    const store = await import("@/lib/admin/store");
    openRows = [
      {
        status: "paid",
        kind: "cafe",
        paidAt: "2026-10-23T08:10:00.000Z",
        createdAt: "2026-10-23T08:09:00.000Z",
      },
      {
        status: "paid",
        kind: "cafe",
        paidAt: "2026-10-23T08:02:00.000Z",
        createdAt: "2026-10-23T08:01:00.000Z",
      },
      { status: "pending_payment", kind: "cafe", paidAt: "", createdAt: "" },
      { status: "shipped", kind: "shop", paidAt: "", createdAt: "" },
    ];
    productRows = [
      { id: "p1", name: "Kup", stock: 0, lowStockThreshold: 5, isActive: true },
      {
        id: "p2",
        name: "Fincan",
        stock: 3,
        lowStockThreshold: 5,
        isActive: true,
      },
      {
        id: "p3",
        name: "Eski",
        stock: 0,
        lowStockThreshold: 5,
        isActive: false,
      },
      {
        id: "p4",
        name: "Çay",
        stock: 40,
        lowStockThreshold: 5,
        isActive: true,
      },
    ];
    const stats = await store.getDashboardStats();
    expect(stats).toEqual({
      openOrderCount: 4,
      openByStatus: [
        { status: "pending_payment", count: 1 },
        { status: "paid", count: 2 },
        { status: "preparing", count: 0 },
        { status: "shipped", count: 1 },
      ],
      openByKind: { cafe: 3, shop: 1 },
      // The café order paid first and still to be made; the unpaid one and
      // the parcel do not count.
      oldestCafeWaitingAt: "2026-10-23T08:02:00.000Z",
      attentionOrderCount: 2,
      // The list's "Stokta yok" counts inactive products too.
      outOfStockCount: 2,
      lowStock: [
        { id: "p1", name: "Kup", stock: 0, lowStockThreshold: 5 },
        { id: "p2", name: "Fincan", stock: 3, lowStockThreshold: 5 },
      ],
      lowStockCount: 2,
    });
    const orderReads = seen
      .map((s) => s.text)
      .filter((t) => /FROM "orders"/.test(t));
    expect(orderReads.join("\n")).not.toContain('"totalMinor"');
    expect(orderReads.join("\n")).toMatch(/"attention" <> \$1/);
  });
});

describe("the dashboard page", () => {
  async function render(
    role: "owner" | "manager" | "staff",
    opts: { mailThrows?: boolean; mailBad?: boolean } = {},
  ) {
    vi.resetModules();
    vi.doMock("next/link", () => ({
      default: ({
        href,
        children,
        ...rest
      }: {
        href: string;
        children?: ReactNode;
      }) => createElement("a", { href, ...rest }, children),
      useLinkStatus: () => ({ pending: false }),
    }));
    vi.doMock("@/lib/admin/auth", () => ({
      requireRole: vi.fn(async () => ({
        email: "info@laffogato.net",
        role,
        expiresAt: 0,
      })),
    }));
    const dashboardRevenue = vi.fn(async () => ({
      buckets: [
        {
          bucket: "2026-10-17",
          label: "17 Eki",
          revenueMinor: 50_000,
          orderCount: 2,
        },
        {
          bucket: "2026-10-18",
          label: "18 Eki",
          revenueMinor: 12_500,
          orderCount: 1,
        },
      ],
      lastWeek: { revenueMinor: 10_000, orderCount: 1 },
    }));
    vi.doMock("@/lib/admin/store", async (importOriginal) => ({
      ...(await importOriginal<typeof import("@/lib/admin/store")>()),
      getDashboardStats: vi.fn(async () => ({
        openOrderCount: 1,
        openByStatus: [
          { status: "pending_payment", count: 0 },
          { status: "paid", count: 1 },
          { status: "preparing", count: 0 },
          { status: "shipped", count: 0 },
        ],
        openByKind: { cafe: 1, shop: 0 },
        oldestCafeWaitingAt: null,
        attentionOrderCount: 0,
        outOfStockCount: 0,
        lowStock: [],
        lowStockCount: 0,
      })),
      listRecentOrders: vi.fn(async () => [
        {
          id: "ord-1",
          orderNo: 10042,
          customerName: "Ayşe",
          customerEmail: "ayse@ornek.com",
          status: "paid",
          paidAt: "2026-10-17T21:00:00.000Z",
          totalMinor: 25_000,
          refunds: [{ amountMinor: 5_000 }],
          items: [],
          createdAt: "2026-10-17T21:00:00.000Z",
        },
        {
          // The sweep cancelled it; the card payment landed afterwards.
          id: "ord-2",
          orderNo: 10041,
          customerName: "Can",
          customerEmail: "can@ornek.com",
          status: "cancelled",
          paidAt: "",
          totalMinor: 9_900,
          refunds: [],
          items: [],
          createdAt: "2026-10-17T20:00:00.000Z",
        },
      ]),
      listOrderMoney: vi.fn(
        async (orders: Array<{ id: string; paidAt?: string }>) =>
          new Map(
            orders.map((o) => [
              o.id,
              {
                collected: true,
                collectedMinor: null,
                destination: "none" as const,
              },
            ]),
          ),
      ),
      getSettings: vi.fn(async () => ({
        name: "L'Affogato",
        karaokePrepay: true,
      })),
      dashboardRevenue,
    }));
    vi.doMock("@/lib/email/health", () => ({
      emailHealth: vi.fn(async () => {
        if (opts.mailThrows) throw new Error("settings down");
        return opts.mailBad
          ? { ok: false, message: "laffogato.net henüz doğrulanmadı." }
          : { ok: true, message: "" };
      }),
    }));
    const loadKaraokeTodayCard = vi.fn(async () => ({
      today: [],
      attention: [],
    }));
    vi.doMock("@/lib/admin/karaoke-today", () => ({ loadKaraokeTodayCard }));
    const { default: Page } = await import("@/app/admin/page");
    const html = renderToStaticMarkup(await Page());
    return {
      html,
      text: html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " "),
      dashboardRevenue,
      loadKaraokeTodayCard,
    };
  }

  it("shows staff no revenue and does not even read it (D1)", async () => {
    const { text, dashboardRevenue } = await render("staff");
    expect(text).not.toMatch(/ciro/i);
    expect(dashboardRevenue).not.toHaveBeenCalled();
    expect(text).toContain("Açık sipariş");
  });

  it("shows owner today's net revenue and the 14 days behind it", async () => {
    const { text, dashboardRevenue } = await render("owner");
    expect(dashboardRevenue).toHaveBeenCalledTimes(1);
    expect(text).toContain("Bugün net ciro ₺125,00");
    expect(text).toMatch(/Geçen \S+ bu saate kadar ₺100,00/);
    // The chart card's headline: the 14 days' net revenue.
    expect(text).toContain("₺625,00 Net ciro · 3 sipariş");
  });

  it("lays the figures in one strip: five abreast from xl, pairs on a phone (SHE-06)", async () => {
    const owner = await render("owner");
    expect(owner.html).toMatch(
      /<ul aria-label="Bugünün özeti" class="grid gap-px [^"]*grid-cols-2 md:grid-cols-6 xl:grid-cols-5"/,
    );
    const staff = await render("staff");
    expect(staff.html).toMatch(
      /<ul aria-label="Bugünün özeti" class="grid gap-px [^"]*grid-cols-2 md:grid-cols-3"/,
    );
    // "Yeni" in the header, not a row of chips under the figures.
    expect(owner.html).not.toContain("Hızlı ekle");
    expect(owner.html).toContain(">Yeni</span>");
    expect(staff.html).toContain('href="/admin/siparisler/yeni"');
  });

  it("greets without a name and dates by Tuzla time", async () => {
    // The server's clock, as on Vercel, whatever this machine's zone is.
    const tz = process.env.TZ;
    process.env.TZ = "UTC";
    try {
      vi.useFakeTimers({ toFake: ["Date"] });
      vi.setSystemTime(new Date("2026-10-17T21:30:00.000Z"));
      const { html } = await render("manager");
      // The h1 is the nav's word; the greeting and the date open the
      // one-line description (UI-20).
      expect(html).toContain(">Genel bakış</h1>");
      expect(html).toContain("İyi geceler. 18 Ekim Pazar:");
      expect(html).not.toContain("L&#x27;Affogato · 18 Ekim Pazar");
      expect(html).not.toContain("info.");
    } finally {
      if (tz === undefined) delete process.env.TZ;
      else process.env.TZ = tz;
    }
  });

  it("lays the recent orders on the kit table, net of refunds", async () => {
    const { html } = await render("staff");
    expect(html).toContain('href="/admin/siparisler/ord-1"');
    expect(html).toContain('<caption class="sr-only">Son siparişler</caption>');
    expect(html).toContain("₺200,00");
    expect(html).toContain("₺50,00 iade");
    // The payment badge reads the payment rows, as the order list does.
    const cancelled = html.slice(html.indexOf("#10041"));
    expect(cancelled).toContain("Ödendi");
    expect(cancelled).not.toContain("Ödeme yok");
    // No faux italic serif left on the page (SHE-17).
    expect(html).not.toContain("Playfair");
    expect(html).not.toContain("italic");
  });

  it("stands when the mail check throws, and links a bad one to the E-posta tab", async () => {
    const down = await render("owner", { mailThrows: true });
    expect(down.text).toContain("Açık sipariş");
    expect(down.text).not.toContain("E-posta gönderilemiyor");
    const bad = await render("owner", { mailBad: true });
    expect(bad.text).toContain("E-posta gönderilemiyor.");
    expect(bad.html).toContain('href="/admin/ayarlar?sekme=email"');
  });

  it("draws no 2FA notice and never reads the account's 2FA (operator, 21 Oct 2026)", async () => {
    // The 2FA state lives in the account menu's Güvenlik / 2FA page and on
    // Kullanıcılar; the landing page no longer nags an account without it.
    const { html, text } = await render("owner");
    expect(seen.filter((s) => /"admin_2fa"/.test(s.text))).toEqual([]);
    expect(text).not.toContain("İki adımlı doğrulama");
    expect(html).not.toContain("/admin/2fa-kurulum");
  });

  it("reads the karaoke card from the Dikkat tab's set (KAR-07)", async () => {
    const { loadKaraokeTodayCard, text } = await render("staff");
    expect(loadKaraokeTodayCard).toHaveBeenCalledWith(
      expect.objectContaining({ prepay: true, canRefund: false }),
    );
    expect(text).toContain("Bugün karaoke");
  });

  it("warns owner and manager when İYS's refusal check is stale while campaigns wait, and never reads İYS for staff", async () => {
    // The stub answers every count with 2 (queued and scheduled campaigns)
    // and every other read with nothing: no İYS check was ever recorded.
    const iysReads = () =>
      seen.filter((s) => /"iys_(events|state|recipients)"/.test(s.text));
    for (const role of ["owner", "manager"] as const) {
      seen.length = 0;
      const { html, text } = await render(role);
      expect(iysReads().length).toBeGreaterThan(0);
      expect(text).toContain("Bekleyen kampanya gönderilemiyor:");
      expect(html).toContain('href="/admin/iys"');
    }
    seen.length = 0;
    const staff = await render("staff");
    expect(iysReads()).toEqual([]);
    expect(staff.text).not.toContain("İYS");
  });

  it("says how many İYS records are past their three business days", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-22T10:00:00.000Z"));
    const due = exec;
    const rows = [
      { dueAt: "2026-10-20T10:00:00.000Z" },
      { dueAt: "2026-10-22T09:00:00.000Z" },
      { dueAt: "2026-10-22T20:00:00.000Z" },
    ];
    const withEvents: Executor = async (q) =>
      /FROM "iys_events"/.test(q.text) && !/count\(\*\)/i.test(q.text)
        ? { rows, rowCount: rows.length }
        : due(q);
    current = withEvents;
    try {
      const { text } = await render("owner");
      expect(text).toContain("İYS: 2 kaydın 3 iş günlük süresi geçti.");
      expect(text).toContain("1 kaydın süresi de 1 iş günü içinde doluyor.");
    } finally {
      current = exec;
    }
  });

  describe("the Supabase keep-alive line (owner only, warnings only)", () => {
    // The routine line moved to Ayarlar → Sistem durumu (operator, 21 Oct
    // 2026); the dashboard draws it only when the ping stopped getting
    // through (tests/admin-system-status.test.ts has the settings rows).
    const keepaliveReads = () =>
      seen.filter((s) => /"supabase_keepalive"/.test(s.text));
    /** The line's own class attribute (other cards use the tones too). */
    const lineClass = (html: string) =>
      /<p data-testid="supabase-keepalive-status"[^>]*class="([^"]*)"/.exec(
        html,
      )?.[1] ?? "";

    it("reads the record for the owner and draws nothing while the ping gets through", async () => {
      vi.useFakeTimers({ toFake: ["Date"] });
      vi.setSystemTime(new Date("2026-10-20T10:00:00.000Z"));
      keepaliveRows = [
        {
          lastStatus: "ok",
          lastAttemptAt: "2026-10-20T06:00:01.234Z",
          lastSuccessAt: "2026-10-20T06:00:01.234Z",
        },
      ];
      const { html, text } = await render("owner");
      expect(keepaliveReads()).toHaveLength(1);
      expect(text).not.toContain("Supabase");
      expect(html).not.toContain("supabase-keepalive-status");
    });

    it("never reads it for a manager or staff, and shows them nothing", async () => {
      keepaliveRows = [
        {
          lastStatus: "failed",
          lastAttemptAt: "2026-10-20T06:00:01.234Z",
          lastSuccessAt: "",
        },
      ];
      for (const role of ["manager", "staff"] as const) {
        seen.length = 0;
        const { html, text } = await render(role);
        expect(keepaliveReads()).toEqual([]);
        expect(seen.filter((s) => /"_migrations"/.test(s.text))).toEqual([]);
        expect(text).not.toContain("Supabase");
        expect(html).not.toContain("supabase-keepalive-status");
      }
    });

    it("turns amber when nothing was recorded days after the table was created", async () => {
      vi.useFakeTimers({ toFake: ["Date"] });
      vi.setSystemTime(new Date("2026-10-25T10:00:00.000Z"));
      migrationRows = [{ applied_at: new Date("2026-10-21T05:30:00.000Z") }];
      const { html, text } = await render("owner");
      expect(html).toContain('data-state="silent"');
      expect(lineClass(html)).toContain("bg-[var(--admin-warning-soft)]");
      expect(text).toContain("günlük görev çalışmıyor olabilir");
      expect(text).toContain("7 gün sessiz kalırsa duraklar");
    });

    it("says nothing before the first record is due", async () => {
      const { html, text } = await render("owner");
      expect(keepaliveReads()).toHaveLength(1);
      expect(text).not.toContain("Supabase uyanık tutma");
      expect(html).not.toContain("supabase-keepalive-status");
    });

    it("is amber after a failed attempt", async () => {
      vi.useFakeTimers({ toFake: ["Date"] });
      vi.setSystemTime(new Date("2026-10-20T10:00:00.000Z"));
      keepaliveRows = [
        {
          lastStatus: "failed",
          lastAttemptAt: "2026-10-20T06:00:01.234Z",
          lastSuccessAt: "2026-10-19T06:00:00.000Z",
        },
      ];
      const { html, text } = await render("owner");
      expect(html).toContain('data-state="failed"');
      expect(lineClass(html)).toContain("bg-[var(--admin-warning-soft)]");
      expect(text).toContain("son deneme başarısız");
    });
  });
});
