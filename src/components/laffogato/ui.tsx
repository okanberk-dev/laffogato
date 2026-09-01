"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";

import { toggleWishlistAction } from "@/app/uye/actions";
import { productPath } from "./route-paths";

import type { MenuCategory, Product } from "./data";
import { EspressoCup, PhotoSurface, ProductSurface } from "./visuals";
import { parsePriceLabel } from "@/lib/utils/format";

export interface CartItem {
  /** Stable product id — preferred match key for merge + server resolution. */
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
  /** Shop category — drives the cart thumbnail illustration. */
  cat?: string;
  /** Max purchasable qty (stock); clamps the stepper. */
  maxStock?: number;
}

/** Stable cart key — same product+variant lines merge into one. */
export function cartItemKey(it: {
  productId?: string;
  variantId?: string;
  name: string;
}): string {
  return `${it.productId ?? it.name}::${it.variantId ?? ""}`;
}

/** Build a CartItem from a Product (+ optional variant) with all metadata. */
export function toCartItem(
  p: Product,
  variant?: { id: string; name: string; priceDelta: number; stock?: number },
): CartItem {
  const base =
    p.priceMinor !== undefined ? p.priceMinor / 100 : parsePriceLabel(p.price);
  const price = base + (variant?.priceDelta ?? 0);
  return {
    productId: p.id,
    variantId: variant?.id,
    variantName: variant?.name,
    name: p.name,
    price,
    tag: p.tag,
    slug: p.slug,
    img: p.img,
    cat: p.cat,
    maxStock: variant?.stock ?? p.stock,
  };
}

export interface ProductCardProps {
  product: Product;
  idx?: number;
  addToCart?: (item: CartItem) => void;
  onOpen?: (product: Product) => void;
}

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
  const onAdd = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (outOfStock) return;
    if (addToCart) addToCart(toCartItem(p));
  };
  const onClick = (e: React.MouseEvent) => {
    e.preventDefault();
    if (onOpen) onOpen(p);
  };
  const label = p.name.split("—")[0].trim().split(" ")[0];
  const href = p.slug ? productPath(p.slug) : undefined;

  return (
    <div
      className="product-card reveal"
      style={{ transitionDelay: `${(idx % 8) * 60}ms` }}
      onClick={onClick}
    >
      <div className="product-card-img">
        <ProductSurface
          cat={p.cat}
          tone={p.img}
          label={label}
          sub={p.tag}
          images={p.images}
        />
        {outOfStock ? (
          <div
            className="product-card-flag"
            style={{ background: "var(--ink-soft)" }}
          >
            TÜKENDİ
          </div>
        ) : (
          <>
            {p.featured && (
              <div className="product-card-flag gold">ÖNE ÇIKAN</div>
            )}
            {p.isNew && <div className="product-card-flag new">NUOVO</div>}
            {!p.featured && !p.isNew && lowStock && (
              <div
                className="product-card-flag"
                style={{ background: "var(--rose)" }}
              >
                SON {p.stock}
              </div>
            )}
            {!p.featured && !p.isNew && !lowStock && (
              <div className="product-card-flag">{p.cat.toUpperCase()}</div>
            )}
          </>
        )}
        <div className="product-card-quick">
          <button onClick={onAdd} disabled={outOfStock}>
            {outOfStock ? "Tükendi" : "+ Sepete ekle"}
          </button>
          <button onClick={onClick}>Hızlı bak</button>
        </div>
      </div>
      <div className="product-card-meta">
        <div className="product-card-cat">{p.tag}</div>
        <h3 className="product-card-name">
          {href ? (
            <a
              href={href}
              onClick={(e) => e.stopPropagation()}
              style={{ color: "inherit", textDecoration: "none" }}
            >
              {p.name.split("—")[0].trim()}
            </a>
          ) : (
            p.name.split("—")[0].trim()
          )}
        </h3>
        <div className="product-card-price">
          <span>{p.price}</span>
          {p.compareAtPrice && <span className="was">{p.compareAtPrice}</span>}
        </div>
      </div>
    </div>
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
          fontFamily: "var(--serif)",
          fontStyle: "normal",
          fontWeight: 500,
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

export function DetailRow({ k, v }: { k: string; v: string }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "110px 1fr",
        gap: 18,
        padding: "10px 0",
        borderTop: "1px solid var(--ink-line)",
      }}
    >
      <div className="eyebrow" style={{ alignSelf: "center" }}>
        {k}
      </div>
      <div style={{ fontSize: 14, color: "var(--ink-soft)" }}>{v}</div>
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
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    document.body.classList.add("is-no-scroll");
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.classList.remove("is-no-scroll");
    };
  }, [open, onClose]);

  const total = items.reduce((s, it) => s + (it.price || 0) * (it.qty || 1), 0);
  const itemCount = items.reduce((s, it) => s + (it.qty || 1), 0);

  return (
    <>
      <div
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 70,
          background: "rgba(20, 16, 11, 0.6)",
          backdropFilter: "blur(6px)",
          opacity: open ? 1 : 0,
          pointerEvents: open ? "auto" : "none",
          transition: "opacity 0.3s",
        }}
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Sepetin"
        style={{
          position: "fixed",
          top: 0,
          right: 0,
          bottom: 0,
          zIndex: 71,
          width: "min(440px, 100vw)",
          background: "#FFF",
          transform: `translateX(${open ? "0" : "100%"})`,
          transition: "transform 0.45s cubic-bezier(0.2, 0.7, 0.2, 1)",
          display: "flex",
          flexDirection: "column",
          boxShadow: "-20px 0 60px rgba(0,0,0,0.12)",
        }}
      >
        <header
          className="cart-drawer-header"
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            borderBottom: "1px solid var(--ink-line)",
          }}
        >
          <div>
            <div className="eyebrow" style={{ marginBottom: 4 }}>
              Sepetin
            </div>
            <div
              style={{
                fontFamily: "var(--serif)",
                fontStyle: "normal",
                fontSize: 24,
                lineHeight: 1,
              }}
            >
              {itemCount} ürün
            </div>
          </div>
          <button onClick={onClose} className="nav-icon-btn" aria-label="Kapat">
            <svg width="14" height="14" viewBox="0 0 16 16">
              <path
                d="M3 3 L13 13 M13 3 L3 13"
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </header>
        {items.length > 0 && freeShippingThreshold > 0 && (
          <FreeShippingBar total={total} threshold={freeShippingThreshold} />
        )}
        <div
          className="cart-drawer-body"
          style={{ flex: 1, overflowY: "auto" }}
        >
          {items.length === 0 ? (
            <div style={{ textAlign: "center", padding: "60px 20px" }}>
              <div
                style={{
                  width: 72,
                  height: 72,
                  borderRadius: "50%",
                  background: "var(--bg-warm)",
                  display: "grid",
                  placeItems: "center",
                  margin: "0 auto 22px",
                }}
              >
                <svg width="28" height="28" viewBox="0 0 16 16" fill="none">
                  <path
                    d="M2 3 L4 3 L5.5 11 L13 11 L14 5 L5 5"
                    stroke="var(--ink-mute)"
                    strokeWidth="1.4"
                    strokeLinejoin="round"
                    strokeLinecap="round"
                  />
                </svg>
              </div>
              <div
                style={{
                  fontFamily: "var(--serif)",
                  fontStyle: "normal",
                  fontSize: 28,
                  lineHeight: 1.1,
                }}
              >
                Sepetin boş.
              </div>
              <p
                style={{
                  color: "var(--ink-mute)",
                  marginTop: 14,
                  fontSize: 14,
                  lineHeight: 1.6,
                  maxWidth: 280,
                  marginLeft: "auto",
                  marginRight: "auto",
                }}
              >
                Bir affogato, bir matcha, bir çekirdek paketi — eve ya da köşkün
                bahçesine servise hazır.
              </p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {items.map((it, i) => {
                const qty = it.qty || 1;
                const lineTotal = (it.price || 0) * qty;
                const atMax = it.maxStock !== undefined && qty >= it.maxStock;
                return (
                  <div
                    key={cartItemKey(it) + i}
                    className="cart-item-grid"
                    style={{
                      alignItems: "center",
                      padding: 12,
                      border: "1px solid var(--ink-line)",
                      borderRadius: "var(--r-md)",
                    }}
                  >
                    <div
                      className="cart-item-thumb"
                      style={{
                        borderRadius: "var(--r-sm)",
                        overflow: "hidden",
                      }}
                    >
                      <ProductSurface
                        cat={it.cat ?? "gift"}
                        tone={it.img ?? "cream"}
                        label={it.name}
                      />
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div
                        style={{
                          fontFamily: "var(--serif-display)",
                          fontSize: 16,
                          lineHeight: 1.2,
                        }}
                      >
                        {it.name.split("—")[0].trim()}
                      </div>
                      {it.variantName && (
                        <div
                          style={{
                            fontSize: 12,
                            color: "var(--ink-soft)",
                            marginTop: 2,
                          }}
                        >
                          {it.variantName}
                        </div>
                      )}
                      {setQty ? (
                        <div
                          className="cart-qty-stepper"
                          style={{ marginTop: 8 }}
                        >
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
                        <div
                          style={{
                            fontFamily: "var(--mono)",
                            fontSize: 11,
                            color: "var(--ink-mute)",
                            marginTop: 4,
                          }}
                        >
                          x{qty}
                        </div>
                      )}
                      {atMax && (
                        <div
                          style={{
                            fontSize: 10,
                            color: "var(--rose)",
                            marginTop: 4,
                          }}
                        >
                          Stok sınırı
                        </div>
                      )}
                    </div>
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "flex-end",
                        gap: 6,
                      }}
                    >
                      <div style={{ fontFamily: "var(--mono)", fontSize: 13 }}>
                        {Math.round(lineTotal)}₺
                      </div>
                      <button
                        onClick={() => removeItem(i)}
                        style={{
                          fontFamily: "var(--mono)",
                          fontSize: 10,
                          letterSpacing: "0.18em",
                          textTransform: "uppercase",
                          color: "var(--ink-mute)",
                        }}
                      >
                        Sil
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
        {items.length > 0 && <CartFooter total={total} />}
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

function CartFooter({ total }: { total: number }) {
  return (
    <footer
      className="cart-drawer-foot"
      style={{ borderTop: "1px solid var(--ink-line)" }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          marginBottom: 10,
          fontSize: 14,
          color: "var(--ink-soft)",
        }}
      >
        <span>Ara toplam</span>
        <span className="tabular" style={{ fontFamily: "var(--mono)" }}>
          {Math.round(total)}₺
        </span>
      </div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          marginBottom: 20,
          fontSize: 12,
          color: "var(--ink-mute)",
        }}
      >
        <span>Kargo</span>
        <span>Ödeme adımında hesaplanır</span>
      </div>
      <a
        href="/odeme"
        className="btn btn-primary btn-lg"
        style={{ width: "100%", justifyContent: "center" }}
      >
        Ödemeye geç
        <span className="arrow">→</span>
      </a>
      <p
        style={{
          margin: "12px 0 0",
          fontSize: 11,
          letterSpacing: "0.04em",
          color: "var(--ink-mute)",
          textAlign: "center",
          lineHeight: 1.55,
        }}
      >
        Adres ve indirim kodu bir sonraki adımda eklenir.
      </p>
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
}: {
  product: Product | null;
  onClose: () => void;
  addToCart: (item: CartItem) => void;
  wishlist?: string[];
  isAuthenticated?: boolean;
}) {
  useEffect(() => {
    if (!product) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    document.body.classList.add("is-no-scroll");
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.classList.remove("is-no-scroll");
    };
  }, [product, onClose]);

  if (!product) return null;
  return (
    <div
      onClick={onClose}
      className="product-modal-overlay"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 90,
        background: "rgba(20, 16, 11, 0.7)",
        backdropFilter: "blur(10px)",
        display: "grid",
        placeItems: "center",
        padding: "clamp(16px, 4vw, 40px)",
        animation: "pageIn 0.3s cubic-bezier(0.2, 0.7, 0.2, 1)",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "min(1080px, 100%)",
          maxHeight: "92vh",
          background: "#FFF",
          borderRadius: "var(--r-lg)",
          overflow: "hidden",
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          position: "relative",
        }}
        className="product-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Ürün detayı"
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
            background: "rgba(255, 255, 255, 0.92)",
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
        <ProductModalBody
          product={product}
          onClose={onClose}
          addToCart={addToCart}
          wishlist={wishlist}
          isAuthenticated={isAuthenticated}
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
}: {
  product: Product;
  onClose: () => void;
  addToCart: (item: CartItem) => void;
  wishlist?: string[];
  isAuthenticated?: boolean;
}) {
  const label = p.name.split("—")[0].trim().split(" ")[0];
  const isFavorite = !!(p.id && wishlist?.includes(p.id));
  const variants = (p.variants ?? []).filter((v) => v.isActive !== false);
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
      <div style={{ aspectRatio: "4/5", position: "relative" }}>
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
          overflowY: "auto",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div className="eyebrow" style={{ marginBottom: 14 }}>
          {p.tag}
        </div>
        <h2 className="h2">{p.name}</h2>
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
              fontFamily: "var(--serif)",
              fontStyle: "normal",
              fontSize: 28,
            }}
          >
            {Math.round(unitPrice)}₺
          </span>
          {p.compareAtPrice && (
            <span
              style={{
                textDecoration: "line-through",
                color: "var(--ink-mute)",
                fontSize: 18,
              }}
            >
              {p.compareAtPrice}
            </span>
          )}
        </div>
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

        <div style={{ marginTop: 24, display: "grid", gap: 14 }}>
          {p.cat === "beans" && (
            <>
              <DetailRow k="Köken" v="Brezilya doğal + Etiyopya yıkanmış" />
              <DetailRow k="Tat notları" v="Kakao · kuru incir · esmer şeker" />
              <DetailRow k="Demleme" v="Espresso, moka, AeroPress" />
            </>
          )}
          {p.cat === "gift" && (
            <>
              <DetailRow k="İçerik" v="Edible cup · sleeve" />
              <DetailRow k="Saklama" v="Kuru, serin · 90 gün" />
              <DetailRow k="Alerjenler" v="Gluten · süt · soya izi" />
            </>
          )}
          {p.cat === "gear" && (
            <>
              <DetailRow k="Marka" v="Bialetti × L'Affogato" />
              <DetailRow k="Garanti" v="2 yıl" />
            </>
          )}
        </div>

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
              for (let i = 0; i < qty; i += 1) addToCart(item);
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
            İstanbul içi aynı gün · Yurt içi 2–3 iş günü · 14 gün açılmamış
            ürünlerde iade.
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
  if (!isAuthenticated) {
    return (
      <a
        href="/uye/giris"
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
      <input type="hidden" name="back" value="/" />
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

/* ─────────────────────────────────────────────────────────────
   Search overlay — site-wide product + menu search
   ───────────────────────────────────────────────────────────── */

interface SearchResult {
  kind: "product" | "menu";
  name: string;
  sub: string;
  price?: string;
  href?: string;
  product?: Product;
}

export function SearchOverlay({
  open,
  onClose,
  products,
  menu,
  onOpenProduct,
}: {
  open: boolean;
  onClose: () => void;
  products: Product[];
  menu: Record<string, MenuCategory>;
  onOpenProduct?: (p: Product) => void;
}) {
  const [q, setQ] = useState("");

  useEffect(() => {
    if (!open) return;
    setQ("");
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    document.body.classList.add("is-no-scroll");
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.classList.remove("is-no-scroll");
    };
  }, [open, onClose]);

  const term = q.trim().toLowerCase();
  const results: SearchResult[] = [];
  if (term.length >= 2) {
    for (const p of products) {
      const hay = `${p.name} ${p.tag} ${p.desc} ${p.cat}`.toLowerCase();
      if (hay.includes(term)) {
        results.push({
          kind: "product",
          name: p.name,
          sub: p.tag,
          price: p.price,
          href: p.slug ? productPath(p.slug) : undefined,
          product: p,
        });
      }
    }
    for (const [, cat] of Object.entries(menu)) {
      for (const it of cat.items) {
        const hay =
          `${it.name} ${it.desc} ${(it.tags ?? []).join(" ")}`.toLowerCase();
        if (hay.includes(term)) {
          results.push({
            kind: "menu",
            name: it.name,
            sub: cat.title,
            price: it.price,
          });
        }
      }
    }
  }
  const productResults = results
    .filter((r) => r.kind === "product")
    .slice(0, 8);
  const menuResults = results.filter((r) => r.kind === "menu").slice(0, 6);

  if (!open) return null;

  return (
    <div className="search-overlay" onClick={onClose}>
      <div
        className="search-panel"
        role="dialog"
        aria-modal="true"
        aria-label="Site içi arama"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="search-input-row">
          <svg
            width="18"
            height="18"
            viewBox="0 0 16 16"
            fill="none"
            aria-hidden
          >
            <circle
              cx="7"
              cy="7"
              r="5"
              stroke="currentColor"
              strokeWidth="1.4"
            />
            <path
              d="M11 11 L14 14"
              stroke="currentColor"
              strokeWidth="1.4"
              strokeLinecap="round"
            />
          </svg>
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Ürün veya menü ara — espresso, matcha, edible cup…"
            aria-label="Ara"
          />
          <button onClick={onClose} className="search-close" aria-label="Kapat">
            ESC
          </button>
        </div>

        <div className="search-results">
          {term.length < 2 ? (
            <div className="search-hint">
              <span className="eyebrow">İpucu</span>
              <p>En az 2 harf yaz — çekirdek, matcha, hediye, affogato…</p>
              <div className="search-suggest">
                {["Affogato", "Matcha", "Edible cup", "Espresso", "Hediye"].map(
                  (s) => (
                    <button key={s} className="chip" onClick={() => setQ(s)}>
                      {s}
                    </button>
                  ),
                )}
              </div>
            </div>
          ) : productResults.length === 0 && menuResults.length === 0 ? (
            <div className="search-empty">
              <div
                style={{
                  fontFamily: "var(--serif)",
                  fontStyle: "normal",
                  fontSize: 24,
                }}
              >
                "{q}" için sonuç yok.
              </div>
              <p>Farklı bir kelime dene ya da mağazaya göz at.</p>
              <Link href="/magaza" className="btn btn-ghost btn-sm">
                Mağazaya git →
              </Link>
            </div>
          ) : (
            <>
              {productResults.length > 0 && (
                <div className="search-group">
                  <div className="eyebrow search-group-head">
                    Mağaza · {productResults.length}
                  </div>
                  {productResults.map((r, i) => {
                    const inner = (
                      <>
                        <div className="search-result-thumb">
                          <ProductSurface
                            cat={r.product?.cat ?? "gift"}
                            tone={r.product?.img ?? "cream"}
                            label={r.name}
                            images={r.product?.images}
                          />
                        </div>
                        <div className="search-result-info">
                          <div className="search-result-name">{r.name}</div>
                          <div className="search-result-sub">{r.sub}</div>
                        </div>
                        {r.price && (
                          <div className="search-result-price">{r.price}</div>
                        )}
                      </>
                    );
                    return r.href ? (
                      <a key={`p-${i}`} href={r.href} className="search-result">
                        {inner}
                      </a>
                    ) : (
                      <button
                        key={`p-${i}`}
                        className="search-result"
                        onClick={() => {
                          if (r.product && onOpenProduct) {
                            onOpenProduct(r.product);
                            onClose();
                          }
                        }}
                      >
                        {inner}
                      </button>
                    );
                  })}
                </div>
              )}
              {menuResults.length > 0 && (
                <div className="search-group">
                  <div className="eyebrow search-group-head">
                    Menü · {menuResults.length}
                  </div>
                  {menuResults.map((r, i) => (
                    <Link key={`m-${i}`} href="/menu" className="search-result">
                      <div className="search-result-thumb">
                        <PhotoSurface hue="caramel">
                          <div
                            style={{
                              width: "100%",
                              height: "100%",
                              display: "grid",
                              placeItems: "center",
                              padding: 6,
                            }}
                          >
                            <EspressoCup />
                          </div>
                        </PhotoSurface>
                      </div>
                      <div className="search-result-info">
                        <div className="search-result-name">{r.name}</div>
                        <div className="search-result-sub">{r.sub}</div>
                      </div>
                      {r.price && (
                        <div className="search-result-price">{r.price}</div>
                      )}
                    </Link>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
