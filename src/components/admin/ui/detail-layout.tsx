import type { ReactNode } from "react";

import { cx } from "@/components/laffogato/cx";

/**
 * A record's page body in Innex's three zones (innex-01/02/09/10; 22 Eki
 * 2026): from xl a 21rem left column with the summary that decides what to
 * do (SummaryCard) and, under it, the people and their controls (`aside`);
 * the record's tabs (DetailTabs) take the right column, the whole height.
 * Below xl: the summary, then the tabs, then the aside, so on a phone the
 * record's lines are a scroll away rather than under four cards. Every
 * track is minmax(0, …): a long address wraps instead of widening the page
 * (admin audit PEO-03). Server-safe.
 */
export function DetailLayout({
  summary,
  tabs,
  aside,
  asideLabel,
  asideSplit = true,
  className,
}: {
  summary: ReactNode;
  tabs: ReactNode;
  aside?: ReactNode;
  /** The aside's landmark name ("Müşteri ve teslimat"). */
  asideLabel?: string;
  /** Two columns of aside cards between md and xl (more than one card). */
  asideSplit?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cx(
        "grid grid-cols-[minmax(0,1fr)] gap-5 xl:grid-cols-[minmax(0,21rem)_minmax(0,1fr)] xl:grid-rows-[auto_1fr]",
        className,
      )}
    >
      <div className="min-w-0 xl:col-start-1 xl:row-start-1">{summary}</div>

      <div className="min-w-0 xl:col-start-2 xl:row-span-2 xl:row-start-1">
        {tabs}
      </div>

      {aside ? (
        <aside
          aria-label={asideLabel}
          className={cx(
            "grid min-w-0 grid-cols-[minmax(0,1fr)] content-start gap-4 xl:col-start-1 xl:row-start-2 xl:grid-cols-[minmax(0,1fr)]",
            asideSplit && "md:grid-cols-2",
          )}
        >
          {aside}
        </aside>
      ) : null}
    </div>
  );
}
