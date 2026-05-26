import Link from "next/link";
import { notFound } from "next/navigation";

import {
  Card,
  PageHeader,
  formatDateTime,
  formatTRY,
} from "@/components/admin/forms";
import { requireRole } from "@/lib/admin/auth";
import {
  customerOrdersByEmail,
  type AdminOrderStatus,
} from "@/lib/admin/store";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ email: string }>;
}

const STATUS_LABEL: Record<AdminOrderStatus, string> = {
  pending_payment: "Ödeme bekleniyor",
  paid: "Ödendi",
  preparing: "Hazırlanıyor",
  shipped: "Kargoda",
  completed: "Tamamlandı",
  cancelled: "İptal",
  refunded: "İade",
};

const STATUS_TONE: Record<AdminOrderStatus, string> = {
  pending_payment: "bg-amber-50 text-amber-700",
  paid: "bg-blue-50 text-blue-700",
  preparing: "bg-purple-50 text-purple-700",
  shipped: "bg-indigo-50 text-indigo-700",
  completed: "bg-green-50 text-green-700",
  cancelled: "bg-neutral-100 text-neutral-500",
  refunded: "bg-rose-50 text-rose-700",
};

export async function generateMetadata({ params }: PageProps) {
  const { email } = await params;
  return { title: `Admin · Müşteri ${decodeURIComponent(email)}` };
}

export default async function CustomerDetailPage({ params }: PageProps) {
  await requireRole("customers");
  const { email: raw } = await params;
  const email = decodeURIComponent(raw);
  const orders = await customerOrdersByEmail(email);
  if (orders.length === 0) notFound();

  const totalSpent = orders.reduce((s, o) => s + o.totalMinor, 0);
  const totalRefunded = orders.reduce(
    (s, o) => s + o.refunds.reduce((r, x) => r + x.amountMinor, 0),
    0,
  );
  const first = orders[orders.length - 1];
  const last = orders[0];

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <PageHeader
        eyebrow="Müşteri"
        title={last.customerName || email}
        description={`${email}${last.customerPhone ? ` · ${last.customerPhone}` : ""}`}
        action={
          <Link
            href="/admin/musteriler"
            className="inline-flex items-center justify-center gap-2 rounded-full border border-neutral-200 px-4 py-2 text-xs text-neutral-700 hover:border-neutral-900 hover:text-neutral-900"
          >
            ← Tüm müşteriler
          </Link>
        }
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-4">
        <Stat label="Sipariş" value={String(orders.length)} />
        <Stat label="Lifetime value" value={formatTRY(totalSpent)} />
        <Stat
          label="İade"
          value={totalRefunded > 0 ? `−${formatTRY(totalRefunded)}` : "—"}
          tone={totalRefunded > 0 ? "warn" : undefined}
        />
        <Stat label="İlk sipariş" value={formatDateTime(first.createdAt)} small />
      </div>

      <Card>
        <h2
          className="mb-4 text-[10px] uppercase tracking-[0.22em] text-neutral-500"
          style={{ fontFamily: "var(--mono), monospace" }}
        >
          Sipariş geçmişi
        </h2>
        <table className="w-full text-sm">
          <thead>
            <tr
              className="border-b border-neutral-200 text-left text-[10px] uppercase tracking-[0.22em] text-neutral-500"
              style={{ fontFamily: "var(--mono), monospace" }}
            >
              <th className="py-3 pr-3">Sipariş</th>
              <th className="pr-3">Tarih</th>
              <th className="pr-3">Durum</th>
              <th className="pr-3">Kalemler</th>
              <th className="pr-3 text-right">Tutar</th>
              <th className="text-right">—</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((o) => {
              const refundedHere = o.refunds.reduce(
                (s, r) => s + r.amountMinor,
                0,
              );
              return (
                <tr
                  key={o.id}
                  className="border-b border-neutral-100 last:border-b-0 align-top"
                >
                  <td
                    className="py-3 pr-3 font-medium text-neutral-900"
                    style={{ fontFamily: "var(--mono), monospace" }}
                  >
                    #{o.orderNo}
                  </td>
                  <td
                    className="pr-3 text-xs text-neutral-500"
                    style={{ fontFamily: "var(--mono), monospace" }}
                  >
                    {formatDateTime(o.createdAt)}
                  </td>
                  <td className="pr-3">
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-[10px] uppercase tracking-[0.18em] ${STATUS_TONE[o.status]}`}
                    >
                      {STATUS_LABEL[o.status]}
                    </span>
                  </td>
                  <td className="pr-3 text-xs text-neutral-700">
                    {o.items
                      .map((it) => `${it.productName} × ${it.qty}`)
                      .join(" · ")}
                  </td>
                  <td
                    className="pr-3 text-right text-neutral-900"
                    style={{ fontFamily: "var(--mono), monospace" }}
                  >
                    {formatTRY(o.totalMinor)}
                    {refundedHere > 0 && (
                      <div className="text-[10px] text-rose-600">
                        −{formatTRY(refundedHere)} iade
                      </div>
                    )}
                  </td>
                  <td className="text-right">
                    <Link
                      href={`/admin/siparisler/${o.id}`}
                      className="inline-flex items-center justify-center rounded-full border border-neutral-200 px-3 py-1.5 text-xs text-neutral-700 hover:border-neutral-900 hover:text-neutral-900"
                    >
                      Detay →
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>
    </main>
  );
}

function Stat({
  label,
  value,
  tone,
  small,
}: {
  label: string;
  value: string;
  tone?: "warn";
  small?: boolean;
}) {
  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
      <div
        className="text-[10px] uppercase tracking-[0.22em] text-neutral-500"
        style={{ fontFamily: "var(--mono), monospace" }}
      >
        {label}
      </div>
      <div
        className={`mt-1 ${small ? "text-sm" : "text-xl"} ${
          tone === "warn" ? "text-rose-700" : "text-neutral-900"
        }`}
        style={{ fontFamily: "var(--mono), monospace" }}
      >
        {value}
      </div>
    </div>
  );
}
