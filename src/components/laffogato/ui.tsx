"use client";

import { usePathname } from "next/navigation";
import { useRef, useState } from "react";

import { toggleWishlistAction } from "@/app/uye/actions";
import { checkoutFromCart, trackCartAdd } from "./pixel-events";
import { productPath } from "./route-paths";
import { useDialog } from "./use-dialog";

import type { Product } from "./data";
import {
  productDiscount,
  productFacts,
  type ProductFact,
} from "./product-facts";
import { ProductSurface } from "./visuals";
import Link from "@/components/link";
import {
  parsePriceLabel,
  priceLabel,
  shortProductName,
} from "@/lib/utils/format";
import { cx } from "./cx";
import { keepUnits } from "./keep-units";

export interface CartItem {
  /** Stable product id - preferred match key for merge + server resolution. */
  productId?: string;
  /** Selected variant id, if any. */
  variantId?: string;
  /** Variant display name appended in the cart (e.g. "250g"). */
  variantName?: string;
  name: string;
  /** Unit price in major units (₺), including any variant delta. */
  price: number;
  tag?: string;
  qty?: number;
  /** Product slug for deep-linking back to the PDP from the cart. */
  slug?: string;
  /** Hue token for the cart thumbnail surface. */
  img?: string;
  /** Shop category - drives the cart thumbnail illustration. */
  cat?: string;
  /** Max purchasable qty (stock); clamps the stepper. */
  maxStock?: number;
}

/** Stable cart key - same product+variant lines merge into one. */
export function cartItemKey(it: {
  productId?: string;
  variantId?: string;
  name: string;
}): string {
  return `${it.productId ?? it.name}::${it.variantId ?? ""}`;
}

/** The variants a product is sold in: the shop offers only active ones. */
export function activeVariants(p: Product) {
  return (p.variants ?? []).filter((v) => v.isActive !== false);
}

/**
 * Build a CartItem from a Product (+ the chosen variant) with all metadata.
 *
 * Null for a product sold in variants when no variant of its own is given:
 * such a line has no variant to price or to take stock from. The card's
 * quick "+" used to add exactly that line, at the base price and against
 * the product total only, so every caller now has to have a variant chosen
 * first (the card opens the product instead, see ProductCard).
 */
export function toCartItem(
  p: Product,
  variant?: { id: string; name: string; priceDelta: number; stock?: number },
): CartItem | null {
  const variants = activeVariants(p);
  if (variants.length > 0 && !variants.some((v) => v.id === variant?.id)) {
    return null;
  }
  const chosen = variants.length > 0 ? variant : undefined;
  const base =
    p.priceMinor !== undefined ? p.priceMinor / 100 : parsePriceLabel(p.price);
  const price = base + (chosen?.priceDelta ?? 0);
  return {
    productId: p.id,
    variantId: chosen?.id,
    variantName: chosen?.name,
    name: p.name,
    price,
    tag: p.tag,
    slug: p.slug,
    img: p.img,
    cat: p.cat,
    maxStock: chosen?.stock ?? p.stock,
  };
}

/** The shop's contact for questions before an order (Ayarlar). */
export interface ShopContact {
  phone?: string;
  email?: string;
}

/**
 * A detail row's value. An `ask` row (product-facts.ts) names where the
 * answer is: the shop's e-mail and phone, as links.
 */
export function ProductFactValue({
  fact,
  contact,
}: {
  fact: ProductFact;
  contact?: ShopContact;
}) {
  if (!fact.ask) return <>{fact.v}</>;
  const email = contact?.email?.trim();
  const phone = contact?.phone?.trim();
  if (!email && !phone) return <>{fact.v}.</>;
  return (
    <>
      {fact.v}:{" "}
      {email && (
        <a className="fact-contact" href={`mailto:${email}`}>
          {email}
        </a>
      )}
      {email && phone ? " ya da " : null}
      {phone && (
        <a className="fact-contact" href={`tel:${phone.replace(/\s+/g, "")}`}>
          {phone}
        </a>
      )}
    </>
  );
}

export interface ProductCardProps {
  product: Product;
  idx?: number;
  addToCart?: (item: CartItem) => void;
  onOpen?: (product: Product) => void;
}

/** Turkish names for the shop's category ids - the card used to print the
    raw id, upper-cased ("BEANS", "PANTRY"). */
const SHOP_CAT_LABELS: Record<string, string> = {
  beans: "Çekirdek",
  gift: "Hediye",
  gear: "Ekipman",
  merch: "Giyim",
  pantry: "Kiler",
};

export function ProductCard({ product, addToCart, onOpen }: ProductCardProps) {
  const p = product;
  const outOfStock = p.stock !== undefined && p.stock <= 0;
  const lowStock =
    !outOfStock &&
    p.stock !== undefined &&
    p.lowStockThreshold !== undefined &&
    p.stock <= p.lowStockThreshold;
  const name = keepUnits(shortProductName(p.name));
  const href = p.slug ? productPath(p.slug) : undefined;
  // A product sold in variants cannot go in from the card: its button opens
  // it so the variant is chosen first (toCartItem refuses a line without one).
  const needsChoice = activeVariants(p).length > 0;
  const discount = productDiscount(p);

  const onAdd = () => {
    if (outOfStock || !addToCart) return;
    const item = toCartItem(p);
    if (item) {
      addToCart(item);
      trackCartAdd(item);
    }
  };

  // The card opens the quick look where the page has one (the shop); where
  // it does not (the related row on a product page) it is a plain link.
  const onCardClick = (e: React.MouseEvent) => {
    if (!onOpen) return;
    e.preventDefault();
    onOpen(p);
  };

  const flag = outOfStock
    ? "Tükendi"
    : p.isNew
      ? "Yeni"
      : p.featured
        ? "Öne çıkan"
        : lowStock
          ? `Son ${p.stock}`
          : "";

  const body = (
    <>
      <div className="media ratio-5-4 p-card-media">
        <ProductSurface label={name} images={p.images} />
        {flag ? <span className="badge">{flag}</span> : null}
      </div>
      <div className="p-card-head">
        <h3 className="t-title">{name}</h3>
        <span className="t-price tabular">
          {discount ? <span className="price-was">{discount.was}</span> : null}
          {p.price}
        </span>
      </div>
      {p.tag ? <p className="t-small p-card-sub">{p.tag}</p> : null}
      {/* The discount's days, wherever the struck price is (m.14/1). */}
      {discount ? (
        <p className="t-small t-muted">{discount.short}</p>
      ) : (
        <p className="t-small t-muted">{SHOP_CAT_LABELS[p.cat] ?? ""}</p>
      )}
    </>
  );

  return (
    <article className="p-card product-card">
      {href ? (
        <a className="p-card-link" href={href} onClick={onCardClick}>
          {body}
        </a>
      ) : (
        <div
          className="p-card-link"
          role={onOpen ? "button" : undefined}
          tabIndex={onOpen ? 0 : undefined}
          onClick={onCardClick}
          onKeyDown={(e) => {
            if (onOpen && (e.key === "Enter" || e.key === " ")) {
              e.preventDefault();
              onOpen(p);
            }
          }}
        >
          {body}
        </div>
      )}
      {addToCart && !outOfStock && needsChoice ? (
        onOpen ? (
          <button
            type="button"
            className="btn btn-dark btn-block p-card-add"
            onClick={() => onOpen(p)}
            aria-label={`${name} - seçenekleri gör`}
          >
            Seçenekleri gör
          </button>
        ) : href ? (
          <a
            className="btn btn-dark btn-block p-card-add"
            href={href}
            aria-label={`${name} - seçenekleri gör`}
          >
            Seçenekleri gör
          </a>
        ) : null
      ) : addToCart ? (
        <button
          type="button"
          className="btn btn-dark btn-block p-card-add"
          onClick={onAdd}
          disabled={outOfStock}
          aria-label={
            outOfStock ? `${name} - tükendi` : `${name} - sepete ekle`
          }
        >
          {outOfStock ? "Tükendi" : "Sepete ekle"}
        </button>
      ) : null}
    </article>
  );
}

/* ─────────────────────────────────────────────────────────────
   Cart drawer
   ───────────────────────────────────────────────────────────── */

interface CartDrawerProps {
  open: boolean;
  onClose: () => void;
  items: CartItem[];
  removeItem: (idx: number) => void;
  setQty?: (idx: number, qty: number) => void;
  /** Free-shipping threshold in major units (₺); 0/undefined hides the bar. */
  freeShippingThreshold?: number;
  /** The shop's products, to show each line's photo (looked up by id; the
   *  stored cart carries no image). */
  products?: readonly Product[];
}

export function CartDrawer({
  open,
  onClose,
  items,
  removeItem,
  setQty,
  freeShippingThreshold = 0,
  products,
}: CartDrawerProps) {
  const imagesFor = (it: CartItem) =>
    products?.find((p) => p.id && p.id === it.productId)?.images;
  const panelRef = useRef<HTMLElement | null>(null);
  useDialog(open, onClose, panelRef);

  const total = items.reduce((s, it) => s + (it.price || 0) * (it.qty || 1), 0);
  const itemCount = items.reduce((s, it) => s + (it.qty || 1), 0);
  // An empty bag shows a few things from the shelf, the panel's featured
  // ones first, as the reference's empty cart does.
  const suggestions =
    items.length === 0
      ? (products ?? [])
          .filter((p) => p.slug && (p.stock === undefined || p.stock > 0))
          .sort((a, b) => Number(!!b.featured) - Number(!!a.featured))
          .slice(0, 3)
      : [];

  return (
    <>
      <div
        onClick={onClose}
        className={cx("cart-scrim", open && "open")}
        aria-hidden="true"
      />
      <aside
        ref={panelRef}
        className={cx("cart-drawer", open && "open")}
        // The drawer stays mounted so it can animate out. While it is closed
        // its buttons and links were still in the tab order off-screen, and
        // `aria-modal` was announced permanently - a screen reader believed a
        // dialog was open on every page.
        role={open ? "dialog" : undefined}
        aria-modal={open ? true : undefined}
        aria-label="Sepetin"
        aria-hidden={open ? undefined : true}
        inert={!open}
        tabIndex={-1}
      >
        <header className="cart-drawer-header">
          <p className="t-display">
            {items.length === 0 ? "Sepetin boş" : "Sepetin"}
            {items.length > 0 ? (
              <span className="t-small t-muted cart-drawer-count">
                {itemCount} ürün
              </span>
            ) : null}
          </p>
          <button
            type="button"
            onClick={onClose}
            className="icon-btn icon-btn--boxed"
            aria-label="Kapat"
          >
            <svg viewBox="0 0 16 16" aria-hidden="true">
              <path
                d="M3 3l10 10M13 3 3 13"
                stroke="currentColor"
                strokeWidth="1.2"
              />
            </svg>
          </button>
        </header>
        {items.length > 0 && freeShippingThreshold > 0 && (
          <FreeShippingBar total={total} threshold={freeShippingThreshold} />
        )}
        <div className="cart-drawer-body">
          {items.length === 0 ? (
            <div className="cart-empty">
              <p className="t-body">
                Kahve, ekipman ya da hediye: mağazada köşkün raflarındaki her
                şey var.
              </p>
              {suggestions.length > 0 ? (
                <div className="cart-suggest">
                  <p className="t-label">Beğenebileceklerin</p>
                  <ul className="cart-suggest-list" role="list">
                    {suggestions.map((p) => (
                      <li key={p.id ?? p.slug}>
                        <Link
                          href={productPath(p.slug!)}
                          className="cart-suggest-item"
                          onClick={onClose}
                        >
                          <span className="cart-item-thumb media ratio-1">
                            <ProductSurface label={p.name} images={p.images} />
                          </span>
                          <span className="cart-suggest-copy">
                            <span className="t-title">
                              {shortProductName(p.name)}
                            </span>
                            <span className="t-price tabular">
                              {typeof p.priceMinor === "number"
                                ? priceLabel(p.priceMinor)
                                : p.price}
                            </span>
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          ) : (
            <ul className="cart-lines">
              {items.map((it, i) => {
                const qty = it.qty || 1;
                const lineTotal = (it.price || 0) * qty;
                const atMax = it.maxStock !== undefined && qty >= it.maxStock;
                return (
                  <li key={cartItemKey(it) + i} className="cart-item-grid">
                    <div className="cart-item-thumb media ratio-1">
                      <ProductSurface label={it.name} images={imagesFor(it)} />
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div className="cart-item-name">
                        {it.slug ? (
                          <a href={productPath(it.slug)} onClick={onClose}>
                            {shortProductName(it.name)}
                          </a>
                        ) : (
                          shortProductName(it.name)
                        )}
                      </div>
                      {it.variantName && (
                        <div className="cart-item-variant">
                          {it.variantName}
                        </div>
                      )}
                      {setQty ? (
                        <div className="cart-qty-stepper">
                          <button
                            type="button"
                            aria-label="Azalt"
                            onClick={() => setQty(i, qty - 1)}
                          >
                            −
                          </button>
                          <span className="tabular">{qty}</span>
                          <button
                            type="button"
                            aria-label="Arttır"
                            onClick={() => setQty(i, qty + 1)}
                            disabled={atMax}
                          >
                            +
                          </button>
                        </div>
                      ) : (
                        <div className="cart-item-variant">x{qty}</div>
                      )}
                      {atMax && (
                        <div className="cart-item-cap">Stok sınırı</div>
                      )}
                    </div>
                    <div className="cart-item-side">
                      <div className="cart-item-price tabular">
                        {priceLabel(Math.round(lineTotal * 100))}
                      </div>
                      <button
                        type="button"
                        className="cart-item-remove"
                        onClick={() => removeItem(i)}
                      >
                        Sil
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
        {items.length > 0 ? (
          <CartFooter total={total} items={items} />
        ) : (
          <div className="cart-drawer-foot">
            <Link
              href="/magaza"
              className="btn btn-dark btn-block"
              onClick={onClose}
            >
              Mağazaya dön
            </Link>
          </div>
        )}
      </aside>
    </>
  );
}

function FreeShippingBar({
  total,
  threshold,
}: {
  total: number;
  threshold: number;
}) {
  const remaining = Math.max(0, threshold - total);
  const pct = Math.min(100, Math.round((total / threshold) * 100));
  const reached = remaining <= 0;
  return (
    <div className="cart-freeship">
      <div className="cart-freeship-text">
        {reached ? (
          <>
            <span aria-hidden>✓</span> Ücretsiz kargoyu kazandın
          </>
        ) : (
          <>
            <strong>{priceLabel(Math.round(remaining * 100))}</strong> daha
            ekle, kargo bizden
          </>
        )}
      </div>
      <div className="cart-freeship-track">
        <div className="cart-freeship-fill" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

/** The app's cart bar: the total and one ink capsule to checkout. */
function CartFooter({
  total,
  items,
}: {
  total: number;
  items: readonly CartItem[];
}) {
  return (
    <footer className="cart-drawer-foot">
      <div className="cart-sum-row">
        <span>Ara toplam</span>
        <span className="cart-sum tabular">
          {priceLabel(Math.round(total * 100))}
        </span>
      </div>
      <div className="cart-sum-note">
        <span>Kargo</span>
        <span>Ödeme adımında hesaplanır</span>
      </div>
      <a
        href="/odeme"
        className="btn btn-dark btn-block cart-checkout"
        onClick={(e) => {
          // A plain click only: a new tab or window keeps the link's own way.
          if (
            e.button !== 0 ||
            e.metaKey ||
            e.ctrlKey ||
            e.shiftKey ||
            e.altKey
          ) {
            return;
          }
          // InitiateCheckout (marketing consent only), then the same hard
          // load of /odeme the link makes.
          e.preventDefault();
          checkoutFromCart(items);
        }}
      >
        Ödemeye geç
      </a>
    </footer>
  );
}

/* ─────────────────────────────────────────────────────────────
   Product modal
   ───────────────────────────────────────────────────────────── */

export function ProductModal({
  product,
  onClose,
  addToCart,
  wishlist,
  isAuthenticated,
  contact,
}: {
  product: Product | null;
  onClose: () => void;
  addToCart: (item: CartItem) => void;
  wishlist?: string[];
  isAuthenticated?: boolean;
  /** Where a food page sends questions before the order (Ayarlar). */
  contact?: ShopContact;
}) {
  const panelRef = useRef<HTMLDivElement | null>(null);
  useDialog(Boolean(product), onClose, panelRef);

  if (!product) return null;
  return (
    <div onClick={onClose} className="product-modal-overlay">
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={product.name}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        className="product-modal"
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Kapat"
          className="icon-btn icon-btn--boxed product-modal-close"
        >
          <svg viewBox="0 0 16 16" aria-hidden="true">
            <path
              d="M3 3l10 10M13 3 3 13"
              stroke="currentColor"
              strokeWidth="1.2"
            />
          </svg>
        </button>
        {/* Keyed: the chosen variant belongs to this product only. */}
        <ProductModalBody
          key={product.id ?? product.name}
          product={product}
          onClose={onClose}
          addToCart={addToCart}
          wishlist={wishlist}
          isAuthenticated={isAuthenticated}
          contact={contact}
        />
      </div>
    </div>
  );
}

function ProductModalBody({
  product: p,
  onClose,
  addToCart,
  wishlist,
  isAuthenticated,
  contact,
}: {
  product: Product;
  onClose: () => void;
  addToCart: (item: CartItem) => void;
  wishlist?: string[];
  isAuthenticated?: boolean;
  contact?: ShopContact;
}) {
  const isFavorite = !!(p.id && wishlist?.includes(p.id));
  const variants = activeVariants(p);
  const facts = productFacts(p);
  const discount = productDiscount(p);
  const [variantId, setVariantId] = useState<string | undefined>(
    variants.find((v) => (v.stock ?? 1) > 0)?.id ?? variants[0]?.id,
  );
  const [qty, setQty] = useState(1);

  const selectedVariant = variants.find((v) => v.id === variantId);
  const basePrice =
    p.priceMinor !== undefined ? p.priceMinor / 100 : parsePriceLabel(p.price);
  const unitPrice = basePrice + (selectedVariant?.priceDelta ?? 0);
  const stock = selectedVariant?.stock ?? p.stock;
  const outOfStock = stock !== undefined && stock <= 0;
  const maxQty = stock ?? 99;

  return (
    <>
      <div className="product-modal-media media">
        <ProductSurface label={p.name} images={p.images} />
        {p.id && (
          <div className="product-modal-heart">
            <WishlistHeart
              productId={p.id}
              isFavorite={isFavorite}
              isAuthenticated={!!isAuthenticated}
            />
          </div>
        )}
      </div>
      <div className="product-modal-info">
        <h2 className="t-display">{p.name}</h2>
        {p.tag ? <p className="t-body">{p.tag}</p> : null}
        <p className="t-price tabular product-modal-price">
          {discount ? <span className="price-was">{discount.was}</span> : null}
          {priceLabel(Math.round(unitPrice * 100))}
        </p>
        {discount && <p className="t-small t-muted">{discount.notice}</p>}

        {variants.length > 0 && (
          <div className="buy-variants">
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
                  </button>
                );
              })}
            </div>
          </div>
        )}

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
            onClick={() => {
              if (outOfStock) return;
              const item = toCartItem(p, selectedVariant);
              if (!item) return;
              for (let i = 0; i < qty; i += 1) addToCart(item);
              trackCartAdd(item, qty);
              onClose();
            }}
          >
            {outOfStock ? (
              "Tükendi"
            ) : (
              <>
                Sepete ekle <span aria-hidden="true">|</span>{" "}
                <span className="tabular">
                  {priceLabel(Math.round(unitPrice * qty * 100))}
                </span>
              </>
            )}
          </button>
        </div>

        {stock !== undefined &&
        !outOfStock &&
        p.lowStockThreshold !== undefined &&
        stock <= p.lowStockThreshold ? (
          <p className="t-small field-error">Son {stock} adet</p>
        ) : null}

        <p className="t-body product-modal-desc">{p.desc}</p>

        {/* The product's own details (product-facts.ts). */}
        {facts.length > 0 && (
          <dl className="ruled-rows">
            {facts.map((f) => (
              <div key={f.k}>
                <dt className="t-label">{f.k}</dt>
                <dd className="t-small">
                  <ProductFactValue fact={f} contact={contact} />
                </dd>
              </div>
            ))}
          </dl>
        )}

        <p className="t-small t-muted">
          İstanbul içi aynı gün · Yurt içi 2-3 iş günü · 14 gün iade hakkı
          (çabuk bozulan gıda, açılmış hijyen ürünü ve sana özel hazırlanan ürün
          hariç).
        </p>

        {p.slug && (
          <a href={productPath(p.slug)} className="link-u">
            Tüm detayları gör
          </a>
        )}
      </div>
    </>
  );
}

function WishlistHeart({
  productId,
  isFavorite,
  isAuthenticated,
}: {
  productId: string;
  isFavorite: boolean;
  isAuthenticated: boolean;
}) {
  // Signing in, or toggling, returns the visitor to the page they were on;
  // the form used to post back="/" and dropped them on the home page.
  const pathname = usePathname() || "/";
  if (!isAuthenticated) {
    return (
      <a
        href={`/uye/giris?next=${encodeURIComponent(pathname)}`}
        aria-label="Favorilere eklemek için giriş yap"
        title="Favorilere eklemek için giriş yap"
        className="wishlist-heart"
        onClick={(e) => e.stopPropagation()}
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinejoin="round"
        >
          <path d="M12 21s-7-4.5-9.5-9.5C.7 7.2 4 3 8 4.5c2 .8 3 2.5 4 4 1-1.5 2-3.2 4-4 4-1.5 7.3 2.7 5.5 7C19 16.5 12 21 12 21Z" />
        </svg>
      </a>
    );
  }
  return (
    <form action={toggleWishlistAction} onClick={(e) => e.stopPropagation()}>
      <input type="hidden" name="productId" value={productId} />
      <input type="hidden" name="back" value={pathname} />
      <button
        type="submit"
        aria-label={isFavorite ? "Favoriden çıkar" : "Favorilere ekle"}
        title={isFavorite ? "Favoriden çıkar" : "Favorilere ekle"}
        className="wishlist-heart"
        data-active={isFavorite ? "true" : undefined}
      >
        <svg
          viewBox="0 0 24 24"
          fill={isFavorite ? "currentColor" : "none"}
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinejoin="round"
        >
          <path d="M12 21s-7-4.5-9.5-9.5C.7 7.2 4 3 8 4.5c2 .8 3 2.5 4 4 1-1.5 2-3.2 4-4 4-1.5 7.3 2.7 5.5 7C19 16.5 12 21 12 21Z" />
        </svg>
      </button>
    </form>
  );
}

/* Search lives in its own module; re-exported so the shell's import stays. */
export { SearchOverlay } from "./search-overlay";
