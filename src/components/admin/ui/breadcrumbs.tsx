"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cx } from "@/components/laffogato/cx";
import { breadcrumbTrail, type NavLink } from "@/lib/admin/nav-match";

/**
 * "Siparişler / Ayrıntı": where the operator is on a page below a sidebar
 * entry, each step a link back up (admin audit SHE-31, P2b). Drawn from the
 * same nav the sidebar shows, so it needs no list of routes of its own.
 * Nothing on a page the sidebar names itself: the entry is lit there, and
 * a one-step trail would only repeat the page title.
 */
export function Breadcrumbs({
  items,
  className,
}: {
  items: readonly NavLink[];
  className?: string;
}) {
  const pathname = usePathname();
  const trail = breadcrumbTrail(pathname, items);
  if (trail.length < 2) return null;
  return (
    <nav aria-label="Konum" className={cx("min-w-0", className)}>
      <ol className="flex min-w-0 flex-wrap items-center gap-x-1 text-sm">
        {trail.map((crumb, i) => (
          <li
            key={`${i}-${crumb.label}`}
            className="flex min-w-0 items-center gap-x-1"
          >
            {i > 0 && (
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
                className="shrink-0 text-[var(--admin-text-mute)]"
              >
                <path d="m9 6 6 6-6 6" />
              </svg>
            )}
            {crumb.href ? (
              <Link
                href={crumb.href}
                className="inline-flex min-h-8 items-center truncate rounded-md px-1 text-[var(--admin-text-soft)] underline-offset-4 hover:text-[var(--admin-primary)] hover:underline"
              >
                {crumb.label}
              </Link>
            ) : (
              <span
                aria-current="page"
                className="inline-flex min-h-8 items-center truncate px-1 font-medium text-[var(--admin-text)]"
              >
                {crumb.label}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
