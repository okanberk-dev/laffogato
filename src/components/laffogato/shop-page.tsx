"use client";

import { useCallback, useState, useMemo, useRef } from "react";

import { parsePriceLabel } from "@/lib/utils/format";
import { useDialog } from "./use-dialog";

import { ShopHeroSlider } from "./shop-hero-slider";
import { PageHero } from "./page-hero";
import { PRODUCTS } from "./data";
import type { Product } from "./data";
import { ProductCard } from "./ui";
import {
  CoffeeBag,
  EdibleCupHero,
  EspressoCup,
  GelatoScoop,
  PhotoSurface,
} from "./visuals";
import type { PageProps } from "./page-shared";

/** Major-unit price of a product, exact when the minor-unit figure is known. */
function priceOf(p: Product): number {
  return p.priceMinor !== undefined
    ? p.priceMinor / 100
    : parsePriceLabel(p.price);
}

function ShopBadge({ icon, k, v }: { icon: string; k: string; v: string }) {
  return (
    <div
      style={{
        padding: 18,
        background: "var(--bg-warm)",
        borderRadius: "var(--r-md)",
      }}
    >
      <div style={{ fontSize: 20, color: "var(--gold)", marginBottom: 10 }}>
        {icon}
      </div>
      <div className="eyebrow" style={{ marginBottom: 6 }}>
        {k}
      </div>
      <div style={{ fontFamily: "var(--serif-display)", fontSize: 15 }}>
        {v}
      </div>
    </div>
  );
}

export function PageShop({
  addToCart,
  openProduct,
  products,
  shopHeroSlides,
}: PageProps) {
  // `[]` means "the shop really has nothing to show" - during a database
  // outage in particular - and must stay empty. Only `undefined` (no data
  // passed at all) falls back to the bundled design catalogue.
  const shopProducts = products ?? PRODUCTS;
  const slides = shopHeroSlides ?? [];
  const [cat, setCat] = useState<string>("all");
  const [sort, setSort] = useState<string>("featured");
  // The slider's ceiling follows the catalogue. It was hard-coded at 900, and
  // the filter is inclusive-of-max, so the moment a product was priced above
  // ₺900 it became invisible in the shop with no filter applied.
  const priceCeiling = useMemo(() => {
    const top = shopProducts.reduce((max, p) => Math.max(max, priceOf(p)), 0);
    return Math.max(900, Math.ceil(top / 100) * 100);
  }, [shopProducts]);
  const [priceMin, setPriceMin] = useState(0);
  const [priceMax, setPriceMax] = useState<number | null>(null);
  const priceTop = priceMax ?? priceCeiling;
  const [filtersOpen, setFiltersOpen] = useState(false);

  const cats = [
    { id: "all", label: "Hepsi", icon: "◯" },
    { id: "beans", label: "Çekirdek", icon: "◉" },
    { id: "gift", label: "Hediye", icon: "◈" },
    { id: "gear", label: "Ekipman", icon: "◇" },
    { id: "merch", label: "Giyim", icon: "◐" },
    { id: "pantry", label: "Kiler", icon: "◇" },
  ];

  let list = shopProducts.filter((p) => cat === "all" || p.cat === cat);
  list = list.filter((p) => {
    const price = priceOf(p);
    return price >= priceMin && price <= priceTop;
  });
  if (sort === "price-asc")
    list = [...list].sort((a, b) => priceOf(a) - priceOf(b));
  if (sort === "price-desc")
    list = [...list].sort((a, b) => priceOf(b) - priceOf(a));

  const priceTouched = priceMin > 0 || priceTop < priceCeiling;
  const activeFilterCount = (cat !== "all" ? 1 : 0) + (priceTouched ? 1 : 0);

  const resetFilters = () => {
    setCat("all");
    setPriceMin(0);
    setPriceMax(null);
  };

  // Escape, body-scroll lock, focus in and focus back out. The sheet stays
  // mounted so it can animate, so it also has to be marked inert while closed
  // - its controls were otherwise reachable by Tab from off-screen.
  const sheetRef = useRef<HTMLDivElement | null>(null);
  const closeFilters = useCallback(() => setFiltersOpen(false), []);
  useDialog(filtersOpen, closeFilters, sheetRef);

  // Filter controls - shared by the desktop sidebar and the mobile sheet.
  const renderFilters = () => (
    <>
      <div className="shop-filter-block">
        <div className="eyebrow" style={{ marginBottom: 14 }}>
          Kategoriler
        </div>
        <div className="shop-cat-list">
          {cats.map((c) => {
            const count =
              c.id === "all"
                ? shopProducts.length
                : shopProducts.filter((p) => p.cat === c.id).length;
            return (
              <button
                key={c.id}
                className={`shop-cat ${cat === c.id ? "on" : ""}`}
                onClick={() => setCat(c.id)}
              >
                <span>{c.label}</span>
                <span className="count">{count}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="shop-filter-block">
        <div className="eyebrow" style={{ marginBottom: 14 }}>
          Fiyat aralığı
        </div>
        <div
          style={{ fontFamily: "var(--mono)", fontSize: 13, marginBottom: 16 }}
        >
          {priceMin}₺ - {priceTop}₺
        </div>
        <div style={{ position: "relative", height: 28 }}>
          <div
            style={{
              position: "absolute",
              top: 12,
              left: 0,
              right: 0,
              height: 2,
              background: "var(--ink-line)",
            }}
          />
          <div
            style={{
              position: "absolute",
              top: 12,
              left: `${(priceMin / priceCeiling) * 100}%`,
              right: `${100 - (priceTop / priceCeiling) * 100}%`,
              height: 2,
              background: "var(--ink)",
            }}
          />
          <input
            type="range"
            min="0"
            max={priceCeiling}
            step="20"
            value={priceMin}
            onChange={(e) =>
              setPriceMin(Math.min(parseInt(e.target.value), priceTop - 40))
            }
            className="price-range"
            aria-label="En düşük fiyat"
            style={{ position: "absolute", top: 0, left: 0, right: 0 }}
          />
          <input
            type="range"
            min="0"
            max={priceCeiling}
            step="20"
            value={priceTop}
            onChange={(e) =>
              setPriceMax(Math.max(parseInt(e.target.value), priceMin + 40))
            }
            className="price-range"
            aria-label="En yüksek fiyat"
            style={{ position: "absolute", top: 0, left: 0, right: 0 }}
          />
        </div>
      </div>

      <div className="shop-filter-block">
        <div className="eyebrow" style={{ marginBottom: 14 }}>
          Etiketler
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {[
            "Yeni",
            "Limited",
            "En çok satan",
            "Bologna import",
            "Gift ready",
          ].map((t) => (
            <span key={t} className="chip" style={{ cursor: "pointer" }}>
              {t}
            </span>
          ))}
        </div>
      </div>

      <div className="shop-filter-block" style={{ borderTop: 0 }}>
        <div className="shop-helpline">
          <div className="eyebrow" style={{ marginBottom: 10 }}>
            Yardım
          </div>
          <div
            style={{
              fontFamily: "var(--serif)",
              fontStyle: "normal",
              fontSize: 22,
              lineHeight: 1.2,
            }}
          >
            Hangi çekirdek?
          </div>
          <p
            style={{
              fontSize: 13,
              color: "var(--ink-soft)",
              marginTop: 10,
              lineHeight: 1.55,
            }}
          >
            Espresso mu, filtre mi karar veremediysen - barista chat’i aç, sana
            yardımcı olalım.
          </p>
          <button
            className="btn btn-ghost btn-sm"
            style={{ marginTop: 16, width: "100%", justifyContent: "center" }}
          >
            Chat’i aç <span className="arrow">→</span>
          </button>
        </div>
      </div>
    </>
  );

  return (
    <div className="page" data-screen-label="03 Shop">
      {slides.length > 0 && <ShopHeroSlider slides={slides} />}
      <header className="page-head shop-head-wrap" id="products">
        <div className="wrap">
          <div
            className="reveal"
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 0.95fr",
              gap: 60,
              alignItems: "end",
            }}
            data-row="shop-head"
          >
            <PageHero
              eyebrow="III - La bottega"
              title={["Köşkün", "mağazası"]}
              lede="Tuzla köşkünde servis ettiğimiz her şey - Bologna’da kavrulan çekirdek, 1994 patentli edible kup, bambu chasen, Bialetti × L’Affogato moka pot. Eve, ofise, hediyeye."
            />
            <div data-row="shop-badges">
              <ShopBadge icon="↗" k="Aynı gün" v="İstanbul içi" />
              <ShopBadge icon="✦" k="Free shipping" v="500₺+ siparişte" />
              <ShopBadge icon="↻" k="14 gün iade" v="Açılmamış ürün" />
            </div>
          </div>
        </div>
      </header>

      {/* ── Mobil yapışkan kontrol çubuğu: kategori pill'leri + filtre + sırala ── */}
      <div className="shop-mobilebar">
        <div
          className="shop-mobilebar-cats"
          role="group"
          aria-label="Ürün kategorileri"
        >
          {cats.map((c) => {
            const count =
              c.id === "all"
                ? shopProducts.length
                : shopProducts.filter((p) => p.cat === c.id).length;
            return (
              <button
                key={c.id}
                className={`shop-pill ${cat === c.id ? "on" : ""}`}
                aria-pressed={cat === c.id}
                onClick={() => setCat(c.id)}
              >
                {c.label}
                <span className="shop-pill-count">{count}</span>
              </button>
            );
          })}
        </div>
        <div className="shop-mobilebar-actions">
          <button
            className="shop-filter-trigger"
            onClick={() => setFiltersOpen(true)}
          >
            <svg
              width="15"
              height="15"
              viewBox="0 0 16 16"
              fill="none"
              aria-hidden="true"
            >
              <path
                d="M2 4 H14 M4 8 H12 M6 12 H10"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
            Filtrele
            {activeFilterCount > 0 && (
              <span className="shop-filter-badge">{activeFilterCount}</span>
            )}
          </button>
          <label className="shop-sort-inline">
            <span className="eyebrow">Sırala</span>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value)}
              aria-label="Sırala"
            >
              <option value="featured">Önerilen</option>
              <option value="price-asc">Fiyat ↑</option>
              <option value="price-desc">Fiyat ↓</option>
              <option value="new">Yeni</option>
            </select>
          </label>
        </div>
      </div>

      <section className="section-tight">
        <div className="wrap-wide shop-layout">
          <aside className="shop-sidebar reveal">{renderFilters()}</aside>

          <div className="shop-main">
            <div className="shop-toolbar reveal">
              <div style={{ fontFamily: "var(--serif-display)", fontSize: 18 }}>
                <span
                  style={{ fontFamily: "var(--serif)", fontStyle: "normal" }}
                >
                  {list.length}
                </span>{" "}
                ürün
                {cat !== "all" && (
                  <>
                    {" "}
                    ·{" "}
                    <span style={{ color: "var(--ink-mute)" }}>
                      {cats.find((c) => c.id === cat)?.label}
                    </span>
                  </>
                )}
              </div>
              <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                <span className="eyebrow" id="shop-sort-label">
                  Sırala
                </span>
                <select
                  className="select"
                  value={sort}
                  onChange={(e) => setSort(e.target.value)}
                  aria-labelledby="shop-sort-label"
                  style={{ width: "auto", padding: "8px 14px", fontSize: 13 }}
                >
                  <option value="featured">Önerilen</option>
                  <option value="price-asc">Fiyat ↑</option>
                  <option value="price-desc">Fiyat ↓</option>
                  <option value="new">Yeni</option>
                </select>
              </div>
            </div>

            <div className="shop-grid-3">
              {list.map((p, i) => (
                <ProductCard
                  key={p.name}
                  product={p}
                  idx={i}
                  addToCart={addToCart}
                  onOpen={openProduct}
                />
              ))}
            </div>

            {list.length === 0 && (
              <div style={{ textAlign: "center", padding: "80px 20px" }}>
                <div
                  style={{
                    fontFamily: "var(--serif)",
                    fontStyle: "normal",
                    fontSize: 36,
                  }}
                >
                  Bu filtreyle ürün yok.
                </div>
                <button
                  className="btn btn-ghost"
                  style={{ marginTop: 24 }}
                  onClick={resetFilters}
                >
                  Filtreleri temizle
                </button>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ── Mobil filtre alt-sayfası (bottom sheet) ── */}
      <div
        className={`shop-sheet-overlay ${filtersOpen ? "open" : ""}`}
        onClick={() => setFiltersOpen(false)}
        aria-hidden={!filtersOpen}
      />
      <div
        ref={sheetRef}
        className={`shop-sheet ${filtersOpen ? "open" : ""}`}
        role={filtersOpen ? "dialog" : undefined}
        aria-modal={filtersOpen ? true : undefined}
        aria-label="Filtreler"
        aria-hidden={filtersOpen ? undefined : true}
        inert={!filtersOpen}
        tabIndex={-1}
      >
        <div className="shop-sheet-grip" aria-hidden="true" />
        <header className="shop-sheet-head">
          <div>
            <div className="eyebrow" style={{ marginBottom: 4 }}>
              Filtrele & sırala
            </div>
            <div
              style={{
                fontFamily: "var(--serif)",
                fontStyle: "normal",
                fontSize: 22,
                lineHeight: 1,
              }}
            >
              {list.length} ürün
            </div>
          </div>
          <button
            onClick={() => setFiltersOpen(false)}
            className="nav-icon-btn"
            aria-label="Kapat"
          >
            <svg width="14" height="14" viewBox="0 0 16 16">
              <path
                d="M3 3 L13 13 M13 3 L3 13"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </header>
        <div className="shop-sheet-body">{renderFilters()}</div>
        <footer className="shop-sheet-foot">
          <button
            className="btn btn-ghost"
            onClick={resetFilters}
            disabled={activeFilterCount === 0}
          >
            Sıfırla
          </button>
          <button
            className="btn btn-primary"
            style={{ flex: 1, justifyContent: "center" }}
            onClick={() => setFiltersOpen(false)}
          >
            {list.length} ürünü göster
          </button>
        </footer>
      </div>

      <section className="section" style={{ background: "var(--bg-warm)" }}>
        <div
          className="wrap"
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 60,
            alignItems: "center",
          }}
          data-row="featured-row"
        >
          <div
            className="reveal"
            style={{
              aspectRatio: "4/3",
              borderRadius: "var(--r-lg)",
              overflow: "hidden",
            }}
          >
            <PhotoSurface
              hue="caramel"
              dotLabel="Limited · Friday drop"
              dotPos="tl"
            >
              <div
                style={{
                  width: "100%",
                  height: "100%",
                  padding: 30,
                  display: "grid",
                  gap: 18,
                  placeItems: "stretch",
                }}
                data-row="featured-inner"
              >
                <div style={{ display: "grid", placeItems: "center" }}>
                  <CoffeeBag
                    label="Sirena"
                    sub="ESPRESSO BLEND · 250G"
                    tone="dark"
                  />
                </div>
                <div style={{ display: "grid", placeItems: "center" }}>
                  <EdibleCupHero scoop="cream" topping="wafer" />
                </div>
                <div style={{ display: "grid", placeItems: "center" }}>
                  <EspressoCup />
                </div>
                <div style={{ display: "grid", placeItems: "center" }}>
                  <GelatoScoop flavor="cream" />
                </div>
              </div>
            </PhotoSurface>
          </div>
          <div className="reveal r1">
            <div className="eyebrow">Affogato Seti · İki Kişilik</div>
            <h2 className="h1" style={{ marginTop: 16 }}>
              Evde <span className="script">tableside</span> servis.
            </h2>
            <p className="lede" style={{ marginTop: 22 }}>
              200g taze kavrulmuş Sirena · 1 pint fior di latte gelato · 2
              edible kup · porselen kaşık · el yazısı tarif kartı. Cuma teslimat
              İstanbul içi. Eve veya hediyeye.
            </p>
            <div
              style={{
                display: "flex",
                gap: 16,
                alignItems: "baseline",
                marginTop: 26,
              }}
            >
              <span
                style={{
                  fontFamily: "var(--serif)",
                  fontStyle: "normal",
                  fontSize: 44,
                }}
              >
                780₺
              </span>
              <span
                style={{
                  fontFamily: "var(--mono)",
                  fontSize: 14,
                  color: "var(--ink-mute)",
                  textDecoration: "line-through",
                }}
              >
                880₺
              </span>
              <span className="chip chip-gold">−12%</span>
            </div>
            <div style={{ display: "flex", gap: 12, marginTop: 28 }}>
              <button
                className="btn btn-primary btn-lg"
                onClick={() =>
                  addToCart({ name: "Affogato Seti · İki Kişilik", price: 780 })
                }
              >
                Sepete ekle <span className="arrow">→</span>
              </button>
              <button className="btn btn-ghost btn-lg">Detay</button>
            </div>
          </div>
        </div>
      </section>

      <section className="section-tight">
        <div
          className="wrap"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gap: 30,
          }}
          data-row="trust-row"
        >
          {[
            { k: "Bologna import", v: "Bologna kavurma · haftalık taze" },
            { k: "Aynı gün", v: "İstanbul içi · 14:00'a kadar" },
            { k: "Avrupa kargo", v: "5-7 iş günü · DHL Express" },
            { k: "14 gün iade", v: "Açılmamış ürünlerde kolay iade" },
          ].map((b, i) => (
            <div
              key={b.k}
              className="reveal"
              style={{
                transitionDelay: `${i * 60}ms`,
                padding: 26,
                border: "1px solid var(--ink-line)",
                borderRadius: "var(--r-md)",
              }}
            >
              <div className="eyebrow" style={{ marginBottom: 12 }}>
                {b.k}
              </div>
              <div style={{ fontFamily: "var(--serif-display)", fontSize: 18 }}>
                {b.v}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
