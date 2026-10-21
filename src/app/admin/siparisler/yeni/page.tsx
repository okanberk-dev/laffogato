import { randomUUID } from "node:crypto";

import Link from "next/link";

import { PageHeader } from "@/components/admin/forms";
import {
  ManualOrderForm,
  type ManualProduct,
} from "@/components/admin/manual-order-form";
import { BUTTON, EmptyState, PageShell } from "@/components/admin/ui";
import { requireRole } from "@/lib/admin/auth";
import { canAccess } from "@/lib/admin/roles";
import { getSettings, listProducts } from "@/lib/admin/store";

import { createManualOrderAction } from "../actions";

export const metadata = { title: "Admin · Yeni Sipariş" };
export const dynamic = "force-dynamic";

export default async function NewOrderPage() {
  const session = await requireRole("orders");
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
    <PageShell width="detail">
      <PageHeader
        title="Yeni sipariş"
        description="Telefon ya da köşkteki satışı elle gir."
        help={
          <p>
            Gel-al, kurye ya da kargo olabilir. Fiyatlar üründen sunucuda
            çözülür, stok düşülür.
          </p>
        }
        action={
          // A text link, as on the order page: the old pill read as a
          // second button next to the form's own (admin audit ORD-22).
          <Link href="/admin/siparisler" className={BUTTON.link}>
            ← Tüm siparişler
          </Link>
        }
      />

      {products.length === 0 ? (
        // "Ürün ekle" only for a role that may open Ürünler: staff take
        // orders but cannot add a product, and the link sent them back to
        // their landing page.
        <EmptyState
          title="Aktif ürün yok."
          description={
            canAccess("products", session.role)
              ? "Elle sipariş, satıştaki bir ürünle girilir."
              : "Elle sipariş, satıştaki bir ürünle girilir. Ürün eklemesi için bir yöneticiye haber ver."
          }
          action={
            canAccess("products", session.role) ? (
              <Link href="/admin/urunler/yeni" className={BUTTON.ghost}>
                Ürün ekle
              </Link>
            ) : null
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
    </PageShell>
  );
}
