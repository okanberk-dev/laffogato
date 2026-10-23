import Link from "next/link";

import { cx } from "@/components/laffogato/cx";

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
      className={cx(
        "inline-flex max-w-full [scrollbar-width:none] overflow-x-auto rounded-lg bg-[var(--admin-panel)] p-0.5 [&::-webkit-scrollbar]:hidden",
        className,
      )}
    >
      {options.map((o) => (
        <Link
          key={o.href}
          href={o.href}
          aria-current={o.current ? "page" : undefined}
          className={cx(
            "relative inline-flex min-h-9 shrink-0 items-center justify-center rounded-md px-3 text-[13px] font-medium whitespace-nowrap transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]/40 focus-visible:outline-none pointer-coarse:min-h-11",
            COMPACT.minH8,
            o.current
              ? "bg-[var(--admin-surface)] text-[var(--admin-text)] shadow-[0_1px_2px_rgba(12,14,27,0.08),0_0_0_1px_rgba(12,14,27,0.04)]"
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
