import type { ReactNode } from "react";

import { cx } from "@/components/laffogato/cx";

/**
 * How wide a panel page is. Three widths instead of the six the pages
 * picked one by one (7xl, 6xl, 5xl, 4xl, 3xl, md), so the content edge
 * stays put from page to page:
 *
 * - `list`: tables and dashboards
 * - `detail`: one record (an order, a booking)
 * - `form`: one form, read top to bottom
 */
export type PageWidth = "list" | "detail" | "form";

/** Written out in full for Tailwind's scanner. */
export const PAGE_WIDTHS: Record<PageWidth, string> = {
  list: "max-w-7xl",
  detail: "max-w-6xl",
  form: "max-w-3xl",
};

export interface PageShellProps {
  /** Default `list`. */
  width?: PageWidth;
  className?: string;
  /** PageHeader first, then the page. */
  children: ReactNode;
}

/**
 * A panel page's `<main>`: one of three widths, the panel's padding and a
 * 20px gap under the PageHeader (from `sm` up the pages had 40px above the
 * title and 32px under the header). The shell's "İçeriğe geç" link lands on
 * the layout's focusable wrapper (`#admin-main`), so this element carries no
 * id: two would repeat it. A page has exactly one PageShell. Server- and
 * client-safe (no hooks).
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
    <main
      className={cx(
        "mx-auto w-full px-4 py-6 sm:px-6 sm:py-8 [&>header]:mb-5",
        PAGE_WIDTHS[width],
        className,
      )}
    >
      {children}
    </main>
  );
}
