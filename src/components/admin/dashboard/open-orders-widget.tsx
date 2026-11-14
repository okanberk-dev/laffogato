import Link from "@/components/link";
import { ORDER_STATUS_LABELS, ORDER_STATUS_TONES } from "@/lib/admin/order-ui";
import type { DashboardStats } from "@/lib/admin/store";

import { TONE_DOT } from "../ui/tone";
import { NUMERIC_STYLE } from "../ui/styles";
import { WidgetCard } from "./widget-card";

/**
 * The open orders by status, each row the order list's tab of that status
 * (decision D38). Counted from the same set as the "Açık" tab. Innex's
 * occupancy bar and legend rows: one bar split by status, then a pale row
 * per status with its colour's notch and its count.
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
        <>
          <div
            aria-hidden="true"
            className="mb-3 flex h-2 gap-0.5 overflow-hidden rounded-full"
          >
            {openByStatus
              .filter((r) => r.count > 0)
              .map((r) => (
                <span
                  key={r.status}
                  className={`h-full ${TONE_DOT[ORDER_STATUS_TONES[r.status]]}`}
                  style={{ width: `${(r.count / total) * 100}%` }}
                />
              ))}
          </div>
          <ul className="flex flex-col gap-1">
            {openByStatus.map((r) => (
              <li key={r.status}>
                <Link
                  href={`/admin/siparisler?durum=${r.status}`}
                  className="flex min-h-11 items-center justify-between gap-3 rounded-lg bg-[var(--admin-surface-2)] px-3 text-sm text-[var(--admin-text)] transition-colors hover:bg-[var(--admin-panel)] focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]/40 focus-visible:outline-none pointer-fine:min-h-9"
                >
                  <span className="flex min-w-0 items-center gap-2.5">
                    <span
                      aria-hidden="true"
                      className={`h-4 w-[3px] shrink-0 rounded-full ${TONE_DOT[ORDER_STATUS_TONES[r.status]]}`}
                    />
                    <span className="truncate">
                      {ORDER_STATUS_LABELS[r.status]}
                    </span>
                  </span>
                  <span
                    className={
                      r.count > 0
                        ? "font-semibold"
                        : "text-[var(--admin-text-mute)]"
                    }
                    style={NUMERIC_STYLE}
                  >
                    {r.count}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </WidgetCard>
  );
}
