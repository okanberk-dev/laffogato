import Link from "next/link";
import type { ReactNode } from "react";

import { Card } from "../forms";

/**
 * The frame of a dashboard widget: a heading, an optional "Tümünü gör"
 * link to the list behind it, and the body. Server-safe; the same look as
 * the karaoke card beside it.
 */
export function WidgetCard({
  title,
  href,
  linkLabel = "Tümünü gör",
  children,
}: {
  title: string;
  href?: string | null;
  linkLabel?: string;
  children: ReactNode;
}) {
  return (
    <Card className="min-w-0">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <h2 className="text-base font-semibold tracking-tight text-[var(--admin-text)]">
          {title}
        </h2>
        {href ? (
          <Link
            href={href}
            className="inline-flex min-h-[44px] items-center gap-1 text-sm text-[var(--admin-text-soft)] underline-offset-4 hover:text-[var(--admin-primary)] hover:underline"
          >
            {linkLabel} <span aria-hidden="true">→</span>
          </Link>
        ) : null}
      </div>
      {children}
    </Card>
  );
}
