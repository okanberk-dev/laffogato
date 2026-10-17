"use client";

import { usePathname } from "next/navigation";
import { useCallback, useMemo, useRef, useState } from "react";

import { SHOP_CATEGORY_ROUTES } from "@/lib/seo/pages";
import { parsePriceLabel } from "@/lib/utils/format";

import { PRODUCTS } from "./data";
import type { Product } from "./data";
import { Illustration } from "./illustration";
import type { PageProps } from "./page-shared";
import { PageHero } from "./page-hero";
import { productPath } from "./route-paths";
import { ShopHeroSlider } from "./shop-hero-slider";
import { activeVariants, ProductCard, toCartItem } from "./ui";
import { useDialog } from "./use-dialog";
import {
  CoffeeBag,
  EdibleCupHero,
  EspressoCup,
  GelatoScoop,
  PhotoSurface,
} from "./visuals";

/** Major-unit price of a product, exact when the minor-unit figure is known. */
function priceOf(p: Product): number {
  return p.priceMinor !== undefined
    ? p.priceMinor / 100
    : parsePriceLabel(p.price);
}

const CATS = [
  { id: "all", label: "Hepsi" },
  { id: "beans", label: "Çekirdek" },
  { id: "gift", label: "Hediye" },
  { id: "gear", label: "Ekipman" },
  { id: "merch", label: "Giyim" },
  { id: "pantry", label: "Kiler" },
];

/**
 * The shelf's quick filters - each backed by a field the product really
 * carries. The five chips this replaced ("Limited", "En çok satan", "Bologna
 * import", …) were styled as buttons and did nothing: no product field said
 * any of them.
 */
const FLAGS = [
  { id: "new", label: "Yeni", test: (p: Product) => Boolean(p.isNew) },
  {
    id: "featured",
    label: "Öne çıkan",
    test: (p: Product) => Boolean(p.featured),
  },
  {
    id: "sale",
    label: "İndirimde",
    test: (p: Product) => Boolean(p.compareAtPrice),
  },
] as const;

type FlagId = (typeof FLAGS)[number]["id"];

/** The slug a category id lives at (/magaza/<slug>). */
const SLUG_FOR = Object.fromEntries(
  SHOP_CATEGORY_ROUTES.map((c) => [c.productCat, c.slug]),
);

const TRUST = [
  { k: "Bologna kavurma", v: "Çekirdek haftalık, taze kavrulur" },
  { k: "Aynı gün", v: "İstanbul içi, 14:00'a kadar" },
  { k: "Ücretsiz kargo", v: "500₺ ve üzeri siparişte" },
  { k: "14 gün iade", v: "Açılmamış üründe kolay iade" },
];

export function PageShop({
  addToCart,
  openProduct,
  products,
  shopHeroSlides,
  settings,
}: PageProps) {
  const pathname = usePathname();
  // `[]` means "the shop really has nothing to show" - during a database
  // outage in particular - and must stay empty. Only `undefined` (no data
  // passed at all) falls back to the bundled design catalogue.
  const shopProducts = products ?? PRODUCTS;
  const slides = shopHeroSlides ?? [];

  // /magaza/<kategori> hands this page one category's products. There the
  // category list is a set of links to the sibling pages - as buttons it
  // filtered an already-filtered list and showed every other category as 0.
  const scopedCat = useMemo(() => {
    const slug = pathname?.startsWith("/magaza/")
      ? pathname.split("/")[2]
      : undefined;
    return SHOP_CATEGORY_ROUTES.find((c) => c.slug === slug)?.productCat;
  }, [pathname]);

  const [cat, setCat] = useState<string>(scopedCat ?? "all");
  const [flags, setFlags] = useState<FlagId[]>([]);
  const [sort, setSort] = useState<string>("featured");
  // The slider's ceiling follows the catalogue, so a product above ₺900 is
  // never invisible with no filter applied.
  const priceCeiling = useMemo(() => {
    const top = shopProducts.reduce((max, p) => Math.max(max, priceOf(p)), 0);
    return Math.max(900, Math.ceil(top / 100) * 100);
  }, [shopProducts]);
  const [priceMin, setPriceMin] = useState(0);
  const [priceMax, setPriceMax] = useState<number | null>(null);
  const priceTop = priceMax ?? priceCeiling;
  const [filtersOpen, setFiltersOpen] = useState(false);

  let list = shopProducts.filter((p) => cat === "all" || p.cat === cat);
  list = list.filter((p) => {
    const price = priceOf(p);
    return price >= priceMin && price <= priceTop;
  });
  for (const id of flags) {
    const flag = FLAGS.find((f) => f.id === id)!;
    list = list.filter(flag.test);
  }
  if (sort === "price-asc")
    list = [...list].sort((a, b) => priceOf(a) - priceOf(b));
  if (sort === "price-desc")
    list = [...list].sort((a, b) => priceOf(b) - priceOf(a));
  // "Yeni" was an option with no branch behind it; new pieces first, the
  // rest in the shop's own order.
  if (sort === "new")
    list = [...list].sort((a, b) => Number(!!b.isNew) - Number(!!a.isNew));

  const priceTouched = priceMin > 0 || priceTop < priceCeiling;
  const activeFilterCount =
    (cat !== "all" && !scopedCat ? 1 : 0) +
    (priceTouched ? 1 : 0) +
    flags.length;

  const resetFilters = () => {
    if (!scopedCat) setCat("all");
    setFlags([]);
    setPriceMin(0);
    setPriceMax(null);
  };

  const toggleFlag = (id: FlagId) =>
    setFlags((f) => (f.includes(id) ? f.filter((x) => x !== id) : [...f, id]));

  // Escape, body-scroll lock, focus in and focus back out. The sheet stays
  // mounted so it can animate, so it is also marked inert while closed.
  const sheetRef = useRef<HTMLDivElement | null>(null);
  const closeFilters = useCallback(() => setFiltersOpen(false), []);
  useDialog(filtersOpen, closeFilters, sheetRef);

  // The featured set is a real product row, found by its slug: the button
  // used to add a hand-typed name and price that checkout could not match
  // (the stored name uses "-", the button "·"), so every such order came back
  // as `?cart=not_found`.
  const featured = useMemo(
    () =>
      shopProducts.find(
        (p) =>
          p.slug === "affogato-seti-iki-kisilik" ||
          /affogato seti/i.test(p.name),
      ),
    [shopProducts],
  );

  const phone = settings?.phone ?? "+90 536 429 09 19";
  const email = settings?.email ?? "info@nextgenlab.com.tr";

  const countFor = (id: string) =>
    id === "all"
      ? shopProducts.length
      : shopProducts.filter((p) => p.cat === id).length;

  const catControl = (c: (typeof CATS)[number], variant: "row" | "pill") => {
    const on = cat === c.id;
    const cls = variant === "row" ? "shop-cat" : "shop-pill";
    // On a category page, siblings are links (their counts are not in hand).
    if (scopedCat) {
      const href = c.id === "all" ? "/magaza" : `/magaza/${SLUG_FOR[c.id]}`;
      return (
        <a
          key={c.id}
          href={href}
          className={`${cls} ${on ? "on" : ""}`}
          aria-current={on ? "page" : undefined}
        >
          <span>{c.label}</span>
          {on && <span className="count">{countFor(c.id)}</span>}
        </a>
      );
    }
    return (
      <button
        key={c.id}
        type="button"
        className={`${cls} ${on ? "on" : ""}`}
        aria-pressed={on}
        onClick={() => setCat(c.id)}
      >
        <span>{c.label}</span>
        <span className="count">{countFor(c.id)}</span>
      </button>
    );
  };

  // Filter controls - shared by the desktop sidebar and the mobile sheet.
  const renderFilters = () => (
    <>
      <div className="shop-filter-block">
        <h2 className="shop-filter-title">Kategoriler</h2>
        <div className="shop-cat-list">
          {CATS.map((c) => catControl(c, "row"))}
        </div>
      </div>

      <div className="shop-filter-block">
        <h2 className="shop-filter-title">Fiyat aralığı</h2>
        <div className="shop-price-readout tabular">
          {priceMin}₺ - {priceTop}₺
        </div>
        <div className="shop-price-track">
          <div className="shop-price-rail" />
          <div
            className="shop-price-fill"
            style={{
              left: `${(priceMin / priceCeiling) * 100}%`,
              right: `${100 - (priceTop / priceCeiling) * 100}%`,
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
          />
        </div>
      </div>

      <div className="shop-filter-block">
        <h2 className="shop-filter-title">Öne çıkanlar</h2>
        <div className="shop-flags">
          {FLAGS.map((f) => {
            const n = shopProducts.filter(f.test).length;
            if (n === 0) return null;
            const on = flags.includes(f.id);
            return (
              <button
                key={f.id}
                type="button"
                className={`chip-link ${on ? "active" : ""}`}
                aria-pressed={on}
                onClick={() => toggleFlag(f.id)}
              >
                {f.label}
                <span className="shop-flag-n">{n}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="shop-filter-block">
        {/* There is no chat. What there is: the phone and the mailbox, both
            answered by the bar. */}
        <div className="shop-helpline">
          <h2 className="shop-helpline-title">Hangi çekirdek?</h2>
          <p>
            Espresso mu filtre mi karar veremediysen bize sor - barista yardımcı
            olsun.
          </p>
          <div className="shop-helpline-actions">
            <a
              href={`tel:${phone.replace(/\s+/g, "")}`}
              className="btn btn-outline btn-sm"
            >
              Ara
            </a>
            <a href={`mailto:${email}`} className="btn btn-ghost btn-sm">
              E-posta
            </a>
          </div>
        </div>
      </div>
    </>
  );

  const scopedLabel = scopedCat
    ? CATS.find((c) => c.id === scopedCat)?.label
    : undefined;

  return (
    <div className="page" data-screen-label="03 Shop">
      {slides.length > 0 && <ShopHeroSlider slides={slides} />}

      <div className="shop-head-wrap" id="products">
        <PageHero
          scene="caramel"
          eyebrow={scopedLabel ? `Mağaza · ${scopedLabel}` : "La bottega"}
          title={["Köşkün", "mağazası"]}
          lede="Tuzla köşkünde servis ettiğimiz her şey - Bologna’da kavrulan çekirdek, 1994 patentli edible kup, bambu chasen, Bialetti × L’Affogato moka pot. Eve, ofise, hediyeye."
        >
          <ul className="shop-promises" aria-label="Teslimat ve iade">
            <li>Aynı gün İstanbul içi</li>
            <li>500₺+ ücretsiz kargo</li>
            <li>14 gün iade</li>
          </ul>
        </PageHero>
      </div>

      {/* ── Small screens: a sticky capsule row + filter sheet ── */}
      <div className="shop-mobilebar">
        <div
          className="shop-mobilebar-cats"
          role="group"
          aria-label="Ürün kategorileri"
        >
          {CATS.map((c) => catControl(c, "pill"))}
        </div>
        <div className="shop-mobilebar-actions">
          <button
            type="button"
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
            <span className="sr-only">Sırala</span>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value)}
              aria-label="Sırala"
            >
              <option value="featured">Önerilen</option>
              <option value="price-asc">Fiyat: artan</option>
              <option value="price-desc">Fiyat: azalan</option>
              <option value="new">Yeniler önce</option>
            </select>
          </label>
        </div>
      </div>

      <section className="section-tight">
        <div className="wrap-wide shop-layout">
          <aside className="shop-sidebar" aria-label="Filtreler">
            {renderFilters()}
          </aside>

          <div className="shop-main">
            <div className="shop-toolbar">
              <p className="shop-count">
                <span className="tabular">{list.length}</span> ürün
                {cat !== "all" && (
                  <span className="shop-count-cat">
                    {" "}
                    · {CATS.find((c) => c.id === cat)?.label}
                  </span>
                )}
              </p>
              <label className="shop-sort">
                <span>Sırala</span>
                <select
                  className="select"
                  value={sort}
                  onChange={(e) => setSort(e.target.value)}
                >
                  <option value="featured">Önerilen</option>
                  <option value="price-asc">Fiyat: artan</option>
                  <option value="price-desc">Fiyat: azalan</option>
                  <option value="new">Yeniler önce</option>
                </select>
              </label>
            </div>

            {/* Product names are h3s; on a phone the filter headings live
                in the closed sheet, so nothing sat between them and the h1. */}
            <h2 className="sr-only">Ürünler</h2>
            <div className="shop-grid-3">
              {list.map((p, i) => (
                <ProductCard
                  key={p.id ?? p.name}
                  product={p}
                  idx={i}
                  addToCart={addToCart}
                  onOpen={openProduct}
                />
              ))}
            </div>

            {list.length === 0 && (
              <div className="shop-empty">
                {/* An open bean tin with nothing in it. */}
                <Illustration name="magaza-teneke" className="shop-empty-art" />
                <p className="shop-empty-title">Bu filtreyle ürün yok</p>
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={resetFilters}
                >
                  Filtreleri temizle
                </button>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ── Small screens: the filter sheet ── */}
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
            <p className="shop-sheet-kicker">Filtrele ve sırala</p>
            <p className="shop-sheet-title">{list.length} ürün</p>
          </div>
          <button
            type="button"
            onClick={() => setFiltersOpen(false)}
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
        <div className="shop-sheet-body">{renderFilters()}</div>
        <footer className="shop-sheet-foot">
          <button
            type="button"
            className="btn btn-ghost"
            onClick={resetFilters}
            disabled={activeFilterCount === 0}
          >
            Sıfırla
          </button>
          <button
            type="button"
            className="btn btn-primary"
            style={{ flex: 1 }}
            onClick={() => setFiltersOpen(false)}
          >
            {list.length} ürünü göster
          </button>
        </footer>
      </div>

      {featured && (
        <section className="section shop-featured-band">
          <div className="wrap shop-featured">
            <div className="shop-featured-art reveal">
              <PhotoSurface hue="caramel">
                <div className="shop-featured-grid">
                  <div>
                    <CoffeeBag
                      label="Sirena"
                      sub="ESPRESSO BLEND · 250G"
                      tone="dark"
                    />
                  </div>
                  <div>
                    <EdibleCupHero scoop="cream" topping="wafer" />
                  </div>
                  <div>
                    <EspressoCup />
                  </div>
                  <div>
                    <GelatoScoop flavor="cream" />
                  </div>
                </div>
              </PhotoSurface>
            </div>
            <div className="reveal r1">
              <div className="eyebrow">Evde ritüel · iki kişilik</div>
              <h2 className="h1" style={{ marginTop: 12 }}>
                Evde <span className="script">tableside</span> servis
              </h2>
              <p className="lede" style={{ marginTop: 18 }}>
                {featured.desc}
              </p>
              <div className="shop-featured-price">
                <span className="shop-featured-now">{featured.price}</span>
                {featured.compareAtPrice && (
                  <span className="shop-featured-was">
                    {featured.compareAtPrice}
                  </span>
                )}
              </div>
              <div className="cta-row">
                {/* A set sold in variants opens for the choice, like a card:
                    a line without its variant has no price or stock of its
                    own. */}
                {activeVariants(featured).length > 0 ? (
                  <button
                    type="button"
                    className="btn btn-primary btn-lg"
                    disabled={
                      featured.stock !== undefined && featured.stock <= 0
                    }
                    onClick={() => openProduct(featured)}
                  >
                    Seçenekleri gör
                  </button>
                ) : (
                  <button
                    type="button"
                    className="btn btn-primary btn-lg"
                    disabled={
                      featured.stock !== undefined && featured.stock <= 0
                    }
                    onClick={() => {
                      const item = toCartItem(featured);
                      if (item) addToCart(item);
                    }}
                  >
                    Sepete ekle
                  </button>
                )}
                {featured.slug && (
                  <a
                    href={productPath(featured.slug)}
                    className="btn btn-ghost btn-lg"
                  >
                    Ürünü incele
                  </a>
                )}
              </div>
            </div>
          </div>
        </section>
      )}

      <section className="section-tight">
        <ul className="wrap trust-row" aria-label="Güvenceler">
          {TRUST.map((b) => (
            <li key={b.k} className="trust-tile">
              <span className="trust-k">{b.k}</span>
              <span className="trust-v">{b.v}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
