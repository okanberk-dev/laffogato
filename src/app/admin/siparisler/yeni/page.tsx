import Link from "next/link";

import { Card, PageHeader } from "@/components/admin/forms";
import {
  ManualOrderForm,
  type ManualProduct,
} from "@/components/admin/manual-order-form";
import { requireRole } from "@/lib/admin/auth";
import { listProducts } from "@/lib/admin/store";

import { createManualOrderAction } from "../actions";

export const metadata = { title: "Admin · Yeni Sipariş" };
export const dynamic = "force-dynamic";

export default async function NewOrderPage() {
  await requireRole("orders");
  const all = await listProducts();

  const products: ManualProduct[] = all
    .filter((p) => p.isActive)
    .map((p) => ({
      id: p.id,
      name: p.name,
      priceMinor: p.priceMinor,
      stock: p.stock,
      variants: p.variants
        .filter((v) => v.isActive)
        .map((v) => ({
          id: v.id,
          name: v.name,
          priceDeltaMinor: v.priceDeltaMinor,
          stock: v.stock,
        })),
    }));

  return (
    <main className="mx-auto max-w-4xl px-4 py-6 sm:px-6 sm:py-10">
      <PageHeader
        eyebrow="E-ticaret"
        title="Yeni sipariş"
        description="Telefon / mağaza siparişini manuel gir. Fiyatlar üründen sunucuda çözülür, stok düşülür."
        action={
          <Link
            href="/admin/siparisler"
            className="inline-flex items-center justify-center gap-2 rounded-full border border-[var(--admin-border)] px-4 py-2 text-xs text-neutral-700 hover:border-[var(--admin-primary)] hover:text-[var(--admin-primary)]"
          >
            ← Tüm siparişler
          </Link>
        }
      />

      {products.length === 0 ? (
        <Card>
          <p className="text-sm text-neutral-500">
            Aktif ürün yok. Önce ürün ekle.
          </p>
        </Card>
      ) : (
        <ManualOrderForm products={products} action={createManualOrderAction} />
      )}
    </main>
  );
}
