import Link from "@/components/link";
import {
  CUSTOMER_LIST_PATH,
  type CustomerListRow,
} from "@/lib/admin/customer-list-core";
import { timeAgo } from "@/lib/admin/time-ago";

import { NUMERIC_STYLE } from "../ui/styles";
import { WidgetCard } from "./widget-card";

/**
 * The customers who moved last (Müşteriler sorted by "Son hareket": the
 * newest order, else the sign-up), for the roles that open Müşteriler.
 * Name, paid order count and when; the row opens the customer. Server-safe.
 */
export function RecentCustomersWidget({
  rows,
  now,
}: {
  rows: readonly CustomerListRow[];
  now: Date;
}) {
  return (
    <WidgetCard title="Son hareket eden müşteriler" href={CUSTOMER_LIST_PATH}>
      {rows.length === 0 ? (
        <p className="text-sm text-[var(--admin-text-soft)]">
          Henüz müşteri yok.
        </p>
      ) : (
        <ul className="flex flex-col gap-1">
          {rows.map((c) => (
            <li key={c.email}>
              <Link
                href={`${CUSTOMER_LIST_PATH}/${encodeURIComponent(c.email)}`}
                className="flex min-h-11 items-center justify-between gap-3 rounded-lg bg-[var(--admin-surface-2)] px-3 text-sm text-[var(--admin-text)] transition-colors hover:bg-[var(--admin-panel)] focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]/40 focus-visible:outline-none pointer-fine:min-h-9"
              >
                <span className="min-w-0">
                  <span className="block truncate font-medium">
                    {c.name || c.email}
                  </span>
                  <span className="block truncate text-xs text-[var(--admin-text-mute)]">
                    {c.isMember ? "Üye" : "Misafir"} ·{" "}
                    {timeAgo(c.lastActivity, now)}
                  </span>
                </span>
                <span
                  className="shrink-0 text-xs text-[var(--admin-text-soft)]"
                  style={NUMERIC_STYLE}
                >
                  {c.orderCount} sipariş
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </WidgetCard>
  );
}
