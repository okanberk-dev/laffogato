import Link from "next/link";
import { notFound } from "next/navigation";

import { BackLink } from "@/components/admin/back-link";
import { formatDateTime, formatTRY } from "@/components/admin/forms";
import {
  DeleteProduct,
  ProductActiveToggle,
} from "@/components/admin/products-list";
import {
  ActionMenu,
  Badge,
  BUTTON,
  KeyValueGrid,
  NUMERIC_STYLE,
  Section,
} from "@/components/admin/ui";
import { EYEBROW, MONO_STYLE } from "@/components/admin/ui/styles";
import { requireRole } from "@/lib/admin/auth";
import { imageVersion } from "@/lib/admin/image-bytes";
import { productImagePath, servedImage } from "@/lib/admin/image-url";
import { MENU_TAG_LABEL } from "@/lib/admin/menu-panel";
import {
  PRODUCTS_PATH,
  productEditHref,
  productShopHref,
  productStockLevel,
  productStockMovesHref,
} from "@/lib/admin/products-panel";
import { getProduct, getSettings, listCategories } from "@/lib/admin/store";
import { kdvRateLabel, productTaxRate } from "@/lib/utils/kdv";

export const metadata = { title: "Admin · Ürün" };
export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
}

/**
 * One product, read-only (Filament's view page, admin audit P2b / D37):
 * what the shop sells it at, its stock and each variant's, its photos, and
 * the actions of the list's ⋯ menu as buttons. The list had no page per
 * product: reading a field meant opening the edit form. Server-rendered;
 * the one client control gets the id, the name and the state, nothing else.
 */
export default async function ProductPage({ params }: PageProps) {
  await requireRole("products");
  const { id } = await params;
  const [product, categories, settings] = await Promise.all([
    getProduct(id),
    listCategories(),
    getSettings(),
  ]);
  if (!product) notFound();

  const category =
    categories.find((c) => c.slug === product.cat)?.label ?? product.cat;
  const rate = productTaxRate(product, settings.taxRates);
  const ownRate =
    product.taxRatePct !== null && product.taxRatePct !== undefined;
  const level = productStockLevel(product);
  const photos = (product.images ?? []).map((img, i) =>
    servedImage(img, productImagePath(product.id, i, imageVersion(img))),
  );
  const tags = (product.tags ?? []).map((t) => MENU_TAG_LABEL[t] ?? t);

  return (
    <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-10">
      <BackLink href={PRODUCTS_PATH}>Ürünler</BackLink>

      <header className="mb-6 flex flex-col gap-3">
        <div className={EYEBROW} style={MONO_STYLE}>
          Mağaza ürünü
        </div>
        <h1 className="text-2xl font-semibold tracking-tight break-words text-[var(--admin-text)] sm:text-3xl">
          {product.name}
        </h1>
        <span className="flex flex-wrap gap-1">
          <Badge tone={product.isActive ? "success" : "neutral"} dot>
            {product.isActive ? "Aktif" : "Pasif"}
          </Badge>
          {product.featured ? <Badge tone="accent">Öne çıkan</Badge> : null}
          {product.isNew ? <Badge tone="info">Yeni</Badge> : null}
          {level === "out" ? <Badge tone="danger">Stokta yok</Badge> : null}
          {level === "low" ? <Badge tone="warning">Düşük stok</Badge> : null}
        </span>
        <div className="flex flex-wrap items-start gap-2">
          <Link href={productEditHref(product.id)} className={BUTTON.primary}>
            Düzenle
          </Link>
          <ProductActiveToggle
            p={{
              id: product.id,
              name: product.name,
              isActive: product.isActive,
            }}
          />
          {product.isActive ? (
            <a
              href={productShopHref(product.slug)}
              target="_blank"
              rel="noopener noreferrer"
              className={BUTTON.ghost}
            >
              Mağazada gör
            </a>
          ) : null}
          <Link
            href={productStockMovesHref(product.id)}
            className={BUTTON.ghost}
          >
            Stok hareketleri
          </Link>
          {/* The rare and destructive one, as on the list's row. */}
          <ActionMenu label={`${product.name} işlemleri`} framed>
            <DeleteProduct
              p={{ id: product.id, name: product.name }}
              variant="menuDanger"
              thenList
            />
          </ActionMenu>
        </div>
      </header>

      {/* minmax(0, 1fr): the variants table scrolls inside its card
          instead of widening the page on a phone. */}
      <div className="grid grid-cols-[minmax(0,1fr)] gap-6">
        <Section title="Satış">
          <KeyValueGrid
            items={[
              {
                label: "Fiyat",
                value: (
                  <span style={NUMERIC_STYLE}>
                    {formatTRY(product.priceMinor)}
                  </span>
                ),
                hint: "KDV dahil, mağazada ve uygulamada.",
              },
              {
                label: "Eski fiyat",
                value:
                  product.compareAtPriceMinor > product.priceMinor ? (
                    <span className="line-through" style={NUMERIC_STYLE}>
                      {formatTRY(product.compareAtPriceMinor)}
                    </span>
                  ) : (
                    ""
                  ),
                hint: "Üstü çizili gösterilir; boşsa indirim yok.",
              },
              {
                label: "Maliyet",
                value:
                  product.costMinor > 0 ? (
                    <span style={NUMERIC_STYLE}>
                      {formatTRY(product.costMinor)}
                    </span>
                  ) : (
                    ""
                  ),
                hint: "Müşteriye gizli; raporlama için.",
              },
              {
                label: "KDV oranı",
                value: kdvRateLabel(rate),
                hint: ownRate
                  ? "Ürünün kendi oranı."
                  : "Kategorinin varsayılanı (Ayarlar · Vergi).",
              },
              { label: "Kategori", value: category },
              { label: "Etiket", value: product.tag },
            ]}
          />
        </Section>

        <Section
          title="Stok"
          description={
            product.variants.length > 0
              ? "Toplam, aktif varyantların stoğundan gelir; her varyant kendi stoğuyla satılır."
              : undefined
          }
        >
          <KeyValueGrid
            items={[
              {
                label: product.variants.length > 0 ? "Toplam stok" : "Stok",
                value: <span style={NUMERIC_STYLE}>{product.stock}</span>,
              },
              {
                label: "Düşük stok eşiği",
                value: (
                  <span style={NUMERIC_STYLE}>{product.lowStockThreshold}</span>
                ),
              },
              {
                label: "Ağırlık",
                value:
                  product.weightGrams > 0 ? `${product.weightGrams} g` : "",
              },
            ]}
            columns={3}
          />
          {product.variants.length > 0 ? (
            // Stock first after the name: on a phone the table scrolls in
            // its card, and the SKU waits for sm.
            <div className="mt-6 overflow-x-auto">
              <table className="w-full min-w-[19rem] border-collapse text-sm">
                <caption className="sr-only">Varyantlar</caption>
                <thead>
                  <tr className={EYEBROW} style={MONO_STYLE}>
                    <th scope="col" className="py-2 pr-3 text-left font-normal">
                      Varyant
                    </th>
                    <th
                      scope="col"
                      className="py-2 pr-3 text-right font-normal"
                    >
                      Stok
                    </th>
                    <th
                      scope="col"
                      className="py-2 pr-3 text-right font-normal"
                    >
                      Fiyat
                    </th>
                    <th scope="col" className="py-2 pr-3 text-left font-normal">
                      Durum
                    </th>
                    <th
                      scope="col"
                      className="hidden py-2 text-left font-normal sm:table-cell"
                    >
                      SKU
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {product.variants.map((v) => (
                    <tr
                      key={v.id}
                      className="border-t border-[var(--admin-border)]"
                    >
                      <td className="py-2 pr-3 text-[var(--admin-text)]">
                        {v.name || "Adsız"}
                      </td>
                      <td
                        className={`py-2 pr-3 text-right ${v.stock <= 0 ? "text-[var(--admin-danger-ink)]" : ""}`}
                        style={NUMERIC_STYLE}
                      >
                        {v.stock}
                      </td>
                      <td
                        className="py-2 pr-3 text-right whitespace-nowrap"
                        style={NUMERIC_STYLE}
                      >
                        {formatTRY(product.priceMinor + v.priceDeltaMinor)}
                      </td>
                      <td className="py-2 pr-3">
                        <Badge tone={v.isActive ? "success" : "neutral"}>
                          {v.isActive ? "Aktif" : "Pasif"}
                        </Badge>
                      </td>
                      <td
                        className="hidden py-2 text-xs text-[var(--admin-text-soft)] sm:table-cell"
                        style={NUMERIC_STYLE}
                      >
                        {v.sku || "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </Section>

        <Section
          title="Görseller"
          description={
            photos.length > 0
              ? "İlki listede, mağaza kartında ve uygulamada görünür."
              : undefined
          }
        >
          {photos.length === 0 ? (
            <p className="text-sm text-[var(--admin-text-soft)]">
              Görsel yok; mağaza ürünün renk yüzeyini gösterir.
            </p>
          ) : (
            <ul className="grid grid-cols-[repeat(auto-fill,minmax(7rem,1fr))] gap-3">
              {photos.map((src, i) => (
                <li key={src}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={src}
                    alt={`${product.name}: görsel ${i + 1}`}
                    loading="lazy"
                    className="aspect-square w-full rounded-xl object-cover ring-1 ring-[var(--admin-border)]"
                  />
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section title="Mağaza ve uygulama">
          <KeyValueGrid
            items={[
              {
                label: "SKU",
                value: product.sku ? (
                  <span style={NUMERIC_STYLE}>{product.sku}</span>
                ) : (
                  ""
                ),
              },
              {
                label: "Adres",
                value: product.slug ? (
                  <span style={NUMERIC_STYLE}>
                    {productShopHref(product.slug)}
                  </span>
                ) : (
                  ""
                ),
              },
              { label: "Marka", value: product.brand },
              { label: "Tat notları", value: product.notes.join(", ") },
              {
                label: "Etiketler",
                value: tags.join(", "),
                hint: "Sert kabuklu yemiş bir alerjen uyarısıdır.",
              },
              { label: "Açıklama", value: product.desc, full: true },
            ]}
          />
        </Section>

        <Section title="Arama motoru">
          <KeyValueGrid
            items={[
              {
                label: "Başlık",
                value: product.seoTitle,
                hint: product.seoTitle
                  ? undefined
                  : "Boş: ürün adı kullanılır.",
              },
              {
                label: "Açıklama",
                value: product.seoDescription,
                hint: product.seoDescription
                  ? undefined
                  : "Boş: ürün açıklaması kullanılır.",
              },
            ]}
            columns={1}
          />
        </Section>

        <p className="text-xs text-[var(--admin-text-soft)]">
          Son değişiklik {formatDateTime(product.updatedAt)}
        </p>
      </div>
    </main>
  );
}
