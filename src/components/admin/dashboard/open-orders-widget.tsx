import Link from "next/link";

import { ORDER_STATUS_LABELS, ORDER_STATUS_TONES } from "@/lib/admin/order-ui";
import type { DashboardStats } from "@/lib/admin/store";

import { TONE_DOT } from "../ui/tone";
import { NUMERIC_STYLE } from "../ui/styles";
import { WidgetCard } from "./widget-card";

/**
 * The open orders by status, each row the order list's tab of that status
 * (decision D38). Counted from the same set as the "Açık" tab.
 */
export function OpenOrdersWidget({
  openByStatus,
}: {
  openByStatus: DashboardStats["openByStatus"];
}) {
  const total = openByStatus.reduce((s, r) => s + r.count, 0);
  return (
    <WidgetCard title="Açık siparişler" href="/admin/siparisler?durum=acik">
      {total === 0 ? (
        <p className="text-sm text-[var(--admin-text-soft)]">
          Bekleyen sipariş yok.
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-[var(--admin-border)]">
          {openByStatus.map((r) => (
            <li key={r.status}>
              <Link
                href={`/admin/siparisler?durum=${r.status}`}
                className="flex min-h-[44px] items-center justify-between gap-3 py-1 text-sm text-[var(--admin-text)] hover:text-[var(--admin-primary)]"
              >
                <span className="flex min-w-0 items-center gap-2">
                  <span
                    aria-hidden="true"
                    className={`h-2 w-2 shrink-0 rounded-full ${TONE_DOT[ORDER_STATUS_TONES[r.status]]}`}
                  />
                  <span className="truncate">
                    {ORDER_STATUS_LABELS[r.status]}
                  </span>
                </span>
                <span
                  className={
                    r.count > 0
                      ? "font-semibold"
                      : "text-[var(--admin-text-soft)]"
                  }
                  style={NUMERIC_STYLE}
                >
                  {r.count}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </WidgetCard>
  );
}
