import Link from "next/link";

import { WidgetCard } from "./widget-card";

/** Shortcuts the role may open, as a list of 44 px rows. Server-safe. */
export function QuickLinks({
  links,
}: {
  links: ReadonlyArray<{ href: string; label: string }>;
}) {
  if (links.length === 0) return null;
  return (
    <WidgetCard title="Hızlı erişim">
      <ul className="flex flex-col gap-2 text-sm">
        {links.map((q) => (
          <li key={q.href}>
            <Link
              href={q.href}
              className="flex min-h-[44px] items-center justify-between gap-3 rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] px-3 py-2 text-[var(--admin-text)] hover:border-[var(--admin-primary)] hover:text-[var(--admin-primary)]"
            >
              <span className="min-w-0 truncate">{q.label}</span>
              <span aria-hidden="true">→</span>
            </Link>
          </li>
        ))}
      </ul>
    </WidgetCard>
  );
}
