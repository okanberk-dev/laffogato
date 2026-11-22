import type { RevenueBucket } from "@/lib/admin/store";

import { formatTRY } from "../forms";
import { RevenueChart } from "../revenue-chart";
import { NUMERIC_STYLE } from "../ui/styles";
import { WidgetCard } from "./widget-card";

/**
 * The last 14 days of net revenue, for the roles that may see reports
 * (decision D38; staff never get it, D1). The buckets are the report's own
 * (`dashboardRevenue`), so the figures here are the ones Raporlar shows for
 * the same days: prepaid karaoke inside the money (22 Kas 2026), the order
 * count the orders' own.
 */
export function RevenueWidget({
  buckets,
}: {
  buckets: readonly RevenueBucket[];
}) {
  const total = buckets.reduce((s, b) => s + b.revenueMinor, 0);
  const orders = buckets.reduce((s, b) => s + b.orderCount, 0);
  return (
    <WidgetCard title="Son 14 gün" href="/admin/raporlar" linkLabel="Raporlar">
      <p className="mb-4 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span
          className="text-2xl font-bold tracking-[-0.01em] text-[var(--admin-text)]"
          style={NUMERIC_STYLE}
        >
          {formatTRY(total)}
        </span>
        <span className="text-[13px] text-[var(--admin-text-mute)]">
          Net ciro · {orders} sipariş · iadeler düşülmüş, karaoke ön ödemesi
          dahil
        </span>
      </p>
      <RevenueChart data={buckets} caption="Son 14 günün net cirosu" />
    </WidgetCard>
  );
}
