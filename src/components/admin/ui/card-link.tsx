import Link from "next/link";
import type { ReactNode } from "react";

import { cx } from "@/components/laffogato/cx";

/**
 * The phone card's title, stretched over its card: a tap anywhere on the
 * card opens the record (21 Oct 2026; the name alone was a 21 px target).
 * Its `::after` covers the nearest positioned ancestor, DataTable's card
 * (`relative`); the card's own controls (checkbox, step buttons, ⋯) sit
 * above it (CARD_LIFT in data-table.tsx), so they keep their taps. Draw it
 * only inside a phone card: in a table row it would cover the table.
 * Server-safe.
 */
export function CardLink({
  href,
  className,
  children,
  style,
  scroll = true,
}: {
  href: string;
  className?: string;
  children: ReactNode;
  style?: React.CSSProperties;
  /** False for a card that opens a quick look over its list (`?gor=`). */
  scroll?: boolean;
}) {
  return (
    <Link
      href={href}
      scroll={scroll}
      data-card-link=""
      style={style}
      className={cx(
        className,
        "after:absolute after:inset-0 after:rounded-xl after:content-['']",
      )}
    >
      {children}
    </Link>
  );
}
