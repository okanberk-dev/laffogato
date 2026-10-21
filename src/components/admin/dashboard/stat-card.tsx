import Link from "next/link";

import { cx } from "@/components/laffogato/cx";
import type { AdminTone } from "@/lib/admin/tone";

import { TONE_INK } from "../ui/tone";
import { EYEBROW, MONO_STYLE, NUMERIC_STYLE } from "../ui/styles";

const CARD =
  "@container flex min-w-0 flex-col gap-1.5 rounded-2xl bg-[var(--admin-panel)] p-4";

/**
 * A figure on a tile: the dashboard's and the report's. Server-safe.
 *
 * The value is the kit's stat size (as on the karaoke card), not the old
 * 30 px faux-italic serif, and the tile is `min-w-0` inside its grid cell:
 * "₺123.456,78" ran 17 px past its card on a phone and past the grid on a
 * laptop (admin audit SHE-06, SYS-15). A money figure is never cut short:
 * its size follows the tile's width (`cqi`), so "₺1.272.103,89" stays on
 * one line in a phone's half-width tile, and only a still longer amount
 * wraps. The hint wraps too; it can carry an amount. With `href` the
 * whole tile is a link to the list it counts (admin audit SHE-31).
 */
export function StatCard({
  label,
  value,
  hint,
  href,
  tone,
  money = false,
}: {
  label: string;
  value: string;
  hint?: string;
  href?: string;
  /** Colours the value: the figure asks for a person. */
  tone?: AdminTone;
  /** Tabular digits, and no truncation. */
  money?: boolean;
}) {
  const body = (
    <>
      <span className={cx(EYEBROW, "truncate")} style={MONO_STYLE}>
        {label}
      </span>
      <span
        title={value}
        className={cx(
          "leading-tight font-semibold tracking-tight",
          money
            ? "text-[clamp(1rem,11cqi,1.5rem)] [overflow-wrap:anywhere]"
            : "truncate text-xl sm:text-2xl",
          tone ? TONE_INK[tone] : "text-[var(--admin-text)]",
        )}
        style={money ? NUMERIC_STYLE : undefined}
      >
        {value}
      </span>
      {hint ? (
        <span className="text-xs break-words text-[var(--admin-text-soft)]">
          {hint}
        </span>
      ) : null}
    </>
  );
  if (!href) return <div className={CARD}>{body}</div>;
  return (
    <Link
      href={href}
      className={cx(
        CARD,
        "transition-colors hover:bg-[var(--admin-primary-soft)] focus-visible:ring-2 focus-visible:ring-[var(--admin-accent)]/45 focus-visible:outline-none",
      )}
    >
      {body}
    </Link>
  );
}
