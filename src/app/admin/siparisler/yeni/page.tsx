import { randomUUID } from "node:crypto";

import Link from "next/link";

import { PageHeader } from "@/components/admin/forms";
import {
  ManualOrderForm,
  type ManualProduct,
} from "@/components/admin/manual-order-form";
import { BUTTON, EmptyState } from "@/components/admin/ui";
import { requireRole } from "@/lib/admin/auth";
import { getSettings, listProducts } from "@/lib/admin/store";

import { createManualOrderAction } from "../actions";

export const metadata = { title: "Admin · Yeni Sipariş" };
export const dynamic = "force-dynamic";

export default async function NewOrderPage() {
  await requireRole("orders");
  const [all, settings] = await Promise.all([listProducts(), getSettings()]);

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
        eyebrow="Satış"
        title="Yeni sipariş"
        description="Telefon ya da köşkteki satışı elle gir: gel-al, kurye ya da kargo. Fiyatlar üründen sunucuda çözülür, stok düşülür."
        action={
          // A text link, as on the order page: the old pill read as a
          // second button next to the form's own (admin audit ORD-22).
          <Link href="/admin/siparisler" className={BUTTON.link}>
            ← Tüm siparişler
          </Link>
        }
      />

      {products.length === 0 ? (
        <EmptyState
          title="Aktif ürün yok."
          description="Elle sipariş, satıştaki bir ürünle girilir."
          action={
            <Link href="/admin/urunler/yeni" className={BUTTON.ghost}>
              Ürün ekle
            </Link>
          }
        />
      ) : (
        <ManualOrderForm
          products={products}
          shipping={{
            courierFeeMinor: settings.courierFeeMinor,
            shippingFlatMinor: settings.shippingFlatMinor,
            shippingFreeThresholdMinor: settings.shippingFreeThresholdMinor,
          }}
          action={createManualOrderAction}
          // One per page load: a second press after a lost answer finds the
          // order the first one made.
          clientOrderId={randomUUID()}
        />
      )}
    </main>
  );
}
