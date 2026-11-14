import { cx } from "@/components/laffogato/cx";
import Link from "@/components/link";
import type { AdminTone } from "@/lib/admin/tone";

import { HUE_INK, HUE_SOFT, type AdminHue } from "../ui/hues";
import { AdminIcon, type AdminIconName } from "../ui/icons";
import { TONE_INK } from "../ui/tone";
import {
  CARD as CARD_FRAME,
  EYEBROW,
  MONO_STYLE,
  NUMERIC_STYLE,
} from "../ui/styles";

const CARD = `@container flex min-w-0 flex-col gap-2 p-4 print:border-[var(--admin-border-strong)] ${CARD_FRAME}`;

/**
 * A figure on a tile: the dashboard's and the report's. Server-safe.
 *
 * Innex's KPI cell (22 Eki 2026): a white card, a small tinted icon box
 * beside the label, the figure in 24 px bold under them and a grey line
 * under that. The tile is `min-w-0` inside its grid cell: "₺123.456,78"
 * ran 17 px past its card on a phone and past the grid on a laptop (admin
 * audit SHE-06, SYS-15). A money figure is never cut short: its size
 * follows the tile's width (`cqi`), so "₺1.272.103,89" stays on one line
 * in a phone's half-width tile, and only a still longer amount wraps. The
 * hint wraps too; it can carry an amount. With `href` the whole tile is a
 * link to the list it counts (admin audit SHE-31). With `icon` the box
 * names the figure at a glance; its ink is the value's tone when it has
 * one, so a figure that asks for a person shows it twice. With `hue` the
 * box takes that colour (ui/hues.ts); without, it is grey.
 */
export function StatCard({
  label,
  value,
  hint,
  href,
  tone,
  money = false,
  icon,
  hue,
}: {
  label: string;
  value: string;
  hint?: string;
  href?: string;
  /** Colours the value: the figure asks for a person. */
  tone?: AdminTone;
  /** Tabular digits, and no truncation. */
  money?: boolean;
  /** Decorative: the label names the figure. */
  icon?: AdminIconName;
  /** The icon box's colour; grey without. */
  hue?: AdminHue;
}) {
  const body = (
    <>
      <span className="flex min-w-0 items-center gap-2">
        {icon ? (
          <span
            aria-hidden="true"
            className={cx(
              "grid size-7 shrink-0 place-items-center rounded-lg print:hidden",
              hue ? HUE_SOFT[hue] : "bg-[var(--admin-panel)]",
              tone
                ? TONE_INK[tone]
                : hue
                  ? HUE_INK[hue]
                  : "text-[var(--admin-text-soft)]",
            )}
          >
            <AdminIcon name={icon} size={16} />
          </span>
        ) : null}
        <span className={cx(EYEBROW, "truncate")} style={MONO_STYLE}>
          {label}
        </span>
      </span>
      <span
        title={value}
        className={cx(
          "leading-tight font-bold tracking-[-0.01em]",
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
        <span className="text-xs break-words text-[var(--admin-text-mute)]">
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
        "transition-colors duration-150 hover:border-[var(--admin-border-field)] hover:bg-[var(--admin-surface-2)]",
        "focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]/40 focus-visible:outline-none",
      )}
    >
      {body}
    </Link>
  );
}
