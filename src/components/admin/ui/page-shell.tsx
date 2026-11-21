import type { ReactNode } from "react";

import { cx } from "@/components/laffogato/cx";

/**
 * How wide a panel page's content runs. Three widths instead of the six the
 * pages picked one by one (7xl, 6xl, 5xl, 4xl, 3xl, md), so the content
 * edge stays put from page to page:
 *
 * - `list`: tables and dashboards, the page card's full width
 * - `detail`: one record (an order, a booking)
 * - `form`: one form, read top to bottom
 *
 * Innex (22 Eki 2026): the page sits in a white card, its header strip runs
 * the card's full width and the content starts at the card's left edge, so
 * a width caps each block under the header instead of centring the page.
 */
export type PageWidth = "list" | "detail" | "form";

/** Written out in full for Tailwind's scanner. */
export const PAGE_WIDTHS: Record<PageWidth, string> = {
  list: "",
  detail: "[&>:not(header)]:max-w-6xl",
  form: "[&>:not(header)]:max-w-3xl",
};

/**
 * The page's own padding: 16 px on a phone, 20 px from `sm`, 24 px from
 * `lg` (the frame's side padding, StorageBox), lined up with the top bar.
 * The pages that draw their own `<main>` use the same string.
 */
export const PAGE_PAD =
  "w-full px-4 pt-5 pb-10 sm:px-5 lg:px-6 lg:pt-6 lg:px-6 lg:pt-6";

export interface PageShellProps {
  /** Default `list`. */
  width?: PageWidth;
  className?: string;
  /** PageHeader first, then the page. */
  children: ReactNode;
}

/**
 * A panel page's `<main>`: Innex's padding, one of three content widths and
 * a 20px gap under the PageHeader strip. The shell's "İçeriğe geç" link
 * lands on the layout's focusable wrapper (`#admin-main`), so this element
 * carries no id: two would repeat it. A page has exactly one PageShell.
 * Server- and client-safe (no hooks).
 *
 * @example
 * <PageShell width="list">
 *   <PageHeader title="Siparişler" primary={{ href: "/admin/siparisler/yeni", label: "Yeni sipariş" }} />
 *   <StatusTabs ... />
 * </PageShell>
 */
export function PageShell({
  width = "list",
  className,
  children,
}: PageShellProps) {
  return (
    <main className={cx(PAGE_PAD, PAGE_WIDTHS[width], className)}>
      {children}
    </main>
  );
}
