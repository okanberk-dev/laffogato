"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { addressLines } from "@/lib/utils/format";
import { CONSENT_OPEN_EVENT } from "@/lib/consent/script";
import { LEGAL_ENTITY } from "@/lib/legal/entity";
import { FOOTER_LEGAL_DOCS } from "@/lib/legal/nav";
import { MENU_CATEGORY_ROUTES } from "@/lib/seo/pages";
import { SITE } from "@/lib/seo/site";

import { NewsletterForm } from "./newsletter-form";
import { ROUTE_PATHS, type Route } from "./route-paths";

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
 * that does not exist. `nav` marks which of the twelve categories are worth a
 * place in the header; the dropdown's "Tüm menü" link covers the rest.
 */
const MENU_DROPDOWN: DropdownEntry[] = MENU_CATEGORY_ROUTES.filter(
  (c) => c.nav,
).map((c) => ({
  slug: c.slug,
  label: c.nav!.label,
  italian: c.nav!.italian,
  hue: c.nav!.hue,
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

interface LinkEntry {
  /** SPA route, or `null` for a destination that lives outside the SPA and is
      always a real navigation (Karaoke). */
  route: Route | null;
  href?: string;
  label: string;
  dropdown?: DropdownEntry[];
  basePath?: string;
}

const LINKS: LinkEntry[] = [
  { route: "home", label: "Anasayfa" },
  { route: "menu", label: "Menü", dropdown: MENU_DROPDOWN, basePath: "/menu" },
  {
    route: "shop",
    label: "Mağaza",
    dropdown: SHOP_DROPDOWN,
    basePath: "/magaza",
  },
  { route: null, href: "/kampanyalar", label: "Kampanyalar" },
  { route: "story", label: "Hikaye" },
  { route: "visit", label: "Ziyaret" },
  { route: null, href: "/karaoke", label: "Karaoke" },
];

/* The L'Affogato monogram is rendered from the brand logo asset
   (public/logo-mark.png) via the `.brand-mark` CSS-mask utility in
   globals.css. The wordmark utility went with the header that used it. */

interface NavProps {
  /** Current SPA route — drives the active link underline. When the nav
      lives outside the homepage SPA (e.g. /uye, /hukuk, /odeme), leave undefined. */
  route?: Route;
  /** SPA-internal navigate (sets hash + scrolls). When undefined, links
      degrade to normal anchors targeting real route URLs. */
  navigate?: (r: Route) => void;
  cart?: number;
  onCart?: () => void;
  onSearch?: () => void;
}

export function Nav({ route, navigate, cart, onCart, onSearch }: NavProps) {
  const [open, setOpen] = useState(false);
  const [openDropdown, setOpenDropdown] = useState<Route | null>(null);
  const [mobileSection, setMobileSection] = useState<Route | null>(null);
  const closeTimerRef = useRef<number | null>(null);
  const dropdownRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    document.body.classList.toggle("is-no-scroll", open);
  }, [open]);

  useEffect(() => {
    if (!openDropdown) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpenDropdown(null);
    };
    const onClick = (e: MouseEvent) => {
      if (!dropdownRef.current) return;
      if (!dropdownRef.current.contains(e.target as Node))
        setOpenDropdown(null);
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

  const hrefFor = (r: Route) => ROUTE_PATHS[r];

  const go = (r: Route) => (e: React.MouseEvent) => {
    setOpen(false);
    setOpenDropdown(null);
    if (navigate) {
      e.preventDefault();
      navigate(r);
    }
  };

  const onHoverOpen = (r: Route) => {
    if (closeTimerRef.current) window.clearTimeout(closeTimerRef.current);
    setOpenDropdown(r);
  };

  const onHoverClose = () => {
    if (closeTimerRef.current) window.clearTimeout(closeTimerRef.current);
    closeTimerRef.current = window.setTimeout(() => setOpenDropdown(null), 180);
  };

  const cartCount = cart ?? 0;
  const cartHandler = onCart
    ? { onClick: onCart, type: "button" as const, role: undefined }
    : {
        onClick: () => {
          window.location.href = "/odeme";
        },
        type: "button" as const,
        role: undefined,
      };

  return (
    <>
      <header className="site-header" ref={dropdownRef}>
        <div className="nav-bar">
          <nav className="nav" aria-label="Ana gezinme">
            <div className="nav-left">
              <a
                href={hrefFor("home")}
                onClick={go("home")}
                className="nav-brand"
                aria-label="L'Affogato anasayfası"
              >
                {/* The mark alone (operator, 7 Eyl). The wordmark beside it
                    said in type what the disc already says, and cost the
                    centred nav ~190px it wanted for its links. The accessible
                    name lives on the anchor, so nothing is lost to a reader. */}
                <span className="nav-brand-disc" aria-hidden="true">
                  <span className="nav-brand-mark brand-mark" />
                </span>
              </a>
            </div>
            <div className="nav-center" onMouseLeave={onHoverClose}>
              {LINKS.map((link) => {
                const hasDropdown = !!link.dropdown;
                // `null` marks a destination outside the SPA (Karaoke): it is
                // always a real navigation, never a hash route.
                const r = link.route;
                const isActive = r !== null && route === r;
                const isOpen = r !== null && openDropdown === r;
                return (
                  <div
                    key={link.label}
                    className={`nav-link-wrap ${hasDropdown ? "has-dropdown" : ""}`}
                    onMouseEnter={
                      hasDropdown && r ? () => onHoverOpen(r) : undefined
                    }
                  >
                    <a
                      href={r ? hrefFor(r) : (link.href ?? "/")}
                      onClick={r ? go(r) : undefined}
                      className={`nav-link ${isActive ? "active" : ""} ${isOpen ? "is-open" : ""}`}
                    >
                      {link.label}
                    </a>
                    {/* The panel used to open on hover alone, so a keyboard user
                    could never reach it and `aria-expanded` was false forever.
                    The caret is its own control: the link still navigates, the
                    button opens the panel. */}
                    {hasDropdown && (
                      <button
                        type="button"
                        className={`nav-link-caret-btn ${isOpen ? "is-open" : ""}`}
                        aria-haspopup="true"
                        aria-expanded={isOpen}
                        aria-label={`${link.label} alt menüsünü ${isOpen ? "kapat" : "aç"}`}
                        onClick={() => setOpenDropdown(isOpen ? null : r)}
                      >
                        <svg
                          className="nav-link-caret"
                          width="9"
                          height="9"
                          viewBox="0 0 10 10"
                          aria-hidden="true"
                        >
                          <path
                            d="M2 4 L5 7 L8 4"
                            stroke="currentColor"
                            strokeWidth="1.4"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            fill="none"
                          />
                        </svg>
                      </button>
                    )}
                    {hasDropdown && isOpen && r && (
                      <DropdownPanel
                        title={link.label}
                        basePath={link.basePath ?? hrefFor(r)}
                        entries={link.dropdown!}
                        parentRoute={r}
                        parentHref={hrefFor(r)}
                        onClose={() => setOpenDropdown(null)}
                      />
                    )}
                  </div>
                );
              })}
            </div>
            <div className="nav-right">
              <button
                type="button"
                className="nav-icon-btn"
                aria-label="Ara"
                onClick={onSearch}
              >
                <svg
                  width="17"
                  height="17"
                  viewBox="0 0 16 16"
                  fill="none"
                  aria-hidden="true"
                >
                  <circle
                    cx="7"
                    cy="7"
                    r="4.6"
                    stroke="currentColor"
                    strokeWidth="1.4"
                  />
                  <path
                    d="M10.6 10.6 14 14"
                    stroke="currentColor"
                    strokeWidth="1.4"
                    strokeLinecap="round"
                  />
                </svg>
              </button>
              {/* An icon, not a second pill: the reference's header carries a
                  single filled button on the right, and two pills side by
                  side was the one thing that stopped ours reading like it. */}
              <a
                href="/uye/hesap"
                className="nav-icon-btn"
                aria-label="Hesabım"
              >
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 18 18"
                  fill="none"
                  aria-hidden="true"
                >
                  <circle
                    cx="9"
                    cy="6"
                    r="3.1"
                    stroke="currentColor"
                    strokeWidth="1.4"
                  />
                  <path
                    d="M3.4 15.2c.7-2.9 2.9-4.5 5.6-4.5s4.9 1.6 5.6 4.5"
                    stroke="currentColor"
                    strokeWidth="1.4"
                    strokeLinecap="round"
                  />
                </svg>
              </a>
              <button
                className="nav-pill nav-pill-solid"
                aria-label={`Sepetim - ${cartCount} ürün`}
                {...cartHandler}
              >
                Sepet
                <span
                  className={`nav-pill-count ${cartCount > 0 ? "has-items" : ""}`}
                >
                  {cartCount}
                </span>
              </button>
              <button
                className={`nav-burger ${open ? "open" : ""}`}
                onClick={() => setOpen((v) => !v)}
                aria-label="Menü"
                aria-expanded={open}
              >
                <span></span>
                <span></span>
                <span></span>
              </button>
            </div>
          </nav>
        </div>
      </header>

      <div className={`mobile-sheet ${open ? "open" : ""}`}>
        <div className="mobile-sheet-links">
          {LINKS.map((link) => {
            const hasDropdown = !!link.dropdown;
            const isExpanded = mobileSection === link.route;
            if (!hasDropdown) {
              return (
                <a
                  key={link.label}
                  href={link.href ?? hrefFor(link.route!)}
                  onClick={link.route ? go(link.route) : () => setOpen(false)}
                >
                  {link.label}
                </a>
              );
            }
            return (
              <div key={link.label} className="mobile-sheet-section">
                <button
                  type="button"
                  className={`mobile-sheet-section-head ${isExpanded ? "open" : ""}`}
                  onClick={() =>
                    setMobileSection(isExpanded ? null : link.route)
                  }
                  aria-expanded={isExpanded}
                >
                  <span>{link.label}</span>
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 14 14"
                    aria-hidden="true"
                  >
                    <path
                      d="M3 5 L7 9 L11 5"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      fill="none"
                    />
                  </svg>
                </button>
                <div
                  className={`mobile-sheet-sublist ${isExpanded ? "open" : ""}`}
                >
                  <a
                    href={hrefFor(link.route!)}
                    onClick={go(link.route!)}
                    className="mobile-sheet-sublink mobile-sheet-sublink-all"
                  >
                    Tümünü gör →
                  </a>
                  {link.dropdown!.map((entry) => (
                    <a
                      key={entry.slug}
                      href={`${link.basePath ?? hrefFor(link.route!)}/${entry.slug}`}
                      onClick={() => setOpen(false)}
                      className="mobile-sheet-sublink"
                    >
                      <span
                        className={`mobile-sheet-sublink-swatch hue-${entry.hue}`}
                        aria-hidden="true"
                      />
                      <span>
                        <span className="mobile-sheet-sublink-label">
                          {entry.label}
                        </span>
                        <span className="mobile-sheet-sublink-it">
                          {entry.italian}
                        </span>
                      </span>
                    </a>
                  ))}
                </div>
              </div>
            );
          })}
          <a
            href="/uye/giris"
            onClick={() => setOpen(false)}
            style={{ fontFamily: "var(--serif)", fontStyle: "normal" }}
          >
            Hesabım
          </a>
        </div>
        <div style={{ marginTop: 32, display: "grid", gap: 12 }}>
          <a
            href="/uye/kayit"
            onClick={() => setOpen(false)}
            className="btn btn-gold btn-lg"
            style={{ width: "100%", justifyContent: "space-between" }}
          >
            Üye ol · sipariş geçmişin elinde
            <span className="arrow">→</span>
          </a>
          <a
            href={hrefFor("visit")}
            onClick={go("visit")}
            className="btn btn-light btn-lg"
            style={{ width: "100%", justifyContent: "space-between" }}
          >
            Tuzla · rezerve et
            <span className="arrow">→</span>
          </a>
        </div>
        <div className="mobile-sheet-foot">
          <span>Tuzla · İstanbul</span>
          <span>Bologna · 1897</span>
        </div>
      </div>

      {/* Mobile bottom navigation — quick access to primary destinations */}
      <nav className="bottom-nav" aria-label="Mobil gezinme">
        <a
          href={hrefFor("home")}
          onClick={go("home")}
          className={`bottom-nav-item ${route === "home" ? "active" : ""}`}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M3 10.5 12 3l9 7.5" />
            <path d="M5 9.8V20a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V9.8" />
          </svg>
          <span>Anasayfa</span>
        </a>
        <a
          href={hrefFor("menu")}
          onClick={go("menu")}
          className={`bottom-nav-item ${route === "menu" ? "active" : ""}`}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M5 8h12v4a5 5 0 0 1-5 5H10a5 5 0 0 1-5-5V8Z" />
            <path d="M17 9h2.5a2 2 0 0 1 0 4H17" />
            <path d="M8 3v2M12 3v2" />
          </svg>
          <span>Menü</span>
        </a>
        <a
          href={hrefFor("shop")}
          onClick={go("shop")}
          className={`bottom-nav-item ${route === "shop" ? "active" : ""}`}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M6 8h12l-1 12H7L6 8Z" />
            <path d="M9 8a3 3 0 0 1 6 0" />
          </svg>
          <span>Mağaza</span>
        </a>
        <a href="/uye/giris" className="bottom-nav-item">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="12" cy="8" r="3.2" />
            <path d="M5.5 20a6.5 6.5 0 0 1 13 0" />
          </svg>
          <span>Hesabım</span>
        </a>
        <button
          className="bottom-nav-item"
          aria-label="Sepetim"
          {...cartHandler}
        >
          <span className="bottom-nav-cart">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M3 4.5h2.2l2 11h10l1.5-8H6.5" />
              <circle
                cx="9"
                cy="20"
                r="1.4"
                fill="currentColor"
                stroke="none"
              />
              <circle
                cx="17"
                cy="20"
                r="1.4"
                fill="currentColor"
                stroke="none"
              />
            </svg>
            {cartCount > 0 && (
              <span className="bottom-nav-badge">{cartCount}</span>
            )}
          </span>
          <span>Sepet</span>
        </button>
      </nav>
    </>
  );
}

/* ─────────────────────────────────────────────────────────────
   Dropdown panel — mega-menu for Menü / Mağaza
   ───────────────────────────────────────────────────────────── */

function DropdownPanel({
  title,
  basePath,
  entries,
  parentRoute,
  parentHref,
  onClose,
}: {
  title: string;
  basePath: string;
  entries: DropdownEntry[];
  parentRoute: Route;
  parentHref: string;
  onClose: () => void;
}) {
  return (
    <div
      className="nav-dropdown"
      role="menu"
      aria-label={`${title} alt menüsü`}
    >
      <div className="nav-dropdown-inner">
        <div className="nav-dropdown-head">
          <div className="eyebrow">
            {parentRoute === "menu"
              ? "Il menù · 5 kategori"
              : "La bottega · 5 kategori"}
          </div>
          <a href={parentHref} className="nav-dropdown-all" onClick={onClose}>
            <span>Tüm {title.toLowerCase()}</span>
            <span className="arrow">→</span>
          </a>
        </div>
        <div className="nav-dropdown-grid">
          {entries.map((entry) => (
            <a
              key={entry.slug}
              href={`${basePath}/${entry.slug}`}
              className="nav-dropdown-item"
              onClick={onClose}
              role="menuitem"
            >
              <span
                className={`nav-dropdown-swatch hue-${entry.hue}`}
                aria-hidden="true"
              >
                <span className="nav-dropdown-swatch-dot" />
              </span>
              <span className="nav-dropdown-text">
                <span className="nav-dropdown-label">{entry.label}</span>
                <span className="nav-dropdown-italian">{entry.italian}</span>
              </span>
              <span className="nav-dropdown-arrow" aria-hidden="true">
                →
              </span>
            </a>
          ))}
        </div>
        <div className="nav-dropdown-foot">
          <span className="nav-dropdown-foot-mark">L'A</span>
          <span className="nav-dropdown-foot-line">
            Bologna 1897 -{" "}
            {parentRoute === "menu"
              ? "tre rituali, un menù"
              : "dalla bottega alla casa"}
          </span>
        </div>
      </div>
    </div>
  );
}

export interface FooterSettings {
  phone?: string;
  email?: string;
  address?: string;
  /** Courier fee in kuruş, from /admin/ayarlar. */
  courierFeeMinor?: number;
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

export function Footer({ navigate, settings }: FooterProps) {
  const hrefFor = (r: Route) => ROUTE_PATHS[r];
  const go = (r: Route) => (e: React.MouseEvent) => {
    if (!navigate) return; // allow default anchor navigation
    e.preventDefault();
    navigate(r);
    window.scrollTo({ top: 0 });
  };
  const phone = settings?.phone ?? "+90 536 429 09 19";
  const email = settings?.email ?? SITE.email;
  const lines = addressLines(settings?.address ?? "", DEFAULT_ADDRESS_LINES);
  const year = new Date().getFullYear();
  return (
    <footer className="footer">
      {/* Newsletter block */}
      <div className="footer-newsletter">
        <div>
          <div className="eyebrow on-dark" style={{ marginBottom: 10 }}>
            Ayda bir mektup
          </div>
          <h3>
            Bir mektup, <span className="script">ayda bir.</span>
          </h3>
          <p className="footer-newsletter-lede">
            Yeni sezon affogati, Bologna kavurma notları, küçük gelato
            denemeleri. Hiçbir zaman ayda birden fazla - söz veriyoruz.
          </p>
        </div>
        <NewsletterForm />
      </div>

      {/* Main link grid */}
      <div className="footer-grid">
        <div className="footer-brand-col">
          <div className="footer-mark">
            <span className="brand-mark" role="img" aria-label="L'Affogato" />
          </div>
          <div className="footer-mark-script">caffè italiano · est. 1897</div>
          <p>
            Bologna 1897’den İstanbul Tuzla’ya - 200 yıllık, restore bir köşkte.
          </p>
          {/* The handle is the same on every network, so it is written
              once above the pills: a visitor who wants to find the account
              from a phone's search box needs the name, not a link. */}
          <div className="footer-social">
            <span className="footer-social-handle">{SITE.social.handle}</span>
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
          {/* In the brand column, not a seventh column of its own: with six
              link groups plus a brand block spanning two, the contact
              details wrapped onto a row by themselves and left the footer
              looking like it had lost a column. */}
          <div className="footer-contact-col">
            <h5>İletişim</h5>
            <ul>
              {lines.map((line, i) => (
                <li key={i}>{line}</li>
              ))}
              <li className="footer-contact-mono">{phone}</li>
              <li className="footer-contact-mono">{email}</li>
              <li className="footer-contact-hours">
                <span>Her gün</span>
                <span className="tabular">09:00 - 02:00</span>
              </li>
            </ul>
          </div>
        </div>

        <div>
          <h5>Menü</h5>
          <ul>
            {MENU_DROPDOWN.map((m) => (
              <li key={m.slug}>
                <a href={`/menu/${m.slug}`}>{m.label}</a>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h5>Mağaza</h5>
          <ul>
            {SHOP_DROPDOWN.map((s) => (
              <li key={s.slug}>
                <a href={`/magaza/${s.slug}`}>{s.label}</a>
              </li>
            ))}
          </ul>
        </div>
        {/* "Hesap" and "Rehber" used to be two columns of five links each.
            They are one now: the guides live at /rehber and were never what
            anyone came to the footer for. */}
        <div>
          <h5>Kurumsal</h5>
          <ul>
            <li>
              <a href="/uye/hesap">Üyelik &amp; ödüller</a>
            </li>
            <li>
              <a href="/kampanyalar">Kampanyalar</a>
            </li>
            <li>
              <a href="/karaoke">Karaoke</a>
            </li>
            <li>
              <a href={hrefFor("visit")} onClick={go("visit")}>
                Ziyaret
              </a>
            </li>
            <li>
              <a href={hrefFor("story")} onClick={go("story")}>
                Hikayemiz
              </a>
            </li>
            <li>
              <Link href="/rehber">Rehber</Link>
            </li>
          </ul>
        </div>
        {/* Eight documents, not fourteen; the criterion for each is in
            src/lib/legal/nav.ts. The rest are one click away. */}
        <div>
          <h5>Yasal</h5>
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
                Çerez Tercihleri
              </button>
            </li>
            <li>
              <Link href="/hukuk">Tüm belgeler →</Link>
            </li>
          </ul>
        </div>
      </div>

      {/* Bottom strip */}
      <div className="footer-meta">
        <span>
          © {year} {SITE_LEGAL_NAME}
        </span>
        <span className="footer-meta-tagline">İçilir. Sonra kupası yenir.</span>
        <span className="footer-meta-pay">
          Visa · Mastercard · Troy · Apple Pay
        </span>
      </div>
    </footer>
  );
}

/** Vergi levhasındaki gerçek tüzel kişi. Footer'da uydurma bir ticaret
    unvanı yazıyordu ve bu, /hukuk altındaki sözleşmelerle çelişiyordu. */
const SITE_LEGAL_NAME = `${SITE.name} - ${LEGAL_ENTITY.shortName}`;
