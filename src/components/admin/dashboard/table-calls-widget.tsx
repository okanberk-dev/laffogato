import Link from "@/components/link";
import {
  TABLE_CALL_REASON_LABELS,
  type PanelTableCall,
} from "@/lib/admin/table-calls-core";
import { timeAgo } from "@/lib/admin/time-ago";

import { WidgetCard } from "./widget-card";

/**
 * The open table calls (the app's "Garson çağır"), oldest first, as
 * Siparişler's "Masa çağrıları" lists them: the table, the reason and how
 * long ago, no guest. Read only: they are answered on Siparişler and on the
 * bar screen. Server-safe.
 */
export function TableCallsWidget({
  calls,
  now,
}: {
  calls: readonly PanelTableCall[];
  now: Date;
}) {
  return (
    <WidgetCard
      title={
        calls.length ? `Masa çağrıları (${calls.length})` : "Masa çağrıları"
      }
      href="/admin/siparisler"
      linkLabel="Siparişler"
    >
      {calls.length === 0 ? (
        <p className="text-sm text-[var(--admin-text-soft)]">
          Açık masa çağrısı yok.
        </p>
      ) : (
        <ul className="flex flex-col gap-1">
          {calls.map((c) => (
            <li key={c.id}>
              <Link
                href="/admin/siparisler"
                className="flex min-h-11 items-center justify-between gap-3 rounded-lg bg-[var(--admin-danger-soft)] px-3 text-sm text-[var(--admin-text)] transition-colors hover:bg-[var(--admin-panel)] focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]/40 focus-visible:outline-none pointer-fine:min-h-9"
              >
                <span className="flex min-w-0 items-center gap-2.5">
                  <span
                    aria-hidden="true"
                    className="h-4 w-[3px] shrink-0 rounded-full bg-[var(--admin-danger)]"
                  />
                  <span className="truncate font-medium">{c.label}</span>
                  <span className="truncate text-[var(--admin-text-soft)]">
                    {TABLE_CALL_REASON_LABELS[c.reason]}
                  </span>
                </span>
                <span className="shrink-0 text-xs text-[var(--admin-text-mute)]">
                  {timeAgo(c.createdAt, now)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </WidgetCard>
  );
}
