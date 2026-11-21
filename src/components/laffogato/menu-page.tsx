"use client";

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

export function PageMenu({ menu, settings }: PageProps) {
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
      <div className="menu-page">
        <PageHero
          image={{ src: "/photos/hero-menu.webp" }}
          eyebrow={`Menü · ${activeLabel}`}
          /* The category's own name, not a fixed tuple. Every menu category
             is an indexable URL and they were all shipping the same H1. */
          title={
            active === "all" ? ["Bugün ne", "içiyoruz?"] : `${activeLabel}.`
          }
          lede="İçeceklerin çoğu M ve L boy servis edilir. Alternatif süt ve ekstra shot barda seçilir. Menüye buradan göz at, beğendiğini barda söyle."
        />
        <div className="wrap">
          <div className="menu-filter-row">
            {/* Real links, one per category URL: six of the twelve menu
                pages used to have no link anywhere but the sitemap, and a
                category page could not reach its siblings. On /menu itself a
                click filters in place (the page is already holding every
                category); on a category page it navigates. */}
            <nav className="menu-tabs scroller" aria-label="Menü kategorileri">
              <Link
                href="/menu"
                className={`menu-tab ${active === "all" ? "on" : ""}`}
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
                <span>Tümü</span>
                {!scoped && <span className="count">{totalCount}</span>}
              </Link>
              {MENU_CATEGORY_ROUTES.map((r) => {
                const cat = liveMenu[r.menuKey];
                if (!scoped && !cat) return null;
                const on = active === r.menuKey;
                return (
                  <Link
                    key={r.slug}
                    href={`/menu/${r.slug}`}
                    className={`menu-tab ${on ? "on" : ""}`}
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
                    <span>{cat?.title ?? r.breadcrumbLabel}</span>
                    {cat && <span className="count">{cat.items.length}</span>}
                  </Link>
                );
              })}
            </nav>
            <div className="menu-search">
              <svg
                width="15"
                height="15"
                viewBox="0 0 16 16"
                fill="none"
                aria-hidden="true"
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
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Menüde ara…"
                aria-label="Menüde ara"
              />
              {query && (
                <button
                  className="menu-search-clear"
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
            <div className="menu-empty">
              <h2 className="h3">Aradığın tatla eşleşen ürün yok</h2>
              <p style={{ color: "var(--ink-mute)", marginTop: 10 }}>
                Farklı bir kelime dene ya da filtreleri sıfırla.
              </p>
              <button
                className="btn btn-ghost"
                style={{ marginTop: 22 }}
                onClick={() => {
                  setQuery("");
                  setActive("all");
                }}
              >
                Filtreleri temizle
              </button>
            </div>
          ) : items.length === 0 ? (
            /* No search, and still nothing: every item of this category is
               off the menu today (the panel's switch). It used to say the
               search found nothing and offered to clear a filter nobody
               had set. */
            <div className="menu-empty">
              <h2 className="h3">
                {active === "all"
                  ? "Menüde şu an ürün yok"
                  : "Bu kategoride şu an ürün yok"}
              </h2>
              {active !== "all" && (
                <>
                  <p style={{ color: "var(--ink-mute)", marginTop: 10 }}>
                    Menünün geri kalanına göz at.
                  </p>
                  <Link
                    href="/menu"
                    className="btn btn-ghost"
                    style={{ marginTop: 22 }}
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
              {/* The cards are h3s; without a heading between them and the
                page's h1 the outline skipped a level. */}
              <h2 className="sr-only">
                {active === "all" ? "Tüm menü" : activeLabel}
              </h2>
              <div className="menu-grid" ref={gridRef}>
                {items.map((it) => {
                  const badge = it.tags
                    ?.map((t) => MENU_TAG_LABELS[t])
                    .find(Boolean);
                  // TGK Etiketleme Yön. m.15/5: the item's own allergens,
                  // once the panel has them. Never clamped like the
                  // description: an allergen is not cut to fit.
                  const allergens = menuAllergenWords(it.allergens);
                  const guide = menuItemGuide(it.name);
                  return (
                    <article
                      className="rail-card"
                      key={`${it.catKey}:${it.name}`}
                    >
                      <div className="rail-card-media menu-card-media">
                        <MenuPlate
                          hue={it.hue}
                          name={it.name}
                          cat={it.catKey}
                          image={it.image}
                        />
                        {badge && (
                          <span
                            className={`rail-card-badge ${badge === "YENİ" ? "new" : ""}`}
                          >
                            {badge}
                          </span>
                        )}
                      </div>
                      <div className="rail-card-body">
                        <div>
                          <span className="rail-card-cat">{it.catLabel}</span>
                          <h3 className="rail-card-name menu-card-name">
                            {it.name}
                          </h3>
                          <p className="rail-card-desc">{it.desc}</p>
                          {guide && (
                            <Link
                              href={`/rehber/${guide}`}
                              className="menu-card-guide"
                            >
                              Rehberde oku
                              <span className="arrow" aria-hidden="true">
                                →
                              </span>
                            </Link>
                          )}
                          {allergens && (
                            <p className="menu-card-allergens">
                              <span className="menu-card-allergens-key">
                                Alerjenler:
                              </span>{" "}
                              {allergens.length > 0
                                ? allergens.join(", ")
                                : "yok"}
                            </p>
                          )}
                        </div>
                        <div className="rail-card-foot">
                          <span className="rail-card-price">
                            {it.priceL ? (
                              <>
                                <span className="size-key">M</span> {it.price}
                                <span className="size-sep">·</span>
                                <span className="size-key">L</span> {it.priceL}
                              </>
                            ) : (
                              it.price
                            )}
                          </span>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
              <MenuPhotoNote show={items.some((it) => it.image)} />
              {/* Fiyat Etiketi Yön. m.5/2-c, d: prices include every tax,
                  and the day they started to apply (Ayarlar > Vergi). A
                  table's QR code opens this list (/masa/<kod>). */}
              <p className="menu-price-note">
                {menuPriceNote(settings?.menuPricesEffectiveDate)}
              </p>
            </>
          )}
        </div>

        {/* Allergen and provenance notes - not decoration: someone with a
            gluten intolerance needs to read this before they order at the
            bar. */}
        <section className="section-tight menu-notes-band">
          <div className="wrap menu-notes" data-row="menu-notes">
            <div>
              <div className="eyebrow muted">Self-servis</div>
              <p>
                Menüye buradan göz at, beğendiğini barda söyle. Sipariş ve
                servis bardan verilir - garson beklemeden.
              </p>
            </div>
            <div>
              <div className="eyebrow muted">Alerjenler</div>
              {/* The card says what the item contains once the panel has it;
                  the cross-contact line is the kitchen's and holds for all.
                  The table of the fourteen groups is in the food safety
                  document (§7). */}
              <p>
                Ürünün içerdiği alerjenler kartında yazar; yazmıyorsa siparişten
                önce baristaya sor. Mutfağımızda süt, gluten, kuruyemiş ve soya
                ile çapraz temas olabilir. Çölyak ya da ciddi bir alerjin varsa
                baristaya söyle.
              </p>
              <p>
                <Link
                  href="/hukuk/gida-guvenligi-ve-alerjen"
                  className="link-more"
                >
                  Alerjen ve gıda güvenliği bilgisi
                </Link>
              </p>
            </div>
            <div>
              <div className="eyebrow muted">Köken</div>
              <p>
                Espresso: Sirena harmanı (Bologna kavurma). Matcha: Uji
                ceremonial grade. Pistacchio: Bronte IGP. Süt: Tuzla yerel
                mandıra.
              </p>
            </div>
            <div>
              <div className="eyebrow muted">Servis</div>
              <p>
                Bar köşesi 6 koltuk yürüyüş trafiği için ayrı. Köpekler hoş
                geldi.
              </p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
