import type { ReactNode } from "react";

import { Card } from "../forms";
import { CARD_TITLE } from "../ui/styles";

import Link from "@/components/link";

/**
 * A widget's link to the list behind it ("Tümünü gör →"): 44 px tall on a
 * touch screen, the arrow drawn apart from the words. The karaoke card and
 * the newest orders' table use it too.
 */
export function WidgetLink({
  href,
  children,
}: {
  href: string;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      className="-mr-1 inline-flex min-h-11 items-center gap-1 rounded-md px-1 text-[13px] font-medium text-[var(--admin-text-soft)] underline-offset-4 hover:text-[var(--admin-primary)] hover:underline focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]/40 focus-visible:outline-none pointer-fine:min-h-8"
    >
      {children} <span aria-hidden="true">→</span>
    </Link>
  );
}

/**
 * The frame of a dashboard widget (Innex's card): its title in the card's
 * 15 px semibold, an optional "Tümünü gör" link to the list behind it, and
 * the body. Server-safe.
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
      <div className="-mt-1.5 mb-3 flex min-h-8 flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <h2 className={CARD_TITLE}>{title}</h2>
        {href ? <WidgetLink href={href}>{linkLabel}</WidgetLink> : null}
      </div>
      {children}
    </Card>
  );
}
