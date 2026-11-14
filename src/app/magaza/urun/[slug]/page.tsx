import type { Metadata } from "next";
import { notFound } from "next/navigation";

import Link from "@/components/link";
import { isDegradedRequest } from "@/lib/db/health";

import type { Product } from "@/components/laffogato/data";
import { ProductDetail } from "@/components/laffogato/product-detail";
import { SiteChrome } from "@/components/laffogato/site-chrome";
import type { ShopCategoryId } from "@/lib/admin/store";
import { breadcrumbLd, singleProductLd } from "@/lib/seo/structured-data";
import { JsonLd } from "@/lib/seo/json-ld";
import { SHOP_CATEGORY_ROUTES } from "@/lib/seo/pages";
import { metaDescription, openGraphBase } from "@/lib/seo/site";
import { shortProductName } from "@/lib/utils/format";
import { footerSettings } from "@/lib/seo/contact";
import {
  getSiteProductBySlug,
  getSiteSettings,
  listSiteRelatedProducts,
} from "@/lib/seo/site-data";

export const dynamic = "force-dynamic";

interface RouteParams {
  params: Promise<{ slug: string }>;
}

const PATH = (slug: string) => `/magaza/urun/${slug}`;

export async function generateMetadata({
  params,
}: RouteParams): Promise<Metadata> {
  const { slug } = await params;
  const product = await getSiteProductBySlug(slug);
  if (!product) return { title: { absolute: "Ürün bulunamadı · L'Affogato" } };
  // " · ", not " - ": product names carry their own hyphen now
  // ("Sirena - Espresso Harmanı"), and the dot is the site's title separator.
  const SUFFIX = " · L'Affogato";
  // The wizard's SEO tab wins when it has been filled in. It used to be
  // written and never read, so the fields promised control the pages ignored.
  const seoTitle = product.seoTitle?.trim();
  const title =
    seoTitle ||
    (product.name.length + SUFFIX.length <= 60
      ? `${product.name}${SUFFIX}`
      : product.name.length <= 60
        ? product.name
        : `${product.name.slice(0, 57).trimEnd()}…`);
  const rawDesc =
    product.seoDescription?.trim() || (product.desc?.trim() ?? "");
  let description: string;
  if (rawDesc) {
    if (rawDesc.length <= 155) {
      description = rawDesc;
    } else {
      const sliced = rawDesc.slice(0, 155);
      const lastSpace = sliced.lastIndexOf(" ");
      description = `${(lastSpace > 0 ? sliced.slice(0, lastSpace) : sliced).trimEnd()}…`;
    }
  } else {
    description = `${product.name} · L'Affogato mağazasından, Türkiye'ye kargo.`;
  }
  // A one-line blurb ("Kakao, kuru incir, esmer şeker.") is too thin for a
  // result snippet; give it the shelf and the delivery promise.
  if (description.length < 90) {
    const shelf =
      SHOP_CATEGORY_ROUTES.find((c) => c.productCat === product.cat)
        ?.breadcrumbLabel ?? "Mağaza";
    description = metaDescription(
      `${description.replace(/[.\s]+$/, "")}. ${shelf} · L'Affogato online mağaza, Türkiye'nin her yerine kargo.`,
    );
  }
  const path = PATH(slug);
  return {
    // `absolute`: the title is already built to 60 characters WITH the brand
    // suffix above, and the root layout's "%s · L'Affogato" template would
    // append the brand a second time ("... · L'Affogato · L'Affogato").
    title: { absolute: title },
    description,
    alternates: { canonical: path },
    openGraph: {
      // No `images`: the product's card (opengraph-image.tsx beside this
      // file) carries its photo, name and price, and an `images` key here
      // would hide it. It used to be the bare photo, or the generic card.
      ...openGraphBase(),
      title,
      description,
      url: path,
    },
    // The og:type / product:* tags are NOT emitted through `other`: Next
    // renders that map as <meta name="…">, and every Open Graph consumer reads
    // `property`, so the whole product block was silently ignored. They are
    // rendered as real property tags in the page body instead (React hoists
    // them into <head>).
    twitter: { card: "summary_large_image", title, description },
  };
}

/**
 * Open Graph product tags.
 *
 * These carry `property`, not `name` - Next's `metadata.other` can only emit
 * the latter, which no Open Graph consumer reads. React hoists these into
 * <head>.
 */
function ProductOpenGraph({ product }: { product: Product }) {
  const price =
    typeof product.priceMinor === "number" && product.priceMinor > 0
      ? (product.priceMinor / 100).toFixed(2)
      : null;
  const inStock = !(product.stock !== undefined && product.stock <= 0);
  return (
    <>
      <meta property="og:type" content="product" />
      <meta
        property="product:availability"
        content={inStock ? "in stock" : "out of stock"}
      />
      {price ? (
        <>
          <meta property="product:price:amount" content={price} />
          <meta property="product:price:currency" content="TRY" />
          <meta property="og:price:amount" content={price} />
          <meta property="og:price:currency" content="TRY" />
        </>
      ) : null}
    </>
  );
}

/**
 * The degraded-mode page: shown when the database cannot answer.
 *
 * It renders inside <SiteChrome> like every other state of this route. It
 * used to be a bare <main> with no header and no footer, so a visitor who hit
 * a DB blip - and a crawler that hit one - got a dead end with no navigation
 * out of it, on the one screen whose whole message is "try again".
 */
function ProductUnavailable() {
  return (
    <div
      style={{
        maxWidth: 560,
        margin: "0 auto",
        padding: "96px 24px",
        textAlign: "center",
      }}
    >
      <h1 className="h2" style={{ marginBottom: 12 }}>
        Bu ürünü şu an gösteremiyoruz
      </h1>
      <p
        style={{
          color: "var(--ink-soft)",
          lineHeight: 1.6,
          marginBottom: 24,
        }}
      >
        Geçici bir aksaklık yaşıyoruz. Birazdan tekrar dener misin?
      </p>
      <Link href="/magaza" className="btn btn-primary btn-sm">
        Mağazaya dön
      </Link>
    </div>
  );
}

export default async function ProductDetailPage({ params }: RouteParams) {
  const { slug } = await params;
  const product = await getSiteProductBySlug(slug);
  if (!product) {
    // A missing product is a genuine 404 - but during a database outage every
    // product reads as missing, and 404-ing real product URLs would get them
    // deindexed. Serve an honest "temporarily unavailable" page instead.
    if (isDegradedRequest()) {
      // Wrapped in the site's own chrome: the fallback used to render bare,
      // so a visitor who hit a database blip got a page with no header and no
      // footer - no way out of it - on the one screen whose entire message is
      // "come back in a minute". `getSiteSettings()` degrades to defaults
      // rather than throwing, so this is safe in exactly this state.
      const fallbackSettings = await getSiteSettings();
      return (
        <SiteChrome settings={footerSettings(fallbackSettings)}>
          <ProductUnavailable />
        </SiteChrome>
      );
    }
    notFound();
  }

  const [related, settings] = await Promise.all([
    listSiteRelatedProducts(
      (product.cat as ShopCategoryId) ?? "beans",
      product.id ?? "",
      4,
    ),
    getSiteSettings(),
  ]);

  const breadcrumb = breadcrumbLd([
    { name: "Ana Sayfa", url: "/" },
    { name: "Mağaza", url: "/magaza" },
    { name: shortProductName(product.name), url: PATH(slug) },
  ]);
  const productJsonLd = singleProductLd(product, PATH(slug), settings);

  return (
    <SiteChrome settings={footerSettings(settings)}>
      <JsonLd data={breadcrumb} />
      <JsonLd data={productJsonLd} />
      <ProductOpenGraph product={product} />
      <ProductDetail
        product={product}
        related={related}
        freeShippingThresholdMinor={settings.shippingFreeThresholdMinor}
        contact={{ phone: settings.phone, email: settings.email }}
      />
    </SiteChrome>
  );
}
