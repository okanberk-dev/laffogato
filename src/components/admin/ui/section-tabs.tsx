import Link from "next/link";

import { cx } from "@/components/laffogato/cx";
import type { NavTab } from "@/lib/admin/nav-match";

import { COMPACT } from "./compact";
import { LinkPending } from "./link-pending";

/**
 * The strip of a nav item that owns tabs ("Ürünler · Kategoriler"): each
 * tab is another existing page, so these are links, not ARIA tabs. The
 * shell draws it under the breadcrumbs, only on a tab's own page
 * (sectionTabsFor). 44 px targets; on a phone the row scrolls sideways
 * instead of wrapping. A clicked tab marks itself while its page loads.
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
      className={cx(
        "border-b border-[var(--admin-border)] bg-[var(--admin-surface)]",
        className,
      )}
    >
      <ul className="flex [scrollbar-width:none] gap-1 overflow-x-auto px-4 sm:px-6">
        {tabs.map((tab) => {
          const active = tab.href === activeHref;
          return (
            <li key={tab.href} className="shrink-0">
              <Link
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className={cx(
                  "relative inline-flex min-h-11 items-center border-b-2 px-3 text-sm whitespace-nowrap transition-colors",
                  COMPACT.minH9,
                  active
                    ? "border-[var(--admin-primary)] font-medium text-[var(--admin-primary)]"
                    : "border-transparent text-[var(--admin-text-soft)] hover:border-[var(--admin-border-strong)] hover:text-[var(--admin-text)]",
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
