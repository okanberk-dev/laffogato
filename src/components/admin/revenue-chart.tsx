import { REPORT_METRICS, type ReportMetric } from "@/lib/admin/report-metrics";
import type { RevenueBucket } from "@/lib/admin/store";

import { formatTRY } from "./forms";
import { EmptyState } from "./ui/detail";
import { EYEBROW, MONO_STYLE, NUMERIC_STYLE } from "./ui/styles";

export type RevenueChartBucket = RevenueBucket;

/** Gridlines above zero: the axis reads 0, ¼, ½, ¾ and the top. */
const AXIS_STEPS = 4;

/**
 * The value axis for a period whose best bucket is `maxMinor`: the step is
 * a round amount (1, 1.5, 2, 2.5, 3, 4, 5, 6 or 8 times a power of ten) in
 * whole liras, so every label reads "₺40.000", not "₺38.775,00", and the
 * line fills most of the plot.
 * The highest tick comes first. Exported for tests.
 */
export function revenueAxis(
  maxMinor: number,
  /** The smallest step: 100 kuruş (a whole lira), or 1 for a count. */
  unit = 100,
): {
  top: number;
  ticks: number[];
} {
  const raw = Math.max(unit, Math.ceil(maxMinor / AXIS_STEPS));
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const step =
    [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10]
      .map((m) => m * magnitude)
      .find((s) => s >= raw && s % unit === 0) ?? 10 * magnitude;
  const top = step * AXIS_STEPS;
  return {
    top,
    ticks: Array.from(
      { length: AXIS_STEPS + 1 },
      (_, i) => step * (AXIS_STEPS - i),
    ),
  };
}

const AXIS_FORMAT = new Intl.NumberFormat("tr-TR", {
  style: "currency",
  currency: "TRY",
  maximumFractionDigits: 0,
});

/** An axis label: whole liras, the ticks are round. */
export function axisLabel(minor: number): string {
  return AXIS_FORMAT.format(minor / 100);
}

/** A figure as the chart says it: money in kuruş, or a count. */
function figure(value: number, unit: "money" | "count"): string {
  return unit === "money" ? formatTRY(value) : value.toLocaleString("tr-TR");
}

/**
 * Which buckets get a date under the chart: about `most` of them, evenly
 * spaced, always the first and the last. The last stands right-aligned, so
 * a label less than a full step before it would run into it.
 */
export function labelIndexes(n: number, most: number): Set<number> {
  const every = Math.max(1, Math.ceil(n / most));
  const out = new Set<number>();
  for (let i = 0; i < n - 1; i += every) {
    if (n - 1 - i >= every || i === 0) out.add(i);
  }
  out.add(n - 1);
  return out;
}

/**
 * Net revenue per bucket as a line, server-rendered, no dependencies.
 *
 * The amounts are HTML, not SVG text (admin audit SYS-14): the chart used a
 * fixed 800 x 240 viewBox scaled to its card, so on a phone the labels were
 * 5 px tall, and the value labels sat at a fixed inset that cut the "₺" off
 * at every width. Now the axis column is as wide as its longest label and
 * the plot stretches beside it at a fixed height; the lines keep their
 * width (`non-scaling-stroke`). Labels are the panel's label grey (6.1:1 on
 * white), as Innex's axes. Every bucket's figures are in a table under the chart, for touch
 * and screen readers alike (the points' tooltips need a mouse). A period
 * with no sales says so instead of drawing ₺0,01 ticks.
 */
export function RevenueChart({
  data,
  caption,
  metric = "net",
}: {
  data: readonly RevenueChartBucket[];
  /** Names the chart and its table, e.g. "Son 14 günün net cirosu". */
  caption: string;
  /** The figure drawn per bucket (Raporlar's card tabs); net by default. */
  metric?: ReportMetric;
}) {
  const spec = REPORT_METRICS[metric];
  const values = data.map(spec.of);
  const max = Math.max(0, ...values);
  if (data.length === 0 || max === 0) {
    return (
      <EmptyState
        title={
          metric === "refund" ? "Bu dönemde iade yok." : "Bu dönemde satış yok."
        }
        description={
          metric === "refund"
            ? "İade edilen siparişler burada görünür."
            : "Ödemesi alınan siparişler geldikçe grafik dolar."
        }
      />
    );
  }

  const unit = spec.unit === "money" ? 100 : 1;
  const { top, ticks } = revenueAxis(max, unit);
  const n = data.length;
  const xAt = (i: number) => (n === 1 ? 50 : (i * 100) / (n - 1));
  const yAt = (v: number) => 100 - (v / top) * 100;
  const points = values.map((v, i) => `${xAt(i)},${yAt(v)}`);
  const area = `M${xAt(0)},100 L${points.join(" L")} L${xAt(n - 1)},100 Z`;
  const peakAt = values.reduce(
    (best, v, i) => (v > values[best] ? i : best),
    0,
  );
  const peak = data[peakAt];
  // An average does not add up: its summary is the peak alone.
  const total = values.reduce((sum, v) => sum + v, 0);
  const summary =
    metric === "basket"
      ? `${caption}: en yüksek ${peak.label} (${figure(values[peakAt], spec.unit)}).`
      : `${caption}: toplam ${figure(total, spec.unit)}, en yüksek ${peak.label} (${figure(values[peakAt], spec.unit)}).`;
  const phoneLabels = labelIndexes(n, 4);
  const wideLabels = labelIndexes(n, 6);
  // The table's second figure: the orders, or the money when the line is
  // the orders.
  const other =
    metric === "orders"
      ? {
          column: "Net ciro",
          of: (d: RevenueChartBucket) => formatTRY(d.revenueMinor),
        }
      : {
          column: "Sipariş",
          of: (d: RevenueChartBucket) => d.orderCount.toLocaleString("tr-TR"),
        };

  return (
    <figure className="m-0">
      <div
        role="img"
        aria-label={summary}
        className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3"
      >
        {/* Five labels spread over the plot's height plus one line, so
            each sits centred on its gridline. */}
        <div
          aria-hidden="true"
          className="-my-[7px] flex flex-col justify-between text-right text-[11px] leading-[14px] text-[var(--admin-text-mute)]"
          style={NUMERIC_STYLE}
        >
          {ticks.map((t) => (
            <span key={t} className="whitespace-nowrap">
              {spec.unit === "money" ? axisLabel(t) : t.toLocaleString("tr-TR")}
            </span>
          ))}
        </div>
        <div aria-hidden="true" className="relative h-44 sm:h-56">
          <svg
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            className="absolute inset-0 h-full w-full overflow-visible"
          >
            {ticks.map((t) => (
              <line
                key={t}
                x1={0}
                x2={100}
                y1={yAt(t)}
                y2={yAt(t)}
                stroke="var(--admin-border)"
                strokeWidth={1}
                strokeDasharray="4 4"
                vectorEffect="non-scaling-stroke"
              />
            ))}
            {/* Innex's revenue line: a 2 px deep blue over a pale lavender
                fill, on dashed rules (admin/layout.tsx --admin-chart-*). */}
            <path d={area} fill="var(--admin-chart-fill)" />
            <polyline
              points={points.join(" ")}
              fill="none"
              stroke="var(--admin-chart-line)"
              strokeWidth={2}
              strokeLinejoin="round"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
          </svg>
          {data.map((d, i) => (
            <span
              key={d.bucket}
              title={`${d.label}: ${figure(values[i], spec.unit)}${metric === "orders" ? " sipariş" : ` (${d.orderCount} sipariş)`}`}
              className="absolute h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[var(--admin-chart-line)] ring-2 ring-[var(--admin-surface)]"
              style={{ left: `${xAt(i)}%`, top: `${yAt(values[i])}%` }}
            />
          ))}
        </div>
        <div aria-hidden="true" className="relative col-start-2 mt-2 h-4">
          {data.map((d, i) =>
            wideLabels.has(i) || phoneLabels.has(i) ? (
              <span
                key={d.bucket}
                className={`absolute top-0 text-[11px] leading-4 whitespace-nowrap text-[var(--admin-text-mute)] ${
                  i === 0
                    ? ""
                    : i === n - 1
                      ? "-translate-x-full"
                      : "-translate-x-1/2"
                } ${phoneLabels.has(i) ? "" : "hidden sm:block"} ${
                  wideLabels.has(i) ? "" : "sm:hidden"
                }`}
                style={{ left: `${xAt(i)}%`, ...MONO_STYLE }}
              >
                {d.label}
              </span>
            ) : null,
          )}
        </div>
      </div>

      <details className="mt-3">
        <summary className="inline-flex min-h-11 cursor-pointer items-center text-sm text-[var(--admin-text-soft)] underline-offset-4 hover:text-[var(--admin-primary)] hover:underline pointer-fine:min-h-9">
          {spec.unit === "money"
            ? "Tutarları tablo olarak göster"
            : "Rakamları tablo olarak göster"}
        </summary>
        <table className="mt-1 w-full text-sm">
          <caption className="sr-only">{caption}</caption>
          <thead>
            <tr className={EYEBROW} style={MONO_STYLE}>
              <th scope="col" className="py-2 text-left font-normal">
                Dönem
              </th>
              <th scope="col" className="py-2 text-right font-normal">
                {spec.column}
              </th>
              <th scope="col" className="py-2 text-right font-normal">
                {other.column}
              </th>
            </tr>
          </thead>
          <tbody>
            {data.map((d, i) => (
              <tr
                key={d.bucket}
                className="border-t border-[var(--admin-border)]"
              >
                <th
                  scope="row"
                  className="py-1.5 text-left font-normal text-[var(--admin-text)]"
                >
                  {d.label}
                </th>
                <td
                  className="py-1.5 text-right text-[var(--admin-text)]"
                  style={NUMERIC_STYLE}
                >
                  {figure(values[i], spec.unit)}
                </td>
                <td
                  className="py-1.5 text-right text-[var(--admin-text-soft)]"
                  style={NUMERIC_STYLE}
                >
                  {other.of(d)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}
