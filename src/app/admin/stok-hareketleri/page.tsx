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
  manual_adjust: "Manuel düzeltme",
  refund_restock: "İade · stoğa geri",
  seed: "Açılış",
};

const REASON_TONE: Record<StockMoveReason, string> = {
  order_placed: "bg-blue-50 text-blue-700",
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
    <main className="mx-auto max-w-7xl px-6 py-10">
      <PageHeader
        eyebrow="Operasyon"
        title="Stok Hareketleri"
        description="Her satış, iade veya manuel düzeltme bir hareket olarak kaydedilir. Burada denetim izini görürsün."
      />

      <div className="mb-4">
        <StockAdjustForm products={products} />
      </div>

      <Card className="mb-4">
        <form className="flex flex-wrap items-end gap-3">
          <label className="grid gap-1">
            <span
              className="text-[10px] uppercase tracking-[0.22em] text-neutral-500"
              style={{ fontFamily: "var(--mono), monospace" }}
            >
              Ürün
            </span>
            <select
              name="productId"
              defaultValue={productId ?? ""}
              className="rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm focus:border-neutral-900 focus:bg-white focus:outline-none"
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
              className="text-[10px] uppercase tracking-[0.22em] text-neutral-500"
              style={{ fontFamily: "var(--mono), monospace" }}
            >
              Sebep
            </span>
            <select
              name="reason"
              defaultValue={reason ?? ""}
              className="rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm focus:border-neutral-900 focus:bg-white focus:outline-none"
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
            className="rounded-full bg-neutral-900 px-4 py-2 text-xs font-medium text-white hover:bg-neutral-800"
          >
            Uygula
          </button>
          <Link
            href="/admin/stok-hareketleri"
            className="rounded-full border border-neutral-200 px-4 py-2 text-xs text-neutral-700 hover:border-neutral-900 hover:text-neutral-900"
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
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr
                  className="border-b border-neutral-200 text-left text-[10px] uppercase tracking-[0.22em] text-neutral-500"
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
                        className={`rounded-full px-2 py-0.5 text-[10px] uppercase tracking-[0.18em] ${REASON_TONE[m.reason]}`}
                      >
                        {REASON_LABEL[m.reason]}
                      </span>
                    </td>
                    <td className="pr-3 text-xs text-neutral-600 max-w-md">
                      {m.note || "—"}
                      {m.orderId && (
                        <>
                          {" "}
                          <Link
                            href={`/admin/siparisler/${m.orderId}`}
                            className="text-neutral-500 underline-offset-2 hover:text-neutral-900 hover:underline"
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
        )}
      </Card>
    </main>
  );
}
