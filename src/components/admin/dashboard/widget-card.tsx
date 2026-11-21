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
      // StorageBox's card button: a small white pill with a thin line.
      className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-full border border-[var(--admin-border-strong)] bg-[var(--admin-surface)] px-4 text-[13px] font-medium whitespace-nowrap text-[var(--admin-text)] transition-colors hover:bg-[var(--admin-surface-2)] focus-visible:ring-[3px] focus-visible:ring-[var(--admin-ring)] focus-visible:outline-none pointer-fine:min-h-8"
    >
      {children} <span aria-hidden="true">→</span>
    </Link>
  );
}

/**
 * The frame of a dashboard widget (StorageBox's card): its title in DM
 * Sans, an optional "Tümünü gör" pill to the list behind it, and the body.
 * Server-safe.
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
      <div className="-mt-1 mb-4 flex min-h-9 flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <h2 className={CARD_TITLE}>{title}</h2>
        {href ? <WidgetLink href={href}>{linkLabel}</WidgetLink> : null}
      </div>
      {children}
    </Card>
  );
}
