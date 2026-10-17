import "server-only";

import type { ReactElement } from "react";

import type { Product } from "@/components/laffogato/data";
import { decodeDataImage } from "@/lib/admin/image-bytes";
import { getProduct, getShopProductBySlug } from "@/lib/admin/store";
import { SHOP_CATEGORY_ROUTES } from "@/lib/seo/pages";

import {
  OG_INK,
  OgFramedPhoto,
  OgPageCard,
  ogPhoto,
  ogPublicPhoto,
  ogText,
} from "./og-card";
import { OG_BAG_SIZE, OgCoffeeBag } from "./og-drawings";
import { shopCard } from "./og-pages";

/**
 * The product page's link preview: the product's first photo, its name and
 * the price the page shows first, KDV included.
 *
 * Read at request time (the route revalidates hourly), from the same
 * `getShopProductBySlug` the page reads. Any failure - a missing or inactive
 * product, the database down, a photo sharp cannot read - draws less, never
 * nothing: no photo gives the coffee bag, no product gives the shop's card.
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
 * The stored first photo as a data URL: an upload (a data URL in the row)
 * or a file the site serves from public/. An https link is not fetched -
 * the same rule as the backdrop reader: a request never waits on someone
 * else's server.
 */
async function productPhoto(id: string | undefined): Promise<string | null> {
  if (!id) return null;
  const stored = (await getProduct(id))?.images?.[0]?.trim();
  if (!stored) return null;
  const upload = decodeDataImage(stored);
  if (upload) return ogPhoto(upload.body, PHOTO, PHOTO);
  if (stored.startsWith("/") && !stored.startsWith("//")) {
    return ogPublicPhoto(stored, PHOTO, PHOTO);
  }
  return null;
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

export async function productCard(slug: string): Promise<ReactElement> {
  let product: Product | null;
  try {
    product = await getShopProductBySlug(slug);
  } catch {
    product = null;
  }
  if (!product) return shopCard();

  let photo: string | null;
  try {
    photo = await productPhoto(product.id);
  } catch {
    photo = null;
  }

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
