"use client";

import { useEffect, useEffectEvent, useRef, useState } from "react";

import Link from "@/components/link";
import { shopParams, trackPixelForPage } from "@/lib/consent/meta-pixel";
import { SHOP_CATEGORY_ROUTES } from "@/lib/seo/pages";
import {
  parsePriceLabel,
  priceLabel,
  shortProductName,
} from "@/lib/utils/format";

import type { Product } from "./data";
import { checkoutFromCart, trackCartAdd } from "./pixel-events";
import {
  freeShippingFrom,
  productDiscount,
  productFacts,
  type ProductFact,
} from "./product-facts";
import {
  activeVariants,
  ProductCard,
  ProductFactValue,
  toCartItem,
  type CartItem,
  type ShopContact,
} from "./ui";
import { ProductSurface } from "./visuals";

const CART_STORAGE_KEY = "laffogato_cart_v1";

function readCart(): CartItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(CART_STORAGE_KEY);
    if (!raw) return [];
    const data = JSON.parse(raw);
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

function writeCart(items: CartItem[]) {
  try {
    if (items.length === 0) window.localStorage.removeItem(CART_STORAGE_KEY);
    else window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
  } catch {
    // private mode / quota - ignore
  }
}

function cartKey(it: {
  productId?: string;
  variantId?: string;
  name: string;
}): string {
  return `${it.productId ?? it.name}::${it.variantId ?? ""}`;
}

/**
 * Full product detail page (PDP) body. A real route (/magaza/urun/<slug>)
 * rather than the quick-look modal: gallery, variant picker, qty, accordions,
 * trust badges and a related-products rail. Writes to the same localStorage
 * cart the SPA + checkout read, then redirects to /odeme.
 */
export function ProductDetail({
  product: p,
  related,
  freeShippingThresholdMinor,
  contact,
}: {
  product: Product;
  related: Product[];
  /** Ayarlar → "Ücretsiz kargo eşiği" (kuruş); 0 or absent = no free-shipping line. */
  freeShippingThresholdMinor?: number;
  /** Ayarlar's e-mail and phone: where questions before an order go. */
  contact?: ShopContact;
}) {
  const variants = activeVariants(p);
  const gallery = (p.images ?? []).filter(
    (u) => typeof u === "string" && u.length > 0,
  );
  const [activeImg, setActiveImg] = useState(0);
  const [variantId, setVariantId] = useState<string | undefined>(
    variants.find((v) => (v.stock ?? 1) > 0)?.id ?? variants[0]?.id,
  );
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);

  const selectedVariant = variants.find((v) => v.id === variantId);
  const basePrice =
    p.priceMinor !== undefined ? p.priceMinor / 100 : parsePriceLabel(p.price);
  const unitPrice = basePrice + (selectedVariant?.priceDelta ?? 0);
  // Printed to the kuruş, as the card, the quick look and the checkout
  // print it: 149,90 rounded to 150 overstated the price before the
  // discount the save proved to the kuruş (Fiyat Etiketi Yön. m.11/1).
  const unitMinor = Math.round(unitPrice * 100);
  // Struck out only with the days the sentence below names (m.14/1).
  const discount = productDiscount(p);
  const compareAt =
    discount && p.compareAtPriceMinor !== undefined
      ? p.compareAtPriceMinor / 100
      : undefined;
  const stock = selectedVariant?.stock ?? p.stock;
  const outOfStock = stock !== undefined && stock <= 0;
  const lowStock =
    !outOfStock &&
    stock !== undefined &&
    p.lowStockThreshold !== undefined &&
    stock <= p.lowStockThreshold;
  const maxQty = stock ?? 99;

  // ViewContent for the product on screen (Meta Pixel, marketing consent
  // only), once per page view, or held for a yes given later on this page;
  // the variant picked later does not repeat it.
  const viewed = useRef(false);
  const reportView = useEffectEvent(() => {
    if (!p.id) return;
    trackPixelForPage(
      "ViewContent",
      shopParams([{ id: p.id, name: p.name, quantity: 1, price: unitPrice }]),
    );
  });
  useEffect(() => {
    if (viewed.current) return;
    viewed.current = true;
    reportView();
  }, []);
  const savingsPct =
    compareAt && compareAt > unitPrice
      ? Math.round(((compareAt - unitPrice) / compareAt) * 100)
      : 0;

  /** Adds `qty` of an item to the shared localStorage cart. */
  const pushToCart = (item: CartItem, count: number) => {
    const key = cartKey(item);
    const cart = readCart();
    const existing = cart.find((c) => cartKey(c) === key);
    if (existing) {
      const cap = existing.maxStock ?? item.maxStock ?? 99;
      existing.qty = Math.min(cap, (existing.qty || 1) + count);
      Object.assign(existing, { ...item, qty: existing.qty });
    } else {
      cart.push({ ...item, qty: count });
    }
    writeCart(cart);
    // Notify other components in this tab (storage event only fires cross-tab).
    window.dispatchEvent(
      new StorageEvent("storage", { key: CART_STORAGE_KEY }),
    );
  };

  const addToCart = (goCheckout: boolean) => {
    if (outOfStock) return;
    const item = toCartItem(p, selectedVariant);
    if (!item) return;
    pushToCart(item, qty);
    trackCartAdd(item, qty);
    if (goCheckout) {
      // A full page load: the checkout opens in a document of its own,
      // without this page's tags (src/lib/security/checkout-document.ts).
      // InitiateCheckout goes first (marketing consent only).
      checkoutFromCart(readCart());
    } else {
      setAdded(true);
      window.setTimeout(() => setAdded(false), 2200);
    }
  };

  // The related row used to render cards with an add button and a quick
  // look that did nothing; now "+" adds one to the same cart, and the card
  // itself opens that product's page.
  const [relatedNote, setRelatedNote] = useState("");
  const addRelated = (item: CartItem) => {
    pushToCart(item, 1);
    trackCartAdd(item, 1);
    setRelatedNote(`${shortProductName(item.name)} sepete eklendi.`);
  };

  const category = SHOP_CATEGORY_ROUTES.find((c) => c.productCat === p.cat);
  const facts = productFacts(p);
  // The threshold the checkout applies, or no line at all: the page said
  // "500₺" whatever Ayarlar held, and also when free shipping was off.
  const freeFrom = freeShippingFrom(freeShippingThresholdMinor);
  const returnsEmail = contact?.email?.trim() || "info@nextgenlab.com.tr";

  return (
    <div className="pdp">
      <div className="wrap">
        <nav className="pdp-breadcrumb" aria-label="breadcrumb">
          <Link href="/">Ana Sayfa</Link>
          <span aria-hidden>/</span>
          <Link href="/magaza">Mağaza</Link>
          {category && (
            <>
              <span aria-hidden>/</span>
              <Link href={`/magaza/${category.slug}`}>
                {category.breadcrumbLabel}
              </Link>
            </>
          )}
          <span aria-hidden>/</span>
          <span aria-current="page">
            {/* The short name, unless it is the shelf's own label ("Çekirdek
                Kahve / Çekirdek Kahve"): then the whole name says which. */}
            {category?.breadcrumbLabel === shortProductName(p.name)
              ? p.name
              : shortProductName(p.name)}
          </span>
        </nav>

        <div className="pdp-grid">
          {/* Gallery */}
          <div className="pdp-gallery">
            <div className="pdp-gallery-main media">
              {gallery.length > 0 ? (
                <ProductSurface
                  label={p.name}
                  images={[gallery[activeImg]]}
                  priority
                />
              ) : (
                <ProductSurface label={p.name} />
              )}
              {savingsPct > 0 && (
                <span className="badge">%{savingsPct} indirim</span>
              )}
            </div>
            {gallery.length > 1 && (
              <div className="pdp-gallery-thumbs">
                {gallery.map((img, i) => (
                  <button
                    key={img + i}
                    type="button"
                    className="pdp-thumb media"
                    data-active={i === activeImg ? "true" : undefined}
                    onClick={() => setActiveImg(i)}
                    aria-label={`Görsel ${i + 1}`}
                  >
                    <ProductSurface label={p.name} images={[img]} />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Buy box */}
          <div className="pdp-info">
            <h1 className="t-display pdp-title">{p.name}</h1>
            {p.tag ? <p className="t-body">{p.tag}</p> : null}

            <div className="pdp-price-row">
              {compareAt && compareAt > unitPrice && (
                <span className="t-price price-was tabular">
                  {priceLabel(Math.round(compareAt * 100))}
                </span>
              )}
              <span className="t-price tabular">{priceLabel(unitMinor)}</span>
              {savingsPct > 0 && (
                <span className="t-small pdp-save-pill">−%{savingsPct}</span>
              )}
            </div>
            {savingsPct > 0 && discount && (
              <p className="t-small t-muted">{discount.notice}</p>
            )}
            <p className="t-small t-muted">KDV dahil fiyat</p>

            {/* Stock state */}
            {stock !== undefined && (
              <div className="pdp-stock">
                {outOfStock ? (
                  <span data-tone="out">● Şu an tükendi</span>
                ) : lowStock ? (
                  <span data-tone="low">● Son {stock} adet - acele et</span>
                ) : (
                  <span data-tone="in">● Stokta · hemen kargo</span>
                )}
              </div>
            )}

            {/* Variants */}
            {variants.length > 0 && (
              <div className="pdp-variants">
                <p className="t-label">Seçenek</p>
                <div className="chip-row">
                  {variants.map((v) => {
                    const vOut = v.stock !== undefined && v.stock <= 0;
                    return (
                      <button
                        key={v.id}
                        type="button"
                        className="tag variant-chip"
                        aria-pressed={v.id === variantId}
                        disabled={vOut}
                        onClick={() => {
                          setVariantId(v.id);
                          setQty(1);
                        }}
                      >
                        {v.name}
                        {v.priceDelta
                          ? ` · ${v.priceDelta > 0 ? "+" : ""}${priceLabel(Math.round(v.priceDelta * 100))}`
                          : ""}
                        {vOut ? " (tükendi)" : ""}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Qty + add */}
            <div className="buy-row">
              <div className="qty-stepper">
                <button
                  type="button"
                  aria-label="Azalt"
                  onClick={() => setQty((q) => Math.max(1, q - 1))}
                  disabled={outOfStock}
                >
                  −
                </button>
                <span className="tabular">{qty}</span>
                <button
                  type="button"
                  aria-label="Arttır"
                  onClick={() => setQty((q) => Math.min(maxQty, q + 1))}
                  disabled={outOfStock || qty >= maxQty}
                >
                  +
                </button>
              </div>
              <button
                type="button"
                className="btn btn-dark buy-add"
                disabled={outOfStock}
                onClick={() => addToCart(false)}
              >
                {outOfStock ? (
                  "Tükendi"
                ) : added ? (
                  "Sepete eklendi ✓"
                ) : (
                  <>
                    Sepete ekle <span aria-hidden="true">|</span>{" "}
                    <span className="tabular">
                      {priceLabel(unitMinor * qty)}
                    </span>
                  </>
                )}
              </button>
            </div>
            {!outOfStock && (
              <button
                type="button"
                className="btn btn-block pdp-buynow"
                onClick={() => addToCart(true)}
              >
                Hemen satın al
              </button>
            )}

            <p className="t-body pdp-desc">{p.desc}</p>

            {/* Trust badges */}
            <ul className="pdp-trust">
              <li>İstanbul içi aynı gün teslimat</li>
              {freeFrom && (
                <li>{freeFrom} ve üzeri siparişte ücretsiz kargo</li>
              )}
              {/* Not "koşulsuz": the legal pages keep the regulation's
                  exceptions (MSY m.15) and say this page names them. */}
              <li>14 gün iade hakkı (istisnalar aşağıda)</li>
              <li>3D Secure ödeme; kart bilgin bizde saklanmaz</li>
            </ul>

            {/* Accordions */}
            <div className="pdp-accordions">
              {facts.length > 0 && (
                <Accordion title="Ürün detayları" defaultOpen>
                  <DetailGrid facts={facts} contact={contact} />
                </Accordion>
              )}
              <Accordion title="Teslimat ve kargo">
                <p>
                  İstanbul içi siparişler aynı gün, Türkiye geneli 2-3 iş günü
                  içinde teslim edilir.
                  {freeFrom
                    ? ` ${freeFrom} ve üzeri siparişlerde kargo ücretsizdir.`
                    : null}{" "}
                  Sipariş durumunu{" "}
                  <Link href="/uye/hesap/siparislerim">üyelik hesabından</Link>{" "}
                  takip edebilirsin. Ayrıntılar:{" "}
                  <Link href="/hukuk/teslimat-ve-kargo">Teslimat ve Kargo</Link>
                  .
                </p>
              </Accordion>
              <Accordion title="İade ve değişim">
                <p>
                  Teslim aldığın günden itibaren 14 gün içinde gerekçe
                  göstermeden ve ücretsiz iade edebilirsin. Çabuk bozulabilen
                  gıdalarda, ambalajı açılmış olup sağlık ya da hijyen açısından
                  iadesi uygun olmayan ürünlerde ve isteğine göre hazırlanan
                  ürünlerde (örneğin özel öğütüm) cayma hakkı yoktur. İade
                  talebin için{" "}
                  <a href={`mailto:${returnsEmail}`}>{returnsEmail}</a> adresine
                  yazman yeterli. Haklarının tamamı:{" "}
                  <Link href="/hukuk/iade-ve-cayma">İptal, İade ve Cayma</Link>.
                </p>
              </Accordion>
            </div>
          </div>
        </div>

        {/* Related */}
        {related.length > 0 && (
          <section className="pdp-related">
            <div className="section-head">
              <h2 className="t-display">Bunları da sevebilirsin</h2>
              <Link href="/magaza" className="link-u">
                Tüm mağaza
              </Link>
            </div>
            <div className="product-grid">
              {related.map((rp, i) => (
                <ProductCard
                  key={rp.id ?? rp.name}
                  product={rp}
                  idx={i}
                  addToCart={addRelated}
                />
              ))}
            </div>
            <p className="sr-only" role="status" aria-live="polite">
              {relatedNote}
            </p>
          </section>
        )}
      </div>
    </div>
  );
}

function Accordion({
  title,
  children,
  defaultOpen = false,
}: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="pdp-acc" data-open={open ? "true" : undefined}>
      <button
        type="button"
        className="pdp-acc-head"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
      >
        <span className="t-label">{title}</span>
        <span className="pdp-acc-icon" aria-hidden>
          {open ? "−" : "+"}
        </span>
      </button>
      {open && <div className="pdp-acc-body">{children}</div>}
    </div>
  );
}

function DetailGrid({
  facts,
  contact,
}: {
  facts: ProductFact[];
  contact?: ShopContact;
}) {
  return (
    <dl className="pdp-detail-grid">
      {facts.map((f) => (
        <div key={f.k}>
          <dt>{f.k}</dt>
          <dd>
            <ProductFactValue fact={f} contact={contact} />
          </dd>
        </div>
      ))}
    </dl>
  );
}
