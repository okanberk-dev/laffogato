import { Card, PageHeader, formatTRY } from "@/components/admin/forms";
import { StatCard } from "@/components/admin/dashboard/stat-card";
import { RevenueChart } from "@/components/admin/revenue-chart";
import { EmptyState, PageShell, StatusTabs } from "@/components/admin/ui";
import {
  EYEBROW,
  MONO_STYLE,
  NUMERIC_STYLE,
} from "@/components/admin/ui/styles";
import { requireRole } from "@/lib/admin/auth";
import { DAY_CLOSE_PATH } from "@/lib/admin/day-close-core";
import {
  analyticsHeadline,
  karaokeRevenue,
  parseGranularity,
  revenueBuckets,
  topProducts,
  type BucketGranularity,
} from "@/lib/admin/store";

export const metadata = { title: "Admin · Raporlar" };
export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ g?: string | string[] }>;
}

const G_OPTIONS: Array<{
  value: BucketGranularity;
  label: string;
  count: number;
  /** The chart's heading. */
  chart: string;
}> = [
  { value: "day", label: "Son 30 gün", count: 30, chart: "Günlük" },
  { value: "week", label: "Son 12 hafta", count: 12, chart: "Haftalık" },
  { value: "month", label: "Son 12 ay", count: 12, chart: "Aylık" },
];

/**
 * Raporlar: every figure on the page reads the period the tabs choose (the
 * chart's buckets, cut at the köşk's midnight). The tiles and the top list
 * used to read every order ever placed beside a "30 gün" switch, and the
 * top list's bars were drawn by quantity under a ranking by money (admin
 * audit SYS-16, decision D31). The "Dönüşüm" card, which promised to fill
 * itself once an analytics tool was connected, is gone (D32).
 */
export default async function ReportsPage({ searchParams }: PageProps) {
  await requireRole("reports");
  const sp = await searchParams;
  // An unknown ?g= falls back to the daily view AND marks its tab.
  const g = parseGranularity(sp.g);
  const opt = G_OPTIONS.find((x) => x.value === g) ?? G_OPTIONS[0];

  const [head, buckets, top, karaoke] = await Promise.all([
    analyticsHeadline(opt.value, opt.count),
    revenueBuckets(opt.value, opt.count),
    topProducts(opt.value, opt.count, 5),
    karaokeRevenue(opt.value, opt.count),
  ]);

  const peak = buckets.reduce(
    (best, b) => (b.revenueMinor > best.revenueMinor ? b : best),
    buckets[0] ?? { label: "-", revenueMinor: 0, orderCount: 0, bucket: "" },
  );
  const maxRevenue = Math.max(1, ...top.map((t) => t.revenueMinor));
  const period = opt.label.toLocaleLowerCase("tr-TR");

  return (
    <PageShell width="list">
      <PageHeader
        title="Raporlar"
        description="Seçtiğin dönemin ciro, sipariş ve en çok satan ürün özeti."
        help={
          <p>
            Seçtiğin dönemde ödemesi alınmış siparişler sayılır; ödeme bekleyen
            ve iptal edilenler sayılmaz. İade, siparişin verildiği dönemden
            düşülür. Karaoke ön ödemeleri ayrı.
          </p>
        }
        secondary={{ href: DAY_CLOSE_PATH, label: "Gün sonu" }}
      />

      <StatusTabs
        tabs={G_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
        current={opt.value}
        searchParams={sp}
        pathname="/admin/raporlar"
        param="g"
        label="Dönem"
      />

      <div className="mb-4 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3 xl:grid-cols-5">
        <StatCard
          label="Net ciro"
          value={formatTRY(head.netRevenueMinor)}
          hint="İadeler düşülmüş"
          money
        />
        <StatCard
          label="Brüt ciro"
          value={formatTRY(head.grossRevenueMinor)}
          hint="İadeler düşülmeden"
          money
        />
        <StatCard
          label="İade"
          value={
            head.refundedMinor > 0 ? `−${formatTRY(head.refundedMinor)}` : "-"
          }
          tone={head.refundedMinor > 0 ? "danger" : undefined}
          money
        />
        <StatCard
          label="Sipariş"
          value={head.totalOrders.toLocaleString("tr-TR")}
        />
        <StatCard
          label="Ortalama sepet"
          value={formatTRY(head.averageOrderMinor)}
          hint="Brüt / sipariş"
          money
        />
      </div>

      <Card className="mb-4">
        <div className="mb-4 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <h2 className="text-lg font-semibold text-[var(--admin-text)]">
            {opt.chart} net ciro
          </h2>
          {peak.revenueMinor > 0 ? (
            <p className="text-sm text-[var(--admin-text-soft)]">
              En yüksek: {peak.label} ·{" "}
              <span style={NUMERIC_STYLE}>{formatTRY(peak.revenueMinor)}</span>
            </p>
          ) : null}
        </div>
        <RevenueChart data={buckets} caption={`${opt.chart} net ciro`} />
      </Card>

      <Card className="mb-4">
        <div className="mb-4 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <h2 className="text-lg font-semibold text-[var(--admin-text)]">
            En çok satan 5 ürün
          </h2>
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
              const widthPct = Math.round((t.revenueMinor / maxRevenue) * 100);
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
                    <div
                      className="h-full rounded-full bg-[var(--admin-primary)]"
                      style={{ width: `${widthPct}%` }}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <Card>
        <h2 className="text-lg font-semibold text-[var(--admin-text)]">
          Karaoke ön ödemesi
        </h2>
        <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
          <div className="min-w-0">
            <div className={EYEBROW} style={MONO_STYLE}>
              Bu dönemde, net
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
          <p className="min-w-0 text-xs text-[var(--admin-text-soft)] sm:text-right">
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
            {formatTRY(karaoke.refundPendingMinor)} için iade başlatıldı, sonucu
            bekleniyor; nete dahil.
          </p>
        ) : null}
      </Card>
    </PageShell>
  );
}
