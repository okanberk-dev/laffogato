"use client";

import Link from "next/link";
import { useState } from "react";

import type { Product } from "./data";
import { ProductCard, toCartItem, type CartItem } from "./ui";
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
    // private mode / quota — ignore
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
}: {
  product: Product;
  related: Product[];
}) {
  const variants = (p.variants ?? []).filter((v) => v.isActive !== false);
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
    p.priceMinor !== undefined ? p.priceMinor / 100 : parseFloat(p.price) || 0;
  const unitPrice = basePrice + (selectedVariant?.priceDelta ?? 0);
  const compareAt =
    p.compareAtPriceMinor !== undefined
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
  const savingsPct =
    compareAt && compareAt > unitPrice
      ? Math.round(((compareAt - unitPrice) / compareAt) * 100)
      : 0;

  const addToCart = (goCheckout: boolean) => {
    if (outOfStock) return;
    const item = toCartItem(p, selectedVariant);
    const key = cartKey(item);
    const cart = readCart();
    const existing = cart.find((c) => cartKey(c) === key);
    if (existing) {
      const cap = existing.maxStock ?? item.maxStock ?? 99;
      existing.qty = Math.min(cap, (existing.qty || 1) + qty);
      Object.assign(existing, { ...item, qty: existing.qty });
    } else {
      cart.push({ ...item, qty });
    }
    writeCart(cart);
    // Notify other components in this tab (storage event only fires cross-tab).
    window.dispatchEvent(
      new StorageEvent("storage", { key: CART_STORAGE_KEY }),
    );
    if (goCheckout) {
      window.location.href = "/odeme";
    } else {
      setAdded(true);
      window.setTimeout(() => setAdded(false), 2200);
    }
  };

  return (
    <main className="pdp">
      <div className="wrap-wide">
        <nav className="pdp-breadcrumb" aria-label="breadcrumb">
          <Link href="/">Ana Sayfa</Link>
          <span aria-hidden>/</span>
          <Link href="/magaza">Mağaza</Link>
          <span aria-hidden>/</span>
          <span>{p.name.split("—")[0].trim()}</span>
        </nav>

        <div className="pdp-grid">
          {/* Gallery */}
          <div className="pdp-gallery">
            <div className="pdp-gallery-main">
              {gallery.length > 0 ? (
                <ProductSurface
                  cat={p.cat}
                  tone={p.img}
                  label={p.name}
                  images={[gallery[activeImg]]}
                  priority
                />
              ) : (
                <ProductSurface
                  cat={p.cat}
                  tone={p.img}
                  label={p.name}
                  sub={p.tag}
                />
              )}
              {savingsPct > 0 && (
                <span className="pdp-save-badge">%{savingsPct} indirim</span>
              )}
            </div>
            {gallery.length > 1 && (
              <div className="pdp-gallery-thumbs">
                {gallery.map((img, i) => (
                  <button
                    key={img + i}
                    type="button"
                    className="pdp-thumb"
                    data-active={i === activeImg ? "true" : undefined}
                    onClick={() => setActiveImg(i)}
                    aria-label={`Görsel ${i + 1}`}
                  >
                    <ProductSurface
                      cat={p.cat}
                      tone={p.img}
                      label={p.name}
                      images={[img]}
                    />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Buy box */}
          <div className="pdp-info">
            <div
              style={{ display: "inline-flex", alignItems: "center", gap: 12 }}
            >
              <span
                aria-hidden="true"
                style={{
                  width: 28,
                  height: 1,
                  background:
                    "linear-gradient(90deg, var(--gold), transparent)",
                }}
              />
              <span className="eyebrow">{p.tag}</span>
            </div>
            <h1 className="pdp-title">{p.name}</h1>

            <div className="pdp-price-row">
              <span className="pdp-price">{Math.round(unitPrice)}₺</span>
              {compareAt && compareAt > unitPrice && (
                <span className="pdp-compare">{Math.round(compareAt)}₺</span>
              )}
              {savingsPct > 0 && (
                <span className="pdp-save-pill">−%{savingsPct}</span>
              )}
            </div>
            <div className="pdp-tax-note">KDV dahil fiyat</div>

            <p className="pdp-desc">{p.desc}</p>

            {/* Stock state */}
            {stock !== undefined && (
              <div className="pdp-stock">
                {outOfStock ? (
                  <span data-tone="out">● Şu an tükendi</span>
                ) : lowStock ? (
                  <span data-tone="low">● Son {stock} adet — acele et</span>
                ) : (
                  <span data-tone="in">● Stokta · hemen kargo</span>
                )}
              </div>
            )}

            {/* Variants */}
            {variants.length > 0 && (
              <div className="pdp-variants">
                <div className="eyebrow" style={{ marginBottom: 10 }}>
                  Seçenek
                </div>
                <div className="pdp-variant-list">
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
                        {vOut ? " (tükendi)" : ""}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Qty + add */}
            <div className="pdp-buy">
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
                type="button"
                className="btn btn-primary btn-lg"
                style={{ flex: 1, justifyContent: "center" }}
                disabled={outOfStock}
                onClick={() => addToCart(false)}
              >
                {outOfStock ? (
                  "Tükendi"
                ) : added ? (
                  "Sepete eklendi ✓"
                ) : (
                  <>Sepete ekle · {Math.round(unitPrice * qty)}₺</>
                )}
              </button>
            </div>
            {!outOfStock && (
              <button
                type="button"
                className="btn btn-ghost btn-lg pdp-buynow"
                onClick={() => addToCart(true)}
              >
                Hemen satın al <span className="arrow">→</span>
              </button>
            )}

            {/* Trust badges */}
            <ul className="pdp-trust">
              <li>
                <span aria-hidden>↗</span> İstanbul içi aynı gün teslimat
              </li>
              <li>
                <span aria-hidden>✦</span> 500₺ üzeri ücretsiz kargo
              </li>
              <li>
                <span aria-hidden>↻</span> 14 gün koşulsuz iade
              </li>
              <li>
                <span aria-hidden>🔒</span> 256-bit SSL · 3D Secure ödeme
              </li>
            </ul>

            {/* Accordions */}
            <div className="pdp-accordions">
              <Accordion title="Ürün detayları" defaultOpen>
                <DetailGrid product={p} />
              </Accordion>
              <Accordion title="Teslimat & kargo">
                <p>
                  İstanbul içi siparişler aynı gün, Türkiye geneli 2–3 iş günü
                  içinde teslim edilir. 500₺ ve üzeri siparişlerde kargo
                  ücretsizdir. Sipariş durumunu üyelik hesabından takip
                  edebilirsin.
                </p>
              </Accordion>
              <Accordion title="İade & değişim">
                <p>
                  Açılmamış ürünleri teslim aldıktan sonra 14 gün içinde
                  ücretsiz iade edebilirsin. İade talebin için{" "}
                  <a href="mailto:hello@laffogato.net">hello@laffogato.net</a>{" "}
                  adresine yazman yeterli.
                </p>
              </Accordion>
            </div>
          </div>
        </div>

        {/* Related */}
        {related.length > 0 && (
          <section className="pdp-related">
            <div className="section-head" style={{ marginBottom: 30 }}>
              <div>
                <div
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 12,
                  }}
                >
                  <span
                    aria-hidden="true"
                    style={{
                      width: 28,
                      height: 1,
                      background:
                        "linear-gradient(90deg, var(--gold), transparent)",
                    }}
                  />
                  <span className="eyebrow">Birlikte iyi gider</span>
                </div>
                <h2 className="h2" style={{ marginTop: 12 }}>
                  Bunları da sevebilirsin
                </h2>
              </div>
              <Link href="/magaza" className="btn btn-ghost btn-sm">
                Tüm mağaza →
              </Link>
            </div>
            <div className="shop-grid-3">
              {related.map((rp, i) => (
                <ProductCard key={rp.id ?? rp.name} product={rp} idx={i} />
              ))}
            </div>
          </section>
        )}
      </div>
    </main>
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
        <span>{title}</span>
        <span className="pdp-acc-icon" aria-hidden>
          {open ? "−" : "+"}
        </span>
      </button>
      {open && <div className="pdp-acc-body">{children}</div>}
    </div>
  );
}

function DetailGrid({ product: p }: { product: Product }) {
  const rows: Array<[string, string]> = [];
  if (p.sku) rows.push(["SKU", p.sku]);
  if (p.weightGrams) rows.push(["Ağırlık", `${p.weightGrams} g`]);
  if (p.cat === "beans") {
    rows.push(["Köken", "Brezilya doğal + Etiyopya yıkanmış"]);
    rows.push(["Tat notları", "Kakao · kuru incir · esmer şeker"]);
    rows.push(["Demleme", "Espresso · moka · AeroPress"]);
  } else if (p.cat === "gift") {
    rows.push(["Saklama", "Kuru, serin · 90 gün"]);
    rows.push(["Alerjenler", "Gluten · süt · soya izi"]);
  } else if (p.cat === "gear") {
    rows.push(["Marka", "Bialetti × L'Affogato"]);
    rows.push(["Garanti", "2 yıl"]);
  } else if (p.cat === "pantry") {
    rows.push(["Saklama", "Ağzı kapalı, serin yer"]);
  }
  if (rows.length === 0) rows.push(["Kategori", p.cat]);
  return (
    <dl className="pdp-detail-grid">
      {rows.map(([k, v]) => (
        <div key={k}>
          <dt>{k}</dt>
          <dd>{v}</dd>
        </div>
      ))}
    </dl>
  );
}
