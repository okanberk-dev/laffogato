import { cx } from "@/components/laffogato/cx";
import Link from "@/components/link";

import { LinkPending } from "./link-pending";
import { COMPACT } from "./styles";

export interface SegmentOption {
  href: string;
  label: string;
  current: boolean;
}

/**
 * Innex's segment control (22 Eki 2026): a grey rail, the chosen option a
 * white pill with a soft shadow. For one choice between a few views of the
 * same page (Raporlar's period, Karaoke's list or calendar), not for a
 * list's statuses (StatusTabs). Links, so it works before hydration and a
 * view can be linked to; a clicked option marks itself while its page
 * loads. 36 px tall, 44 on a touch screen, 32 in "Sıkı görünüm".
 * Server-safe.
 */
export function SegmentedLinks({
  label,
  options,
  className,
}: {
  /** The control's accessible name ("Dönem"). */
  label: string;
  options: readonly SegmentOption[];
  className?: string;
}) {
  return (
    <nav
      aria-label={label}
      data-focus-inset=""
      className={cx(
        "inline-flex max-w-full [scrollbar-width:none] gap-0.5 overflow-x-auto rounded-full border border-[var(--admin-border-strong)] bg-[var(--admin-surface)] p-0.5 [&::-webkit-scrollbar]:hidden",
        className,
      )}
    >
      {options.map((o) => (
        <Link
          key={o.href}
          href={o.href}
          aria-current={o.current ? "page" : undefined}
          className={cx(
            "relative inline-flex min-h-9 shrink-0 items-center justify-center rounded-full px-4 text-sm whitespace-nowrap transition-colors duration-150 focus-visible:ring-[3px] focus-visible:ring-[var(--admin-ring)] focus-visible:outline-none pointer-coarse:min-h-11",
            COMPACT.minH8,
            o.current
              ? "bg-[var(--admin-surface-2)] font-medium text-[var(--admin-text)]"
              : "text-[var(--admin-text-mute)] hover:text-[var(--admin-text)]",
          )}
        >
          {o.label}
          <LinkPending className="bottom-1" />
        </Link>
      ))}
    </nav>
  );
}
