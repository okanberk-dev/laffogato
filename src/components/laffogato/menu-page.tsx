"use client";

import { siteImage } from "@/lib/admin/site-images-core";
import Image from "next/image";
import { useMemo, useRef, useState } from "react";

import Link from "@/components/link";
import { menuAllergenWords } from "@/lib/menu/allergens";
import { menuPriceNote } from "@/lib/menu/price-list";
import { MENU_CATEGORY_ROUTES } from "@/lib/seo/pages";
import { parsePriceLabel } from "@/lib/utils/format";

import { MENU } from "./data";
import { menuItemGuide } from "./menu-guides";
import { MenuPhotoNote } from "./menu-photo-note";
import { MenuPlate } from "./visuals";
import { MENU_TAG_LABELS, type PageProps } from "./page-shared";
import {
  FilterOption,
  FilterOptions,
  FilterSection,
  FilterSheet,
  GridToggle,
  SortMenu,
} from "./ui";

const SORTS = [
  { value: "featured", label: "Menü sırası" },
  { value: "price-asc", label: "Fiyat: artan" },
  { value: "price-desc", label: "Fiyat: azalan" },
];

/** The menu panel's choices: any chosen category, any chosen label. */
interface MenuFilters {
  cats: string[];
  tags: string[];
}
const NO_FILTERS: MenuFilters = { cats: [], tags: [] };

const toggle = (list: readonly string[], v: string): string[] =>
  list.includes(v) ? list.filter((x) => x !== v) : [...list, v];

const LEDE =
  "İçeceklerin çoğu M ve L boy servis edilir. Alternatif süt ve ekstra shot barda seçilir. Menüye buradan göz at, beğendiğini barda söyle.";

export function PageMenu({ menu, settings, images }: PageProps) {
  const liveMenu = menu ?? MENU;
  const cats = Object.keys(liveMenu);
  // A single-category menu means this is /menu/<kategori>, which is scoped
  // server-side. Starting on "all" there made the page announce itself as
  // "Menü · Hepsi" and lost the category the URL promised.
  const scoped = cats.length === 1;
  const [applied, setApplied] = useState<MenuFilters>(NO_FILTERS);
  const [draft, setDraft] = useState<MenuFilters>(NO_FILTERS);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState("featured");
  const [cols, setCols] = useState<1 | 2>(2);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const gridRef = useRef<HTMLDivElement>(null);

  // The one category on show, when there is one: the page's title follows
  // it (every menu category is an indexable URL and they must not all ship
  // the same H1).
  const active = scoped
    ? cats[0]
    : applied.cats.length === 1
      ? applied.cats[0]
      : "all";

  // Restaurant-menu feel: tapping a category brings the freshly filtered list
  // up under the header instead of leaving the guest stranded mid-scroll.
  const selectCat = (key: string) => {
    setApplied((f) => ({ ...f, cats: key === "all" ? [] : [key] }));
    const el = gridRef.current;
    if (!el) return;
    const top = el.getBoundingClientRect().top + window.scrollY - 140;
    if (window.scrollY > top + 4) window.scrollTo({ top, behavior: "smooth" });
  };

  const totalCount = Object.values(liveMenu).reduce(
    (s, c) => s + c.items.length,
    0,
  );

  /**
   * One flat list rather than a section per category, as the prototype draws
   * it. Search still spans everything; the category pills filter it.
   *
   * There is no "sepete ekle" on these cards. The cafe menu on the web is a
   * viewing menu - the cart carries shop products, whose price and stock the
   * checkout re-reads from the products table, and a menu item has no product
   * row to validate against. Ordering cafe items exists in the mobile API and
   * wiring the web checkout to it is its own change.
   */
  const items = useMemo(() => {
    const q = query.trim().toLowerCase();
    const keys = applied.cats.length > 0 ? applied.cats : cats;
    const found = keys.flatMap((key) => {
      const cat = liveMenu[key];
      if (!cat) return [];
      return cat.items
        .filter(
          (it) =>
            !q ||
            it.name.toLowerCase().includes(q) ||
            it.desc.toLowerCase().includes(q),
        )
        .filter(
          (it) =>
            applied.tags.length === 0 ||
            applied.tags.some((t) => it.tags?.includes(t)),
        )
        .map((it) => ({ ...it, catKey: key, catLabel: cat.title }));
    });
    if (sort === "featured") return found;
    const dir = sort === "price-asc" ? 1 : -1;
    return [...found].sort(
      (a, b) => dir * (parsePriceLabel(a.price) - parsePriceLabel(b.price)),
    );
  }, [applied, cats, liveMenu, query, sort]);

  const activeLabel = active === "all" ? undefined : liveMenu[active]?.title;
  const activeNote = active === "all" ? undefined : liveMenu[active]?.note;

  // The panel's sections: a category or a label no item carries is left
  // out, and with nothing to choose the FILTER button goes too.
  const catOptions = scoped
    ? []
    : cats
        .map((key) => ({
          key,
          label: liveMenu[key].title,
          n: liveMenu[key].items.length,
        }))
        .filter((c) => c.n > 0);
  const tagOptions = Object.entries(MENU_TAG_LABELS)
    .map(([key, label]) => ({
      key,
      label,
      n: cats.reduce(
        (s, c) =>
          s + liveMenu[c].items.filter((it) => it.tags?.includes(key)).length,
        0,
      ),
    }))
    .filter((t) => t.n > 0);
  const hasFilters = catOptions.length > 0 || tagOptions.length > 0;
  const countOf = (f: MenuFilters) => f.cats.length + f.tags.length;
  const activeFilterCount = countOf(applied);
  const resetFilters = () => {
    setDraft(NO_FILTERS);
    setApplied(NO_FILTERS);
  };
  const heroImage = siteImage(images, "hero.menu");

  return (
    /* Not <main>: app.tsx already renders one around this, and a nested
       <main> is two landmarks with the same role. */
    <div className="page" data-screen-label="02 Menu">
      <div className="page-hero-media media">
        <Image
          src={heroImage.src}
          unoptimized={heroImage.src.startsWith("/gorsel/")}
          alt={heroImage.alt ?? ""}
          fill
          priority
          sizes="100vw"
        />
      </div>
      <section className="collection menu-page">
        <div className="collection-head">
          <div className="collection-title">
            <h1 className="t-display">
              {activeLabel ? `Menü · ${activeLabel}` : "Menü"}
            </h1>
            <p className="t-body">{activeNote || LEDE}</p>
            {/* The table order, said once where the menu starts; /masa has
                its own banner and hides this line (catalog.css). */}
            <p className="t-small menu-app-nudge">
              Köşkte misin? Masandaki QR&rsquo;ı okut, uygulamadan sipariş ver;
              masana gelsin.{" "}
              <Link href="/#uygulama" className="link-u">
                Uygulamayı gör
              </Link>
            </p>
          </div>
          <div className="collection-tools">
            <div className="search-input">
              <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <circle
                  cx="7"
                  cy="7"
                  r="5"
                  stroke="currentColor"
                  strokeWidth="1.2"
                />
                <path
                  d="M11 11l3.5 3.5"
                  stroke="currentColor"
                  strokeWidth="1.2"
                />
              </svg>
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Menüde ara"
                aria-label="Menüde ara"
              />
              {query && (
                <button
                  type="button"
                  className="search-input-clear"
                  onClick={() => setQuery("")}
                  aria-label="Aramayı temizle"
                >
                  ×
                </button>
              )}
            </div>
            {hasFilters && (
              <button
                type="button"
                className="btn collection-filter"
                onClick={() => {
                  setDraft(applied);
                  setFiltersOpen(true);
                }}
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
            )}
            <SortMenu
              id="menu-sort"
              label="Sırala"
              value={sort}
              options={SORTS}
              onChange={setSort}
            />
            <GridToggle cols={cols} onChange={setCols} />
          </div>
        </div>

        {/* Real links, one per category URL. On /menu itself a click
            filters in place (the page already holds every category); on
            a category page it navigates. */}
        <nav
          className="chip-row collection-cats"
          aria-label="Menü kategorileri"
        >
          <Link
            href="/menu"
            className="chip"
            aria-current={active === "all" ? "page" : undefined}
            onClick={
              scoped
                ? undefined
                : (e) => {
                    e.preventDefault();
                    selectCat("all");
                  }
            }
          >
            Tümü
            {!scoped && (
              <span className="chip-count tabular">{totalCount}</span>
            )}
          </Link>
          {MENU_CATEGORY_ROUTES.map((r) => {
            const cat = liveMenu[r.menuKey];
            if (!scoped && !cat) return null;
            const on = active === r.menuKey;
            return (
              <Link
                key={r.slug}
                href={`/menu/${r.slug}`}
                className="chip"
                aria-current={on ? "page" : undefined}
                onClick={
                  scoped
                    ? undefined
                    : (e) => {
                        e.preventDefault();
                        selectCat(r.menuKey);
                      }
                }
              >
                {cat?.title ?? r.breadcrumbLabel}
                {cat && (
                  <span className="chip-count tabular">{cat.items.length}</span>
                )}
              </Link>
            );
          })}
        </nav>

        <p className="sr-only" role="status" aria-live="polite">
          {items.length} ürün
        </p>
        {items.length === 0 && (query.trim() || applied.tags.length > 0) ? (
          /* A search or a label with no match. */
          <div className="collection-empty">
            <h2 className="t-title">Aradığın tatla eşleşen ürün yok</h2>
            <p className="t-body t-muted">
              Farklı bir kelime dene ya da filtreleri sıfırla.
            </p>
            <button
              type="button"
              className="btn btn-wide"
              onClick={() => {
                setQuery("");
                resetFilters();
              }}
            >
              Filtreleri temizle
            </button>
          </div>
        ) : items.length === 0 ? (
          /* Every item of this category is off the menu today (the
             panel's switch). */
          <div className="collection-empty">
            <h2 className="t-title">
              {active === "all"
                ? "Menüde şu an ürün yok"
                : "Bu kategoride şu an ürün yok"}
            </h2>
            {active !== "all" && (
              <>
                <p className="t-body t-muted">Menünün geri kalanına göz at.</p>
                <Link
                  href="/menu"
                  className="btn btn-wide"
                  onClick={
                    scoped
                      ? undefined
                      : (e) => {
                          e.preventDefault();
                          selectCat("all");
                        }
                  }
                >
                  Tüm menü
                </Link>
              </>
            )}
          </div>
        ) : (
          <>
            {/* The cards are h3s. */}
            <h2 className="sr-only">
              {active === "all" ? "Tüm menü" : activeLabel}
            </h2>
            <div className="product-grid" data-cols={cols} ref={gridRef}>
              {items.map((it) => {
                const badge = it.tags
                  ?.map((t) => MENU_TAG_LABELS[t])
                  .find(Boolean);
                // TGK Etiketleme Yön. m.15/5: the item's own allergens,
                // once the panel has them. Never clamped.
                const allergens = menuAllergenWords(it.allergens);
                const guide = menuItemGuide(it.name);
                return (
                  <article className="p-card" key={`${it.catKey}:${it.name}`}>
                    <div className="media ratio-5-4 p-card-media">
                      <MenuPlate image={it.image} />
                      {badge && <span className="badge">{badge}</span>}
                    </div>
                    <div className="p-card-head">
                      <h3 className="t-title">{it.name}</h3>
                      <span className="t-price tabular">
                        {it.priceL ? (
                          <>
                            <span className="size-key">M</span> {it.price}{" "}
                            <span className="size-key">L</span> {it.priceL}
                          </>
                        ) : (
                          it.price
                        )}
                      </span>
                    </div>
                    <p className="t-small p-card-sub">{it.desc}</p>
                    {allergens && (
                      <p className="t-small t-muted">
                        Alerjenler:{" "}
                        {allergens.length > 0 ? allergens.join(", ") : "yok"}
                      </p>
                    )}
                    <p className="t-small t-muted">{it.catLabel}</p>
                    {guide && (
                      <Link href={`/rehber/${guide}`} className="link-u">
                        Rehberde oku
                        <span className="sr-only">: {it.name}</span>
                      </Link>
                    )}
                  </article>
                );
              })}
            </div>
            <MenuPhotoNote show={items.some((it) => it.image)} />
            {/* Fiyat Etiketi Yön. m.5/2-c, d: prices include every tax,
                and the day they started to apply (Ayarlar > Vergi). A
                table's QR code opens this list (/masa/<kod>). */}
            <p className="t-small t-muted menu-price-note">
              {menuPriceNote(settings?.menuPricesEffectiveDate)}
            </p>
          </>
        )}
      </section>

      {hasFilters && (
        <FilterSheet
          open={filtersOpen}
          onClose={() => setFiltersOpen(false)}
          onApply={() => {
            setApplied(draft);
            setFiltersOpen(false);
          }}
          onClear={resetFilters}
          count={countOf(draft)}
        >
          {catOptions.length > 0 && (
            <FilterSection title="Kategori">
              <FilterOptions label="Kategori">
                {catOptions.map((c) => (
                  <FilterOption
                    key={c.key}
                    type="checkbox"
                    name="kategori"
                    checked={draft.cats.includes(c.key)}
                    onChange={() =>
                      setDraft((f) => ({ ...f, cats: toggle(f.cats, c.key) }))
                    }
                  >
                    {c.label} <span className="filter-count">({c.n})</span>
                  </FilterOption>
                ))}
              </FilterOptions>
            </FilterSection>
          )}
          {tagOptions.length > 0 && (
            <FilterSection title="Etiket">
              <FilterOptions label="Etiket">
                {tagOptions.map((t) => (
                  <FilterOption
                    key={t.key}
                    type="checkbox"
                    name="etiket"
                    checked={draft.tags.includes(t.key)}
                    onChange={() =>
                      setDraft((f) => ({ ...f, tags: toggle(f.tags, t.key) }))
                    }
                  >
                    {t.label} <span className="filter-count">({t.n})</span>
                  </FilterOption>
                ))}
              </FilterOptions>
            </FilterSection>
          )}
        </FilterSheet>
      )}

      {/* Allergen and provenance notes: someone with a gluten intolerance
          needs to read this before they order at the bar. */}
      <section className="section section--band" aria-label="Notlar">
        <div className="wrap">
          <ul className="fact-row fact-row--quiet menu-notes" role="list">
            <li>
              <p className="t-label">Self-servis</p>
              <p className="t-small">
                Menüye buradan göz at, beğendiğini barda söyle. Uygulaman varsa
                masandaki QR&rsquo;ı okut: sipariş masana gelir.
              </p>
            </li>
            <li>
              <p className="t-label">Alerjenler</p>
              {/* The card says what the item contains once the panel has
                  it; the cross-contact line is the kitchen's and holds for
                  all. */}
              <p className="t-small">
                Ürünün içerdiği alerjenler kartında yazar; yazmıyorsa siparişten
                önce baristaya sor. Mutfağımızda süt, gluten, kuruyemiş ve soya
                ile çapraz temas olabilir. Çölyak ya da ciddi bir alerjin varsa
                baristaya söyle.
              </p>
              <Link href="/hukuk/gida-guvenligi-ve-alerjen" className="link-u">
                Alerjen ve gıda güvenliği bilgisi
              </Link>
            </li>
            <li>
              <p className="t-label">Köken</p>
              <p className="t-small">
                Espresso: Sirena harmanı (Bologna kavurma). Matcha: Uji
                ceremonial grade. Pistacchio: Bronte IGP. Süt: Tuzla yerel
                mandıra.
              </p>
            </li>
            <li>
              <p className="t-label">Servis</p>
              <p className="t-small">
                Bar köşesi 6 koltuk yürüyüş trafiği için ayrı. Köpekler hoş
                geldi.
              </p>
            </li>
          </ul>
        </div>
      </section>
    </div>
  );
}
