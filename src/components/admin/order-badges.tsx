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

const CHANNEL_TONE: Record<OrderChannel, string> = {
  web: "bg-neutral-100 text-neutral-600",
  app: "bg-emerald-50 text-emerald-700",
};

const FULFILLMENT_TONE: Record<OrderFulfillment, string> = {
  shipping: "bg-indigo-50 text-indigo-700",
  pickup: "bg-amber-50 text-amber-700",
  delivery: "bg-sky-50 text-sky-700",
  table: "bg-rose-50 text-rose-700",
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
  const pill =
    "rounded-full px-2.5 py-0.5 text-[10px] tracking-[0.18em] uppercase";
  return (
    <>
      <span className={`${pill} ${CHANNEL_TONE[channel]}`}>
        {ORDER_CHANNEL_LABELS[channel]}
        {kind === "cafe" ? ` · ${ORDER_KIND_LABELS[kind]}` : ""}
      </span>
      <span className={`${pill} ${FULFILLMENT_TONE[fulfillment]}`}>
        {ORDER_FULFILLMENT_LABELS[fulfillment]}
        {table ? ` · ${table.name || table.code}` : ""}
      </span>
    </>
  );
}
