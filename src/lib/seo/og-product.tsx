import "server-only";

import type { ReactElement } from "react";

import type { Product } from "@/components/laffogato/data";
import { decodeDataImage } from "@/lib/admin/image-bytes";
import { getProduct, getShopProductBySlugLive } from "@/lib/admin/store";
import { SHOP_CATEGORY_ROUTES } from "@/lib/seo/pages";

import { OG_INK, OgFramedPhoto, OgPageCard, ogPhoto, ogText } from "./og-card";
import { OG_BAG_SIZE, OgCoffeeBag } from "./og-drawings";

/**
 * The product page's link preview: the product's first photo, its name and
 * the price the page shows first, KDV included.
 *
 * Read at request time (the route revalidates hourly), from the same query
 * the page reads, without its outage fallback. Three outcomes, as the page
 * has them:
 * - the product: its card, with the coffee bag when no photo can be drawn;
 * - no such active product: null, and the route answers 404 like the page;
 * - the database down or failing: the read throws. The route then errors,
 *   so the hourly revalidation keeps the last good card instead of storing a
 *   stand-in for an hour (the page shows "try again" in that state too).
 */

const PHOTO = 446;

/** Whole lira, as the product page prints them, with thousands dots. */
function lira(amount: number): string {
  return `${String(Math.round(amount)).replace(/\B(?=(\d{3})+(?!\d))/g, ".")} TL`;
}

type PricedProduct = Pick<
  Product,
  "priceMinor" | "compareAtPriceMinor" | "variants" | "stock"
>;

/**
 * The variant the product page preselects (product-detail.tsx): the first
 * active one in stock, else the first active one.
 */
function preselectedVariant(product: PricedProduct) {
  const variants = (product.variants ?? []).filter((v) => v.isActive !== false);
  return variants.find((v) => (v.stock ?? 1) > 0) ?? variants[0];
}

/** Sold out as the product page says it: the preselected variant's stock. */
export function ogProductSoldOut(product: PricedProduct): boolean {
  const stock = preselectedVariant(product)?.stock ?? product.stock;
  return stock !== undefined && stock <= 0;
}

/**
 * The price the product page opens on (product-detail.tsx): the base price
 * plus the preselected variant's delta, and the struck compare-at price when
 * it is higher. Null when the product carries no price.
 */
export function ogProductPrice(
  product: PricedProduct,
): { now: string; was?: string } | null {
  if (typeof product.priceMinor !== "number" || product.priceMinor <= 0) {
    return null;
  }
  const unit =
    product.priceMinor / 100 + (preselectedVariant(product)?.priceDelta ?? 0);
  const compareAt =
    product.compareAtPriceMinor !== undefined
      ? product.compareAtPriceMinor / 100
      : undefined;
  return {
    now: lira(unit),
    ...(compareAt && compareAt > unit ? { was: lira(compareAt) } : {}),
  };
}

/**
 * The stored first photo, drawn: an upload (a data URL in the row, what the
 * panel's uploader stores). A pasted https link is not fetched, the rule
 * the panel's photo reader keeps too (src/lib/backdrop/scene-core.ts): a
 * request never waits on someone else's server. Such a product shares the
 * coffee bag; uploading its photo in the panel brings the photo back
 * (docs/SEO.md). Null for no photo or bytes sharp cannot read; a database
 * error throws.
 */
async function productPhoto(id: string | undefined): Promise<string | null> {
  if (!id) return null;
  const stored = (await getProduct(id))?.images?.[0]?.trim();
  const upload = stored ? decodeDataImage(stored) : null;
  return upload ? ogPhoto(upload.body, PHOTO, PHOTO) : null;
}

function PriceLine({ now, was }: { now: string; was?: string }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "baseline",
        gap: 18,
        marginTop: 24,
      }}
    >
      <div style={{ display: "flex", fontSize: 52, color: OG_INK.brass }}>
        {now}
      </div>
      {was ? (
        <div
          style={{
            display: "flex",
            fontSize: 30,
            color: OG_INK.mint,
            textDecoration: "line-through",
          }}
        >
          {was}
        </div>
      ) : null}
      <div style={{ display: "flex", fontSize: 22, color: OG_INK.mint }}>
        KDV dahil
      </div>
    </div>
  );
}

export async function productCard(slug: string): Promise<ReactElement | null> {
  const product: Product | null = await getShopProductBySlugLive(slug);
  if (!product) return null;
  const photo = await productPhoto(product.id);

  const shelf =
    SHOP_CATEGORY_ROUTES.find((c) => c.productCat === product.cat)
      ?.breadcrumbLabel ?? null;
  const price = ogProductPrice(product);
  const detail = ogProductSoldOut(product)
    ? "Şu an tükendi"
    : ogText(product.tag, 48);

  return (
    <OgPageCard
      eyebrow={shelf ? `Mağaza · ${shelf}` : "Mağaza"}
      title={ogText(product.name, 64)}
      price={price ? <PriceLine {...price} /> : undefined}
      detail={detail || undefined}
      path={`/magaza/urun/${slug}`}
      art={
        photo ? (
          <OgFramedPhoto src={photo} width={PHOTO} height={PHOTO} />
        ) : (
          <OgCoffeeBag />
        )
      }
      artWidth={photo ? PHOTO : OG_BAG_SIZE.width}
    />
  );
}
