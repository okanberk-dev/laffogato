"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";

import Link from "@/components/link";
import { MENU_CATEGORY_ROUTES } from "@/lib/seo/pages";

import { LafMark } from "./brand-mark";
import { cx } from "./cx";
import type { MenuCategory, Product } from "./data";
import { productPath } from "./route-paths";
import { useDialog } from "./use-dialog";
import { MenuPlate, ProductSurface } from "./visuals";

/* ─────────────────────────────────────────────────────────────
   Search - the header turns into the search bar

   The panel is anchored where the header is and starts with a bar of the
   header's own height, so opening search reads as the header changing mode
   rather than a box appearing over the page: the L'Af mark stays where it
   was, the links give way to the field. Below it, before anything is typed:
   popular searches, the visitor's own recent ones and five quick doors;
   once two letters are in, results grouped by shop and menu with the
   matched letters marked. Arrow keys move through the results, Enter opens
   one - the list is a listbox the field controls.
   ───────────────────────────────────────────────────────────── */

interface SearchResult {
  key: string;
  kind: "product" | "menu";
  name: string;
  sub: string;
  price?: string;
  href: string;
  product?: Product;
  /** A menu item's photo, when the panel has one. */
  image?: string;
}

const POPULAR = [
  "Affogato",
  "Matcha",
  "Yenilebilir kupa",
  "Espresso",
  "Hediye",
];

/** The doors under the field, as the reference's "Top Categories". */
const QUICK: Array<{ href: string; title: string }> = [
  { href: "/menu", title: "Menü" },
  { href: "/magaza", title: "Mağaza" },
  { href: "/magaza/cekirdek", title: "Çekirdek kahve" },
  { href: "/karaoke", title: "Karaoke" },
  { href: "/kampanyalar", title: "Kampanyalar" },
  { href: "/ziyaret", title: "Ziyaret" },
];

const RECENT_KEY = "laf_recent_search_v1";
const RECENT_MAX = 5;

function readRecent(): string[] {
  try {
    const raw = window.localStorage.getItem(RECENT_KEY);
    const list = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(list)
      ? list
          .filter((s): s is string => typeof s === "string")
          .slice(0, RECENT_MAX)
      : [];
  } catch {
    return [];
  }
}

function writeRecent(list: string[]) {
  try {
    window.localStorage.setItem(RECENT_KEY, JSON.stringify(list));
  } catch {
    /* private mode or storage blocked - recents are a convenience */
  }
}

/** Turkish-aware fold: "İ" → "i", "I" → "ı", so "irmik" finds "İrmik". */
const fold = (s: string) => s.toLocaleLowerCase("tr-TR");

/** The name with the matched run wrapped in <mark>. */
function Highlight({ text, term }: { text: string; term: string }) {
  if (!term) return <>{text}</>;
  const at = fold(text).indexOf(term);
  if (at < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, at)}
      <mark>{text.slice(at, at + term.length)}</mark>
      {text.slice(at + term.length)}
    </>
  );
}

function Glyph({ children }: { children: ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      {children}
    </svg>
  );
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
  const router = useRouter();
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);
  const [recent, setRecent] = useState<string[]>([]);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  useDialog(open, onClose, panelRef);

  /* A fresh query each time the panel opens, adjusted during render so the
     stale term never paints for a frame (react.dev "adjusting state when a
     prop changes"). Recents are read on the same transition - localStorage
     is only touched in the browser, after the visitor asked for search. */
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setQ("");
      setActive(0);
      setRecent(typeof window === "undefined" ? [] : readRecent());
    }
  }

  const term = fold(q.trim());
  const results: SearchResult[] = [];
  if (term.length >= 2) {
    for (const p of products) {
      const hay = fold(`${p.name} ${p.tag} ${p.desc} ${p.cat}`);
      if (hay.includes(term)) {
        results.push({
          key: `p-${p.id ?? p.name}`,
          kind: "product",
          name: p.name,
          sub: p.tag,
          price: p.price,
          href: p.slug ? productPath(p.slug) : "/magaza",
          product: p,
        });
      }
    }
    for (const [key, cat] of Object.entries(menu)) {
      // Each result opens its own category page.
      const slug = MENU_CATEGORY_ROUTES.find((r) => r.menuKey === key)?.slug;
      for (const it of cat.items) {
        const hay = fold(`${it.name} ${it.desc} ${(it.tags ?? []).join(" ")}`);
        if (hay.includes(term)) {
          results.push({
            key: `m-${key}-${it.name}`,
            kind: "menu",
            name: it.name,
            sub: cat.title,
            price: it.price,
            href: slug ? `/menu/${slug}` : "/menu",
            image: it.image,
          });
        }
      }
    }
  }
  const productResults = results
    .filter((r) => r.kind === "product")
    .slice(0, 6);
  const menuResults = results.filter((r) => r.kind === "menu").slice(0, 6);
  // Before anything is typed: the shelf's featured pieces first, three to a
  // row, as the reference's "Most Popular".
  const popular = products
    .filter((p) => p.slug && (p.stock === undefined || p.stock > 0))
    .sort(
      (a, b) =>
        Number(!!b.featured) - Number(!!a.featured) ||
        Number(!!b.isNew) - Number(!!a.isNew),
    )
    .slice(0, 6);
  const flat = [...productResults, ...menuResults];
  const activeIndex = flat.length ? Math.min(active, flat.length - 1) : -1;

  // Keep the highlighted row in view as the arrows move it.
  useEffect(() => {
    if (!open || activeIndex < 0) return;
    panelRef.current
      ?.querySelector<HTMLElement>(`[data-index="${activeIndex}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [open, activeIndex]);

  if (!open) return null;

  const remember = (value: string) => {
    const v = value.trim();
    if (v.length < 2) return;
    const next = [v, ...recent.filter((r) => fold(r) !== fold(v))].slice(
      0,
      RECENT_MAX,
    );
    setRecent(next);
    writeRecent(next);
  };

  const choose = (r: SearchResult) => {
    remember(q);
    if (!r.product?.slug && r.product && onOpenProduct) {
      onOpenProduct(r.product);
      onClose();
      return;
    }
    onClose();
    router.push(r.href);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!flat.length) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((activeIndex + 1) % flat.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((activeIndex - 1 + flat.length) % flat.length);
    } else if (e.key === "Enter" && activeIndex >= 0) {
      e.preventDefault();
      choose(flat[activeIndex]);
    }
  };

  const pick = (value: string) => {
    setQ(value);
    setActive(0);
    inputRef.current?.focus();
  };

  const clearRecent = () => {
    setRecent([]);
    writeRecent([]);
  };

  const row = (r: SearchResult, index: number) => (
    <li key={r.key} role="presentation">
      <a
        href={r.href}
        id={`search-opt-${index}`}
        role="option"
        aria-selected={index === activeIndex}
        data-index={index}
        className={cx("search-result", index === activeIndex && "is-active")}
        onMouseMove={() => index !== activeIndex && setActive(index)}
        onClick={(e) => {
          e.preventDefault();
          choose(r);
        }}
      >
        <span className="search-result-thumb media ratio-1" aria-hidden="true">
          {r.kind === "product" ? (
            <ProductSurface label={r.name} images={r.product?.images} />
          ) : (
            <MenuPlate image={r.image} sizes="64px" />
          )}
        </span>
        <span className="search-result-info">
          <span className="search-result-name">
            <Highlight text={r.name} term={term} />
          </span>
          <span className="search-result-sub">{r.sub}</span>
        </span>
        {r.price && <span className="search-result-price">{r.price}</span>}
        <span className="search-result-go" aria-hidden="true">
          <Glyph>
            <path d="M5 12h13M13 6.5 18.5 12 13 17.5" />
          </Glyph>
        </span>
      </a>
    </li>
  );

  const hasQuery = term.length >= 2;

  return (
    <div className="search-overlay" onClick={onClose}>
      <div
        ref={panelRef}
        className="search-panel"
        role="dialog"
        aria-modal="true"
        aria-label="Site içi arama"
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="search-bar">
          <span className="search-bar-mark" aria-hidden="true">
            <LafMark tone="ink" />
          </span>
          <label className="search-field">
            <span className="search-field-icon" aria-hidden="true">
              <Glyph>
                <circle cx="10.75" cy="10.75" r="6.25" />
                <path d="m15.5 15.5 4.25 4.25" />
              </Glyph>
            </span>
            <input
              ref={inputRef}
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setActive(0);
              }}
              onKeyDown={onKeyDown}
              placeholder="Menüde ve mağazada ara"
              aria-label="Menüde ve mağazada ara"
              role="combobox"
              aria-expanded={hasQuery && flat.length > 0}
              aria-controls="search-listbox"
              aria-activedescendant={
                hasQuery && activeIndex >= 0
                  ? `search-opt-${activeIndex}`
                  : undefined
              }
              aria-autocomplete="list"
              enterKeyHint="search"
              autoComplete="off"
              spellCheck={false}
            />
            {q && (
              <button
                type="button"
                className="search-clear"
                aria-label="Aramayı temizle"
                onClick={() => pick("")}
              >
                <Glyph>
                  <path d="m7.5 7.5 9 9m0-9-9 9" />
                </Glyph>
              </button>
            )}
          </label>
          <button
            type="button"
            onClick={onClose}
            className="search-close"
            aria-label="Aramayı kapat"
          >
            <svg viewBox="0 0 20 20" aria-hidden="true">
              <path d="M1 1l18 18M19 1 1 19" />
            </svg>
          </button>
        </div>

        <div className="search-body">
          {!hasQuery ? (
            <div className="search-start">
              {recent.length > 0 && (
                <section className="search-block">
                  <div className="search-block-head">
                    <span className="search-block-title">Son aramaların</span>
                    <button
                      type="button"
                      className="search-block-action"
                      onClick={clearRecent}
                    >
                      Temizle
                    </button>
                  </div>
                  <div className="search-chips">
                    {recent.map((s) => (
                      <button
                        key={s}
                        type="button"
                        className="search-chip search-chip--recent"
                        onClick={() => pick(s)}
                      >
                        <Glyph>
                          <path d="M4.75 12a7.25 7.25 0 1 0 2.1-5.1M4.75 4.75v3.5h3.5" />
                          <path d="M12 8.5V12l2.5 1.75" />
                        </Glyph>
                        {s}
                      </button>
                    ))}
                  </div>
                </section>
              )}
              <section className="search-block">
                <div className="search-block-head">
                  <span className="search-block-title">Popüler</span>
                </div>
                <div className="search-chips">
                  {POPULAR.map((s) => (
                    <button
                      key={s}
                      type="button"
                      className="search-chip"
                      onClick={() => pick(s)}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </section>
              <section className="search-block">
                <div className="search-block-head">
                  <span className="search-block-title">Kategoriler</span>
                </div>
                <div className="search-chips">
                  {QUICK.map((d) => (
                    <Link
                      key={d.href}
                      href={d.href}
                      className="search-chip"
                      onClick={onClose}
                    >
                      {d.title}
                    </Link>
                  ))}
                </div>
              </section>
              {popular.length > 0 && (
                <section className="search-popular">
                  <h2 className="search-popular-title">Çok tercih edilenler</h2>
                  <ul className="product-grid search-popular-grid" role="list">
                    {popular.map((p) => (
                      <li key={p.id ?? p.slug} className="p-card">
                        <Link
                          href={productPath(p.slug!)}
                          className="p-card-link"
                          onClick={onClose}
                        >
                          <span className="media ratio-5-4 p-card-media">
                            <ProductSurface label={p.name} images={p.images} />
                            {p.isNew ? (
                              <span className="badge">Yeni</span>
                            ) : p.featured ? (
                              <span className="badge">Öne çıkan</span>
                            ) : null}
                          </span>
                          <span className="p-card-head">
                            <span className="t-title">{p.name}</span>
                            <span className="t-price tabular">{p.price}</span>
                          </span>
                          {p.tag ? (
                            <span className="t-small p-card-sub">{p.tag}</span>
                          ) : null}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </section>
              )}
            </div>
          ) : flat.length === 0 ? (
            <div className="search-empty">
              <span className="search-empty-mark" aria-hidden="true">
                <LafMark tone="green" height={34} />
              </span>
              <p className="search-empty-title">
                &ldquo;{q.trim()}&rdquo; için sonuç yok
              </p>
              <p className="search-empty-text">
                Başka bir kelime dene ya da bunlardan birine göz at
              </p>
              <div className="search-chips search-chips--center">
                {POPULAR.slice(0, 4).map((s) => (
                  <button
                    key={s}
                    type="button"
                    className="search-chip"
                    onClick={() => pick(s)}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <ul
              id="search-listbox"
              role="listbox"
              aria-label="Arama sonuçları"
              className="search-list"
            >
              {productResults.length > 0 && (
                <li role="presentation" className="search-group-head">
                  Mağaza <span>{productResults.length}</span>
                </li>
              )}
              {productResults.map((r, i) => row(r, i))}
              {menuResults.length > 0 && (
                <li role="presentation" className="search-group-head">
                  Menü <span>{menuResults.length}</span>
                </li>
              )}
              {menuResults.map((r, i) => row(r, productResults.length + i))}
            </ul>
          )}
        </div>

      </div>
    </div>
  );
}
