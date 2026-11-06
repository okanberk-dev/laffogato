import { type MixPart } from "@/lib/admin/dashboard-core";

import { DonutChart, type DonutSlice } from "../arc/donut-chart";
import { WidgetCard } from "./widget-card";

/** A part of the mix with its count and the list it counts. */
export type CountedPart = MixPart & { count: number; href: string };

/**
 * Each part's colour: the panel's own inks (admin/layout.tsx), never the
 * only cue (the legend names every part with its count and share).
 */
const COLORS: Readonly<Record<string, string>> = {
  app: "var(--admin-primary)",
  web: "var(--admin-info)",
  manuel: "var(--admin-hue-amber)",
  table: "var(--admin-success)",
  pickup: "var(--admin-primary)",
  shipping: "var(--admin-accent)",
  delivery: "var(--admin-hue-amber)",
};

const slices = (parts: readonly CountedPart[]): DonutSlice[] =>
  parts.map((p) => ({
    key: p.key,
    label: p.label,
    value: p.count,
    color: COLORS[p.key] ?? "var(--admin-text-mute)",
    href: p.href,
  }));

/**
 * The last seven days' orders by channel (app, web, the panel) and by how
 * they were handed over (table, pickup, parcel, courier), as two Arc
 * donuts for owner and manager. Counted from the order list's own filters
 * ("Raporda sayılan" in "Son 7 gün"), so every row opens the orders it
 * counts. Server-safe.
 */
export function OrderMixWidget({
  channel,
  fulfillment,
  allHref,
}: {
  channel: readonly CountedPart[];
  fulfillment: readonly CountedPart[];
  allHref: string;
}) {
  return (
    <WidgetCard
      title="Son 7 gün: kanal ve teslimat"
      href={allHref}
      linkLabel="Siparişler"
    >
      <div className="grid gap-6 md:grid-cols-2">
        <section aria-label="Kanal" className="min-w-0">
          <h3 className="mb-2 text-[13px] font-medium text-[var(--admin-text-soft)]">
            Kanal
          </h3>
          <DonutChart
            label="Son 7 günün siparişleri, kanala göre"
            slices={slices(channel)}
            totalLabel="Sipariş"
            emptyLabel="Son 7 günde sayılan sipariş yok."
          />
        </section>
        <section aria-label="Teslimat" className="min-w-0">
          <h3 className="mb-2 text-[13px] font-medium text-[var(--admin-text-soft)]">
            Teslimat
          </h3>
          <DonutChart
            label="Son 7 günün siparişleri, teslimata göre"
            slices={slices(fulfillment)}
            totalLabel="Sipariş"
            emptyLabel="Son 7 günde sayılan sipariş yok."
          />
        </section>
      </div>
      <p className="mt-3 text-xs text-[var(--admin-text-mute)]">
        Raporda sayılan siparişler: iptal ve ödeme bekleyen hariç.
      </p>
    </WidgetCard>
  );
}
