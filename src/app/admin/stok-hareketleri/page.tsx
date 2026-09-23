import Link from "next/link";

import { Card, PageHeader, formatDateTime } from "@/components/admin/forms";
import { StockAdjustForm } from "@/components/admin/stock-adjust-form";
import { requireRole } from "@/lib/admin/auth";
import {
  listProducts,
  listStockMoves,
  type StockMoveReason,
} from "@/lib/admin/store";

export const metadata = { title: "Admin · Stok Hareketleri" };
export const dynamic = "force-dynamic";

const REASON_LABEL: Record<StockMoveReason, string> = {
  order_placed: "Sipariş",
  order_cancelled: "İptal · stoğa geri",
  manual_adjust: "Manuel düzeltme",
  refund_restock: "İade · stoğa geri",
  seed: "Açılış",
};

const REASON_TONE: Record<StockMoveReason, string> = {
  order_placed: "bg-blue-50 text-blue-700",
  order_cancelled: "bg-emerald-50 text-emerald-700",
  manual_adjust: "bg-amber-50 text-amber-700",
  refund_restock: "bg-emerald-50 text-emerald-700",
  seed: "bg-neutral-100 text-neutral-600",
};

interface PageProps {
  searchParams: Promise<{ productId?: string; reason?: StockMoveReason }>;
}

export default async function StockMovesPage({ searchParams }: PageProps) {
  await requireRole("stock");
  const sp = await searchParams;
  const productId = sp.productId?.trim();
  const reason = sp.reason;

  const [products, moves] = await Promise.all([
    listProducts(),
    listStockMoves({ productId, reason, limit: 500 }),
  ]);

  return (
    <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-10">
      <PageHeader
        eyebrow="Operasyon"
        title="Stok Hareketleri"
        description="Her satış, iade veya manuel düzeltme bir hareket olarak kaydedilir. Burada denetim izini görürsün."
      />

      <div className="mb-4">
        <StockAdjustForm products={products} />
      </div>

      <Card className="mb-4">
        <form className="grid gap-3 sm:grid-cols-2 sm:items-end md:grid-cols-[1fr_1fr_auto_auto]">
          <label className="grid gap-1">
            <span
              className="text-[10px] tracking-[0.22em] text-neutral-500 uppercase"
              style={{ fontFamily: "var(--mono), monospace" }}
            >
              Ürün
            </span>
            <select
              name="productId"
              defaultValue={productId ?? ""}
              className="w-full rounded-md border border-[var(--admin-border)] bg-neutral-50 px-3 py-2.5 text-base focus:border-[var(--admin-primary)] focus:bg-white focus:outline-none sm:text-sm"
            >
              <option value="">Tüm ürünler</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1">
            <span
              className="text-[10px] tracking-[0.22em] text-neutral-500 uppercase"
              style={{ fontFamily: "var(--mono), monospace" }}
            >
              Sebep
            </span>
            <select
              name="reason"
              defaultValue={reason ?? ""}
              className="w-full rounded-md border border-[var(--admin-border)] bg-neutral-50 px-3 py-2.5 text-base focus:border-[var(--admin-primary)] focus:bg-white focus:outline-none sm:text-sm"
            >
              <option value="">Tümü</option>
              {(Object.keys(REASON_LABEL) as StockMoveReason[]).map((r) => (
                <option key={r} value={r}>
                  {REASON_LABEL[r]}
                </option>
              ))}
            </select>
          </label>
          <button
            type="submit"
            className="inline-flex min-h-[44px] items-center justify-center rounded-xl bg-[var(--admin-primary)] px-4 text-sm font-medium text-white hover:bg-[var(--admin-primary-hover)]"
          >
            Uygula
          </button>
          <Link
            href="/admin/stok-hareketleri"
            className="inline-flex min-h-[44px] items-center justify-center rounded-full border border-[var(--admin-border)] px-4 text-sm text-neutral-700 hover:border-[var(--admin-primary)] hover:text-[var(--admin-primary)]"
          >
            Sıfırla
          </Link>
        </form>
      </Card>

      <Card>
        {moves.length === 0 ? (
          <p className="text-sm text-neutral-500">
            Bu filtreyle hareket bulunamadı. Yeni siparişler ve manuel
            düzeltmeler burada belirir.
          </p>
        ) : (
          <>
            {/* Mobile cards */}
            <ul className="flex flex-col gap-3 md:hidden">
              {moves.map((m) => (
                <li
                  key={m.id}
                  className="rounded-lg border border-[var(--admin-border)] p-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-medium text-neutral-900">
                        {m.productName}
                      </div>
                      <div
                        className="mt-0.5 text-[10px] text-neutral-500"
                        style={{ fontFamily: "var(--mono), monospace" }}
                      >
                        {formatDateTime(m.createdAt)} · {m.actor}
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <div
                        className={`text-base ${m.delta < 0 ? "text-red-600" : "text-emerald-700"}`}
                        style={{ fontFamily: "var(--mono), monospace" }}
                      >
                        {m.delta > 0 ? "+" : ""}
                        {m.delta}
                      </div>
                      <div
                        className="text-[10px] text-neutral-500"
                        style={{ fontFamily: "var(--mono), monospace" }}
                      >
                        → {m.stockAfter}
                      </div>
                    </div>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] tracking-[0.18em] uppercase ${REASON_TONE[m.reason]}`}
                    >
                      {REASON_LABEL[m.reason]}
                    </span>
                    {m.orderId && (
                      <Link
                        href={`/admin/siparisler/${m.orderId}`}
                        className="text-[10px] text-neutral-600 underline-offset-2 hover:text-[var(--admin-primary)] hover:underline"
                      >
                        siparişe git →
                      </Link>
                    )}
                  </div>
                  {m.note && (
                    <p className="mt-2 text-xs text-neutral-600">{m.note}</p>
                  )}
                </li>
              ))}
            </ul>

            {/* Desktop table */}
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full text-sm">
                <thead>
                  <tr
                    className="border-b border-[var(--admin-border)] text-left text-[10px] tracking-[0.22em] text-neutral-500 uppercase"
                    style={{ fontFamily: "var(--mono), monospace" }}
                  >
                    <th className="py-3 pr-3">Zaman</th>
                    <th className="pr-3">Ürün</th>
                    <th className="pr-3 text-right">Δ</th>
                    <th className="pr-3 text-right">Yeni stok</th>
                    <th className="pr-3">Sebep</th>
                    <th className="pr-3">Not</th>
                    <th className="pr-3">Aktör</th>
                  </tr>
                </thead>
                <tbody>
                  {moves.map((m) => (
                    <tr
                      key={m.id}
                      className="border-b border-neutral-100 last:border-b-0"
                    >
                      <td
                        className="py-3 pr-3 text-xs text-neutral-500"
                        style={{ fontFamily: "var(--mono), monospace" }}
                      >
                        {formatDateTime(m.createdAt)}
                      </td>
                      <td className="pr-3 text-neutral-900">{m.productName}</td>
                      <td
                        className={`pr-3 text-right ${
                          m.delta < 0 ? "text-red-600" : "text-emerald-700"
                        }`}
                        style={{ fontFamily: "var(--mono), monospace" }}
                      >
                        {m.delta > 0 ? "+" : ""}
                        {m.delta}
                      </td>
                      <td
                        className="pr-3 text-right text-neutral-700"
                        style={{ fontFamily: "var(--mono), monospace" }}
                      >
                        {m.stockAfter}
                      </td>
                      <td className="pr-3">
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] tracking-[0.18em] uppercase ${REASON_TONE[m.reason]}`}
                        >
                          {REASON_LABEL[m.reason]}
                        </span>
                      </td>
                      <td className="max-w-md pr-3 text-xs text-neutral-600">
                        {m.note || "-"}
                        {m.orderId && (
                          <>
                            {" "}
                            <Link
                              href={`/admin/siparisler/${m.orderId}`}
                              className="text-neutral-500 underline-offset-2 hover:text-[var(--admin-primary)] hover:underline"
                            >
                              siparişe git →
                            </Link>
                          </>
                        )}
                      </td>
                      <td
                        className="pr-3 text-xs text-neutral-500"
                        style={{ fontFamily: "var(--mono), monospace" }}
                      >
                        {m.actor}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </Card>
    </main>
  );
}
