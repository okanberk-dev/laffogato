"use client";

import { useActionState, useEffect, useState, type ReactNode } from "react";

import {
  placeOrderAction,
  previewPromoAction,
  type PromoPreviewState,
} from "@/app/odeme/actions";

import type { Product } from "./data";
import {
  EspressoCup,
  PhotoSurface,
  ProductSurface,
} from "./visuals";

export interface CartItem {
  name: string;
  price: number;
  tag?: string;
  qty?: number;
}

export interface ProductCardProps {
  product: Product;
  idx?: number;
  addToCart?: (item: CartItem) => void;
  onOpen?: (product: Product) => void;
}

export function ProductCard({ product, idx = 0, addToCart, onOpen }: ProductCardProps) {
  const p = product;
  const onAdd = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (addToCart) {
      addToCart({ name: p.name, price: parseFloat(p.price), tag: p.tag });
    }
  };
  const onClick = (e: React.MouseEvent) => {
    e.preventDefault();
    if (onOpen) onOpen(p);
  };
  const label = p.name.split("—")[0].trim().split(" ")[0];

  return (
    <div
      className="product-card reveal"
      style={{ transitionDelay: `${(idx % 8) * 60}ms` }}
      onClick={onClick}
    >
      <div className="product-card-img">
        <ProductSurface cat={p.cat} tone={p.img} label={label} sub={p.tag} />
        {p.featured && <div className="product-card-flag gold">ÖNE ÇIKAN</div>}
        {p.isNew && <div className="product-card-flag new">NUOVO</div>}
        {!p.featured && !p.isNew && (
          <div className="product-card-flag">{p.cat.toUpperCase()}</div>
        )}
        <div className="product-card-quick">
          <button onClick={onAdd}>+ Sepete ekle</button>
          <button onClick={onClick}>Hızlı bak</button>
        </div>
      </div>
      <div className="product-card-meta">
        <div className="product-card-cat">{p.tag}</div>
        <h3 className="product-card-name">{p.name.split("—")[0].trim()}</h3>
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
        {eyebrow && <div className="eyebrow" style={{ marginBottom: 16 }}>{eyebrow}</div>}
        <h2 className="h-1">{title}</h2>
      </div>
    );
  }
  return (
    <div className="reveal section-head">
      <div>
        {eyebrow && <div className="eyebrow">{eyebrow}</div>}
        <h2 className="h-1" style={{ marginTop: 16 }}>
          {title}
        </h2>
      </div>
      {action && <div>{action}</div>}
    </div>
  );
}

export function Stat({ n, l, d }: { n: ReactNode; l: ReactNode; d?: ReactNode }) {
  return (
    <div>
      <div
        style={{
          fontFamily: "var(--serif)",
          fontStyle: "italic",
          fontWeight: 500,
          fontSize: "clamp(36px, 4vw, 56px)",
          lineHeight: 1,
          letterSpacing: "-0.02em",
        }}
      >
        {n}
      </div>
      <div className="eyebrow" style={{ marginTop: 10 }}>{l}</div>
      {d && (
        <div style={{ fontSize: 13, color: "var(--ink-soft)", marginTop: 8, lineHeight: 1.5 }}>
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
}

export function CartDrawer({ open, onClose, items, removeItem }: CartDrawerProps) {
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
            <div className="eyebrow" style={{ marginBottom: 4 }}>Sepetin</div>
            <div style={{ fontFamily: "var(--serif)", fontStyle: "italic", fontSize: 24, lineHeight: 1 }}>
              {items.length} ürün
            </div>
          </div>
          <button onClick={onClose} className="nav-icon-btn" aria-label="Kapat">
            <svg width="14" height="14" viewBox="0 0 16 16">
              <path d="M3 3 L13 13 M13 3 L3 13" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
            </svg>
          </button>
        </header>
        <div className="cart-drawer-body" style={{ flex: 1, overflowY: "auto" }}>
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
              <div style={{ fontFamily: "var(--serif)", fontStyle: "italic", fontSize: 28, lineHeight: 1.1 }}>
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
                Bir affogato, bir matcha, bir çekirdek paketi — eve ya da terasta servise hazır.
              </p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {items.map((it, i) => (
                <div
                  key={i}
                  className="cart-item-grid"
                  style={{
                    alignItems: "center",
                    padding: 12,
                    border: "1px solid var(--ink-line)",
                    borderRadius: "var(--r-md)",
                  }}
                >
                  <div className="cart-item-thumb" style={{ borderRadius: "var(--r-sm)", overflow: "hidden" }}>
                    <PhotoSurface hue="warm">
                      <div style={{ width: "100%", height: "100%", display: "grid", placeItems: "center", padding: 6 }}>
                        <EspressoCup />
                      </div>
                    </PhotoSurface>
                  </div>
                  <div>
                    <div style={{ fontFamily: "var(--serif-display)", fontSize: 16, lineHeight: 1.2 }}>{it.name}</div>
                    <div style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--ink-mute)", marginTop: 4 }}>
                      x{it.qty || 1}
                    </div>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
                    <div style={{ fontFamily: "var(--mono)", fontSize: 13 }}>{it.price}₺</div>
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
              ))}
            </div>
          )}
        </div>
        {items.length > 0 && <CartFooter items={items} total={total} />}
      </aside>
    </>
  );
}

const promoInitial: PromoPreviewState = {};

function CartFooter({ items, total }: { items: CartItem[]; total: number }) {
  const [step, setStep] = useState<"summary" | "details">("summary");
  const [pending, setPending] = useState(false);

  const [promoState, promoAction, promoPending] = useActionState(
    previewPromoAction,
    promoInitial,
  );

  const promoOk = promoState.ok;
  const discountMajor = promoOk ? promoOk.discountMinor / 100 : 0;
  const finalTotal = Math.max(0, total - discountMajor);

  const itemsJson = JSON.stringify(
    items.map((it) => ({
      name: it.name,
      price: it.price ?? 0,
      qty: it.qty ?? 1,
    })),
  );

  return (
    <footer className="cart-drawer-foot" style={{ borderTop: "1px solid var(--ink-line)" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          marginBottom: 8,
          fontSize: 14,
          color: "var(--ink-soft)",
        }}
      >
        <span>Ara toplam</span>
        <span style={{ fontFamily: "var(--mono)" }}>{total}₺</span>
      </div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          marginBottom: 12,
          fontSize: 14,
          color: "var(--ink-soft)",
        }}
      >
        <span>Kargo · İstanbul içi</span>
        <span style={{ fontFamily: "var(--mono)" }}>Ücretsiz</span>
      </div>

      {/* Promo code input */}
      <form action={promoAction} style={{ display: "flex", gap: 6, marginBottom: 12 }}>
        <input type="hidden" name="subtotal" value={String(total)} />
        <input
          name="code"
          placeholder="Promosyon kodu"
          defaultValue={promoOk?.code ?? ""}
          style={{
            flex: 1,
            padding: "10px 12px",
            borderRadius: 8,
            border: "1px solid var(--ink-line)",
            background: "var(--bg-warm)",
            fontFamily: "var(--mono)",
            fontSize: 12,
            textTransform: "uppercase",
            color: "var(--ink)",
          }}
        />
        <button
          type="submit"
          disabled={promoPending}
          className="btn"
          style={{
            padding: "10px 14px",
            fontSize: 12,
            background: "transparent",
            border: "1px solid var(--ink-line)",
            color: "var(--ink-soft)",
            opacity: promoPending ? 0.6 : 1,
          }}
        >
          {promoPending ? "…" : "Uygula"}
        </button>
      </form>
      {promoState.error && (
        <div style={{ marginBottom: 12, fontSize: 12, color: "#b91c1c" }}>
          {promoState.error}
        </div>
      )}
      {promoOk && (
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            marginBottom: 12,
            fontSize: 13,
            color: "#15803d",
          }}
        >
          <span>
            <strong style={{ fontFamily: "var(--mono)" }}>{promoOk.code}</strong>{" "}
            uygulandı
          </span>
          <span style={{ fontFamily: "var(--mono)" }}>
            −{Math.round(promoOk.discountMinor / 100)}₺
          </span>
        </div>
      )}

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          marginBottom: 22,
          alignItems: "baseline",
        }}
      >
        <span style={{ fontFamily: "var(--serif-display)", fontSize: 20 }}>Toplam</span>
        <span style={{ fontFamily: "var(--serif)", fontStyle: "italic", fontSize: 28 }}>
          {Math.round(finalTotal)}₺
        </span>
      </div>

      {step === "summary" ? (
        <button
          type="button"
          onClick={() => setStep("details")}
          className="btn btn-primary btn-lg"
          style={{ width: "100%", justifyContent: "center" }}
        >
          Ödemeye geç
          <span className="arrow">→</span>
        </button>
      ) : (
        <form
          action={placeOrderAction}
          onSubmit={() => setPending(true)}
          style={{ display: "grid", gap: 10 }}
        >
          <input type="hidden" name="items" value={itemsJson} />
          {promoOk && (
            <input type="hidden" name="promoCode" value={promoOk.code} />
          )}
          <CheckoutInput
            name="customerName"
            type="text"
            placeholder="Ad soyad"
            required
            autoComplete="name"
          />
          <CheckoutInput
            name="customerEmail"
            type="email"
            placeholder="E-posta"
            required
            autoComplete="email"
          />
          <CheckoutInput
            name="customerPhone"
            type="tel"
            placeholder="Telefon (+90…)"
            required
            autoComplete="tel"
          />
          <textarea
            name="shippingAddress"
            placeholder="Teslimat adresi (mahalle, cadde, no, ilçe / il, posta kodu)"
            required
            rows={3}
            autoComplete="street-address"
            style={{
              width: "100%",
              padding: "12px 14px",
              borderRadius: 10,
              border: "1px solid var(--ink-line)",
              background: "var(--bg-warm)",
              fontFamily: "inherit",
              fontSize: 14,
              color: "var(--ink)",
              resize: "vertical",
              minHeight: 70,
            }}
          />
          <div style={{ display: "flex", gap: 8 }}>
            <button
              type="button"
              onClick={() => setStep("summary")}
              disabled={pending}
              className="btn"
              style={{
                flex: 1,
                justifyContent: "center",
                background: "transparent",
                border: "1px solid var(--ink-line)",
                color: "var(--ink-soft)",
              }}
            >
              ← Geri
            </button>
            <button
              type="submit"
              disabled={pending}
              className="btn btn-primary"
              style={{
                flex: 2,
                justifyContent: "center",
                opacity: pending ? 0.7 : 1,
              }}
            >
              {pending ? "Gönderiliyor…" : "Siparişi tamamla"}
              <span className="arrow">→</span>
            </button>
          </div>
          <p style={{ margin: 0, fontSize: 11, color: "var(--ink-mute)", lineHeight: 1.5 }}>
            Bilgilerin yalnızca siparişin işlenmesi için kullanılır. Ödeme adımı
            sanal POS entegrasyonu sonrası aktif olacak.
          </p>
        </form>
      )}
    </footer>
  );
}

function CheckoutInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      style={{
        width: "100%",
        padding: "12px 14px",
        borderRadius: 10,
        border: "1px solid var(--ink-line)",
        background: "var(--bg-warm)",
        fontFamily: "inherit",
        fontSize: 14,
        color: "var(--ink)",
        ...props.style,
      }}
    />
  );
}

/* ─────────────────────────────────────────────────────────────
   Product modal
   ───────────────────────────────────────────────────────────── */

export function ProductModal({
  product,
  onClose,
  addToCart,
}: {
  product: Product | null;
  onClose: () => void;
  addToCart: (item: CartItem) => void;
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
  const p = product;
  const label = p.name.split("—")[0].trim().split(" ")[0];

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
            <path d="M3 3 L13 13 M13 3 L3 13" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
          </svg>
        </button>
        <div style={{ aspectRatio: "4/5", position: "relative" }}>
          <ProductSurface cat={p.cat} tone={p.img} label={label} sub={p.tag} />
        </div>
        <div
          style={{
            padding: "clamp(28px, 4vw, 50px)",
            overflowY: "auto",
            display: "flex",
            flexDirection: "column",
          }}
        >
          <div className="eyebrow" style={{ marginBottom: 14 }}>{p.tag}</div>
          <h2 className="h-2">{p.name}</h2>
          <div style={{ fontFamily: "var(--serif)", fontStyle: "italic", fontSize: 28, marginTop: 16 }}>
            {p.price}
          </div>
          <p style={{ marginTop: 22, lineHeight: 1.65, color: "var(--ink-soft)" }}>{p.desc}</p>

          <div style={{ marginTop: 28, display: "grid", gap: 14 }}>
            {p.cat === "beans" && (
              <>
                <DetailRow k="Köken" v="Brezilya doğal + Etiyopya yıkanmış" />
                <DetailRow k="Kavurma" v="Bologna · 14 Mayıs 2026" />
                <DetailRow k="Tat notları" v="Kakao · kuru incir · esmer şeker" />
                <DetailRow k="Demleme" v="Espresso, moka, AeroPress" />
              </>
            )}
            {p.cat === "gift" && (
              <>
                <DetailRow k="İçerik" v="6 adet edible cup · sleeve" />
                <DetailRow k="Saklama" v="Kuru, serin · 90 gün" />
                <DetailRow k="Alerjenler" v="Gluten · süt · soya izi" />
              </>
            )}
            {p.cat === "gear" && (
              <>
                <DetailRow k="Marka" v="Bialetti × L’Affogato" />
                <DetailRow k="Garanti" v="2 yıl" />
                <DetailRow k="Servis" v="Türkiye geneli" />
              </>
            )}
          </div>

          <div style={{ marginTop: 28, display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            <div
              style={{
                display: "flex",
                border: "1px solid var(--ink-line-strong)",
                borderRadius: 999,
                overflow: "hidden",
              }}
            >
              <button style={{ padding: "12px 16px", fontFamily: "var(--mono)", fontSize: 14 }}>−</button>
              <div
                style={{
                  padding: "12px 16px",
                  fontFamily: "var(--mono)",
                  fontSize: 14,
                  minWidth: 40,
                  textAlign: "center",
                  borderLeft: "1px solid var(--ink-line)",
                  borderRight: "1px solid var(--ink-line)",
                }}
              >
                1
              </div>
              <button style={{ padding: "12px 16px", fontFamily: "var(--mono)", fontSize: 14 }}>+</button>
            </div>
            <button
              className="btn btn-primary btn-lg"
              style={{ flex: 1, justifyContent: "center" }}
              onClick={() => {
                addToCart({ name: p.name, price: parseFloat(p.price), tag: p.tag });
                onClose();
              }}
            >
              Sepete ekle · {p.price} <span className="arrow">→</span>
            </button>
          </div>

          <div style={{ marginTop: 24, padding: 18, background: "var(--bg-warm)", borderRadius: "var(--r-sm)" }}>
            <div className="eyebrow" style={{ marginBottom: 8 }}>Teslimat · İade</div>
            <div style={{ fontSize: 13, color: "var(--ink-soft)", lineHeight: 1.6 }}>
              İstanbul içi aynı gün · Yurt içi 2–3 iş günü · 14 gün açılmamış ürünlerde iade.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
