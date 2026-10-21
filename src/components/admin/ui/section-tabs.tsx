import Link from "next/link";

import { cx } from "@/components/laffogato/cx";
import type { NavTab } from "@/lib/admin/nav-match";

import { COMPACT } from "./compact";
import { LinkPending } from "./link-pending";

/**
 * The strip of a nav item that owns tabs ("Ürünler · Kategoriler"): each
 * tab is another existing page, so these are links, not ARIA tabs. The
 * shell draws it under the breadcrumbs, only on a tab's own page
 * (sectionTabsFor), as AkmanOS's segmented control: the white part on a
 * zinc-100 track. 40 px targets, 44 on a touch screen; on a phone the row
 * scrolls sideways instead of wrapping. A clicked tab marks itself while its page loads.
 */
export function SectionTabs({
  label,
  tabs,
  activeHref,
  className,
}: {
  /** Accessible name of the strip, e.g. "Ürünler bölümleri". */
  label: string;
  tabs: readonly NavTab[];
  /** The tab whose page this is. */
  activeHref: string;
  className?: string;
}) {
  return (
    <nav
      aria-label={label}
      data-admin-section-tabs=""
      className={cx("bg-[var(--admin-surface)] px-4 pt-3 sm:px-6", className)}
    >
      <ul className="inline-flex max-w-full [scrollbar-width:none] gap-1 overflow-x-auto rounded-xl bg-[var(--admin-panel)] p-1">
        {tabs.map((tab) => {
          const active = tab.href === activeHref;
          return (
            <li key={tab.href} className="shrink-0">
              <Link
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className={cx(
                  "relative inline-flex min-h-10 items-center rounded-lg px-3 text-sm whitespace-nowrap transition-[color,background-color,box-shadow] duration-200 pointer-coarse:min-h-11",
                  COMPACT.minH9,
                  active
                    ? "bg-[var(--admin-surface)] font-medium text-[var(--admin-text)] shadow-[0_1px_2px_rgba(0,0,0,0.08),0_0_0_1px_rgba(0,0,0,0.04)]"
                    : "text-[var(--admin-text-soft)] hover:text-[var(--admin-text)]",
                )}
              >
                {tab.label}
                <LinkPending className="bottom-1.5" />
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
