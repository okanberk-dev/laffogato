import {
  ORDER_CHANNEL_LABELS,
  ORDER_FULFILLMENT_LABELS,
  ORDER_KIND_LABELS,
  orderChannel,
  orderFulfillment,
  orderKind,
  orderTable,
  type OrderChannel,
  type OrderFulfillment,
} from "@/lib/admin/order-channel";
import type { AdminTone } from "@/lib/admin/tone";

import { Badge } from "./ui/badge";

// The kit's tones (ui/tone.ts, each ink AA on its ground), not the raw
// Tailwind palette the pills used to carry; Badge keeps a pill on one line,
// where "Masaya servis · Bahçe 5" wrapped into a three-line capsule in the
// Kanal column (admin audit ORD-22).
export const CHANNEL_TONE: Record<OrderChannel, AdminTone> = {
  web: "neutral",
  app: "success",
};

export const FULFILLMENT_TONE: Record<OrderFulfillment, AdminTone> = {
  shipping: "info",
  pickup: "warning",
  delivery: "primary",
  table: "accent",
};

interface Props {
  order: {
    channel?: string;
    kind?: string;
    fulfillment?: string;
    tableCode?: string;
    tableName?: string;
  };
}

/**
 * Channel + fulfillment badges for an order. Client-safe (no server-only
 * import) so the orders list, a client component, can render it. Rows written
 * before the columns existed read as Web · Kargo through the defaulting
 * helpers rather than showing an empty badge.
 */
export function OrderChannelBadges({ order }: Props) {
  const channel = orderChannel(order);
  const fulfillment = orderFulfillment(order);
  const kind = orderKind(order);
  const table = orderTable(order);
  return (
    <>
      <Badge tone={CHANNEL_TONE[channel]}>
        {ORDER_CHANNEL_LABELS[channel]}
        {kind === "cafe" ? ` · ${ORDER_KIND_LABELS[kind]}` : ""}
      </Badge>
      {/* A long table name is cut, not wrapped: the full name is the title. */}
      <Badge
        tone={FULFILLMENT_TONE[fulfillment]}
        title={table ? table.name || table.code : undefined}
        className="max-w-full min-w-0"
      >
        <span className="truncate">
          {ORDER_FULFILLMENT_LABELS[fulfillment]}
          {table ? ` · ${table.name || table.code}` : ""}
        </span>
      </Badge>
    </>
  );
}
