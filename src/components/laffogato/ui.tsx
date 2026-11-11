"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRef, useState, type ReactNode } from "react";

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
import { parsePriceLabel, shortProductName } from "@/lib/utils/format";
import { cx } from "./cx";

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

export function ProductCard({
  product,
  idx = 0,
  addToCart,
  onOpen,
}: ProductCardProps) {
  const p = product;
  const outOfStock = p.stock !== undefined && p.stock <= 0;
  const lowStock =
    !outOfStock &&
    p.stock !== undefined &&
    p.lowStockThreshold !== undefined &&
    p.stock <= p.lowStockThreshold;
  const name = shortProductName(p.name);
  const label = name.split(" ")[0];
  const href = p.slug ? productPath(p.slug) : undefined;
  // A product sold in variants cannot go in from the card: the "+" opens it
  // so the variant is chosen first (toCartItem refuses a line without one).
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
  // it does not (the related row on a product page) it is a plain link to
  // the product - it used to be a dead surface there, with two dead buttons.
  const onCardClick = (e: React.MouseEvent) => {
    if (!onOpen) return;
    e.preventDefault();
    onOpen(p);
  };

  const flag = outOfStock
    ? { text: "Tükendi", cls: "out" }
    : p.isNew
      ? { text: "Yeni", cls: "new" }
      : p.featured
        ? { text: "Öne çıkan", cls: "gold" }
        : lowStock
          ? { text: `Son ${p.stock}`, cls: "low" }
          : { text: SHOP_CAT_LABELS[p.cat] ?? p.tag, cls: "" };

  const body = (
    <>
      <div className="product-card-img">
        <ProductSurface
          cat={p.cat}
          tone={p.img}
          label={label}
          sub={p.tag}
          images={p.images}
        />
        <div className={`product-card-flag ${flag.cls}`}>{flag.text}</div>
      </div>
      <div className="product-card-meta">
        <div className="product-card-cat">{p.tag}</div>
        <h3 className="product-card-name">{name}</h3>
      </div>
    </>
  );

  return (
    <article
      className="product-card reveal"
      style={{ transitionDelay: `${(idx % 8) * 60}ms` }}
    >
      {href ? (
        <a className="product-card-link" href={href} onClick={onCardClick}>
          {body}
        </a>
      ) : (
        <div
          className="product-card-link"
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
      <div className="product-card-foot">
        <div className="product-card-pricing">
          <div className="product-card-price">
            <span>{p.price}</span>
            {discount && <span className="was">{discount.was}</span>}
          </div>
          {/* The discount's days, wherever the struck price is (m.14/1). */}
          {discount && (
            <span className="product-card-discount">{discount.short}</span>
          )}
        </div>
        {addToCart && !outOfStock && needsChoice ? (
          onOpen ? (
            <button
              type="button"
              className="product-card-add"
              data-kind="options"
              onClick={() => onOpen(p)}
              aria-label={`${name} - seçenekleri gör`}
              title="Seçenekleri gör"
            >
              <OptionsGlyph />
            </button>
          ) : href ? (
            <a
              className="product-card-add"
              data-kind="options"
              href={href}
              aria-label={`${name} - seçenekleri gör`}
              title="Seçenekleri gör"
            >
              <OptionsGlyph />
            </a>
          ) : null
        ) : addToCart ? (
          <button
            type="button"
            className="product-card-add"
            onClick={onAdd}
            disabled={outOfStock}
            aria-label={
              outOfStock ? `${name} - tükendi` : `${name} - sepete ekle`
            }
          >
            <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path
                d="M8 3v10M3 8h10"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
              />
            </svg>
          </button>
        ) : null}
      </div>
    </article>
  );
}

/** The card's "choose an option" disc: a chevron, not the "+" that adds. */
function OptionsGlyph() {
  return (
    <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M6 3.5 10.5 8 6 12.5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function SectionHead({
  eyebrow,
  title,
  action,
  alignment = "split",
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  action?: ReactNode;
  alignment?: "split" | "center";
}) {
  if (alignment === "center") {
    return (
      <div className="reveal" style={{ textAlign: "center", marginBottom: 50 }}>
        {eyebrow && (
          <div className="eyebrow" style={{ marginBottom: 16 }}>
            {eyebrow}
          </div>
        )}
        <h2 className="h1">{title}</h2>
      </div>
    );
  }
  return (
    <div className="reveal section-head">
      <div>
        {eyebrow && <div className="eyebrow">{eyebrow}</div>}
        <h2 className="h1" style={{ marginTop: 16 }}>
          {title}
        </h2>
      </div>
      {action && <div>{action}</div>}
    </div>
  );
}

export function Stat({
  n,
  l,
  d,
}: {
  n: ReactNode;
  l: ReactNode;
  d?: ReactNode;
}) {
  return (
    <div>
      <div
        style={{
          fontFamily: "var(--headline)",
          fontStyle: "normal",
          fontWeight: 400,
          fontSize: "clamp(36px, 4vw, 56px)",
          lineHeight: 1,
          letterSpacing: "-0.02em",
        }}
      >
        {n}
      </div>
      <div className="eyebrow" style={{ marginTop: 10 }}>
        {l}
      </div>
      {d && (
        <div
          style={{
            fontSize: 13,
            color: "var(--ink-soft)",
            marginTop: 8,
            lineHeight: 1.5,
          }}
        >
          {d}
        </div>
      )}
    </div>
  );
}

export function DetailRow({ k, v }: { k: string; v: ReactNode }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "110px 1fr",
        gap: 18,
        padding: "10px 0",
        borderTop: "1px solid var(--ink-line)",
        // A label row runs to several lines (ingredients, nutrition): the
        // name sits on its first line, not in the middle of the block.
        alignItems: "baseline",
      }}
    >
      <div className="eyebrow">{k}</div>
      <div
        style={{
          fontSize: 14,
          color: "var(--ink-soft)",
          whiteSpace: "pre-line",
          overflowWrap: "anywhere",
        }}
      >
        {v}
      </div>
    </div>
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
}

export function CartDrawer({
  open,
  onClose,
  items,
  removeItem,
  setQty,
  freeShippingThreshold = 0,
}: CartDrawerProps) {
  const panelRef = useRef<HTMLElement | null>(null);
  useDialog(open, onClose, panelRef);

  const total = items.reduce((s, it) => s + (it.price || 0) * (it.qty || 1), 0);
  const itemCount = items.reduce((s, it) => s + (it.qty || 1), 0);

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
        <div className="cart-grip" aria-hidden="true" />
        <header className="cart-drawer-header">
          <div>
            <p className="cart-drawer-kicker">Sepetin</p>
            <p className="cart-drawer-title">{itemCount} ürün</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="nav-icon-btn"
            aria-label="Kapat"
          >
            <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true">
              <path
                d="M3 3 L13 13 M13 3 L3 13"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
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
              <div className="cart-empty-disc" aria-hidden="true">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M5.25 8.25h13.5l-.9 11.1a1 1 0 0 1-1 .9H7.15a1 1 0 0 1-1-.9l-.9-11.1Z"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M9 10.5V7.5a3 3 0 0 1 6 0v3"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                  />
                </svg>
              </div>
              <p className="cart-empty-title">Sepetin boş</p>
              <Link
                href="/magaza"
                className="btn btn-primary"
                onClick={onClose}
              >
                Mağazaya göz at
              </Link>
            </div>
          ) : (
            <ul className="cart-lines">
              {items.map((it, i) => {
                const qty = it.qty || 1;
                const lineTotal = (it.price || 0) * qty;
                const atMax = it.maxStock !== undefined && qty >= it.maxStock;
                return (
                  <li key={cartItemKey(it) + i} className="cart-item-grid">
                    <div className="cart-item-thumb">
                      <ProductSurface
                        cat={it.cat ?? "gift"}
                        tone={it.img ?? "cream"}
                        label={it.name}
                      />
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
                        {Math.round(lineTotal)}₺
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
        {items.length > 0 && <CartFooter total={total} items={items} />}
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
            <strong>{Math.round(remaining)}₺</strong> daha ekle, kargo bizden
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
        <span className="cart-sum tabular">{Math.round(total)}₺</span>
      </div>
      <div className="cart-sum-note">
        <span>Kargo</span>
        <span>Ödeme adımında hesaplanır</span>
      </div>
      <a
        href="/odeme"
        className="btn btn-ink btn-lg cart-checkout"
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
        <span className="arrow">→</span>
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
    <div
      onClick={onClose}
      className="product-modal-overlay"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 90,
        background: "var(--glass-dim)",
        backdropFilter: "blur(8px)",
        display: "grid",
        placeItems: "center",
        padding: "clamp(16px, 4vw, 40px)",
        animation: "pageIn 0.3s cubic-bezier(0.2, 0.7, 0.2, 1)",
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={product.name}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "min(1080px, 100%)",
          maxHeight: "92vh",
          background: "var(--bg)",
          borderRadius: "var(--r-card)",
          boxShadow: "var(--shadow-lg)",
          overflow: "hidden",
          display: "grid",
          // minmax(0, 1fr): with a bare 1fr the photo's 4/5 box widened
          // with the row, so a longer detail list squeezed the text column.
          gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)",
          position: "relative",
        }}
        className="product-modal"
      >
        <button
          onClick={onClose}
          aria-label="Kapat"
          style={{
            position: "absolute",
            top: 18,
            right: 18,
            zIndex: 5,
            width: 38,
            height: 38,
            borderRadius: "50%",
            background: "var(--frost-chrome)",
            backdropFilter: "blur(10px)",
            display: "grid",
            placeItems: "center",
          }}
        >
          <svg width="14" height="14" viewBox="0 0 16 16">
            <path
              d="M3 3 L13 13 M13 3 L3 13"
              stroke="currentColor"
              strokeWidth="1.4"
              strokeLinecap="round"
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
  const label = shortProductName(p.name).split(" ")[0];
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
      {/* At least the row's height: a long detail list makes the row
          taller than the 4/5 photo, which left a bare strip under it. The
          width stays the column's, or the ratio would widen it again. */}
      <div
        style={{
          aspectRatio: "4/5",
          width: "100%",
          minHeight: "100%",
          position: "relative",
        }}
      >
        <ProductSurface
          cat={p.cat}
          tone={p.img}
          label={label}
          sub={p.tag}
          images={p.images}
        />
        {p.id && (
          <div style={{ position: "absolute", top: 14, left: 14, zIndex: 4 }}>
            <WishlistHeart
              productId={p.id}
              isFavorite={isFavorite}
              isAuthenticated={!!isAuthenticated}
            />
          </div>
        )}
      </div>
      <div
        style={{
          padding: "clamp(28px, 4vw, 50px)",
          // The panel's own height, so the column scrolls instead of the
          // "Sepete ekle" row being cut off at the panel's edge.
          maxHeight: "92vh",
          overflowY: "auto",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div className="eyebrow" style={{ marginBottom: 14 }}>
          {p.tag}
        </div>
        <h2 className="pdp-title" style={{ marginTop: 0 }}>
          {p.name}
        </h2>
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            gap: 12,
            marginTop: 16,
          }}
        >
          <span
            style={{
              fontFamily: "var(--display)",
              fontStyle: "normal",
              fontWeight: 800,
              letterSpacing: "-0.02em",
              fontVariantNumeric: "tabular-nums",
              fontSize: 28,
            }}
          >
            {Math.round(unitPrice)}₺
          </span>
          {discount && (
            <span
              style={{
                textDecoration: "line-through",
                color: "var(--ink-mute)",
                fontSize: 18,
              }}
            >
              {discount.was}
            </span>
          )}
        </div>
        {discount && <p className="pdp-discount-note">{discount.notice}</p>}
        <p
          style={{ marginTop: 22, lineHeight: 1.65, color: "var(--ink-soft)" }}
        >
          {p.desc}
        </p>

        {variants.length > 0 && (
          <div style={{ marginTop: 24 }}>
            <div className="eyebrow" style={{ marginBottom: 10 }}>
              Seçenek
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {variants.map((v) => {
                const vOut = v.stock !== undefined && v.stock <= 0;
                return (
                  <button
                    key={v.id}
                    type="button"
                    className="variant-chip"
                    data-active={v.id === variantId ? "true" : undefined}
                    disabled={vOut}
                    onClick={() => {
                      setVariantId(v.id);
                      setQty(1);
                    }}
                  >
                    {v.name}
                    {v.priceDelta
                      ? ` · ${v.priceDelta > 0 ? "+" : ""}${Math.round(v.priceDelta)}₺`
                      : ""}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* The product's own details (product-facts.ts): the fixed rows
            per shelf this replaced gave the chasen a Bialetti warranty. */}
        {facts.length > 0 && (
          <div style={{ marginTop: 24, display: "grid", gap: 14 }}>
            {facts.map((f) => (
              <DetailRow
                key={f.k}
                k={f.k}
                v={<ProductFactValue fact={f} contact={contact} />}
              />
            ))}
          </div>
        )}

        {stock !== undefined && (
          <div style={{ marginTop: 18, fontSize: 13 }}>
            {outOfStock ? (
              <span style={{ color: "var(--ink-mute)" }}>● Şu an tükendi</span>
            ) : p.lowStockThreshold !== undefined &&
              stock <= p.lowStockThreshold ? (
              <span style={{ color: "var(--rose)" }}>● Son {stock} adet</span>
            ) : (
              <span style={{ color: "var(--matcha)" }}>● Stokta</span>
            )}
          </div>
        )}

        <div
          style={{
            marginTop: 24,
            display: "flex",
            gap: 10,
            flexWrap: "wrap",
            alignItems: "center",
          }}
        >
          <div className="qty-stepper-pill">
            <button
              type="button"
              aria-label="Azalt"
              onClick={() => setQty((q) => Math.max(1, q - 1))}
              disabled={outOfStock}
            >
              −
            </button>
            <span className="qty-stepper-val tabular">{qty}</span>
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
            className="btn btn-primary btn-lg"
            style={{ flex: 1, justifyContent: "center" }}
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
                Sepete ekle · {Math.round(unitPrice * qty)}₺{" "}
                <span className="arrow">→</span>
              </>
            )}
          </button>
        </div>

        {p.slug && (
          <a
            href={productPath(p.slug)}
            className="modal-pdp-link"
            style={{ marginTop: 16 }}
          >
            Tüm detayları gör →
          </a>
        )}

        <div
          style={{
            marginTop: 20,
            padding: 18,
            background: "var(--bg-warm)",
            borderRadius: "var(--r-sm)",
          }}
        >
          <div className="eyebrow" style={{ marginBottom: 8 }}>
            Teslimat · İade
          </div>
          <div
            style={{ fontSize: 13, color: "var(--ink-soft)", lineHeight: 1.6 }}
          >
            İstanbul içi aynı gün · Yurt içi 2-3 iş günü · 14 gün iade hakkı
            (çabuk bozulan gıda, açılmış hijyen ürünü ve sana özel hazırlanan
            ürün hariç).
          </div>
        </div>
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
        style={{ position: "relative", top: 0, left: 0 }}
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
        style={{ position: "relative", top: 0, left: 0 }}
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
