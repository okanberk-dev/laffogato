import type { ReactNode } from "react";

import { cx } from "@/components/laffogato/cx";
import { orderStatusLabel, orderStatusTone } from "@/lib/admin/order-ui";
import type { AdminOrderStatus } from "@/lib/admin/store";
import type { AdminTone } from "@/lib/admin/tone";

import { TONE_DOT, TONE_SOFT } from "./tone";

export interface BadgeProps {
  /** What it means; default `neutral`. */
  tone?: AdminTone;
  /** A small solid dot before the text, for a status read at a glance. */
  dot?: boolean;
  /** Native tooltip, e.g. the full date behind "3 gün önce". */
  title?: string;
  className?: string;
  children: ReactNode;
}

/**
 * The panel's pill. Server- and client-safe (no hooks).
 *
 * 11px sentence case, AkmanOS's pill (21 Eki 2026): the text reads as
 * written ("Ödeme bekleniyor"), not as 10px capitals with wide tracking. The tone pairs are the same, so the
 * contrast tests hold.
 *
 * @example <Badge tone="warning">Ödeme bekleniyor</Badge>
 */
export function Badge({
  tone = "neutral",
  dot = false,
  title,
  className,
  children,
}: BadgeProps) {
  return (
    <span
      title={title}
      className={cx(
        "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] leading-4 font-medium whitespace-nowrap",
        TONE_SOFT[tone],
        className,
      )}
    >
      {dot ? (
        <span
          aria-hidden="true"
          className={cx("h-1.5 w-1.5 rounded-full", TONE_DOT[tone])}
        />
      ) : null}
      {children}
    </span>
  );
}

/**
 * An order's status badge, in the order's own words ("Hazır" for a shipped
 * pickup order) and the shared tone (lib/admin/order-ui.ts).
 */
export function OrderStatusBadge({
  order,
  className,
}: {
  order: { status: AdminOrderStatus; fulfillment?: string };
  className?: string;
}) {
  return (
    <Badge tone={orderStatusTone(order)} className={className}>
      {orderStatusLabel(order)}
    </Badge>
  );
}
