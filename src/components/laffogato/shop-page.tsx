"use client";

import { siteImage } from "@/lib/admin/site-images-core";
import Image from "next/image";

import { usePathname } from "next/navigation";
import { useMemo, useState } from "react";

import { SHOP_CATEGORY_ROUTES } from "@/lib/seo/pages";
import { parsePriceLabel, priceLabel } from "@/lib/utils/format";

import { PRODUCTS } from "./data";
import type { Product } from "./data";
import type { PageProps } from "./page-shared";
import { trackCartAdd } from "./pixel-events";
import { freeShippingFrom, productDiscount } from "./product-facts";
import { productPath } from "./route-paths";
import { ShopHeroSlider } from "./shop-hero-slider";
import {
  activeVariants,
  FilterOption,
  FilterOptions,
  FilterSection,
  FilterSheet,
  GridToggle,
  ProductCard,
  SortMenu,
  toCartItem,
} from "./ui";
import { ProductSurface } from "./visuals";

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
    test: (p: Product) => productDiscount(p) !== null,
  },
] as const;

type FlagId = (typeof FLAGS)[number]["id"];

/** The price section's bands (the reference's filter has round options
    only, no slider). A product is in the band its price falls in. */
const PRICE_BANDS = [
  { id: "p0", label: `${priceLabel(25000)} altı`, min: 0, max: 250 },
  {
    id: "p1",
    label: `${priceLabel(25000)} - ${priceLabel(50000)}`,
    min: 250,
    max: 500,
  },
  {
    id: "p2",
    label: `${priceLabel(50000)} - ${priceLabel(100000)}`,
    min: 500,
    max: 1000,
  },
  {
    id: "p3",
    label: `${priceLabel(100000)} ve üzeri`,
    min: 1000,
    max: Infinity,
  },
] as const;

const SORTS = [
  { value: "featured", label: "Önerilen" },
  { value: "price-asc", label: "Fiyat: artan" },
  { value: "price-desc", label: "Fiyat: azalan" },
  { value: "new", label: "Yeniler önce" },
];

/** What the filter panel chooses: within a section any option may match,
    across sections every section must. */
interface ShopFilters {
  cats: string[];
  prices: string[];
  flags: FlagId[];
}
const NO_FILTERS: ShopFilters = { cats: [], prices: [], flags: [] };

function matches(p: Product, f: ShopFilters): boolean {
  if (f.cats.length > 0 && !f.cats.includes(p.cat)) return false;
  if (f.prices.length > 0) {
    const v = priceOf(p);
    const inBand = PRICE_BANDS.some(
      (b) => f.prices.includes(b.id) && v >= b.min && v < b.max,
    );
    if (!inBand) return false;
  }
  if (f.flags.length > 0) {
    if (!FLAGS.some((fl) => f.flags.includes(fl.id) && fl.test(p)))
      return false;
  }
  return true;
}

const toggle = <T,>(list: readonly T[], v: T): T[] =>
  list.includes(v) ? list.filter((x) => x !== v) : [...list, v];

/** The slug a category id lives at (/magaza/<slug>). */
const SLUG_FOR = Object.fromEntries(
  SHOP_CATEGORY_ROUTES.map((c) => [c.productCat, c.slug]),
);

/**
 * The shop's promises. The free-shipping tile reads Ayarlar's threshold and
 * is left out when free shipping is off: it said "500₺" whatever the
 * checkout applied. The return tile names that some food is excepted (MSY
 * m.15), as the legal pages and the product page do.
 */
function trustTiles(freeFrom: string | null) {
  return [
    { k: "Bologna kavurma", v: "Çekirdek haftalık, taze kavrulur" },
    { k: "Aynı gün", v: "İstanbul içi, 14:00'a kadar" },
    ...(freeFrom
      ? [{ k: "Ücretsiz kargo", v: `${freeFrom} ve üzeri siparişte` }]
      : []),
    { k: "14 gün iade", v: "Gerekçesiz; bazı gıdalar hariç" },
  ];
}

export function PageShop({
  addToCart,
  openProduct,
  products,
  shopHeroSlides,
  settings,
  freeShippingThreshold,
  images,
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

  // The filters in force, and the panel's own copy while it is open: the
  // panel's choices apply with "Uygula", as the reference's do.
  const [applied, setApplied] = useState<ShopFilters>(NO_FILTERS);
  const [draft, setDraft] = useState<ShopFilters>(NO_FILTERS);
  const [sort, setSort] = useState<string>("featured");
  const [cols, setCols] = useState<1 | 2>(2);
  const [filtersOpen, setFiltersOpen] = useState(false);

  let list = shopProducts.filter((p) => matches(p, applied));
  if (sort === "price-asc")
    list = [...list].sort((a, b) => priceOf(a) - priceOf(b));
  if (sort === "price-desc")
    list = [...list].sort((a, b) => priceOf(b) - priceOf(a));
  // "Yeni" was an option with no branch behind it; new pieces first, the
  // rest in the shop's own order.
  if (sort === "new")
    list = [...list].sort((a, b) => Number(!!b.isNew) - Number(!!a.isNew));

  const countOf = (f: ShopFilters) =>
    f.cats.length + f.prices.length + f.flags.length;
  const activeFilterCount = countOf(applied);

  const openFilters = () => {
    setDraft(applied);
    setFiltersOpen(true);
  };
  const resetFilters = () => {
    setDraft(NO_FILTERS);
    setApplied(NO_FILTERS);
  };

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
  const featuredDiscount = featured ? productDiscount(featured) : null;

  // The threshold arrives in whole lira (the cart bar's figure).
  const freeFrom = freeShippingFrom(
    freeShippingThreshold === undefined
      ? undefined
      : Math.round(freeShippingThreshold * 100),
  );

  const trust = trustTiles(freeFrom);

  const phone = settings?.phone ?? "+90 536 429 09 19";
  const email = settings?.email ?? "info@nextgenlab.com.tr";

  const countFor = (id: string) =>
    id === "all"
      ? shopProducts.length
      : shopProducts.filter((p) => p.cat === id).length;

  // A chip chooses one category at once (or all); the panel may choose
  // several.
  const catControl = (c: (typeof CATS)[number]) => {
    const on =
      c.id === "all"
        ? applied.cats.length === 0
        : applied.cats.length === 1 && applied.cats[0] === c.id;
    // On a category page, siblings are links (their counts are not in hand).
    if (scopedCat) {
      const here = c.id === scopedCat;
      const href = c.id === "all" ? "/magaza" : `/magaza/${SLUG_FOR[c.id]}`;
      return (
        <a
          key={c.id}
          href={href}
          className="chip"
          aria-current={here ? "page" : undefined}
        >
          {c.label}
          {here && <span className="chip-count tabular">{countFor(c.id)}</span>}
        </a>
      );
    }
    return (
      <button
        key={c.id}
        type="button"
        className="chip"
        aria-pressed={on}
        onClick={() =>
          setApplied((f) => ({ ...f, cats: c.id === "all" ? [] : [c.id] }))
        }
      >
        {c.label}
        <span className="chip-count tabular">{countFor(c.id)}</span>
      </button>
    );
  };

  // The panel's sections: an option no product carries is left out.
  const catOptions = scopedCat
    ? []
    : CATS.filter((c) => c.id !== "all")
        .map((c) => ({ ...c, n: countFor(c.id) }))
        .filter((c) => c.n > 0);
  const priceOptions = PRICE_BANDS.map((b) => ({
    ...b,
    n: shopProducts.filter((p) => {
      const v = priceOf(p);
      return v >= b.min && v < b.max;
    }).length,
  })).filter((b) => b.n > 0);
  const flagOptions = FLAGS.map((f) => ({
    ...f,
    n: shopProducts.filter(f.test).length,
  })).filter((f) => f.n > 0);

  const scopedLabel = scopedCat
    ? CATS.find((c) => c.id === scopedCat)?.label
    : undefined;

  return (
    <div className="page" data-screen-label="03 Shop">
      {slides.length > 0 ? (
        <ShopHeroSlider slides={slides} />
      ) : (
        <div className="page-hero-media media">
          <Image
            src={siteImage(images, "hero.shop").src}
            unoptimized={siteImage(images, "hero.shop").src.startsWith(
              "/gorsel/",
            )}
            alt={siteImage(images, "hero.shop").alt}
            fill
            priority
            sizes="100vw"
          />
        </div>
      )}

      <section className="collection" id="products">
        <div className="collection-head">
          <div className="collection-title">
            <h1 className="t-display">
              {scopedLabel ? `Mağaza · ${scopedLabel}` : "Köşkün mağazası"}
            </h1>
            <p className="t-body">
              Tuzla köşkünde servis ettiğimiz her şey: Bologna’da kavrulan
              çekirdek, yenilebilir kup, bambu chasen, moka pot. Eve, ofise,
              hediyeye.
            </p>
          </div>
          <div className="collection-tools">
            <button
              type="button"
              className="btn collection-filter"
              onClick={openFilters}
              aria-haspopup="dialog"
              aria-expanded={filtersOpen}
            >
              <span>
                Filtre
                {activeFilterCount > 0 ? (
                  <span className="tabular"> ({activeFilterCount})</span>
                ) : null}
              </span>
              <svg viewBox="0 0 16 16" aria-hidden="true">
                <path d="M3 4.5h10M5 8h6M7 11.5h2" />
              </svg>
            </button>
            <SortMenu
              id="shop-sort"
              label="Sırala"
              value={sort}
              options={SORTS}
              onChange={setSort}
            />
            <GridToggle cols={cols} onChange={setCols} />
          </div>
        </div>

        <div
          className="chip-row collection-cats"
          role="group"
          aria-label="Ürün kategorileri"
        >
          {CATS.map((c) => catControl(c))}
        </div>

        {/* Product names are h3s. The count is for a screen reader: it is
            read out when a filter changes the list. */}
        <h2 className="sr-only">Ürünler</h2>
        <p className="sr-only" role="status" aria-live="polite">
          {list.length} ürün
        </p>
        {list.length > 0 ? (
          <div className="product-grid" data-cols={cols}>
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
        ) : (
          <div className="collection-empty">
            <p className="t-title">Bu filtreyle ürün yok</p>
            <button
              type="button"
              className="btn btn-wide"
              onClick={resetFilters}
            >
              Filtreleri temizle
            </button>
          </div>
        )}
      </section>

      <FilterSheet
        open={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        onApply={() => {
          setApplied(draft);
          setFiltersOpen(false);
        }}
        onClear={resetFilters}
        count={countOf(draft)}
        after={
          /* There is no chat. What there is: the phone and the mailbox,
             both answered by the bar. */
          <div className="filter-note">
            <p className="filter-note-title">Hangi çekirdek?</p>
            <p>
              Espresso mu filtre mi karar veremediysen bize sor:{" "}
              <a href={`tel:${phone.replace(/\s+/g, "")}`}>{phone}</a> ya da{" "}
              <a href={`mailto:${email}`}>{email}</a>.
            </p>
          </div>
        }
      >
        {catOptions.length > 0 && (
          <FilterSection title="Kategori">
            <FilterOptions label="Kategori">
              {catOptions.map((c) => (
                <FilterOption
                  key={c.id}
                  type="checkbox"
                  name="kategori"
                  checked={draft.cats.includes(c.id)}
                  onChange={() =>
                    setDraft((f) => ({ ...f, cats: toggle(f.cats, c.id) }))
                  }
                >
                  {c.label} <span className="filter-count">({c.n})</span>
                </FilterOption>
              ))}
            </FilterOptions>
          </FilterSection>
        )}
        {priceOptions.length > 0 && (
          <FilterSection title="Fiyat">
            <FilterOptions label="Fiyat">
              {priceOptions.map((b) => (
                <FilterOption
                  key={b.id}
                  type="checkbox"
                  name="fiyat"
                  checked={draft.prices.includes(b.id)}
                  onChange={() =>
                    setDraft((f) => ({ ...f, prices: toggle(f.prices, b.id) }))
                  }
                >
                  <span className="tabular">{b.label}</span>{" "}
                  <span className="filter-count">({b.n})</span>
                </FilterOption>
              ))}
            </FilterOptions>
          </FilterSection>
        )}
        {flagOptions.length > 0 && (
          <FilterSection title="Öne çıkanlar">
            <FilterOptions label="Öne çıkanlar">
              {flagOptions.map((fl) => (
                <FilterOption
                  key={fl.id}
                  type="checkbox"
                  name="one-cikan"
                  checked={draft.flags.includes(fl.id)}
                  onChange={() =>
                    setDraft((f) => ({ ...f, flags: toggle(f.flags, fl.id) }))
                  }
                >
                  {fl.label} <span className="filter-count">({fl.n})</span>
                </FilterOption>
              ))}
            </FilterOptions>
          </FilterSection>
        )}
      </FilterSheet>

      {featured && (
        <section
          className="split section--band"
          aria-labelledby="shop-set-title"
        >
          <div className="split-copy">
            <p className="t-label">Evde ritüel · iki kişilik</p>
            <h2 id="shop-set-title" className="t-display">
              Evde tableside servis
            </h2>
            <p className="t-body">{featured.desc}</p>
            <p className="t-price tabular">
              {featuredDiscount ? (
                <span className="price-was">{featuredDiscount.was}</span>
              ) : null}
              {featured.price}
            </p>
            {/* The discount's days beside the struck price (Ticari Reklam
                Yön. m.14/1). */}
            {featuredDiscount && (
              <p className="t-small t-muted">{featuredDiscount.notice}</p>
            )}
            <div className="btn-row">
              {/* A set sold in variants opens for the choice, like a card. */}
              {activeVariants(featured).length > 0 ? (
                <button
                  type="button"
                  className="btn btn-dark"
                  disabled={featured.stock !== undefined && featured.stock <= 0}
                  onClick={() => openProduct(featured)}
                >
                  Seçenekleri gör
                </button>
              ) : (
                <button
                  type="button"
                  className="btn btn-dark"
                  disabled={featured.stock !== undefined && featured.stock <= 0}
                  onClick={() => {
                    const item = toCartItem(featured);
                    if (item) {
                      addToCart(item);
                      trackCartAdd(item);
                    }
                  }}
                >
                  Sepete ekle
                </button>
              )}
              {featured.slug && (
                <a href={productPath(featured.slug)} className="btn">
                  Ürünü incele
                </a>
              )}
            </div>
          </div>
          <div className="split-media media">
            <ProductSurface label={featured.name} images={featured.images} />
          </div>
        </section>
      )}

      <section className="section" aria-label="Güvenceler">
        <div className="wrap">
          <ul className="fact-row fact-row--quiet" role="list">
            {trust.map((b) => (
              <li key={b.k}>
                <p className="t-label">{b.k}</p>
                <p className="t-small">{b.v}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </div>
  );
}
