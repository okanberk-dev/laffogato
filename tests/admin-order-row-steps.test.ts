import { readFileSync } from "node:fs";

import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import type { AdminRole } from "@/lib/admin/roles";
import type { AdminOrder } from "@/lib/admin/store";

/**
 * The inline order step on the list (admin UI design 5 #4, UI-10): each
 * table row and phone card shows ONE button, the first enabled forward move
 * of start_preparing, mark_shipped and complete that the server's
 * `orderActions` decided for the role, through `transitionOrderAction`.
 * Money and modal actions never leave the "⋯" menu.
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

const { OrdersList, ROW_STEP_IDS, rowStep } =
  await import("@/components/admin/orders-list");
const { orderActions, orderActionLabel } =
  await import("@/lib/admin/order-actions");

type Status = AdminOrder["status"];
type Fulfillment = "pickup" | "delivery" | "table" | "shipping";

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
        productId: "prd-0001",
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
    fulfillment: "pickup",
    legalConsent: {},
    ...over,
  } as AdminOrder;
}

function row(o: AdminOrder, role: AdminRole = "owner", collected = true) {
  return {
    order: o,
    money: {
      collected,
      collectedMinor: collected ? o.totalMinor : null,
      destination: "card" as const,
    },
    actions: orderActions(o, role, collected, collected ? o.totalMinor : null),
    payment: { label: "Ödendi", tone: "success" as const },
    refundToken: "tok",
  };
}

function list(rows: ReturnType<typeof row>[]): string {
  return renderToStaticMarkup(
    createElement(OrdersList, {
      rows,
      mayRefund: true,
      live: "all",
      sort: { key: "no", dir: "desc" },
      searchParams: {},
      pathname: "/admin/siparisler",
      emptyTitle: "Henüz sipariş yok.",
    }),
  );
}

/** The phone cards (the first list) and the table, apart. */
function views(html: string): { cards: string; table: string } {
  const cards = html.slice(html.indexOf("<ul"), html.indexOf("</ul>"));
  const table = html.slice(html.indexOf("<table"), html.indexOf("</table>"));
  return { cards, table };
}

/** The markup with every "⋯" menu (a <details>) taken out. */
function outsideMenus(html: string): string {
  let out = html;
  for (;;) {
    const open = out.lastIndexOf("<details");
    if (open < 0) return out;
    const close = out.indexOf("</details>", open);
    out = out.slice(0, open) + out.slice(close + "</details>".length);
  }
}

/** Every inline step button: its name and the transition it posts. */
function inlineSteps(
  html: string,
): Array<{ name: string; transition: string }> {
  const forms = outsideMenus(html).match(/<form[^>]*>.*?<\/form>/g) ?? [];
  return forms
    .filter((f) => f.includes('name="transition"'))
    .map((f) => ({
      name: f.match(/aria-label="([^"]*)"/)?.[1] ?? "",
      transition: f.match(/name="transition" value="([^"]*)"/)?.[1] ?? "",
    }));
}

const MATRIX: Array<[Status, Fulfillment, string | null]> = [
  ["pending_payment", "pickup", null],
  ["paid", "pickup", "start_preparing"],
  ["paid", "shipping", "start_preparing"],
  ["preparing", "pickup", "mark_shipped"],
  ["preparing", "delivery", "mark_shipped"],
  ["preparing", "table", "mark_shipped"],
  // A parcel leaves through "Kargoya ver" (carrier and tracking number),
  // a modal: nothing inline until it is on its way.
  ["preparing", "shipping", null],
  ["shipped", "shipping", "complete"],
  ["shipped", "pickup", "complete"],
  ["completed", "pickup", null],
  ["cancelled", "pickup", null],
  ["refunded", "pickup", null],
];

describe("rowStep: the first enabled forward move", () => {
  it("offers only the three money-free moves, in the order an order goes", () => {
    expect([...ROW_STEP_IDS]).toEqual([
      "start_preparing",
      "mark_shipped",
      "complete",
    ]);
  });

  it.each(MATRIX)("%s %s -> %s", (status, fulfillment, expected) => {
    const o = order({ status, fulfillment } as Partial<AdminOrder>);
    for (const role of ["owner", "manager", "staff"] as const) {
      expect(
        rowStep(orderActions(o, role, status !== "pending_payment")),
        role,
      ).toBe(expected);
    }
  });

  it("skips a move the role may not take", () => {
    expect(
      rowStep({
        start_preparing: { enabled: false, reason: "Yetkin yok." },
        mark_shipped: { enabled: true },
      }),
    ).toBe("mark_shipped");
    expect(
      rowStep({ complete: { enabled: false, reason: "Yetkin yok." } }),
    ).toBeNull();
  });

  it("never picks a money or modal action, even when it is the only one on", () => {
    expect(
      rowStep({
        mark_paid: { enabled: true },
        check_pos: { enabled: true },
        ship: { enabled: true },
        cancel: { enabled: true },
        refund: { enabled: true },
        release_stock: { enabled: true },
        clear_attention: { enabled: true },
        edit_tracking: { enabled: true },
        item_status: { enabled: true },
        resend_mail: { enabled: true },
      }),
    ).toBeNull();
  });
});

describe("the step on the row and the phone card", () => {
  it.each(["owner", "manager", "staff"] as const)(
    "%s sees one step per view, posted through transitionOrderAction",
    (role) => {
      const html = list([row(order({ status: "paid" }), role)]);
      const { cards, table } = views(html);
      for (const [view, markup] of [
        ["card", cards],
        ["table", table],
      ] as const) {
        expect(inlineSteps(markup), `${role} ${view}`).toEqual([
          {
            name: "Hazırlamaya başla: sipariş 10023",
            transition: "start_preparing",
          },
        ]);
        expect(markup).toContain('name="id" value="ord-1"');
      }
    },
  );

  it("names each step in the order's own words", () => {
    const html = list([
      row(
        order({
          id: "a",
          orderNo: 1,
          status: "preparing",
          fulfillment: "pickup",
        }),
      ),
      row(
        order({
          id: "b",
          orderNo: 2,
          status: "preparing",
          fulfillment: "delivery",
        }),
      ),
      row(
        order({
          id: "c",
          orderNo: 3,
          status: "preparing",
          fulfillment: "table",
        }),
      ),
      row(
        order({
          id: "d",
          orderNo: 4,
          status: "shipped",
          fulfillment: "shipping",
        }),
      ),
    ]);
    expect(inlineSteps(views(html).table).map((s) => s.name)).toEqual([
      "Teslime hazır: sipariş 1",
      "Kuryeye ver: sipariş 2",
      "Masaya götürüldü: sipariş 3",
      "Tamamlandı: sipariş 4",
    ]);
  });

  it("a role without the orders section gets no step (and no move at all)", () => {
    const o = order({ status: "paid" });
    const cashier = row(o, "cashier");
    expect(cashier.actions).toEqual({});
    expect(inlineSteps(list([cashier]))).toEqual([]);
  });

  it("draws nothing inline for an order with no forward move", () => {
    for (const [status, fulfillment, expected] of MATRIX) {
      if (expected) continue;
      const html = list([
        row(
          order({ status, fulfillment } as Partial<AdminOrder>),
          "owner",
          status !== "pending_payment",
        ),
      ]);
      expect(inlineSteps(html), `${status} ${fulfillment}`).toEqual([]);
    }
  });

  it("keeps the 44 px target and the visible label", () => {
    const html = list([row(order({ status: "shipped" }))]);
    const form = outsideMenus(views(html).cards).match(
      /<form[^>]*>.*?<\/form>/,
    )?.[0];
    expect(form).toMatch(
      /<button type="submit"[^>]*min-h-\[44px\][^>]*>Tamamlandı<\/button>/,
    );
  });

  it("puts the table's step under the status, not in the pinned column", () => {
    const html = list([row(order({ status: "paid" }))]);
    const { cards, table } = views(html);
    // The Durum cell: status, payment, then the step. The pinned "⋯" cell
    // stays as narrow as it was: 160 px more there made the table wider
    // than its card from 768 to 1279 px and covered the status.
    const at = table.indexOf('name="transition"');
    const cell = table.slice(table.lastIndexOf("<td", at), at);
    expect(cell).toContain("max-xl:px-3");
    expect(cell).not.toContain("sticky");
    expect(cell).toContain(">Ödendi<");
    const pinned = table.slice(
      table.lastIndexOf("<td", table.indexOf("<details")),
      table.indexOf("<details"),
    );
    expect(pinned).toContain("sticky right-0");
    expect(pinned).not.toContain("<form");
    // The card's step is its last line, after the amount, and the card's
    // own "⋯" (DataTable's rowActions) holds no second copy.
    expect(inlineSteps(cards)).toHaveLength(1);
    expect(cards.indexOf('name="transition"')).toBeGreaterThan(
      cards.indexOf("₺300,00"),
    );
  });
});

describe("money and modal actions stay in the ⋯ menu", () => {
  const MENU_ONLY = [
    "mark_paid",
    "check_pos",
    "ship",
    "cancel",
    "refund",
    "release_stock",
    "clear_attention",
    "edit_tracking",
    "item_status",
    "resend_mail",
  ] as const;

  it("never renders one of them outside a menu, in any state, for any role", () => {
    for (const role of ["owner", "manager", "staff"] as const) {
      for (const [status, fulfillment] of MATRIX) {
        const o = order({
          status,
          fulfillment,
          attention: "refund_due",
          trackingNumber: fulfillment === "shipping" ? "TR123" : undefined,
        } as Partial<AdminOrder>);
        const r = row(o, role, status !== "pending_payment");
        const outside = outsideMenus(list([r]));
        for (const id of MENU_ONLY) {
          if (!r.actions[id]) continue;
          const label = orderActionLabel(id, o);
          expect(
            outside,
            `${role} ${status} ${fulfillment} ${id}`,
          ).not.toContain(`>${label}</button>`);
        }
        for (const step of inlineSteps(outside)) {
          expect(ROW_STEP_IDS).toContain(step.transition);
        }
      }
    }
  });

  it("the menu no longer repeats the step the row shows, and keeps the rest", () => {
    const html = list([row(order({ status: "paid", fulfillment: "pickup" }))]);
    const menu = html.slice(
      html.indexOf("<details"),
      html.indexOf("</details>"),
    );
    expect(menu).not.toContain(">Hazırlamaya başla<");
    expect(menu).toContain(">Teslime hazır<");
    expect(menu).toContain(">İptal et<");
  });

  it("a disabled move stays in the menu with its reason", () => {
    const o = order({ status: "paid" });
    const r = {
      ...row(o),
      actions: {
        ...row(o).actions,
        start_preparing: { enabled: false, reason: "Bu adım için yetkin yok." },
        mark_shipped: { enabled: false, reason: "Bu adım için yetkin yok." },
      },
    };
    const html = list([r]);
    expect(inlineSteps(html)).toEqual([]);
    const menu = html.slice(
      html.indexOf("<details"),
      html.indexOf("</details>"),
    );
    expect(menu).toMatch(
      /<button type="button" aria-disabled="true" aria-describedby="[^"]+"[^>]*>Hazırlamaya başla<\/button><span id="[^"]+"[^>]*>Bu adım için yetkin yok\.<\/span>/,
    );
  });
});

describe("the list keeps its live poll and sound", () => {
  it("still polls with newOrderCountAction and draws the sound toggle", () => {
    const src = readFileSync("src/components/admin/orders-list.tsx", "utf8");
    expect(src).toContain("const POLL_MS = 30_000;");
    expect(src).toContain("newOrderCountAction(latestOrderNo");
    expect(src).toContain("shouldListBeep(");
    expect(list([row(order())])).toContain("Yeni sipariş sesi");
  });

  it("a new step ignores taps for a moment, so a double tap runs one move", () => {
    const src = readFileSync("src/components/admin/orders-list.tsx", "utf8");
    expect(src).toMatch(/const STEP_ARM_MS = \d{3};/);
    expect(src).toContain("onClickCapture=");
    // Armed per step on the same button, so the next step ("Teslime
    // hazır" after "Hazırlamaya başla") waits again and focus stays put.
    expect(src).toContain("setTimeout(() => setArmedFor(id), STEP_ARM_MS)");
    expect(src).toContain("}, [id]);");
    expect(src).not.toContain("<RowStepButton key=");
  });

  it("does not re-implement a move: the step goes through the shared action", () => {
    const src = readFileSync("src/components/admin/orders-list.tsx", "utf8");
    expect(src).toContain("action={transitionOrderAction}");
    expect(src).toContain('from "./action-form"');
    expect(src).not.toMatch(
      /markPaidAction|refundOrderAction|cancelOrderAction|shipOrderAction|checkPosAction/,
    );
  });
});
