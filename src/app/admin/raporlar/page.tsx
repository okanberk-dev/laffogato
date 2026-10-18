import Link from "next/link";

import { Card, PageHeader, formatTRY } from "@/components/admin/forms";
import { RevenueChart } from "@/components/admin/revenue-chart";
import { requireRole } from "@/lib/admin/auth";
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
}> = [
  { value: "day", label: "Günlük · 30 gün", count: 30 },
  { value: "week", label: "Haftalık · 12 hafta", count: 12 },
  { value: "month", label: "Aylık · 12 ay", count: 12 },
];

export default async function ReportsPage({ searchParams }: PageProps) {
  await requireRole("reports");
  const sp = await searchParams;
  // An unknown ?g= falls back to the daily view AND marks its tab.
  const g = parseGranularity(sp.g);
  const opt = G_OPTIONS.find((x) => x.value === g) ?? G_OPTIONS[0];

  const [head, buckets, top, karaoke] = await Promise.all([
    analyticsHeadline(),
    revenueBuckets(opt.value, opt.count),
    topProducts(5),
    karaokeRevenue(opt.value, opt.count),
  ]);

  const periodRevenue = buckets.reduce((s, b) => s + b.revenueMinor, 0);
  const periodOrders = buckets.reduce((s, b) => s + b.orderCount, 0);
  const peak = buckets.reduce(
    (best, b) => (b.revenueMinor > best.revenueMinor ? b : best),
    buckets[0] ?? { label: "-", revenueMinor: 0, orderCount: 0, bucket: "" },
  );
  const maxQty = Math.max(1, ...top.map((t) => t.qty));

  return (
    <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-10">
      <PageHeader
        eyebrow="Operasyon · İçgörüler"
        title="Raporlar"
        description="Ödemesi alınmış siparişler sayılır; ödeme bekleyen ve iptal edilenler hariç. Net ciro iadeler düşülmüş tutardır, iade siparişin kendi döneminden düşülür. Karaoke ön ödemeleri ayrı gösterilir."
      />

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Stat
          label="Net ciro"
          value={formatTRY(head.netRevenueMinor)}
          hint="Siparişler, iadeler düşülmüş"
        />
        <Stat
          label="Brüt ciro"
          value={formatTRY(head.grossRevenueMinor)}
          hint="İadeler düşülmeden"
        />
        <Stat
          label="İade"
          value={
            head.refundedMinor > 0 ? `−${formatTRY(head.refundedMinor)}` : "-"
          }
          tone={head.refundedMinor > 0 ? "warn" : undefined}
        />
        <Stat label="Sipariş" value={String(head.totalOrders)} />
        <Stat
          label="Ortalama sepet"
          value={formatTRY(head.averageOrderMinor)}
          hint="Brüt / sipariş"
        />
      </div>

      <Card className="mb-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2
              className="text-[10px] tracking-[0.22em] text-neutral-500 uppercase"
              style={{ fontFamily: "var(--mono), monospace" }}
            >
              Karaoke ön ödemesi (net)
            </h2>
            <div
              className="mt-1 text-2xl text-neutral-900"
              style={{ fontFamily: "var(--mono), monospace" }}
            >
              {formatTRY(karaoke.netMinor)}
            </div>
            <p className="mt-1 text-xs text-neutral-500">
              {karaoke.paidCount} ödenmiş rezervasyon · tahsil edilen{" "}
              {formatTRY(karaoke.collectedMinor)} · iade edilen{" "}
              {formatTRY(karaoke.refundedMinor)}
            </p>
            {karaoke.refundPendingMinor > 0 ? (
              <p className="mt-1 text-xs text-[var(--admin-danger-ink)]">
                {formatTRY(karaoke.refundPendingMinor)} için iade başlatıldı,
                sonucu bekleniyor; nete dahil.
              </p>
            ) : null}
          </div>
          <div className="text-right text-xs text-neutral-500">
            Bu dönemde ({opt.label.toLocaleLowerCase("tr-TR")}):{" "}
            <span
              className="text-sm text-neutral-900"
              style={{ fontFamily: "var(--mono), monospace" }}
            >
              {formatTRY(karaoke.periodNetMinor)}
            </span>{" "}
            · {karaoke.periodCount} rezervasyon
          </div>
        </div>
      </Card>

      <Card className="mb-4">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2
              className="text-[10px] tracking-[0.22em] text-neutral-500 uppercase"
              style={{ fontFamily: "var(--mono), monospace" }}
            >
              Net sipariş cirosu
            </h2>
            <div
              className="mt-1 text-3xl"
              style={{
                fontFamily: "var(--serif), 'Playfair Display', serif",
                fontStyle: "italic",
              }}
            >
              {formatTRY(periodRevenue)}
            </div>
            <div className="text-xs text-neutral-500">
              {periodOrders} sipariş · zirve: {peak.label} (
              {formatTRY(peak.revenueMinor)})
            </div>
          </div>
          <nav className="flex flex-wrap gap-1">
            {G_OPTIONS.map((o) => (
              <Link
                key={o.value}
                href={`/admin/raporlar?g=${o.value}`}
                aria-current={o.value === opt.value ? "page" : undefined}
                className={`rounded-full px-3 py-1.5 text-xs ${
                  o.value === opt.value
                    ? "bg-[var(--admin-primary)] text-white"
                    : "border border-[var(--admin-border)] text-neutral-700 hover:border-[var(--admin-primary)] hover:text-[var(--admin-primary)]"
                }`}
              >
                {o.label}
              </Link>
            ))}
          </nav>
        </div>
        <RevenueChart data={buckets} caption={`${opt.label} net ciro`} />
      </Card>

      <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        <Card>
          <h2
            className="mb-4 text-[10px] tracking-[0.22em] text-neutral-500 uppercase"
            style={{ fontFamily: "var(--mono), monospace" }}
          >
            En çok satan 5 ürün
          </h2>
          {top.length === 0 ? (
            <p className="text-sm text-neutral-500">
              Henüz satış yok. Siparişler geldikçe burası dolar.
            </p>
          ) : (
            <ul className="grid gap-3">
              {top.map((t, i) => {
                const widthPct = Math.round((t.qty / maxQty) * 100);
                return (
                  <li key={t.productName} className="grid gap-1">
                    <div className="flex justify-between text-sm">
                      <span className="text-neutral-900">
                        <span
                          className="mr-2 inline-block w-4 text-right text-neutral-400"
                          style={{ fontFamily: "var(--mono), monospace" }}
                        >
                          {i + 1}.
                        </span>
                        {t.productName}
                      </span>
                      <span
                        className="text-neutral-700"
                        style={{ fontFamily: "var(--mono), monospace" }}
                      >
                        {t.qty} adet · {formatTRY(t.revenueMinor)}
                      </span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-neutral-100">
                      <div
                        className="h-full rounded-full bg-[var(--admin-primary)] transition-all"
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
          <h2
            className="mb-4 text-[10px] tracking-[0.22em] text-neutral-500 uppercase"
            style={{ fontFamily: "var(--mono), monospace" }}
          >
            Dönüşüm
          </h2>
          <div
            className="text-3xl text-neutral-300"
            style={{ fontFamily: "var(--mono), monospace" }}
          >
            -
          </div>
          <p className="mt-3 text-xs text-neutral-500">
            Sipariş / ziyaret oranı için ziyaret verisi gerekiyor. Vercel
            Analytics / GA / Plausible bağlandığında bu kart otomatik aktif
            olacak.
          </p>
        </Card>
      </div>
    </main>
  );
}

function Stat({
  label,
  value,
  tone,
  hint,
}: {
  label: string;
  value: string;
  tone?: "warn";
  hint?: string;
}) {
  return (
    <div className="rounded-xl border border-[var(--admin-border)] bg-white p-4 shadow-sm">
      <div
        className="text-[10px] tracking-[0.22em] text-neutral-500 uppercase"
        style={{ fontFamily: "var(--mono), monospace" }}
      >
        {label}
      </div>
      <div
        className={`mt-1 text-xl ${tone === "warn" ? "text-rose-700" : "text-neutral-900"}`}
        style={{ fontFamily: "var(--mono), monospace" }}
      >
        {value}
      </div>
      {hint ? (
        <div className="mt-1 text-xs text-neutral-500">{hint}</div>
      ) : null}
    </div>
  );
}
