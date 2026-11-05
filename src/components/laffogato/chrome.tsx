"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { accountMenuStateAction, logoutAction } from "@/app/uye/actions";
import { CONSENT_OPEN_EVENT } from "@/lib/consent/script";
import { LEGAL_ENTITY } from "@/lib/legal/entity";
import { FOOTER_LEGAL_DOCS } from "@/lib/legal/nav";
import { OTHER_BRANCHES } from "@/lib/seo/branches";
import { MENU_CATEGORY_ROUTES } from "@/lib/seo/pages";
import { SITE } from "@/lib/seo/site";
import { addressLines } from "@/lib/utils/format";

import { AppStoreLinks } from "./app-links";
import { LafMark } from "./brand-mark";
import { NewsletterForm } from "./newsletter-form";
import { ROUTE_PATHS, type Route } from "./route-paths";
import { SCENES, sceneForHue } from "./scenes";
import { cx } from "./cx";

export type { Route };
/** Re-export for legacy importers that still pull `ROUTE_PATHS` from here.
    New server-side code should import directly from `./route-paths`. */
export { ROUTE_PATHS };

export interface DropdownEntry {
  slug: string;
  label: string;
  italian: string;
  hue: "caramel" | "dark" | "cream" | "matcha" | "strawberry" | "pistachio";
}

/**
 * Built from the real category routes, so a nav entry cannot point at a page
 * that does not exist. `nav` marks the six categories that get a tile in the
 * header; the other six are listed under them, so every /menu/<slug> page has
 * a door in the chrome (six of the twelve used to be reachable only through
 * the sitemap).
 */
const MENU_DROPDOWN: DropdownEntry[] = MENU_CATEGORY_ROUTES.filter(
  (c) => c.nav,
).map((c) => ({
  slug: c.slug,
  label: c.nav!.label,
  italian: c.nav!.italian,
  hue: c.nav!.hue,
}));

const MENU_MORE = MENU_CATEGORY_ROUTES.filter((c) => !c.nav).map((c) => ({
  slug: c.slug,
  label: c.breadcrumbLabel,
}));

const SHOP_DROPDOWN: DropdownEntry[] = [
  {
    slug: "cekirdek",
    label: "Çekirdek Kahve",
    italian: "Caffè in grani",
    hue: "dark",
  },
  {
    slug: "hediye",
    label: "Hediye Seti",
    italian: "Confezioni regalo",
    hue: "cream",
  },
  { slug: "ekipman", label: "Ekipman", italian: "Strumenti", hue: "caramel" },
  { slug: "giyim", label: "Giyim", italian: "Capi d'autore", hue: "dark" },
  { slug: "kiler", label: "Kiler", italian: "Dispensa", hue: "matcha" },
];

type DropdownKey = "menu" | "shop";

interface LinkEntry {
  href: string;
  label: string;
  /** SPA section this link opens, when it is one (lets the SPA navigate
      without a full page load). */
  route?: Route;
  dropdown?: DropdownKey;
}

/**
 * The header's destinations. No "Anasayfa": the mark is the way home, as on
 * every Apple-style bar. Karaoke and Kampanyalar are real routes outside the
 * SPA; they now light up like the others when you are on them.
 */
const LINKS: LinkEntry[] = [
  { href: "/menu", label: "Menü", route: "menu", dropdown: "menu" },
  { href: "/magaza", label: "Mağaza", route: "shop", dropdown: "shop" },
  { href: "/kampanyalar", label: "Kampanyalar" },
  { href: "/karaoke", label: "Karaoke" },
  { href: "/hikayemiz", label: "Hikayemiz", route: "story" },
  { href: "/ziyaret", label: "Ziyaret", route: "visit" },
];

function isActivePath(pathname: string | null, href: string): boolean {
  if (!pathname) return false;
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** A category's swatch: the scene colour for that family, a flat disc. */
function swatchStyle(hue: DropdownEntry["hue"]): React.CSSProperties {
  const s = SCENES[sceneForHue(hue === "dark" ? "espresso" : hue)];
  return { background: s.mid };
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
  const [mobileSection, setMobileSection] = useState<DropdownKey | null>(null);
  const [scrolled, setScrolled] = useState(false);
  const closeTimerRef = useRef<number | null>(null);
  const headerRef = useRef<HTMLElement | null>(null);

  // A new page closes whatever the last one left open. Adjusted during
  // render when the URL changes (react.dev "adjusting state when a prop
  // changes") rather than in an effect.
  const [shownPath, setShownPath] = useState(pathname);
  if (pathname !== shownPath) {
    setShownPath(pathname);
    setOpen(false);
    setOpenDropdown(null);
  }

  useEffect(() => {
    document.body.classList.toggle("is-no-scroll", open);
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  // The bar is glass from the first pixel; the hairline under it only
  // appears once there is content scrolling beneath it, as on iOS.
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 4);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (!openDropdown) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpenDropdown(null);
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

  // ⌘K / Ctrl+K anywhere, and "/" when the visitor is not typing: the
  // keyboard way into search that the header's pill advertises.
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

  return (
    <>
      <header
        className={cx(
          "site-header",
          (scrolled || open) && "is-scrolled",
          open && "is-sheet-open",
        )}
        ref={headerRef}
      >
        <nav className="nav" aria-label="Ana gezinme">
          <Link
            href="/"
            onClick={go(home)}
            className="nav-brand"
            aria-label="L'Affogato anasayfası"
          >
            <LafMark tone="duo" />
          </Link>

          <div className="nav-center" onMouseLeave={onHoverClose}>
            {LINKS.map((link) => {
              const active = isActivePath(pathname, link.href);
              const key = link.dropdown;
              const isOpen = key !== undefined && openDropdown === key;
              return (
                <div
                  key={link.href}
                  className={cx("nav-link-wrap", key && "has-dropdown")}
                  onMouseEnter={key ? () => onHoverOpen(key) : undefined}
                >
                  <a
                    href={link.href}
                    onClick={go(link)}
                    className={cx(
                      "nav-link",
                      active && "active",
                      isOpen && "is-open",
                    )}
                    aria-current={active ? "page" : undefined}
                  >
                    {link.label}
                  </a>
                  {/* The caret is its own control: the link still navigates,
                      the button opens the panel - so a keyboard user can
                      reach it and `aria-expanded` tells the truth. */}
                  {key && (
                    <button
                      type="button"
                      className={cx("nav-link-caret-btn", isOpen && "is-open")}
                      aria-haspopup="true"
                      aria-expanded={isOpen}
                      aria-label={`${link.label} alt menüsünü ${isOpen ? "kapat" : "aç"}`}
                      onClick={() => setOpenDropdown(isOpen ? null : key)}
                    >
                      <Chevron className="nav-link-caret" />
                    </button>
                  )}
                  {key && isOpen && (
                    <DropdownPanel
                      kind={key}
                      title={link.label}
                      href={link.href}
                      onClose={() => setOpenDropdown(null)}
                    />
                  )}
                </div>
              );
            })}
          </div>

          <div className="nav-right">
            {/* Minimal: the glyph and one word. Narrow headers keep the
                glyph alone. ⌘K / Ctrl+K / "/" open it from anywhere. */}
            <button
              type="button"
              className="nav-search"
              aria-label="Menüde ve mağazada ara"
              aria-keyshortcuts="Control+K Meta+K /"
              onClick={openSearch}
            >
              <SearchGlyph />
              <span className="nav-search-text">Ara</span>
            </button>
            <AccountMenu />
            <button
              type="button"
              className="nav-cart"
              aria-label={`Sepetim - ${cartCount} ürün`}
              onClick={openCart}
            >
              <BagGlyph />
              <span className="nav-cart-label">Sepet</span>
              <span
                className={cx("nav-cart-count", cartCount > 0 && "has-items")}
                aria-hidden="true"
              >
                {cartCount}
              </span>
            </button>
            <button
              type="button"
              className={cx("nav-burger", open && "open")}
              onClick={() => setOpen((v) => !v)}
              aria-label={open ? "Menüyü kapat" : "Menüyü aç"}
              aria-expanded={open}
              aria-controls="mobile-sheet"
            >
              <span />
              <span />
            </button>
          </div>
        </nav>
      </header>

      {/* The small-screen sheet: an inset grouped list, iOS Settings style -
          big tappable rows, the two catalogues expandable in place. */}
      <div
        id="mobile-sheet"
        className={cx("mobile-sheet", open && "open")}
        aria-hidden={!open}
        inert={!open}
      >
        <div className="mobile-sheet-scroll">
          <ul className="sheet-group" aria-label="Keşfet">
            <li>
              <Link
                href="/"
                onClick={go(home)}
                className={cx("sheet-row", pathname === "/" && "active")}
              >
                <span>Anasayfa</span>
                <Chevron className="sheet-chev" dir="right" />
              </Link>
            </li>
            {(["menu", "shop"] as const).map((key) => {
              const link = LINKS.find((l) => l.dropdown === key)!;
              const expanded = mobileSection === key;
              const entries = key === "menu" ? MENU_DROPDOWN : SHOP_DROPDOWN;
              return (
                <li key={key}>
                  <button
                    type="button"
                    className={cx(
                      "sheet-row",
                      isActivePath(pathname, link.href) && "active",
                    )}
                    onClick={() => setMobileSection(expanded ? null : key)}
                    aria-expanded={expanded}
                  >
                    <span>{link.label}</span>
                    <Chevron className={cx("sheet-chev", expanded && "open")} />
                  </button>
                  <div className={cx("sheet-sub", expanded && "open")}>
                    <div className="sheet-sub-inner">
                      <a
                        href={link.href}
                        onClick={go(link)}
                        className="sheet-sub-all"
                      >
                        {key === "menu" ? "Tüm menü" : "Tüm mağaza"}
                      </a>
                      {entries.map((entry) => (
                        <a
                          key={entry.slug}
                          href={`${link.href}/${entry.slug}`}
                          onClick={() => setOpen(false)}
                          className="sheet-sub-link"
                        >
                          <span
                            className="sheet-swatch"
                            style={swatchStyle(entry.hue)}
                            aria-hidden="true"
                          />
                          <span className="sheet-sub-text">
                            <span className="sheet-sub-label">
                              {entry.label}
                            </span>
                            <span className="sheet-sub-it">
                              {entry.italian}
                            </span>
                          </span>
                        </a>
                      ))}
                      {key === "menu" && (
                        <div className="sheet-sub-more">
                          {MENU_MORE.map((m) => (
                            <a
                              key={m.slug}
                              href={`/menu/${m.slug}`}
                              onClick={() => setOpen(false)}
                              className="chip-link"
                            >
                              {m.label}
                            </a>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
            {LINKS.filter((l) => !l.dropdown).map((link) => (
              <li key={link.href}>
                <a
                  href={link.href}
                  onClick={go(link)}
                  className={cx(
                    "sheet-row",
                    isActivePath(pathname, link.href) && "active",
                  )}
                >
                  <span>{link.label}</span>
                  <Chevron className="sheet-chev" dir="right" />
                </a>
              </li>
            ))}
            <li>
              <Link
                href="/rehber"
                onClick={() => setOpen(false)}
                className={cx(
                  "sheet-row",
                  isActivePath(pathname, "/rehber") && "active",
                )}
              >
                <span>Rehber</span>
                <Chevron className="sheet-chev" dir="right" />
              </Link>
            </li>
          </ul>

          <div className="sheet-actions">
            <a
              href="/uye/hesap"
              onClick={() => setOpen(false)}
              className="btn btn-primary btn-lg"
            >
              Hesabım
            </a>
            <a
              href="/uye/kayit"
              onClick={() => setOpen(false)}
              className="btn btn-ghost btn-lg"
            >
              Üye ol
            </a>
          </div>

          <div className="sheet-app">
            <LafMark tone="green" height={30} />
            <div>
              <p className="sheet-app-title">L&apos;Affogato uygulaması</p>
              <AppStoreLinks />
            </div>
          </div>

          <p className="sheet-foot">
            Tuzla · İstanbul <span aria-hidden="true">·</span> Her gün 09:00 -
            02:00
          </p>
        </div>
      </div>

      {/* The small-screen tab bar: a floating glass capsule, the app's own
          bar (DESIGN-GLASS §4.5) - the selected tab sits in a white capsule
          that lifts off the glass. */}
      <nav className="tab-bar" aria-label="Mobil gezinme">
        <Link
          href="/"
          onClick={go(home)}
          className={cx("tab-item", pathname === "/" && "active")}
          aria-current={pathname === "/" ? "page" : undefined}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M3.75 10.4 12 3.75l8.25 6.65" />
            <path d="M5.75 9.1v9.9c0 .7.55 1.25 1.25 1.25h3.25v-5.5h3.5v5.5H17c.7 0 1.25-.55 1.25-1.25V9.1" />
          </svg>
          <span>Anasayfa</span>
        </Link>
        <Link
          href="/menu"
          onClick={go(LINKS[0])}
          className={cx(
            "tab-item",
            isActivePath(pathname, "/menu") && "active",
          )}
          aria-current={isActivePath(pathname, "/menu") ? "page" : undefined}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M5 8.25h11.5v4.25a5 5 0 0 1-5 5h-1.5a5 5 0 0 1-5-5V8.25Z" />
            <path d="M16.5 9.5h1.75a2.25 2.25 0 0 1 0 4.5H16.3" />
            <path d="M8.25 3.75v1.5M11.75 3.75v1.5M4.5 20.25h13" />
          </svg>
          <span>Menü</span>
        </Link>
        <Link
          href="/magaza"
          onClick={go(LINKS[1])}
          className={cx(
            "tab-item",
            isActivePath(pathname, "/magaza") && "active",
          )}
          aria-current={isActivePath(pathname, "/magaza") ? "page" : undefined}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M5.25 8.25h13.5l-.9 11.1a1 1 0 0 1-1 .9H7.15a1 1 0 0 1-1-.9l-.9-11.1Z" />
            <path d="M9 10.5V7.5a3 3 0 0 1 6 0v3" />
          </svg>
          <span>Mağaza</span>
        </Link>
        <button
          type="button"
          className="tab-item"
          aria-label={`Sepetim - ${cartCount} ürün`}
          onClick={openCart}
        >
          <span className="tab-cart">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M3.5 4.75h2.1l2.05 10.5h9.9l1.7-7.5H6.4" />
              <circle cx="9.25" cy="19.25" r="1.25" />
              <circle cx="16.25" cy="19.25" r="1.25" />
            </svg>
            {cartCount > 0 && (
              <span className="tab-badge" aria-hidden="true">
                {cartCount}
              </span>
            )}
          </span>
          <span>Sepet</span>
        </button>
        <a
          href="/uye/hesap"
          className={cx("tab-item", isActivePath(pathname, "/uye") && "active")}
          aria-current={isActivePath(pathname, "/uye") ? "page" : undefined}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="12" cy="8.25" r="3.5" />
            <path d="M5.25 20a6.75 6.75 0 0 1 13.5 0" />
          </svg>
          <span>Hesabım</span>
        </a>
      </nav>

      {/* The floating order button: a green circle bottom-right that rides
          over every scrolled surface and opens the cart. Phones already
          carry the cart in the tab bar, and the checkout is the cart, so it
          stays off both (globals.css .frap). */}
      {!pathname?.startsWith("/odeme") && (
        <button
          type="button"
          className="frap"
          aria-label={`Sepetim - ${cartCount} ürün`}
          onClick={openCart}
        >
          <BagGlyph />
          {cartCount > 0 && (
            <span className="frap-badge" aria-hidden="true">
              {cartCount}
            </span>
          )}
        </button>
      )}
    </>
  );
}

/* ─────────────────────────────────────────────────────────────
   Dropdown panel - the glass popover under Menü / Mağaza
   ───────────────────────────────────────────────────────────── */

function DropdownPanel({
  kind,
  title,
  href,
  onClose,
}: {
  kind: DropdownKey;
  title: string;
  href: string;
  onClose: () => void;
}) {
  const entries = kind === "menu" ? MENU_DROPDOWN : SHOP_DROPDOWN;
  const total = kind === "menu" ? MENU_CATEGORY_ROUTES.length : entries.length;
  return (
    <div
      className="nav-dropdown"
      role="menu"
      aria-label={`${title} alt menüsü`}
    >
      <div className="nav-dropdown-inner">
        <div className="nav-dropdown-head">
          <span className="nav-dropdown-kicker">
            {kind === "menu" ? "Il menù" : "La bottega"} · {total} kategori
          </span>
          <a href={href} className="link-more" onClick={onClose}>
            {kind === "menu" ? "Tüm menü" : "Tüm mağaza"}
          </a>
        </div>
        <div className="nav-dropdown-grid">
          {entries.map((entry) => (
            <a
              key={entry.slug}
              href={`${href}/${entry.slug}`}
              className="nav-dropdown-item"
              onClick={onClose}
              role="menuitem"
            >
              <span
                className="nav-dropdown-swatch"
                style={swatchStyle(entry.hue)}
                aria-hidden="true"
              />
              <span className="nav-dropdown-text">
                <span className="nav-dropdown-label">{entry.label}</span>
                <span className="nav-dropdown-italian">{entry.italian}</span>
              </span>
            </a>
          ))}
        </div>
        {kind === "menu" && (
          <div className="nav-dropdown-more">
            <span className="nav-dropdown-more-label">Ayrıca</span>
            {MENU_MORE.map((m) => (
              <a
                key={m.slug}
                href={`/menu/${m.slug}`}
                className="chip-link"
                onClick={onClose}
                role="menuitem"
              >
                {m.label}
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   Glyphs - the app's thin line (1.5), drawn on a 24 grid
   ───────────────────────────────────────────────────────────── */

function Chevron({
  className,
  dir = "down",
}: {
  className?: string;
  dir?: "down" | "right";
}) {
  return (
    <svg
      className={className}
      width="12"
      height="12"
      viewBox="0 0 12 12"
      aria-hidden="true"
    >
      <path
        d={dir === "down" ? "M2.5 4.5 6 8l3.5-3.5" : "M4.5 2.5 8 6l-3.5 3.5"}
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
}

/**
 * The header's person button: a small menu rather than a straight link, so
 * signing out is one tap from any page. Whether anyone is signed in is asked
 * the first time it opens (the session cookie is httpOnly), then kept.
 */
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
    <div className="nav-account-wrap nav-account" ref={wrapRef}>
      <button
        type="button"
        className="nav-icon-btn"
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
            <span className="nav-account-loading" aria-live="polite">
              …
            </span>
          ) : state.signedIn ? (
            <>
              <span className="nav-account-hello">
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
                  className="nav-account-item nav-account-logout"
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
                className="nav-account-item"
              >
                Giriş yap
              </Link>
              <Link
                href="/uye/kayit"
                role="menuitem"
                className="nav-account-item"
              >
                Üye ol
              </Link>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function SearchGlyph() {
  return (
    <svg
      width="19"
      height="19"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <circle
        cx="10.75"
        cy="10.75"
        r="6.5"
        stroke="currentColor"
        strokeWidth="1.75"
      />
      <path
        d="m15.6 15.6 4.9 4.9"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
    </svg>
  );
}

function PersonGlyph() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <circle
        cx="12"
        cy="8.25"
        r="3.75"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <path
        d="M4.75 20.25a7.25 7.25 0 0 1 14.5 0"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

function BagGlyph() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M5.25 8.25h13.5l-.9 11.1a1 1 0 0 1-1 .9H7.15a1 1 0 0 1-1-.9l-.9-11.1Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path
        d="M9 10.5V7.5a3 3 0 0 1 6 0v3"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

/* ─────────────────────────────────────────────────────────────
   Footer - the app icon's green, the mark in cream and brass
   ───────────────────────────────────────────────────────────── */

export interface FooterSettings {
  phone?: string;
  email?: string;
  address?: string;
  /** Ayarlar → Saatler as label/value rows (`footerSettings`, seo/contact.ts). */
  hours?: [string, string][];
  /** Courier fee in kuruş, from /admin/ayarlar. */
  courierFeeMinor?: number;
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

export function Footer({ navigate, settings }: FooterProps) {
  const hrefFor = (r: Route) => ROUTE_PATHS[r];
  const go = (r: Route) => (e: React.MouseEvent) => {
    if (!navigate) return; // allow default anchor navigation
    e.preventDefault();
    navigate(r);
    window.scrollTo({ top: 0 });
  };
  // `||`, not `??`: a field cleared in the panel arrives as "", and "" made
  // an empty `tel:` / `mailto:` link.
  const phone = settings?.phone?.trim() || SITE.phone;
  // A phone typed without digits ("Yakında") still dials the bundled number,
  // as the visit page and the facts block do.
  const tel = phone.replace(/[^\d+]/g, "") || SITE.phoneE164;
  const email = settings?.email?.trim() || SITE.email;
  const lines = addressLines(settings?.address ?? "", DEFAULT_ADDRESS_LINES);
  const hours = settings?.hours?.length ? settings.hours : DEFAULT_HOURS;
  const year = new Date().getFullYear();
  return (
    <footer className="footer" data-ground="dark">
      <div className="footer-inner">
        {/* The signature: the mark exactly as the app icon draws it, then
            the two ways to keep in touch - the app and the letter. */}
        <div className="footer-top">
          <div className="footer-brand">
            <LafMark tone="cream" label="L'Affogato" className="footer-mark" />
            <p className="footer-motto">İçilir, sonra kupası yenir</p>
            <p className="footer-brand-line">
              Bologna 1897&apos;den İstanbul Tuzla&apos;ya - 200 yıllık, restore
              bir köşkte.
            </p>
          </div>

          <div className="footer-card footer-app">
            <div className="footer-card-head">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/brand/app-icon-192.png"
                alt=""
                width={48}
                height={48}
                loading="lazy"
                decoding="async"
                className="footer-app-icon"
              />
              <div>
                <h2 className="footer-card-title">L&apos;Affogato cebinde</h2>
                <p className="footer-card-text">
                  Damga kartın, kasa kodun ve siparişin tek uygulamada.
                </p>
              </div>
            </div>
            <AppStoreLinks tone="dark" />
          </div>

          <div className="footer-card footer-newsletter">
            <h2 className="footer-card-title">
              Bir mektup, <span className="script">ayda bir</span>
            </h2>
            <p className="footer-card-text">
              Yeni sezon affogati, Bologna kavurma notları, küçük gelato
              denemeleri. Hiçbir zaman ayda birden fazla.
            </p>
            <NewsletterForm />
          </div>
        </div>

        <div className="footer-grid">
          <div>
            <h3 className="footer-col-title">Menü</h3>
            <ul>
              {MENU_DROPDOWN.map((m) => (
                <li key={m.slug}>
                  <a href={`/menu/${m.slug}`}>{m.label}</a>
                </li>
              ))}
              <li>
                <a href={hrefFor("menu")} onClick={go("menu")}>
                  Tüm menü
                </a>
              </li>
            </ul>
          </div>
          <div>
            <h3 className="footer-col-title">Mağaza</h3>
            <ul>
              {SHOP_DROPDOWN.map((s) => (
                <li key={s.slug}>
                  <a href={`/magaza/${s.slug}`}>{s.label}</a>
                </li>
              ))}
              <li>
                <a href={hrefFor("shop")} onClick={go("shop")}>
                  Tüm mağaza
                </a>
              </li>
            </ul>
          </div>
          <div>
            <h3 className="footer-col-title">Köşk</h3>
            <ul>
              <li>
                <a href="/uye/hesap">Üyelik ve ödüller</a>
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
                <a href={hrefFor("visit")} onClick={go("visit")}>
                  Ziyaret
                </a>
              </li>
              <li>
                <Link href="/rehber">Rehber</Link>
              </li>
            </ul>
          </div>
          {/* Seven documents, not twenty-six; the criterion for each is in
              src/lib/legal/nav.ts. The rest are one click away. */}
          <div>
            <h3 className="footer-col-title">Yasal</h3>
            <ul>
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
            </ul>
          </div>
          <div className="footer-contact-col">
            <h3 className="footer-col-title">İletişim</h3>
            <ul>
              {lines.map((line, i) => (
                <li key={i}>{line}</li>
              ))}
              <li>
                <a href={`tel:${tel}`} className="tabular">
                  {phone}
                </a>
              </li>
              <li>
                <a href={`mailto:${email}`}>{email}</a>
              </li>
              {/* Ayarlar → Saatler: one row for a uniform week, one per run
                  otherwise ("Pzt-Cum", "Cmt-Paz", "Paz Kapalı"). */}
              <li className="footer-contact-hours">
                {hours.map(([label, value], i) => (
                  <span key={i} className="footer-hours-row">
                    <span>{label}</span>
                    <span className="tabular">{value}</span>
                  </span>
                ))}
              </li>
              {/* The other branches (src/lib/seo/branches.ts): one line each,
                  to their card on /ziyaret. The column above stays the Tuzla
                  köşk's, which is the one the app and the shop serve. */}
              {OTHER_BRANCHES.map((b) => (
                <li key={b.id} className="footer-branch">
                  <a href={`/ziyaret#${b.id}`}>Yeni: {b.name} açıldı</a>
                </li>
              ))}
            </ul>
            {/* The handle is the same on every network, so it is written once
                above the pills: a visitor who wants to find the account from
                a phone's search box needs the name, not a link. */}
            <div className="footer-social">
              <span className="footer-social-handle">{SITE.social.handle}</span>
              <div className="footer-social-links">
                <a
                  href={SITE.social.instagram}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Instagram
                </a>
                <a
                  href={SITE.social.tiktok}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  TikTok
                </a>
                <a
                  href={SITE.social.youtube}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  YouTube
                </a>
              </div>
            </div>
            {/* Who runs the site, where it can be reached directly (ETHS
                Yön. m.5/1, 6563 m.3/1): the title, MERSİS, the registered
                seat and, once there is one, the KEP address, straight from
                LEGAL_ENTITY. The chamber and the rules of conduct sit one
                click away on the company page. */}
            <dl className="footer-company">
              <div>
                <dt>Ticaret unvanı</dt>
                <dd>{LEGAL_ENTITY.legalName}</dd>
              </div>
              <div>
                <dt>MERSİS</dt>
                <dd className="tabular">{LEGAL_ENTITY.mersisNo}</dd>
              </div>
              <div>
                <dt>Merkez</dt>
                <dd>{COMPANY_ADDRESS}</dd>
              </div>
              {LEGAL_ENTITY.kep ? (
                <div>
                  <dt>KEP</dt>
                  <dd>{LEGAL_ENTITY.kep}</dd>
                </div>
              ) : null}
            </dl>
            <Link
              href="/hukuk/sirket-bilgileri"
              className="footer-company-link"
            >
              Şirket bilgileri
            </Link>
          </div>
        </div>

        <div className="footer-meta">
          <span>
            © {year} {SITE_LEGAL_NAME}
          </span>
          <span className="footer-meta-pay">
            Visa · Mastercard · Troy · Apple Pay
          </span>
        </div>
      </div>
    </footer>
  );
}

/** Vergi levhasındaki gerçek tüzel kişi. Footer'da uydurma bir ticaret
    unvanı yazıyordu ve bu, /hukuk altındaki sözleşmelerle çelişiyordu. */
const SITE_LEGAL_NAME = `${SITE.name} - ${LEGAL_ENTITY.shortName}`;
