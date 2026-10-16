import Link from "next/link";

import { Card, PageHeader } from "@/components/admin/forms";
import { OrdersList } from "@/components/admin/orders-list";
import { requireRole } from "@/lib/admin/auth";
import { ORDER_STATUSES, ORDER_STATUS_LABELS } from "@/lib/admin/order-ui";
import {
  BULK_ORDER_TRANSITIONS,
  listOrdersPage,
  type AdminOrderStatus,
} from "@/lib/admin/store";

export const metadata = { title: "Admin · Siparişler" };
export const dynamic = "force-dynamic";

// Only the statuses `bulkUpdateOrders` can actually reach, derived from the
// store so the dropdown can never drift back to offering `paid`/`refunded`.
// Labels are the shared ones (lib/admin/order-ui.ts).
const BULK_STATUS_OPTIONS: Array<[AdminOrderStatus, string]> =
  ORDER_STATUSES.filter((k) => BULK_ORDER_TRANSITIONS[k] !== undefined).map(
    (k) => [k, ORDER_STATUS_LABELS[k]],
  );

interface PageProps {
  /** `once`: show orders numbered below this one (the next, older page). */
  searchParams: Promise<{ once?: string }>;
}

/** A positive integer `orderNo`, or null for anything else (first page). */
function parseBefore(raw: string | undefined): number | null {
  if (!raw || !/^\d{1,9}$/.test(raw)) return null;
  const n = Number(raw);
  return n > 0 ? n : null;
}

export default async function AdminOrdersPage({ searchParams }: PageProps) {
  await requireRole("orders");
  const before = parseBefore((await searchParams).once);
  // One page, not the table (WP1): every order used to be read with all its
  // jsonb and rendered into the client list - 27 MB of JSON at 20k orders.
  const { orders, total, nextBefore } = await listOrdersPage({ before });

  return (
    <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-10">
      <PageHeader
        eyebrow="E-ticaret"
        title="Siparişler"
        description="Birden fazla seçerek toplu durum güncellemesi yapabilir ya da elle yeni sipariş girebilirsin."
        action={
          <Link
            href="/admin/siparisler/yeni"
            className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-[var(--admin-primary)] px-5 py-2.5 text-sm font-medium text-white hover:bg-[var(--admin-primary-hover)] sm:w-auto"
          >
            + Yeni sipariş
          </Link>
        }
      />

      {orders.length === 0 ? (
        <Card>
          <p className="text-sm text-neutral-500">
            {before === null ? "Henüz sipariş yok." : "Bu sayfada sipariş yok."}
          </p>
        </Card>
      ) : (
        <OrdersList
          orders={orders}
          total={total}
          live={before === null}
          bulkStatusOptions={BULK_STATUS_OPTIONS}
        />
      )}

      {(before !== null || nextBefore !== null) && (
        <nav
          aria-label="Sipariş sayfaları"
          className="mt-6 flex flex-wrap items-center justify-between gap-3 text-sm"
        >
          {before !== null ? (
            <Link
              href="/admin/siparisler"
              className="rounded-xl border border-[var(--admin-border)] bg-white px-4 py-2 hover:bg-neutral-50"
            >
              En yeni siparişler
            </Link>
          ) : (
            <span />
          )}
          {nextBefore !== null && (
            <Link
              href={`/admin/siparisler?once=${nextBefore}`}
              className="rounded-xl border border-[var(--admin-border)] bg-white px-4 py-2 hover:bg-neutral-50"
            >
              Daha eski siparişler
            </Link>
          )}
        </nav>
      )}
    </main>
  );
}
