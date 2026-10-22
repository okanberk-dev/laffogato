import Link from "next/link";

import { cx } from "@/components/laffogato/cx";
import type { NavTab } from "@/lib/admin/nav-match";

import { LinkPending } from "./link-pending";

/**
 * A nav item's tabs (admin UI v2, UI-5): "Ürünler · Kategoriler",
 * "Kampanyalar · Aboneler · İYS". Each tab is a page of its own; the shell
 * draws this strip on the tab's own page only. Innex's underlined tabs
 * (22 Eki 2026): the current tab in full ink over a 2 px dark rule, the
 * others in the label grey. From `lg` the strip sits inside the top bar
 * (`inBar`), in the breadcrumbs' place; on a phone it is a strip of its own
 * under the bar. Server-safe; the hover and focus are CSS.
 */
export function SectionTabs({
  label,
  tabs,
  activeHref,
  inBar = false,
  className,
}: {
  label: string;
  tabs: readonly NavTab[];
  activeHref: string;
  /** Inside the top bar: no strip of its own, as tall as the bar. */
  inBar?: boolean;
  className?: string;
}) {
  return (
    <nav
      aria-label={label}
      data-admin-section-tabs=""
      className={cx(
        inBar
          ? "min-w-0 self-stretch"
          : "border-b border-[var(--admin-border)] bg-[var(--admin-surface)] px-4 sm:px-5",
        className,
      )}
    >
      <ul className="flex h-full max-w-full [scrollbar-width:none] gap-5 overflow-x-auto [&::-webkit-scrollbar]:hidden">
        {tabs.map((tab) => {
          const active = tab.href === activeHref;
          return (
            <li key={tab.href} className="flex shrink-0">
              <Link
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className={cx(
                  "relative inline-flex min-h-11 items-center border-b-2 px-0.5 text-sm font-medium whitespace-nowrap transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]/40 focus-visible:outline-none",
                  active
                    ? "border-[var(--admin-text)] text-[var(--admin-text)]"
                    : "border-transparent text-[var(--admin-text-mute)] hover:text-[var(--admin-text)]",
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
