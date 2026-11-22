"use client";

import { siteImage } from "@/lib/admin/site-images-core";
import { useState, useMemo, useRef } from "react";

import Link from "@/components/link";
import { menuAllergenWords } from "@/lib/menu/allergens";
import { menuPriceNote } from "@/lib/menu/price-list";
import { MENU_CATEGORY_ROUTES } from "@/lib/seo/pages";

import { PageHero } from "./page-hero";
import { MENU } from "./data";
import { menuItemGuide } from "./menu-guides";
import { MenuPhotoNote } from "./menu-photo-note";
import { MenuPlate } from "./visuals";
import { MENU_TAG_LABELS, type PageProps } from "./page-shared";

export function PageMenu({ menu, settings, images }: PageProps) {
  const liveMenu = menu ?? MENU;
  const cats = Object.keys(liveMenu);
  // A single-category menu means this is /menu/<kategori>, which is scoped
  // server-side. Starting on "all" there made the page announce itself as
  // "Menü · Hepsi" and lost the category the URL promised.
  const scoped = cats.length === 1;
  const [active, setActive] = useState<string>(scoped ? cats[0] : "all");
  const [query, setQuery] = useState("");
  const gridRef = useRef<HTMLDivElement>(null);

  // Restaurant-menu feel: tapping a category brings the freshly filtered list
  // up under the header instead of leaving the guest stranded mid-scroll.
  const selectCat = (key: string) => {
    setActive(key);
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
    const keys = active === "all" ? cats : [active];
    return keys.flatMap((key) => {
      const cat = liveMenu[key];
      if (!cat) return [];
      return cat.items
        .filter(
          (it) =>
            !q ||
            it.name.toLowerCase().includes(q) ||
            it.desc.toLowerCase().includes(q),
        )
        .map((it) => ({ ...it, catKey: key, catLabel: cat.title }));
    });
  }, [active, cats, liveMenu, query]);

  const activeLabel = active === "all" ? "Hepsi" : liveMenu[active]?.title;

  return (
    /* Not <main>: app.tsx already renders one around this, and a nested
       <main> is two landmarks with the same role. */
    <div className="page" data-screen-label="02 Menu">
      <PageHero
        image={siteImage(images, "hero.menu")}
        eyebrow={active === "all" ? undefined : "Menü"}
        /* The category's own name: every menu category is an indexable URL
           and they must not all ship the same H1. */
        title={active === "all" ? "Menü" : (activeLabel ?? "Menü")}
        lede="İçeceklerin çoğu M ve L boy servis edilir. Alternatif süt ve ekstra shot barda seçilir. Menüye buradan göz at, beğendiğini barda söyle."
      />
      <section className="section collection menu-page">
        <div className="wrap">
          <div className="collection-head">
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
                      <span className="chip-count tabular">
                        {cat.items.length}
                      </span>
                    )}
                  </Link>
                );
              })}
            </nav>
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
          </div>

          {items.length === 0 && query.trim() ? (
            /* A search with no match. */
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
                  setActive("all");
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
                  <p className="t-body t-muted">
                    Menünün geri kalanına göz at.
                  </p>
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
              <div className="product-grid product-grid--4" ref={gridRef}>
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
                      <p className="t-small">{it.desc}</p>
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
        </div>
      </section>

      {/* Allergen and provenance notes: someone with a gluten intolerance
          needs to read this before they order at the bar. */}
      <section className="section section--band" aria-label="Notlar">
        <div className="wrap">
          <ul className="fact-row fact-row--quiet menu-notes" role="list">
            <li>
              <p className="t-label">Self-servis</p>
              <p className="t-small">
                Menüye buradan göz at, beğendiğini barda söyle. Sipariş ve
                servis bardan verilir, garson beklemeden.
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
