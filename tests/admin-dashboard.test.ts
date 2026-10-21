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

vi.mock("@/lib/db", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/db")>();
  const db = createDb(exec);
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
  const input = {
    openOrderCount: 3,
    attentionOrderCount: 0,
    outOfStockCount: 0,
    revenue: { todayMinor: 123_456_78, periodMinor: 999_999_99 },
  };

  it("never gives staff a revenue tile", () => {
    const tiles = core.dashboardTiles(input, "staff");
    expect(tiles.map((t) => t.key)).toEqual(["open", "attention", "soldOut"]);
    expect(JSON.stringify(tiles)).not.toContain("ciro");
  });

  it("gives owner and manager today's net revenue, linked to Raporlar", () => {
    for (const role of ["owner", "manager"] as const) {
      const revenue = core.dashboardTiles(input, role).at(-1)!;
      expect(revenue).toMatchObject({
        key: "revenue",
        label: "Bugün net ciro",
        value: "₺123.456,78",
        hint: "Son 14 gün ₺999.999,99",
        href: "/admin/raporlar",
        money: true,
      });
    }
  });

  it("links every tile to the list it counts", () => {
    const owner = core.dashboardTiles(input, "owner");
    expect(Object.fromEntries(owner.map((t) => [t.key, t.href]))).toEqual({
      open: "/admin/siparisler?durum=acik",
      attention: "/admin/siparisler?dikkat=1",
      soldOut: "/admin/urunler?status=out_of_stock",
      revenue: "/admin/raporlar",
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

  it("writes a hint only under a figure that asks for something", () => {
    const quiet = core.dashboardTiles(input, "owner");
    expect(quiet.find((t) => t.key === "soldOut")!.hint).toBeUndefined();
    expect(quiet.find((t) => t.key === "attention")!.tone).toBeUndefined();
    const busy = core.dashboardTiles(
      { ...input, attentionOrderCount: 2, outOfStockCount: 4 },
      "owner",
    );
    expect(busy.find((t) => t.key === "soldOut")).toMatchObject({
      hint: "Dolum gerekiyor",
      tone: "warning",
    });
    expect(busy.find((t) => t.key === "attention")!.tone).toBe("danger");
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
      { status: "paid" },
      { status: "paid" },
      { status: "pending_payment" },
      { status: "shipped" },
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
    const revenueBuckets = vi.fn(async () => [
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
    ]);
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
      revenueBuckets,
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
      revenueBuckets,
      loadKaraokeTodayCard,
    };
  }

  it("shows staff no revenue and does not even read it (D1)", async () => {
    const { text, revenueBuckets } = await render("staff");
    expect(text).not.toMatch(/ciro/i);
    expect(revenueBuckets).not.toHaveBeenCalled();
    expect(text).toContain("Açık sipariş");
  });

  it("shows owner today's net revenue and the 14 days behind it", async () => {
    const { text, revenueBuckets } = await render("owner");
    expect(revenueBuckets).toHaveBeenCalledWith("day", 14);
    expect(text).toContain("Bugün net ciro ₺125,00");
    expect(text).toContain("Son 14 gün ₺625,00");
  });

  it("lays four tiles two abreast until there is room for four (SHE-06)", async () => {
    // Five tiles in five columns beside the sidebar left each about 132 px.
    const owner = await render("owner");
    expect(owner.html).toContain(
      'class="grid gap-3 sm:gap-4 grid-cols-2 xl:grid-cols-4"',
    );
    expect(owner.html).not.toContain("lg:grid-cols-5");
    const staff = await render("staff");
    expect(staff.html).toContain(
      'class="grid gap-3 sm:gap-4 grid-cols-2 md:grid-cols-3"',
    );
  });

  it("greets without a name and dates by Tuzla time", async () => {
    // The server's clock, as on Vercel, whatever this machine's zone is.
    const tz = process.env.TZ;
    process.env.TZ = "UTC";
    try {
      vi.useFakeTimers({ toFake: ["Date"] });
      vi.setSystemTime(new Date("2026-10-17T21:30:00.000Z"));
      const { html } = await render("manager");
      expect(html).toContain("İyi geceler.</h1>");
      expect(html).toContain("L&#x27;Affogato · 18 Ekim Pazar");
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

  it("reads the karaoke card from the Dikkat tab's set (KAR-07)", async () => {
    const { loadKaraokeTodayCard, text } = await render("staff");
    expect(loadKaraokeTodayCard).toHaveBeenCalledWith(
      expect.objectContaining({ prepay: true, canRefund: false }),
    );
    expect(text).toContain("Bugün karaoke");
  });

  describe("the Supabase keep-alive line (owner only)", () => {
    const keepaliveReads = () =>
      seen.filter((s) => /"supabase_keepalive"/.test(s.text));
    /** The line's own class attribute (other cards use the tones too). */
    const lineClass = (html: string) =>
      /<p data-testid="supabase-keepalive-status"[^>]*class="([^"]*)"/.exec(
        html,
      )?.[1] ?? "";

    it("reads the record for the owner and names the last successful ping", async () => {
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
      expect(text).toContain(
        "Supabase uyanık tutma: son başarılı ping 20 Eki 2026 09:00.",
      );
      expect(html).toContain('data-state="fresh"');
      expect(lineClass(html)).toContain("bg-[var(--admin-neutral-soft)]");
      expect(lineClass(html)).not.toContain("bg-[var(--admin-warning-soft)]");
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
    });

    it("says plainly that nothing is recorded yet", async () => {
      const { html, text } = await render("owner");
      expect(keepaliveReads()).toHaveLength(1);
      expect(text).toContain("Supabase uyanık tutma: henüz kayıt yok");
      expect(html).toContain('data-state="none"');
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
