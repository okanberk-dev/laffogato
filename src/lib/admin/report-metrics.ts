// Client-safe and pure: Raporlar's card tabs (Innex's "answer on the tab",
// recipe §3.6; 23 Eki 2026). Each figure of the strip is a tab; the chart
// under it draws the chosen one per bucket (`?m=`), so the strip and the
// chart answer the same question.

import type { RevenueBucket } from "./store";

export type ReportMetric = "net" | "gross" | "refund" | "orders" | "basket";

/** `?m=` on Raporlar: the figure the chart draws. Net when absent. */
export const REPORT_METRIC_PARAM = "m";

export interface ReportMetricSpec {
  key: ReportMetric;
  /** The chart's heading after the period ("Günlük net ciro"). */
  chart: string;
  /** The table's column under the chart. */
  column: string;
  /** Kuruş (money, whole-lira axis) or a count. */
  unit: "money" | "count";
  /** The figure of one bucket. */
  of: (b: RevenueBucket) => number;
}

export const REPORT_METRICS: Readonly<Record<ReportMetric, ReportMetricSpec>> =
  {
    net: {
      key: "net",
      chart: "net ciro",
      column: "Net ciro",
      unit: "money",
      of: (b) => b.revenueMinor,
    },
    gross: {
      key: "gross",
      chart: "brüt ciro",
      column: "Brüt ciro",
      unit: "money",
      of: (b) => b.grossMinor,
    },
    refund: {
      key: "refund",
      chart: "iade",
      column: "İade",
      unit: "money",
      of: (b) => b.refundedMinor,
    },
    orders: {
      key: "orders",
      chart: "sipariş",
      column: "Sipariş",
      unit: "count",
      of: (b) => b.orderCount,
    },
    // Gross per order, as the strip's figure: a bucket with no order has no
    // basket (0, not a division by nothing). Prepaid karaoke is in the
    // bucket's gross but is not an order's: it is taken out first.
    basket: {
      key: "basket",
      chart: "ortalama sepet",
      column: "Ortalama sepet",
      unit: "money",
      of: (b) =>
        b.orderCount > 0
          ? Math.round(
              (b.grossMinor - (b.karaokeGrossMinor ?? 0)) / b.orderCount,
            )
          : 0,
    },
  };

const METRIC_KEYS = Object.keys(REPORT_METRICS) as ReportMetric[];

/** The figure `?m=` asks for; anything else is net revenue. */
export function parseReportMetric(
  value: string | string[] | undefined,
): ReportMetric {
  const raw = Array.isArray(value) ? value[0] : value;
  return METRIC_KEYS.find((k) => k === raw) ?? "net";
}

/**
 * Raporlar's address for a period and a figure: net is the page's own
 * (no `m`), so the period links of a net view stay as they were.
 */
export function reportsHref(granularity: string, metric: ReportMetric): string {
  const q = new URLSearchParams({ g: granularity });
  if (metric !== "net") q.set(REPORT_METRIC_PARAM, metric);
  return `/admin/raporlar?${q.toString()}`;
}
