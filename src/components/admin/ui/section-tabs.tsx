import { cx } from "@/components/laffogato/cx";
import Link from "@/components/link";
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
        inBar ? "min-w-0 self-stretch" : "px-4 pt-3 sm:px-5 lg:px-6",
        className,
      )}
    >
      <ul
        data-focus-inset=""
        className={cx(
          "flex max-w-full [scrollbar-width:none] overflow-x-auto [&::-webkit-scrollbar]:hidden",
          inBar
            ? "h-full gap-5"
            : "w-fit gap-0.5 rounded-full bg-[var(--admin-panel)] p-1",
        )}
      >
        {tabs.map((tab) => {
          const active = tab.href === activeHref;
          return (
            <li key={tab.href} className="flex shrink-0">
              <Link
                href={tab.href}
                aria-current={active ? "page" : undefined}
                // StorageBox's section pills: a grey rail, the current page
                // a white pill. In the top bar, an underline as before.
                className={cx(
                  "relative inline-flex items-center text-sm font-medium whitespace-nowrap transition-colors duration-150 focus-visible:ring-[3px] focus-visible:ring-[var(--admin-ring)] focus-visible:outline-none",
                  inBar
                    ? cx(
                        "min-h-11 border-b-2 px-0.5",
                        active
                          ? "border-[var(--admin-text)] text-[var(--admin-text)]"
                          : "border-transparent text-[var(--admin-text-mute)] hover:text-[var(--admin-text)]",
                      )
                    : cx(
                        "min-h-9 rounded-full px-4 pointer-coarse:min-h-10",
                        active
                          ? "bg-[var(--admin-surface)] text-[var(--admin-text)] shadow-[0_1px_2px_rgb(31_33_45/0.08)]"
                          : "text-[var(--admin-text-mute)] hover:text-[var(--admin-text)]",
                      ),
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
