import { Card, PageHeader, formatTRY } from "@/components/admin/forms";
import { KpiStrip, type KpiCell } from "@/components/admin/dashboard/kpi-strip";
import { RevenueChart } from "@/components/admin/revenue-chart";
import { EmptyState, PageShell } from "@/components/admin/ui";
import { SegmentedLinks } from "@/components/admin/ui/segmented";
import {
  CARD_TITLE,
  EYEBROW,
  MONO_STYLE,
  NUMERIC_STYLE,
} from "@/components/admin/ui/styles";
import { requireRole } from "@/lib/admin/auth";
import { dashboardDelta } from "@/lib/admin/dashboard-core";
import { DAY_CLOSE_PATH } from "@/lib/admin/day-close-core";
import {
  REPORT_METRICS,
  parseReportMetric,
  reportsHref,
  type ReportMetric,
} from "@/lib/admin/report-metrics";
import {
  parseGranularity,
  reportsOverview,
  topProducts,
  type BucketGranularity,
} from "@/lib/admin/store";

export const metadata = { title: "Admin · Raporlar" };
export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ g?: string | string[]; m?: string | string[] }>;
}

const G_OPTIONS: Array<{
  value: BucketGranularity;
  label: string;
  count: number;
  /** The chart's heading. */
  chart: string;
  /** The period before it, as the tiles' references name it. */
  before: string;
}> = [
  {
    value: "day",
    label: "Son 30 gün",
    count: 30,
    chart: "Günlük",
    before: "Önceki 30 gün",
  },
  {
    value: "week",
    label: "Son 12 hafta",
    count: 12,
    chart: "Haftalık",
    before: "Önceki 12 hafta",
  },
  {
    value: "month",
    label: "Son 12 ay",
    count: 12,
    chart: "Aylık",
    before: "Önceki 12 ay",
  },
];

/**
 * Raporlar: every figure on the page reads the period the tabs choose (the
 * chart's buckets, cut at the köşk's midnight). The tiles and the top list
 * used to read every order ever placed beside a "30 gün" switch, and the
 * top list's bars were drawn by quantity under a ranking by money (admin
 * audit SYS-16, decision D31). The "Dönüşüm" card, which promised to fill
 * itself once an analytics tool was connected, is gone (D32).
 *
 * Prepaid karaoke is inside the money figures (22 Kas 2026; operator:
 * "raporlarda karaoke cirosu online'da gözükmüyor"): a booking paid by card
 * on the site is online revenue, and it sat only in its own card at the foot
 * of the page. Net, gross and refunds carry it now, on the day it was paid;
 * the order count and the basket stay the orders' own, and a line under the
 * strip says how much of the net is karaoke.
 */
export default async function ReportsPage({ searchParams }: PageProps) {
  await requireRole("reports");
  const sp = await searchParams;
  // An unknown ?g= falls back to the daily view AND marks its tab.
  const g = parseGranularity(sp.g);
  const opt = G_OPTIONS.find((x) => x.value === g) ?? G_OPTIONS[0];
  // The card tab the chart draws (Innex: the answer on the tab).
  const metric = parseReportMetric(sp.m);
  const spec = REPORT_METRICS[metric];

  const [overview, top] = await Promise.all([
    reportsOverview(opt.value, opt.count),
    topProducts(opt.value, opt.count, 5),
  ]);
  const { compared, buckets, karaoke } = overview;
  const karaokeNow = overview.karaokeShare.current;
  const head = compared.current;
  const prev = compared.previous;

  // The chosen figure's best bucket, for the line beside the chart's title.
  const peak = buckets.reduce<{ label: string; value: number }>(
    (best, b) => {
      const value = spec.of(b);
      return value > best.value ? { label: b.label, value } : best;
    },
    { label: "-", value: 0 },
  );
  const maxRevenue = Math.max(1, ...top.map((t) => t.revenueMinor));
  const period = opt.label.toLocaleLowerCase("tr-TR");
  const refundLabel = (minor: number) =>
    minor > 0 ? `−${formatTRY(minor)}` : "-";

  // Innex's KPI strip: every figure against the same stretch of time just
  // before the period (one read of twice the period, store.ts).
  const cells: KpiCell[] = [
    {
      key: "net",
      label: "Net ciro",
      value: formatTRY(head.netRevenueMinor),
      reference: `${opt.before} ${formatTRY(prev.netRevenueMinor)}`,
      delta: dashboardDelta(
        head.netRevenueMinor,
        prev.netRevenueMinor,
        "percent",
      ),
      money: true,
      icon: "revenue",
      hue: "green",
    },
    {
      key: "gross",
      label: "Brüt ciro",
      value: formatTRY(head.grossRevenueMinor),
      reference: `${opt.before} ${formatTRY(prev.grossRevenueMinor)}`,
      delta: dashboardDelta(
        head.grossRevenueMinor,
        prev.grossRevenueMinor,
        "percent",
      ),
      money: true,
      icon: "reports",
      hue: "blue",
    },
    {
      key: "refund",
      label: "İade",
      value: refundLabel(head.refundedMinor),
      reference:
        prev.refundedMinor > 0
          ? `${opt.before} ${refundLabel(prev.refundedMinor)}`
          : `${opt.before} iade yok`,
      // More money back is not good news.
      delta: dashboardDelta(
        head.refundedMinor,
        prev.refundedMinor,
        "percent",
        "down",
      ),
      tone: head.refundedMinor > 0 ? "danger" : undefined,
      money: true,
      icon: "attention",
      hue: "rose",
    },
    {
      key: "orders",
      label: "Sipariş",
      value: head.totalOrders.toLocaleString("tr-TR"),
      reference: `${opt.before} ${prev.totalOrders.toLocaleString("tr-TR")}`,
      delta: dashboardDelta(head.totalOrders, prev.totalOrders, "count"),
      icon: "orders",
      hue: "violet",
    },
    {
      key: "basket",
      label: "Ortalama sepet",
      value: formatTRY(head.averageOrderMinor),
      reference: `Sipariş brütü / sipariş · ${opt.before.toLocaleLowerCase("tr-TR")} ${formatTRY(prev.averageOrderMinor)}`,
      delta: dashboardDelta(
        head.averageOrderMinor,
        prev.averageOrderMinor,
        "percent",
      ),
      money: true,
      icon: "promos",
      hue: "amber",
    },
  ];

  // Each figure is a tab: the chart under the strip draws it per bucket.
  const tabs: KpiCell[] = cells.map((cell) => ({
    ...cell,
    href: reportsHref(opt.value, cell.key as ReportMetric),
    current: cell.key === metric,
  }));

  return (
    <PageShell width="list">
      <PageHeader
        title="Raporlar"
        description="Seçtiğin dönemin özeti, her rakam bir önceki dönemle karşılaştırmalı."
        help={
          <p>
            Seçtiğin dönemde ödemesi alınmış siparişler sayılır; ödeme bekleyen
            ve iptal edilenler sayılmaz. İade, siparişin verildiği dönemden
            düşülür. Sitede kartla ödenen karaoke ön ödemeleri de ciroya
            dahildir (ödendiği günde); köşkte ödenen, elle eklenen rezervasyon
            dahil değildir. Sipariş sayısı ve ortalama sepet yalnız
            siparişlerden hesaplanır.
          </p>
        }
        action={
          <SegmentedLinks
            label="Dönem"
            options={G_OPTIONS.map((o) => ({
              // Another period keeps the figure the chart draws.
              href: reportsHref(o.value, metric),
              label: o.label,
              current: o.value === opt.value,
            }))}
          />
        }
        secondary={{ href: DAY_CLOSE_PATH, label: "Gün sonu" }}
      />

      <KpiStrip
        label={`${opt.label}: özet`}
        cells={tabs}
        linkScroll={false}
        className={karaokeNow.grossMinor > 0 ? "mb-2" : "mb-5"}
      />
      {karaokeNow.grossMinor > 0 ? (
        <p className="mb-5 text-xs text-[var(--admin-text-soft)]">
          Net cironun{" "}
          <span style={NUMERIC_STYLE}>{formatTRY(karaokeNow.netMinor)}</span>
          &apos;si karaoke ön ödemesi ({karaokeNow.count} rezervasyon, sitede
          kartla ödenen). Sipariş sayısı ve ortalama sepet yalnız siparişlerden.
        </p>
      ) : null}

      <Card className="mb-5">
        <div className="mb-4 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <h2 className={CARD_TITLE}>
            {opt.chart} {spec.chart}
          </h2>
          {peak.value > 0 ? (
            <p className="text-sm text-[var(--admin-text-soft)]">
              En yüksek: {peak.label} ·{" "}
              <span style={NUMERIC_STYLE}>
                {spec.unit === "money"
                  ? formatTRY(peak.value)
                  : peak.value.toLocaleString("tr-TR")}
              </span>
            </p>
          ) : null}
        </div>
        <RevenueChart
          data={buckets}
          caption={`${opt.chart} ${spec.chart}`}
          metric={metric}
        />
      </Card>

      <div className="grid gap-5 xl:grid-cols-3">
        <Card className="min-w-0 xl:col-span-2">
          <div className="mb-4 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <h2 className={CARD_TITLE}>En çok satan 5 ürün</h2>
            <p className="text-xs text-[var(--admin-text-soft)]">
              Bu dönemde, liste fiyatıyla; iadeler düşülmüş
            </p>
          </div>
          {top.length === 0 ? (
            <EmptyState
              title="Bu dönemde satış yok."
              description="Siparişler geldikçe burası dolar."
            />
          ) : (
            <ul className="grid gap-3">
              {top.map((t, i) => {
                // The bar is the figure the list is sorted by (SYS-16).
                const widthPct = Math.round(
                  (t.revenueMinor / maxRevenue) * 100,
                );
                return (
                  <li key={t.productName} className="grid gap-1">
                    <div className="flex flex-wrap items-baseline justify-between gap-x-3 text-sm">
                      <span className="min-w-0 text-[var(--admin-text)]">
                        <span
                          className="mr-2 inline-block w-5 text-right text-[var(--admin-text-soft)]"
                          style={NUMERIC_STYLE}
                        >
                          {i + 1}.
                        </span>
                        {t.productName}
                      </span>
                      <span
                        className="text-[var(--admin-text-soft)]"
                        style={NUMERIC_STYLE}
                      >
                        {t.qty} adet · {formatTRY(t.revenueMinor)}
                      </span>
                    </div>
                    <div
                      aria-hidden="true"
                      className="h-2 w-full overflow-hidden rounded-full bg-[var(--admin-neutral-soft)]"
                    >
                      {/* The money's green, as the chart above draws it
                        (Raporlar is in the green group, ui/hues.ts). */}
                      <div
                        className="h-full rounded-full bg-[var(--admin-hue-green)]"
                        style={{ width: `${widthPct}%` }}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <Card className="min-w-0">
          <h2 className={CARD_TITLE}>Karaoke ön ödemesi</h2>
          <div className="mt-3 flex flex-col gap-3">
            <div className="min-w-0">
              <div className={EYEBROW} style={MONO_STYLE}>
                Bu dönemde, net · ciroya dahil
              </div>
              <div
                className="mt-1 text-2xl font-semibold text-[var(--admin-text)]"
                style={NUMERIC_STYLE}
              >
                {formatTRY(karaoke.periodNetMinor)}
              </div>
              <p className="mt-1 text-xs text-[var(--admin-text-soft)]">
                {karaoke.periodCount} rezervasyon ({period})
              </p>
            </div>
            <p className="min-w-0 border-t border-[var(--admin-divider)] pt-3 text-xs text-[var(--admin-text-soft)]">
              Tüm zamanlar: net{" "}
              <span style={NUMERIC_STYLE}>{formatTRY(karaoke.netMinor)}</span> ·{" "}
              {karaoke.paidCount} ödenmiş rezervasyon · tahsil edilen{" "}
              <span style={NUMERIC_STYLE}>
                {formatTRY(karaoke.collectedMinor)}
              </span>{" "}
              · iade edilen{" "}
              <span style={NUMERIC_STYLE}>
                {formatTRY(karaoke.refundedMinor)}
              </span>
            </p>
          </div>
          {karaoke.refundPendingMinor > 0 ? (
            <p className="mt-2 text-xs text-[var(--admin-danger-ink)]">
              {formatTRY(karaoke.refundPendingMinor)} için iade başlatıldı,
              sonucu bekleniyor; nete dahil.
            </p>
          ) : null}
        </Card>
      </div>
    </PageShell>
  );
}
