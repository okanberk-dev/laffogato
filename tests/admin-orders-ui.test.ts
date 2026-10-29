import { readFileSync } from "node:fs";

import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import type { AdminOrder } from "@/lib/admin/store";

/**
 * The order list and its pieces as markup (admin audit, package 2b
 * orders-ui): the columns that make the table fit its card, the channel
 * pills on the kit's tones, the sound toggle's fixed name, the phone card's
 * visible link, the empty state's way out and the bulk bar's phone menu.
 */

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    prefetch: _p,
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
  redirect: vi.fn(),
}));

const { OrdersList } = await import("@/components/admin/orders-list");
const { SoundToggle, SOUND_TOGGLE_LABEL } =
  await import("@/components/admin/sound-toggle");
const { OrderChannelBadges } = await import("@/components/admin/order-badges");
const { BulkOrderButtons } =
  await import("@/components/admin/order-actions-ui");
const { orderActions } = await import("@/lib/admin/order-actions");
const { markShippedLabel } = await import("@/lib/admin/order-channel");

const read = (path: string) => readFileSync(path, "utf8");

function order(over: Partial<AdminOrder> = {}): AdminOrder {
  return {
    id: "ord-1",
    orderNo: 10023,
    customerName: "Eda Yılmaz",
    customerEmail: "eda@example.com",
    customerPhone: "",
    shippingAddress: "",
    internalNote: "",
    status: "paid",
    items: [
      {
        productName: "Latte",
        qty: 2,
        unitPriceMinor: 15_000,
        status: "pending",
      },
    ],
    subtotalMinor: 30_000,
    discountMinor: 0,
    promoCode: "",
    shippingMinor: 0,
    totalMinor: 30_000,
    refunds: [],
    createdAt: "2026-10-17T08:00:00.000Z",
    paidAt: "2026-10-17T08:01:00.000Z",
    channel: "app",
    kind: "cafe",
    fulfillment: "table",
    tableCode: "K7P42M9XQA",
    tableName: "Bahçe 5",
    legalConsent: {},
    ...over,
  } as AdminOrder;
}

function row(o: AdminOrder) {
  return {
    order: o,
    money: {
      collected: true,
      collectedMinor: o.totalMinor,
      destination: "card" as const,
    },
    actions: orderActions(o, "owner", true, o.totalMinor),
    payment: { label: "Ödendi", tone: "success" as const },
    refundToken: "tok",
  };
}

function list(props: Partial<Parameters<typeof OrdersList>[0]> = {}): string {
  return renderToStaticMarkup(
    createElement(OrdersList, {
      rows: [row(order())],
      live: "all",
      sort: { key: "no", dir: "desc" },
      searchParams: {},
      pathname: "/admin/siparisler",
      emptyTitle: "Henüz sipariş yok.",
      ...props,
    }),
  );
}

/** The opening tag of the first element whose text is `text`. */
function tagBefore(html: string, text: string): string {
  const at = html.indexOf(`>${text}<`);
  expect(at, text).toBeGreaterThan(-1);
  return html.slice(html.lastIndexOf("<", at), at + 1);
}

describe("the order table fits its card (ORD-02 columns)", () => {
  it("shows Kanal only from 2xl and puts the pills under the customer below that", () => {
    const html = list();
    const kanal = tagBefore(html, "Kanal");
    expect(kanal).toMatch(/^<th/);
    expect(kanal).toContain("hidden 2xl:table-cell");
    // The customer cell is 12rem and carries the pills until 2xl.
    expect(html).toContain("max-w-[12rem]");
    expect(html).not.toContain("max-w-[16rem]");
    expect(html).toMatch(/2xl:hidden[^>]*>.*Masa · Bahçe 5/);
    // The Kanal cell is capped, so a long table name cannot widen the column.
    expect(html).toContain("flex max-w-[14rem] flex-col items-start gap-1");
  });

  it("tightens the cells below xl, where 768 and 1024 leave the table 718 px", () => {
    const html = list();
    for (const header of ["Müşteri", "Durum"]) {
      const at = html.indexOf(`>${header}<`);
      const th = html.slice(
        html.lastIndexOf("<th", at),
        html.indexOf(">", html.lastIndexOf("<th", at)) + 1,
      );
      expect(th, header).toContain("max-xl:px-3");
    }
  });

  it("lets the No cell wrap: its marks and the date go under the number", () => {
    const html = list({
      rows: [
        row(order({ attention: "refund_unknown" as AdminOrder["attention"] })),
      ],
    });
    const table = html.slice(html.indexOf("<table"));
    const at = table.indexOf("#10023");
    expect(at).toBeGreaterThan(-1);
    const td = table.slice(
      table.lastIndexOf("<td", at),
      table.indexOf(">", table.lastIndexOf("<td", at)) + 1,
    );
    expect(td).not.toContain("whitespace-nowrap");
    // The number itself stays on one line; the marks wrap after it.
    expect(table).toContain(
      "inline-flex flex-wrap items-center gap-x-2 gap-y-1",
    );
    expect(table).toContain('<span class="whitespace-nowrap">#10023</span>');
  });
});

describe("channel pills on the kit's tones (ORD-22)", () => {
  it("draws Badges that never wrap, in the --admin tones", () => {
    const html = renderToStaticMarkup(
      createElement(OrderChannelBadges, { order: order() }),
    );
    expect(html.match(/whitespace-nowrap/g)).toHaveLength(2);
    expect(html).toContain("var(--admin-success-soft)");
    expect(html).toContain("var(--admin-accent-soft)");
    expect(html).not.toMatch(/(emerald|indigo|amber|sky|rose|neutral)-\d/);
    // A long table name is cut and named in full by the title.
    expect(html).toContain('title="Bahçe 5"');
    expect(html).toContain("truncate");
  });
});

describe("the sound toggle (ORD-27)", () => {
  it("keeps one name and tells its state only by aria-pressed", () => {
    const button = renderToStaticMarkup(createElement(SoundToggle));
    expect(SOUND_TOGGLE_LABEL).toBe("Yeni sipariş sesi");
    // The name is the text alone: a dot drawn beside it is aria-hidden.
    expect(button).toMatch(
      /<span aria-hidden="true"[^>]*><\/span>Yeni sipariş sesi<\/button>$/,
    );
    // Rendered before the browser's stored answer is read: the panel's
    // default (sound-pref.ts, on unless switched off).
    expect(button).toContain('aria-pressed="true"');
    expect(button).not.toMatch(/Ses (kapalı|açık)/);
    // A 44 px target, not a 26 px chip.
    expect(button).toContain("min-h-11");
  });

  it("reads the one stored preference the new-order alert reads", () => {
    const pref = read("src/components/admin/sound-pref.ts");
    expect(pref).toContain(
      'export const SOUND_KEY = "laffogato.admin.orders.sound";',
    );
    expect(pref).toContain("export function readSoundPref(): boolean");
    const src = read("src/components/admin/sound-toggle.tsx");
    expect(src).toContain('from "./sound-pref"');
    expect(src).not.toContain("localStorage");
  });

  it("sits in the filter bar's row, and only on a list that polls", () => {
    // Its own row above the table made four rows of controls before the
    // first order on a phone (21 Oct 2026); it shares Görünümler's now.
    const page = read("src/app/admin/siparisler/page.tsx");
    expect(page).toContain("toolbar={parsed.live ? <SoundToggle /> : null}");
    for (const live of ["all", "open", null] as const) {
      expect(list({ live })).not.toContain(SOUND_TOGGLE_LABEL);
    }
  });
});

describe("the new-order banner below lg (ORD-10)", () => {
  it("sticks under the phone top bar, not behind it", () => {
    const src = read("src/components/admin/orders-list.tsx");
    expect(src).toMatch(/sticky top-\[4\.25rem\][^"]*lg:top-2/);
    expect(src).not.toMatch(/"sticky top-2 /);
  });
});

describe("the phone card and the empty list (ORD-25)", () => {
  it("underlines the order number at rest: touch has no hover", () => {
    const html = list();
    const card = html.slice(html.indexOf("<ul"), html.indexOf("</ul>"));
    const link =
      card.match(/<a href="\/admin\/siparisler\/ord-1"[^>]*>/)?.[0] ?? "";
    expect(link).toMatch(/class="[^"]*(^|\s)underline(\s|")/);
    expect(link).toContain("min-h-11");
  });

  it("offers the way out the page decided", () => {
    const html = list({
      rows: [],
      emptyTitle: "Bu süzgece uyan sipariş yok.",
      emptyAction: {
        href: "/admin/siparisler?durum=acik",
        label: "Filtreleri temizle",
      },
    });
    expect(html).toContain("Bu süzgece uyan sipariş yok.");
    expect(html).toMatch(
      /<a href="\/admin\/siparisler\?durum=acik"[^>]*>Filtreleri temizle<\/a>/,
    );
  });

  it("shows no button when there is nothing to offer", () => {
    expect(list({ rows: [], emptyAction: null })).not.toContain("<a ");
  });
});

describe("the bulk bar on a phone (ORD-06)", () => {
  const html = renderToStaticMarkup(
    createElement(BulkOrderButtons, {
      ids: ["a", "b", "c"],
      onSuccess: () => {},
    }),
  );

  it("folds the four buttons into one menu below sm", () => {
    const menu = html.slice(html.indexOf('<div class="sm:hidden">'));
    expect(menu).toContain("<details");
    expect(menu).toMatch(/<summary[^>]*><span>Toplu işlem<\/span>/);
    for (const label of [
      "Hazırlamaya başla",
      "Hazır / yolda",
      "Tamamlandı",
      "İptal et",
    ]) {
      expect(menu, label).toContain(`>${label}</button>`);
    }
    // From sm the bar keeps its four buttons.
    expect(html).toContain('<div class="hidden sm:contents">');
  });

  it("names the shipped step for every kind of order (ORD-26)", () => {
    expect(html).not.toContain("Kargoda / Hazır");
    expect(html).toContain("Hazır / yolda");
  });

  it("has no backdrop filter, so the menu's fixed panel is placed on the screen", () => {
    // A backdrop filter makes the bar the containing block of fixed
    // descendants: measured, the menu opened 750 px below a 844 px screen.
    const bar = read("src/components/admin/bulk.tsx");
    const tag = bar.slice(
      bar.indexOf('data-admin-bulk-bar=""'),
      bar.indexOf("{children}"),
    );
    expect(tag).not.toContain("backdrop-blur");
    expect(tag).not.toContain("backdrop-filter");
  });

  it("hides the bar's sentence on a phone, so the bar is one row", () => {
    expect(read("src/components/admin/orders-list.tsx")).toContain(
      '<span className="hidden sm:inline">Seçili siparişlere uygula:</span>',
    );
  });
});

describe("orders copy (ORD-26, ORD-22)", () => {
  it("a pickup order's ready step says it once", () => {
    expect(markShippedLabel("pickup")).toBe("Teslime hazır");
  });

  it("the till's note is optional in the panel's words", () => {
    const till = read("src/app/admin/kasa/till-console.tsx");
    expect(till).toContain('label="Not (isteğe bağlı)"');
    expect(till).not.toContain("opsiyonel");
    // The receipt is on the panel's success tone, not raw emerald.
    expect(till).not.toMatch(/emerald-\d/);
  });

  it("the order screens draw no eyebrow that repeats the nav group", () => {
    for (const path of [
      "src/app/admin/siparisler/page.tsx",
      "src/app/admin/siparisler/yeni/page.tsx",
    ]) {
      const src = read(path);
      expect(src, path).not.toMatch(/\beyebrow=/);
      expect(src, path).not.toContain("E-ticaret");
    }
  });

  it("the new-order page's way back is a text link, and no raw grey is left", () => {
    // The kit's BackLink above the header, as on every sub-page (21 Eki
    // 2026): a quiet text link, not a second button beside the form's.
    const src = read("src/app/admin/siparisler/yeni/page.tsx");
    expect(src).toContain(
      '<BackLink href="/admin/siparisler">Tüm siparişler</BackLink>',
    );
    expect(src).not.toMatch(/neutral-\d/);
  });
});
