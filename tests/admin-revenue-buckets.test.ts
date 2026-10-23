import { describe, expect, it } from "vitest";

import { bucketRevenue, type AdminOrder } from "@/lib/admin/store";

function order(createdAt: string, totalMinor: number): AdminOrder {
  return {
    id: `ord-${createdAt}`,
    orderNo: 10001,
    customerName: "",
    customerEmail: "",
    customerPhone: "",
    shippingAddress: "",
    internalNote: "",
    status: "paid",
    items: [],
    subtotalMinor: totalMinor,
    discountMinor: 0,
    promoCode: "",
    shippingMinor: 0,
    totalMinor,
    refunds: [],
    createdAt,
  } as AdminOrder;
}

describe("revenue report buckets", () => {
  it("does not repeat the current month on the 31st", () => {
    // setMonth(8) on 31 October is "31 September" → 1 October: the report
    // used to show October twice and September not at all.
    const buckets = bucketRevenue(
      [],
      "month",
      3,
      new Date("2026-10-31T12:00:00Z"),
    );
    expect(buckets.map((b) => b.bucket)).toEqual([
      "2026-08",
      "2026-09",
      "2026-10",
    ]);
  });

  it("cuts days at Istanbul midnight, not UTC midnight", () => {
    // 01:30 in Tuzla on 23 Sept is 22:30 UTC on 22 Sept.
    const late = order("2026-09-22T22:30:00.000Z", 5000);
    const buckets = bucketRevenue(
      [late],
      "day",
      2,
      new Date("2026-09-23T09:00:00Z"),
    );
    expect(buckets.map((b) => b.bucket)).toEqual(["2026-09-22", "2026-09-23"]);
    expect(buckets[1]).toMatchObject({ revenueMinor: 5000, orderCount: 1 });
    expect(buckets[0]).toMatchObject({ revenueMinor: 0, orderCount: 0 });
  });

  it("names 'today' by the venue's date just after Istanbul midnight", () => {
    // 00:15 on 1 Oct in Tuzla is still 30 Sept in UTC.
    const buckets = bucketRevenue(
      [],
      "day",
      1,
      new Date("2026-09-30T21:15:00Z"),
    );
    expect(buckets[0].bucket).toBe("2026-10-01");
  });

  it("nets refunds against the order's own bucket", () => {
    const o = order("2026-09-10T10:00:00.000Z", 10000);
    o.refunds = [{ amountMinor: 2500 } as AdminOrder["refunds"][number]];
    const [b] = bucketRevenue(
      [o],
      "month",
      1,
      new Date("2026-09-23T09:00:00Z"),
    );
    expect(b).toMatchObject({
      bucket: "2026-09",
      revenueMinor: 7500,
      orderCount: 1,
    });
  });
});

describe("the revenue chart (admin audit SYS-14)", () => {
  const bucket = (i: number, revenueMinor: number) => ({
    bucket: `2026-10-${String(i + 1).padStart(2, "0")}`,
    label: `${String(i + 1).padStart(2, "0")} Eki`,
    revenueMinor,
    orderCount: revenueMinor > 0 ? 3 : 0,
  });

  async function html(data: ReturnType<typeof bucket>[]) {
    const { createElement } = await import("react");
    const { renderToStaticMarkup } = await import("react-dom/server");
    const { RevenueChart } = await import("@/components/admin/revenue-chart");
    return renderToStaticMarkup(
      createElement(RevenueChart, { data, caption: "Günlük net ciro" }),
    );
  }

  it("rounds the axis up to round liras", async () => {
    const { revenueAxis, axisLabel } =
      await import("@/components/admin/revenue-chart");
    // The audit's ₺38.775,00 peak: the axis tops at ₺40.000.
    const axis = revenueAxis(3_877_500);
    expect(axis.top).toBe(4_000_000);
    expect(axis.ticks.map(axisLabel)).toEqual([
      "₺40.000",
      "₺30.000",
      "₺20.000",
      "₺10.000",
      "₺0",
    ]);
    // A small day: whole liras still, never ₺0,01 steps.
    expect(revenueAxis(350).ticks.map(axisLabel)).toEqual([
      "₺4",
      "₺3",
      "₺2",
      "₺1",
      "₺0",
    ]);
    expect(revenueAxis(1_284_567_89).top).toBeGreaterThanOrEqual(1_284_567_89);
  });

  it("writes the amounts in HTML beside the plot, so the ₺ is never cut off", async () => {
    const markup = await html([bucket(0, 1_000_000), bucket(1, 3_877_500)]);
    const svg = markup.match(/<svg[\s\S]*?<\/svg>/)![0];
    // The old chart drew its labels as SVG text at a fixed inset of a
    // scaled 800-wide viewBox: 5 px tall on a phone, "₺" clipped.
    expect(svg).not.toContain("<text");
    expect(svg).not.toContain("₺");
    expect(markup).toContain("₺40.000");
    expect(markup).toContain('vector-effect="non-scaling-stroke"');
    // Labels in the panel's soft ink, not rgba(0,0,0,.5) (3.95:1).
    expect(markup).not.toContain("rgba(0,0,0,0.5)");
    expect(markup).toContain("text-[var(--admin-text-soft)]");
  });

  it("puts every bucket's figures in a table under the chart", async () => {
    const markup = await html([
      bucket(0, 0),
      bucket(1, 12_345),
      bucket(2, 500),
    ]);
    expect(markup).toContain(
      '<caption class="sr-only">Günlük net ciro</caption>',
    );
    const rows = [
      ...markup.matchAll(/<tr class="border-t[^"]*">([\s\S]*?)<\/tr>/g),
    ];
    expect(rows).toHaveLength(3);
    expect(rows[1][1]).toContain("02 Eki");
    expect(rows[1][1]).toContain("₺123,45");
    expect(markup).toMatch(
      /role="img" aria-label="Günlük net ciro: toplam ₺128,45, en yüksek 02 Eki \(₺123,45\)\."/,
    );
  });

  it("says there were no sales instead of drawing ₺0,01 ticks", async () => {
    const markup = await html([bucket(0, 0), bucket(1, 0)]);
    expect(markup).toContain("Bu dönemde satış yok.");
    // No chart: the only drawing is the empty state's glyph.
    expect(markup).not.toContain("<polyline");
    expect(markup).not.toContain('role="img"');
    expect(markup).not.toContain("₺0,01");
  });

  it("dates the first and the last bucket and none crowding the last", async () => {
    const { labelIndexes } = await import("@/components/admin/revenue-chart");
    expect([...labelIndexes(30, 4)].sort((a, b) => a - b)).toEqual([
      0, 8, 16, 29,
    ]);
    expect([...labelIndexes(14, 4)].sort((a, b) => a - b)).toEqual([
      0, 4, 8, 13,
    ]);
    expect([...labelIndexes(1, 4)]).toEqual([0]);
  });
});
