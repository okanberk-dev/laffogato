import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import type { AdminOrder } from "@/lib/admin/store";

/**
 * Innex's KPI strip (22 Eki 2026): the panel's figures in one card, each
 * read against a reference. What is pinned: the cells never leave a hole
 * however they wrap, a change pill says its direction in words, the
 * selected cell of a set of card tabs says so, and today's money is read
 * against the same weekday a week ago up to the same clock time.
 */

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

const { KpiStrip, kpiSpan } =
  await import("@/components/admin/dashboard/kpi-strip");
const { revenuePaceAt } = await import("@/lib/admin/store");

describe("the strip's cells", () => {
  it("five cells: three over two from md (six columns), one row from xl, the odd one whole on a phone", () => {
    expect([0, 1, 2, 3, 4].map((i) => kpiSpan(i, 5))).toEqual([
      "md:col-span-2 xl:col-span-1",
      "md:col-span-2 xl:col-span-1",
      "md:col-span-2 xl:col-span-1",
      "md:col-span-3 xl:col-span-1",
      "col-span-2 md:col-span-3 xl:col-span-1",
    ]);
    expect([0, 1, 2].map((i) => kpiSpan(i, 3))).toEqual([
      "md:col-span-1",
      "md:col-span-1",
      "col-span-2 md:col-span-1",
    ]);
    expect(kpiSpan(0, 4)).toBe("");
  });

  it("draws the hairlines as the card's grey through a 1 px gap", () => {
    const html = renderToStaticMarkup(
      createElement(KpiStrip, {
        label: "Özet",
        cells: [{ key: "a", label: "Açık sipariş", value: "3" }],
      }),
    );
    expect(html).toMatch(
      /^<ul aria-label="Özet" class="grid gap-px overflow-hidden rounded-xl border border-\[var\(--admin-border\)\] bg-\[var\(--admin-border\)\]/,
    );
    expect(
      renderToStaticMarkup(
        createElement(KpiStrip, { label: "Boş", cells: [] }),
      ),
    ).toBe("");
  });

  it("says a change in words beside its arrow, green for good news and red for bad", () => {
    const html = renderToStaticMarkup(
      createElement(KpiStrip, {
        label: "Özet",
        cells: [
          {
            key: "net",
            label: "Net ciro",
            value: "₺1.000,00",
            reference: "Geçen cuma bu saate kadar ₺800,00",
            delta: {
              label: "%25",
              direction: "up",
              good: true,
              spoken: "artış",
            },
            money: true,
          },
          {
            key: "refund",
            label: "İade",
            value: "₺200,00",
            delta: {
              label: "%100",
              direction: "up",
              good: false,
              spoken: "artış",
            },
          },
        ],
      }),
    );
    expect(html).toContain('<span class="sr-only"> artış</span>');
    expect(html).toContain("bg-[var(--admin-success-soft)]");
    expect(html).toContain("bg-[var(--admin-danger-soft)]");
    expect(html).toContain("Geçen cuma bu saate kadar ₺800,00");
    // A money figure shrinks with its cell and wraps last; a count cuts.
    expect(html).toContain("text-[clamp(1.125rem,12cqi,1.5rem)]");
  });

  it("marks the selected cell of a set of card tabs, a link like the others", () => {
    const html = renderToStaticMarkup(
      createElement(KpiStrip, {
        label: "Özet",
        cells: [
          {
            key: "a",
            label: "Net ciro",
            value: "1",
            href: "?m=a",
            current: true,
          },
          { key: "b", label: "Sipariş", value: "2", href: "?m=b" },
        ],
      }),
    );
    expect(html).toMatch(
      /<a href="\?m=a" aria-current="true" class="[^"]*bg-\[var\(--admin-primary-soft\)\]/,
    );
    expect(html).not.toMatch(/<a href="\?m=b" aria-current/);
  });
});

describe("today against the same weekday last week (dashboardRevenue)", () => {
  // Friday 23 Oct 2026, 15:00 in Tuzla (12:00Z); last Friday is the 16th.
  const now = new Date("2026-10-23T12:00:00.000Z");
  const order = (createdAt: string, over: Partial<AdminOrder> = {}) =>
    ({
      status: "completed",
      createdAt,
      totalMinor: 10_000,
      refunds: [],
      ...over,
    }) as Pick<AdminOrder, "status" | "createdAt" | "totalMinor" | "refunds">;

  it("counts last Friday from its midnight in Tuzla up to this clock time", () => {
    const pace = revenuePaceAt(
      [
        // 00:30 on the 16th in Tuzla (21:30Z on the 15th): in.
        order("2026-10-15T21:30:00.000Z"),
        // 14:59 on the 16th: in, net of its refund.
        order("2026-10-16T11:59:00.000Z", {
          refunds: [{ amountMinor: 4_000 }] as AdminOrder["refunds"],
        }),
        // 15:01 on the 16th: after this hour, out.
        order("2026-10-16T12:01:00.000Z"),
        // Cancelled and unpaid ones are not sales.
        order("2026-10-16T08:00:00.000Z", { status: "cancelled" }),
        order("2026-10-16T08:00:00.000Z", { status: "pending_payment" }),
        // Today's: not last week's.
        order("2026-10-23T08:00:00.000Z"),
      ],
      now,
      7,
    );
    expect(pace).toEqual({ revenueMinor: 16_000, orderCount: 2 });
  });

  it("reads today itself with daysAgo 0", () => {
    expect(revenuePaceAt([order("2026-10-23T08:00:00.000Z")], now, 0)).toEqual({
      revenueMinor: 10_000,
      orderCount: 1,
    });
  });
});
