"use client";

import { useLinkStatus } from "next/link";

import { cx } from "@/components/laffogato/cx";

/**
 * A click's answer on a list link: a status tab, a page number, a sort
 * header. The lists are dynamic pages that read many rows, and after a
 * click the old list stayed on screen with no sign that anything was
 * happening, so operators clicked again (admin audit ORD-17, KAR-19).
 *
 * Render it inside a `<Link>` that is `relative`: a short bar under the
 * label fades in while that link's navigation runs. It is always there at
 * a fixed size and only changes opacity, so nothing shifts, and it waits a
 * moment before showing, so a fast page does not flicker.
 */
export function LinkPending({
  className = "bottom-1",
}: {
  /** Where the bar sits; default just inside the link's bottom edge. */
  className?: string;
}) {
  const { pending } = useLinkStatus();
  return (
    <span
      aria-hidden="true"
      data-link-pending={pending ? "" : undefined}
      className={cx(
        "pointer-events-none absolute left-1/2 h-0.5 w-4 -translate-x-1/2 rounded-full bg-current transition-opacity",
        pending ? "opacity-80 delay-150" : "opacity-0",
        className,
      )}
    />
  );
}
