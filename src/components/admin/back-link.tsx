import type { ReactNode } from "react";

import { cx } from "@/components/laffogato/cx";
import Link from "@/components/link";

/**
 * "← Kampanyalar": the way back over a sub-page, in the Masalar and karaoke
 * pages' look (44 px tall). The composer, the new and edit pages and the
 * view pages had only the sidebar or a "Vazgeç" at the very bottom (admin
 * audit PEO-23). Every sub-page draws it the same way, above its header
 * (21 Oct 2026: four looks, two of them header buttons). Server- and
 * client-safe.
 *
 * `data-admin-back` tells the shell the page has its own way back: on a
 * phone the breadcrumb row under the top bar ("Siparişler > Ayrıntı") then
 * stays hidden, the same link twice in the first screen
 * (admin-sidebar.tsx).
 */
export function BackLink({
  href,
  children,
  className,
}: {
  href: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Link
      href={href}
      data-admin-back=""
      className={cx(
        "mb-4 inline-flex min-h-11 items-center gap-1 text-sm text-[var(--admin-text-soft)] underline-offset-4 hover:text-[var(--admin-primary)] hover:underline focus-visible:rounded focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]/45 focus-visible:outline-none pointer-fine:min-h-9",
        className,
      )}
    >
      <span aria-hidden="true">←</span>
      {children}
    </Link>
  );
}
