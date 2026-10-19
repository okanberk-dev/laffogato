import Link from "next/link";
import type { ReactNode } from "react";

/**
 * "← Kampanyalar": the way back over a sub-page, in the Masalar and karaoke
 * pages' look (44 px tall). The composer, the new and edit pages and the
 * view pages had only the sidebar or a "Vazgeç" at the very bottom (admin
 * audit PEO-23). Server- and client-safe.
 */
export function BackLink({
  href,
  children,
}: {
  href: string;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      className="mb-4 inline-flex min-h-[44px] items-center gap-1 text-sm text-[var(--admin-text-soft)] underline-offset-4 hover:text-[var(--admin-primary)] hover:underline focus-visible:rounded focus-visible:ring-2 focus-visible:ring-[var(--admin-accent)]/45 focus-visible:outline-none"
    >
      <span aria-hidden="true">←</span>
      {children}
    </Link>
  );
}
