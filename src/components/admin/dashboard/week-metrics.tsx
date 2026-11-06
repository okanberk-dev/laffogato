import {
  averageBasket,
  dashboardDelta,
  type PeriodPace,
} from "@/lib/admin/dashboard-core";

import { MetricCard } from "../arc/metric-card";
import { formatTRY } from "../forms";
import { WidgetCard } from "./widget-card";

/**
 * The last seven days for owner and manager (Arc metric cards): net
 * revenue, reportable orders and the average basket, each read against
 * the seven days before cut at this hour (dashboard-core lastSevenDays,
 * from the same read as the KPI strip and the 14-day chart). Server-safe.
 */
export function WeekMetrics({
  current,
  previous,
}: {
  current: PeriodPace;
  previous: PeriodPace;
}) {
  const basket = averageBasket(current);
  const basketBefore = averageBasket(previous);
  return (
    <WidgetCard title="Son 7 gün" href="/admin/raporlar" linkLabel="Raporlar">
      <div className="grid gap-3 sm:grid-cols-3">
        <MetricCard
          label="Net ciro"
          value={formatTRY(current.revenueMinor)}
          change={dashboardDelta(
            current.revenueMinor,
            previous.revenueMinor,
            "percent",
          )}
          context={`Önceki 7 gün bu saate kadar ${formatTRY(previous.revenueMinor)}`}
        />
        <MetricCard
          label="Sipariş"
          value={String(current.orderCount)}
          change={dashboardDelta(
            current.orderCount,
            previous.orderCount,
            "count",
          )}
          context={`Önceki 7 gün bu saate kadar ${previous.orderCount}`}
        />
        <MetricCard
          label="Ortalama sepet"
          value={basket === null ? "Sipariş yok" : formatTRY(basket)}
          change={
            basket !== null && basketBefore !== null
              ? dashboardDelta(basket, basketBefore, "percent")
              : undefined
          }
          context={
            basketBefore === null
              ? "Önceki 7 günde sipariş yok"
              : `Önceki 7 gün ${formatTRY(basketBefore)}`
          }
        />
      </div>
    </WidgetCard>
  );
}
