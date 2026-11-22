"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { accountMenuStateAction, logoutAction } from "@/app/uye/actions";
import Link from "@/components/link";
import { CONSENT_OPEN_EVENT } from "@/lib/consent/script";
import { LEGAL_ENTITY } from "@/lib/legal/entity";
import { FOOTER_LEGAL_DOCS } from "@/lib/legal/nav";
import { OTHER_BRANCHES } from "@/lib/seo/branches";
import { APP_STORE_URL, PLAY_STORE_URL } from "@/lib/mobile/app-store";
import { MENU_CATEGORY_ROUTES } from "@/lib/seo/pages";
import { SITE } from "@/lib/seo/site";
import { addressLines } from "@/lib/utils/format";

import { LafMark } from "./brand-mark";
import { NewsletterForm } from "./newsletter-form";
import { ROUTE_PATHS, type Route } from "./route-paths";
import { cx } from "./cx";
import { useOpenStatus } from "./use-open-status";

export type { Route };
/** Re-export for legacy importers that still pull `ROUTE_PATHS` from here.
    New server-side code should import directly from `./route-paths`. */
export { ROUTE_PATHS };

/*
 * The site's chrome (21 Kas 2026), in the reference's language: a thin
 * announcement line, then the bar - the destinations on the left in tracked
 * capitals, the mark in the middle, search, account and bag on the right -
 * on the band. A destination with more behind it opens a full-width panel
 * under the bar. Below the wide layout the bar keeps the mark in the
 * middle, the menu button takes the left, and a row of quick links follows.
 * The footer is the charcoal block.
 */

export interface DropdownEntry {
  slug: string;
  label: string;
  sub: string;
}

/** Every /menu/<slug> page has a door in the chrome, built from the real
 *  category routes so an entry cannot point at a page that does not exist. */
const MENU_LINKS: DropdownEntry[] = MENU_CATEGORY_ROUTES.filter(
  (c) => c.nav,
).map((c) => ({ slug: c.slug, label: c.nav!.label, sub: c.nav!.italian }));
const MENU_MORE: DropdownEntry[] = MENU_CATEGORY_ROUTES.filter(
  (c) => !c.nav,
).map((c) => ({ slug: c.slug, label: c.breadcrumbLabel, sub: "" }));

const SHOP_LINKS: DropdownEntry[] = [
  { slug: "cekirdek", label: "Çekirdek kahve", sub: "Bologna'da kavrulur" },
  { slug: "hediye", label: "Hediye setleri", sub: "Kutusunda hazır" },
  { slug: "ekipman", label: "Ekipman", sub: "Moka pot, chasen" },
  { slug: "giyim", label: "Giyim", sub: "Önlük, tişört" },
  { slug: "kiler", label: "Kiler", sub: "Matcha, şurup" },
];

type DropdownKey = "menu" | "shop" | "visit";

interface LinkEntry {
  href: string;
  label: string;
  /** SPA section this link opens, when it is one. */
  route?: Route;
  dropdown?: DropdownKey;
}

const LINKS: LinkEntry[] = [
  { href: "/menu", label: "Menü", route: "menu", dropdown: "menu" },
  { href: "/magaza", label: "Mağaza", route: "shop", dropdown: "shop" },
  { href: "/karaoke", label: "Karaoke" },
  {
    href: "/ziyaret",
    label: "Ziyaret & keşfet",
    route: "visit",
    dropdown: "visit",
  },
];

const VISIT_LINKS: Array<{ href: string; label: string; sub: string }> = [
  { href: "/ziyaret", label: "Tuzla köşkü", sub: "Adres ve saatler" },
  ...OTHER_BRANCHES.map((b) => ({
    href: `/ziyaret#${b.id}`,
    label: b.name,
    sub: b.hoursLabel || "Yeni şube",
  })),
  { href: "/hikayemiz", label: "Hikayemiz", sub: "Bologna 1897'den" },
  { href: "/kampanyalar", label: "Kampanyalar", sub: "Köşkte bu ay" },
  { href: "/rehber", label: "Rehber", sub: "Barın arkasında öğrendiklerimiz" },
];

/** The picture and the door on the right of each panel. */
const PANEL_FEATURE: Record<
  DropdownKey,
  { src: string; title: string; href: string; cta: string }
> = {
  menu: {
    src: "/menu/strawberry-matcha.webp",
    title: "Matcha barı",
    href: "/menu/matcha",
    cta: "Matcha menüsü",
  },
  shop: {
    src: "/menu/espresso.webp",
    title: "Evde L'Affogato",
    href: "/magaza/cekirdek",
    cta: "Çekirdek kahveler",
  },
  visit: {
    src: "/photos/facade-day.webp",
    title: "Tuzla köşkü",
    href: "/ziyaret",
    cta: "Ziyaret bilgileri",
  },
};

const ALL_LABEL: Record<DropdownKey, { href: string; label: string }> = {
  menu: { href: "/menu", label: "Tüm menü" },
  shop: { href: "/magaza", label: "Tüm mağaza" },
  visit: { href: "/ziyaret", label: "Ziyaret" },
};

/** The quick links under the bar on a phone (the reference's chips). */
const QUICK_LINKS = [
  { href: "/menu", label: "Menü" },
  { href: "/karaoke", label: "Karaoke" },
  { href: "/magaza", label: "Mağaza" },
  { href: "/kampanyalar", label: "Kampanyalar" },
];

function isActivePath(pathname: string | null, href: string): boolean {
  if (!pathname) return false;
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

interface NavProps {
  /** Current SPA route. Kept for the SPA's callers; the active link is
      worked out from the URL, so pages outside the SPA light up too. */
  route?: Route;
  /** SPA-internal navigate. When undefined, links are plain anchors. */
  navigate?: (r: Route) => void;
  cart?: number;
  onCart?: () => void;
  onSearch?: () => void;
}

export function Nav({ navigate, cart, onCart, onSearch }: NavProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [openDropdown, setOpenDropdown] = useState<DropdownKey | null>(null);
  const caretRefs = useRef<Partial<Record<DropdownKey, HTMLButtonElement>>>({});
  const [mobileSection, setMobileSection] = useState<DropdownKey | null>(null);
  const closeTimerRef = useRef<number | null>(null);
  const headerRef = useRef<HTMLElement | null>(null);
  const sheetRef = useRef<HTMLDivElement | null>(null);

  // A new page closes whatever the last one left open (adjusted during
  // render when the URL changes, not in an effect).
  const [shownPath, setShownPath] = useState(pathname);
  if (pathname !== shownPath) {
    setShownPath(pathname);
    setOpen(false);
    setOpenDropdown(null);
  }

  const burgerRef = useRef<HTMLButtonElement | null>(null);
  useEffect(() => {
    document.body.classList.toggle("is-no-scroll", open);
    if (!open) return;
    // The sheet opens right under the bar, wherever the bar is: under the
    // announcement line at the top of the page, at the top once scrolled.
    const bottom = headerRef.current?.getBoundingClientRect().bottom ?? 0;
    sheetRef.current?.style.setProperty(
      "--sheet-top",
      `${Math.max(0, bottom)}px`,
    );
    // The page behind the sheet is out of reach while it is open: Tab goes
    // from the last link back to the bar, not into the hidden page.
    const behind = [
      document.getElementById("main"),
      document.querySelector<HTMLElement>(".site-footer"),
    ].filter((el): el is HTMLElement => el !== null);
    behind.forEach((el) => el.setAttribute("inert", ""));
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setOpen(false);
      burgerRef.current?.focus();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      behind.forEach((el) => el.removeAttribute("inert"));
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  useEffect(() => {
    if (!openDropdown) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      // Back to the control that opened it, so the keyboard is not lost.
      caretRefs.current[openDropdown]?.focus();
      setOpenDropdown(null);
    };
    const onClick = (e: MouseEvent) => {
      if (!headerRef.current) return;
      if (!headerRef.current.contains(e.target as Node)) setOpenDropdown(null);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onClick);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onClick);
    };
  }, [openDropdown]);

  useEffect(
    () => () => {
      if (closeTimerRef.current) window.clearTimeout(closeTimerRef.current);
    },
    [],
  );

  const go =
    (link: { href: string; route?: Route }) => (e: React.MouseEvent) => {
      setOpen(false);
      setOpenDropdown(null);
      if (navigate && link.route) {
        e.preventDefault();
        navigate(link.route);
      }
    };

  const onHoverOpen = (key: DropdownKey) => {
    if (closeTimerRef.current) window.clearTimeout(closeTimerRef.current);
    setOpenDropdown(key);
  };
  const onHoverClose = () => {
    if (closeTimerRef.current) window.clearTimeout(closeTimerRef.current);
    closeTimerRef.current = window.setTimeout(() => setOpenDropdown(null), 180);
  };

  const cartCount = cart ?? 0;
  const openCart = () => {
    setOpen(false);
    if (onCart) onCart();
    // A full page load, never a client-side one: the checkout must open in
    // a document of its own, under its own policy and without the tags this
    // page has already run (src/lib/security/checkout-document.ts).
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- the full load is the point
    else window.location.assign("/odeme");
  };
  const openSearch = () => {
    setOpen(false);
    if (onSearch) onSearch();
    else router.push("/magaza?ara=1");
  };

  // ⌘K / Ctrl+K anywhere, and "/" when the visitor is not typing.
  const openSearchRef = useRef(openSearch);
  useEffect(() => {
    openSearchRef.current = openSearch;
  });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      const typing =
        !!t &&
        (t.isContentEditable ||
          ["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName));
      const combo = (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k";
      const slash = e.key === "/" && !typing && !e.metaKey && !e.ctrlKey;
      if (!combo && !slash) return;
      if (document.querySelector(".search-overlay")) return;
      e.preventDefault();
      openSearchRef.current();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const home = { href: "/", route: "home" as Route };
  const panelKey = openDropdown;

  return (
    <>
      <div className="announce">
        <p className="t-micro">
          Uygulamadan siparişte damga topla <span aria-hidden="true">|</span>{" "}
          <Link href="/kampanyalar" className="announce-link">
            Kampanyalar
          </Link>
        </p>
      </div>
      <header
        className={cx("site-header", open && "is-sheet-open")}
        ref={headerRef}
        onMouseLeave={onHoverClose}
        onBlur={(e) => {
          // Tabbing out of the header folds the panel away.
          const next = e.relatedTarget as Node | null;
          if (openDropdown && next && !e.currentTarget.contains(next))
            setOpenDropdown(null);
        }}
      >
        <div className="nav">
          <button
            type="button"
            ref={burgerRef}
            className="icon-btn nav-burger"
            aria-expanded={open}
            aria-controls="mobile-sheet"
            aria-label={open ? "Menüyü kapat" : "Menüyü aç"}
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <CloseGlyph /> : <BurgerGlyph />}
          </button>

          <nav className="nav-links" aria-label="Ana menü">
            <ul role="list">
              {LINKS.map((l) => {
                const active = isActivePath(pathname, l.href);
                const isOpen = l.dropdown && openDropdown === l.dropdown;
                return (
                  <li
                    key={l.href}
                    className="nav-link-wrap"
                    onMouseEnter={
                      l.dropdown
                        ? () => onHoverOpen(l.dropdown!)
                        : () => setOpenDropdown(null)
                    }
                  >
                    <a
                      href={l.href}
                      onClick={go(l)}
                      className={cx("t-nav nav-link", isOpen && "is-open")}
                      aria-current={active ? "page" : undefined}
                    >
                      {l.label}
                    </a>
                    {l.dropdown ? (
                      <button
                        type="button"
                        ref={(el) => {
                          if (el) caretRefs.current[l.dropdown!] = el;
                        }}
                        className="nav-caret"
                        aria-expanded={!!isOpen}
                        aria-controls="nav-panel"
                        aria-label={`${l.label} alt menüsü`}
                        onClick={() => {
                          if (isOpen) {
                            setOpenDropdown(null);
                            return;
                          }
                          setOpenDropdown(l.dropdown!);
                          // Into the panel it opened, not on to the next
                          // link: the panel sits later in the bar's order.
                          requestAnimationFrame(() =>
                            document
                              .querySelector<HTMLElement>("#nav-panel a")
                              ?.focus(),
                          );
                        }}
                      >
                        <ChevronGlyph />
                      </button>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </nav>

          <a
            href={home.href}
            onClick={go(home)}
            onMouseEnter={() => setOpenDropdown(null)}
            className="nav-brand"
            aria-label="L'Affogato ana sayfa"
          >
            <LafMark tone="duo" />
          </a>

          <div className="nav-tools" onMouseEnter={() => setOpenDropdown(null)}>
            <button
              type="button"
              className="icon-btn"
              onClick={openSearch}
              aria-label="Ara"
            >
              <SearchGlyph />
            </button>
            <AccountMenu />
            <button
              type="button"
              className="icon-btn nav-cart"
              onClick={openCart}
              aria-label={
                cartCount > 0 ? `Sepet, ${cartCount} ürün` : "Sepet, boş"
              }
            >
              <BagGlyph />
              {cartCount > 0 ? (
                <span className="nav-cart-count tabular" aria-hidden="true">
                  {cartCount > 99 ? "99+" : cartCount}
                </span>
              ) : null}
            </button>
          </div>
        </div>

        {/* The quick links: a phone's row under the bar. */}
        <nav className="nav-quick" aria-label="Hızlı bağlantılar">
          <ul role="list">
            {QUICK_LINKS.map((q) => (
              <li key={q.href}>
                <Link
                  href={q.href}
                  className="chip"
                  aria-current={
                    isActivePath(pathname, q.href) ? "page" : undefined
                  }
                >
                  {q.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        {/* The panel under the bar. It stays mounted so the hover can move
            from the link into it; inert while closed. */}
        <div
          id="nav-panel"
          className={cx("nav-panel", panelKey && "open")}
          inert={!panelKey}
          onMouseEnter={() => {
            if (closeTimerRef.current)
              window.clearTimeout(closeTimerRef.current);
          }}
        >
          {panelKey ? (
            <NavPanel panel={panelKey} onPick={() => setOpenDropdown(null)} />
          ) : null}
        </div>
      </header>

      {/* The phone's menu: a full-height sheet under the bar. */}
      <div
        id="mobile-sheet"
        ref={sheetRef}
        className={cx("mobile-sheet", open && "open")}
        inert={!open}
        aria-hidden={open ? undefined : true}
      >
        <nav aria-label="Mobil menü">
          <ul className="sheet-list" role="list">
            {LINKS.map((l) => {
              const expanded = l.dropdown && mobileSection === l.dropdown;
              return (
                <li key={l.href}>
                  {l.dropdown ? (
                    <>
                      <button
                        type="button"
                        className="sheet-row t-nav"
                        aria-expanded={!!expanded}
                        onClick={() =>
                          setMobileSection(expanded ? null : l.dropdown!)
                        }
                      >
                        {l.label}
                        <ChevronGlyph
                          className={cx("sheet-chev", expanded && "open")}
                        />
                      </button>
                      <ul
                        className={cx("sheet-sub", expanded && "open")}
                        role="list"
                        hidden={!expanded}
                      >
                        <li>
                          <a
                            href={ALL_LABEL[l.dropdown].href}
                            onClick={go({
                              href: ALL_LABEL[l.dropdown].href,
                              route: l.route,
                            })}
                          >
                            {ALL_LABEL[l.dropdown].label}
                          </a>
                        </li>
                        {panelLinks(l.dropdown).map((e) => (
                          <li key={e.href}>
                            <a href={e.href} onClick={() => setOpen(false)}>
                              {e.label}
                            </a>
                          </li>
                        ))}
                      </ul>
                    </>
                  ) : (
                    <a
                      href={l.href}
                      onClick={go(l)}
                      className="sheet-row t-nav"
                      aria-current={
                        isActivePath(pathname, l.href) ? "page" : undefined
                      }
                    >
                      {l.label}
                    </a>
                  )}
                </li>
              );
            })}
          </ul>
          <ul className="sheet-account" role="list">
            <li>
              <a href="/uye/hesap" onClick={() => setOpen(false)}>
                Hesabım
              </a>
            </li>
            <li>
              <Link
                href="/uye/hesap/siparislerim"
                onClick={() => setOpen(false)}
              >
                Siparişlerim
              </Link>
            </li>
            {APP_STORE_URL ? (
              <li>
                <a
                  href={APP_STORE_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Uygulamayı indir
                </a>
              </li>
            ) : null}
          </ul>
        </nav>
      </div>
    </>
  );
}

/** A panel's links: the category pages, or the places and pages to visit. */
function panelLinks(
  key: DropdownKey,
): Array<{ href: string; label: string; sub?: string }> {
  if (key === "menu")
    return [...MENU_LINKS, ...MENU_MORE].map((m) => ({
      href: `/menu/${m.slug}`,
      label: m.label,
      sub: m.sub,
    }));
  if (key === "shop")
    return SHOP_LINKS.map((s) => ({
      href: `/magaza/${s.slug}`,
      label: s.label,
      sub: s.sub,
    }));
  return VISIT_LINKS;
}

function NavPanel({
  panel,
  onPick,
}: {
  panel: DropdownKey;
  onPick: () => void;
}) {
  const feature = PANEL_FEATURE[panel];
  const all = panelLinks(panel);
  // Entries with a sub-line keep the two-line grid; the rest (the menu's
  // smaller families) follow as one compact row, so the grid's rhythm does
  // not change halfway down.
  const links = all.filter((e) => e.sub);
  const more = all.filter((e) => !e.sub);
  return (
    <div className="wrap nav-panel-inner">
      <div className="nav-panel-cols">
        <a
          href={ALL_LABEL[panel].href}
          className="t-nav nav-panel-all"
          onClick={onPick}
        >
          {ALL_LABEL[panel].label}
        </a>
        <ul className="nav-panel-list" role="list">
          {links.map((e) => (
            <li key={e.href}>
              <a href={e.href} onClick={onPick}>
                <span className="nav-panel-label">{e.label}</span>
                {e.sub ? (
                  <span className="t-small t-muted">{e.sub}</span>
                ) : null}
              </a>
            </li>
          ))}
        </ul>
        {more.length > 0 ? (
          <ul className="nav-panel-more" role="list" aria-label="Diğer">
            {more.map((e) => (
              <li key={e.href}>
                <a href={e.href} onClick={onPick}>
                  {e.label}
                </a>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
      <a href={feature.href} className="nav-panel-feature" onClick={onPick}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={feature.src} alt="" loading="lazy" decoding="async" />
        <span className="t-title">{feature.title}</span>
        <span className="link-u">{feature.cta}</span>
      </a>
    </div>
  );
}

function AccountMenu() {
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<{
    signedIn: boolean;
    firstName: string;
  } | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const toggle = () => {
    const next = !open;
    setOpen(next);
    if (next && state === null) {
      accountMenuStateAction()
        .then(setState)
        .catch(() => setState({ signedIn: false, firstName: "" }));
    }
  };

  return (
    <div className="nav-account" ref={wrapRef}>
      <button
        type="button"
        className="icon-btn"
        aria-label="Hesap menüsü"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={toggle}
      >
        <PersonGlyph />
      </button>
      {open && (
        <div className="nav-account-menu" role="menu">
          {state === null ? (
            <span className="t-small" aria-live="polite">
              …
            </span>
          ) : state.signedIn ? (
            <>
              <span className="t-label">
                {state.firstName ? `Merhaba ${state.firstName}` : "Hesabın"}
              </span>
              <Link
                href="/uye/hesap"
                role="menuitem"
                className="nav-account-item"
              >
                Hesabım
              </Link>
              <Link
                href="/uye/hesap/siparislerim"
                role="menuitem"
                className="nav-account-item"
              >
                Siparişlerim
              </Link>
              <form action={logoutAction}>
                <button
                  type="submit"
                  role="menuitem"
                  className="nav-account-item"
                >
                  Çıkış yap
                </button>
              </form>
            </>
          ) : (
            <>
              <Link
                href="/uye/giris"
                role="menuitem"
                className="btn btn-dark btn-block"
              >
                Giriş yap
              </Link>
              <Link href="/uye/kayit" role="menuitem" className="btn btn-block">
                Üye ol
              </Link>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function BurgerGlyph() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M3 7h18M3 12h18M3 17h18"
        stroke="currentColor"
        strokeWidth="1.4"
      />
    </svg>
  );
}
function CloseGlyph() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M5 5l14 14M19 5 5 19" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  );
}
function ChevronGlyph({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 12 8"
      fill="none"
      aria-hidden="true"
    >
      <path d="M1 1.5 6 6.5l5-5" stroke="currentColor" strokeWidth="1.2" />
    </svg>
  );
}
function SearchGlyph() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle
        cx="10.5"
        cy="10.5"
        r="6.5"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path d="m15.5 15.5 5 5" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}
function PersonGlyph() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="8" r="4" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M4.5 20.5c.6-4 3.6-6.5 7.5-6.5s6.9 2.5 7.5 6.5"
        stroke="currentColor"
        strokeWidth="1.5"
      />
    </svg>
  );
}
function BagGlyph() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M5 8.5h14l-1.2 12H6.2L5 8.5Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path
        d="M9 10.5V7a3 3 0 0 1 6 0v3.5"
        stroke="currentColor"
        strokeWidth="1.5"
      />
    </svg>
  );
}

/* ─────────────────────────────────────────────────────────────
   Footer - the charcoal block: the mark, four link columns and the
   letter, then who runs the site.
   ───────────────────────────────────────────────────────────── */

export interface FooterSettings {
  phone?: string;
  email?: string;
  address?: string;
  /** Ayarlar → Saatler as label/value rows (`footerSettings`, seo/contact.ts). */
  hours?: [string, string][];
  /** Courier fee in kuruş, from /admin/ayarlar. */
  courierFeeMinor?: number;
  /** Mobil → Ayarlar → Kurye (`mobileApp.ordering.deliveryEnabled`). */
  courierEnabled?: boolean;
  /** Ayarlar → "Gel-al hazırlık süresi", for the home page's order card. */
  pickupReadyMinutes?: number;
  /** Stamps per free drink (`mobileApp.loyalty.stampTarget`). */
  stampTarget?: number;
  /** Ayarlar → Vergi, the day the menu prices started ("YYYY-MM-DD" or ""). */
  menuPricesEffectiveDate?: string;
}

interface FooterProps {
  /** Optional SPA navigate - when provided, links call it (no full nav).
      When absent (non-SPA pages), links are plain anchors to real routes. */
  navigate?: (r: Route) => void;
  settings?: FooterSettings;
}

const DEFAULT_ADDRESS_LINES = [
  "Postane Mah. Atatürk Cad. No: 28 İç Kapı No: 1",
  "34940 Tuzla / İstanbul",
];

/** The bundled week, for a page that passes no settings (error pages). */
const DEFAULT_HOURS: [string, string][] = [
  [
    "Her gün",
    `${LEGAL_ENTITY.cafeHours.opens} - ${LEGAL_ENTITY.cafeHours.closes}`,
  ],
];

/** The registered seat: the tax certificate's address, one line. */
const COMPANY_ADDRESS = `${LEGAL_ENTITY.address.line1}, ${LEGAL_ENTITY.address.postalCode} ${LEGAL_ENTITY.address.district} / ${LEGAL_ENTITY.address.city}`;

/** The legal person on the tax certificate. */
const SITE_LEGAL_NAME = `${SITE.name} - ${LEGAL_ENTITY.shortName}`;

export function Footer({ navigate, settings }: FooterProps) {
  const hrefFor = (r: Route) => ROUTE_PATHS[r];
  const go = (r: Route) => (e: React.MouseEvent) => {
    if (!navigate) return; // allow default anchor navigation
    e.preventDefault();
    navigate(r);
    window.scrollTo({ top: 0 });
  };
  // `||`, not `??`: a field cleared in the panel arrives as "".
  const phone = settings?.phone?.trim() || SITE.phone;
  const tel = phone.replace(/[^\d+]/g, "") || SITE.phoneE164;
  const email = settings?.email?.trim() || SITE.email;
  const lines = addressLines(settings?.address ?? "", DEFAULT_ADDRESS_LINES);
  const hours = settings?.hours?.length ? settings.hours : DEFAULT_HOURS;
  const year = new Date().getFullYear();

  return (
    <footer className="site-footer" data-ground="dark">
      <div className="wrap">
        <Link
          href="/"
          className="footer-brand"
          aria-label="L'Affogato ana sayfa"
        >
          <LafMark tone="cream" />
          <span className="footer-wordmark">L&apos;Affogato</span>
        </Link>

        <div className="footer-main">
          <nav className="footer-cols" aria-label="Site haritası">
            <FooterColumn title="Keşfet">
              <li>
                <a href={hrefFor("menu")} onClick={go("menu")}>
                  Menü
                </a>
              </li>
              <li>
                <a href={hrefFor("shop")} onClick={go("shop")}>
                  Mağaza
                </a>
              </li>
              <li>
                <a href="/kampanyalar">Kampanyalar</a>
              </li>
              <li>
                <a href="/karaoke">Karaoke odası</a>
              </li>
              <li>
                <a href={hrefFor("story")} onClick={go("story")}>
                  Hikayemiz
                </a>
              </li>
              <li>
                <Link href="/rehber">Rehber</Link>
              </li>
            </FooterColumn>
            <FooterColumn title="Ziyaret">
              <li>
                <a href={hrefFor("visit")} onClick={go("visit")}>
                  Tuzla köşkü
                </a>
              </li>
              <li className="footer-note">{lines.join(", ")}</li>
              {/* Ayarlar → Saatler: one row for a uniform week. */}
              {hours.map(([label, value], i) => (
                <li key={i} className="footer-note tabular">
                  {label} {value}
                </li>
              ))}
              <li>
                <KoskStatus hours={hours} />
              </li>
              <li>
                <a href={`tel:${tel}`} className="tabular">
                  {phone}
                </a>
              </li>
              <li>
                <a href={`mailto:${email}`}>{email}</a>
              </li>
              {OTHER_BRANCHES.map((b) => (
                <li key={b.id}>
                  <a href={`/ziyaret#${b.id}`}>{b.name}</a>
                </li>
              ))}
            </FooterColumn>
            <FooterColumn title="Üyelik">
              {APP_STORE_URL ? (
                <li>
                  <a
                    href={APP_STORE_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    iPhone için App Store
                  </a>
                </li>
              ) : null}
              {PLAY_STORE_URL ? (
                <li>
                  <a
                    href={PLAY_STORE_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Android için Google Play
                  </a>
                </li>
              ) : null}
              <li>
                <a href="/uye/hesap">Üyelik ve ödüller</a>
              </li>
              <li>
                <a href="/uye/kayit">Üye ol</a>
              </li>
              <li>
                <a href="/uye/giris">Giriş yap</a>
              </li>
            </FooterColumn>
            {/* Seven documents; the criterion for each is in
                src/lib/legal/nav.ts. The rest are one click away. */}
            <FooterColumn title="Kurumsal">
              {FOOTER_LEGAL_DOCS.map((d) => (
                <li key={d.slug}>
                  <Link href={`/hukuk/${d.slug}`}>{d.label}</Link>
                </li>
              ))}
              <li>
                <button
                  type="button"
                  className="footer-linkish"
                  onClick={() =>
                    window.dispatchEvent(new Event(CONSENT_OPEN_EVENT))
                  }
                >
                  Çerez tercihleri
                </button>
              </li>
              <li>
                <Link href="/hukuk">Tüm belgeler</Link>
              </li>
              <li>
                <Link href="/hukuk/sirket-bilgileri">Şirket bilgileri</Link>
              </li>
            </FooterColumn>
          </nav>

          {/* The monthly letter: 6563 consent records behind it. */}
          <div className="footer-letter">
            <h2 className="t-nav">Bültene abone ol</h2>
            <p className="footer-letter-text">
              Yeni sezon affogatoları, kavurma notları, küçük gelato denemeleri.
              Hiçbir zaman ayda birden fazla.
            </p>
            <NewsletterForm />
            <div className="footer-social">
              <a
                href={SITE.social.instagram}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Instagram"
              >
                <SocialGlyph network="instagram" />
              </a>
              <a
                href={SITE.social.tiktok}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="TikTok"
              >
                <SocialGlyph network="tiktok" />
              </a>
              <a
                href={SITE.social.youtube}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="YouTube"
              >
                <SocialGlyph network="youtube" />
              </a>
              <span className="t-small footer-handle">
                {SITE.social.handle}
              </span>
            </div>
          </div>
        </div>

        {/* Every category page keeps a door in the footer. */}
        <div className="footer-cats">
          <p className="t-small">
            <span className="t-label">Menüde</span>{" "}
            {[...MENU_LINKS, ...MENU_MORE].map((m, i) => (
              <span key={m.slug}>
                {i > 0 ? " · " : ""}
                <a href={`/menu/${m.slug}`}>{m.label}</a>
              </span>
            ))}
          </p>
          <p className="t-small">
            <span className="t-label">Mağazada</span>{" "}
            {SHOP_LINKS.map((s, i) => (
              <span key={s.slug}>
                {i > 0 ? " · " : ""}
                <a href={`/magaza/${s.slug}`}>{s.label}</a>
              </span>
            ))}
          </p>
        </div>

        {/* Who runs the site and where it can be reached directly (ETHS
            Yön. m.5/1, 6563 m.3/1), straight from LEGAL_ENTITY. */}
        <dl className="footer-company">
          <div>
            <dt className="t-label">Ticaret unvanı</dt>
            <dd>{LEGAL_ENTITY.legalName}</dd>
          </div>
          <div>
            <dt className="t-label">MERSİS</dt>
            <dd className="tabular">{LEGAL_ENTITY.mersisNo}</dd>
          </div>
          <div>
            <dt className="t-label">Merkez</dt>
            <dd>{COMPANY_ADDRESS}</dd>
          </div>
          {LEGAL_ENTITY.kep ? (
            <div>
              <dt className="t-label">KEP</dt>
              <dd>{LEGAL_ENTITY.kep}</dd>
            </div>
          ) : null}
        </dl>

        <div className="footer-bottom">
          <ul className="footer-legal" role="list">
            <li className="t-label">Visa · Mastercard · Troy · Apple Pay</li>
            <li>
              {/* Every shell names its <main> "main". */}
              <a className="t-label" href="#main">
                Başa dön
              </a>
            </li>
          </ul>
          {/* The year is read on the server and in the browser; on the night
              of 31 December the two differ, which must not fail hydration. */}
          <span className="t-label" suppressHydrationWarning>
            © {year} {SITE_LEGAL_NAME}
          </span>
        </div>
      </div>
    </footer>
  );
}

function FooterColumn({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="footer-col">
      <h2 className="t-nav footer-col-title">{title}</h2>
      <ul className="footer-col-list" role="list">
        {children}
      </ul>
    </div>
  );
}

/**
 * Whether the köşk is open now, once the browser has answered: the same
 * `useOpenStatus` the home page and /ziyaret read, so the three never
 * disagree. Nothing live is printed on the server.
 */
function KoskStatus({
  hours,
}: {
  hours: ReadonlyArray<readonly [string, string]>;
}) {
  const st = useOpenStatus(hours);
  if (!st) return null;
  return (
    <span className={cx("open-line", st.open ? "is-open" : "is-closed")}>
      {st.open ? "Şu an açık" : "Şu an kapalı"}
    </span>
  );
}

/** Plain line glyphs, not the networks' artwork. */
function SocialGlyph({
  network,
}: {
  network: "instagram" | "tiktok" | "youtube";
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      aria-hidden="true"
    >
      {network === "instagram" ? (
        <>
          <rect x="3.5" y="3.5" width="17" height="17" rx="5" />
          <circle cx="12" cy="12" r="4" />
          <circle cx="17.2" cy="6.8" r="0.6" fill="currentColor" />
        </>
      ) : network === "tiktok" ? (
        <path d="M14 3.5v11.25a3.75 3.75 0 1 1-3.75-3.75M14 3.5c.4 2.6 2.2 4.3 5 4.6" />
      ) : (
        <>
          <rect x="2.75" y="5.5" width="18.5" height="13" rx="4" />
          <path d="m10.25 9.25 4.5 2.75-4.5 2.75Z" fill="currentColor" />
        </>
      )}
    </svg>
  );
}
