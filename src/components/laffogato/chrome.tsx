"use client";

import { useEffect, useRef, useState } from "react";

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

export const MENU_DROPDOWN: DropdownEntry[] = [
  { slug: "affogato", label: "Affogato", italian: "La firma della casa", hue: "caramel" },
  { slug: "matcha", label: "Matcha Bar", italian: "Uji ceremonial grade", hue: "matcha" },
  { slug: "espresso", label: "Espresso & Coffee", italian: "Dalla macchina", hue: "dark" },
  { slug: "cold", label: "Cold Bar", italian: "Il banco freddo", hue: "strawberry" },
  { slug: "gelato", label: "Gelato & Dolci", italian: "Dal banco", hue: "pistachio" },
];

export const SHOP_DROPDOWN: DropdownEntry[] = [
  { slug: "cekirdek", label: "Çekirdek Kahve", italian: "Caffè in grani", hue: "dark" },
  { slug: "hediye", label: "Hediye Seti", italian: "Confezioni regalo", hue: "cream" },
  { slug: "ekipman", label: "Ekipman", italian: "Strumenti", hue: "caramel" },
  { slug: "giyim", label: "Giyim", italian: "Capi d'autore", hue: "dark" },
  { slug: "kiler", label: "Kiler", italian: "Dispensa", hue: "matcha" },
];

interface LinkEntry {
  route: Route;
  label: string;
  dropdown?: DropdownEntry[];
  basePath?: string;
}

const LINKS: LinkEntry[] = [
  { route: "home", label: "Anasayfa" },
  { route: "menu", label: "Menü", dropdown: MENU_DROPDOWN, basePath: "/menu" },
  { route: "shop", label: "Mağaza", dropdown: SHOP_DROPDOWN, basePath: "/magaza" },
  { route: "story", label: "Hikaye" },
  { route: "reels", label: "Reels" },
  { route: "visit", label: "Ziyaret" },
  { route: "franchise", label: "Franchise" },
];

interface NavProps {
  /** Current SPA route — drives the active link underline. When the nav
      lives outside the homepage SPA (e.g. /uye, /hukuk, /odeme), leave undefined. */
  route?: Route;
  /** SPA-internal navigate (sets hash + scrolls). When undefined, links
      degrade to normal anchors targeting real route URLs. */
  navigate?: (r: Route) => void;
  dark?: boolean;
  cart?: number;
  onCart?: () => void;
  onSearch?: () => void;
}

export function Nav({ route, navigate, dark, cart, onCart, onSearch }: NavProps) {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const [openDropdown, setOpenDropdown] = useState<Route | null>(null);
  const [mobileSection, setMobileSection] = useState<Route | null>(null);
  const closeTimerRef = useRef<number | null>(null);
  const dropdownRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

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
      if (!dropdownRef.current.contains(e.target as Node)) setOpenDropdown(null);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onClick);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onClick);
    };
  }, [openDropdown]);

  useEffect(() => () => {
    if (closeTimerRef.current) window.clearTimeout(closeTimerRef.current);
  }, []);

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
    : { onClick: () => { window.location.href = "/odeme"; }, type: "button" as const, role: undefined };

  return (
    <>
      {/* Sottile topbar — italian heritage strip, hidden once you scroll */}
      <div
        className={`nav-topbar ${scrolled ? "is-hidden" : ""} ${dark && !scrolled ? "on-dark" : ""}`}
        aria-hidden="true"
      >
        <div className="nav-topbar-inner">
          <span className="nav-topbar-item">Italia · 1987</span>
          <span className="nav-topbar-dot" />
          <span className="nav-topbar-item">Maltepe Park · 10:00 — 23:00</span>
          <span className="nav-topbar-dot" />
          <span className="nav-topbar-item">500₺ üzeri Türkiye geneli ücretsiz kargo</span>
        </div>
      </div>
      <nav
        className={`nav ${scrolled ? "scrolled" : ""} ${dark && !scrolled ? "on-dark" : ""}`}
        ref={dropdownRef}
      >
        <div className="nav-left">
          <a
            href={hrefFor("home")}
            onClick={go("home")}
            className="nav-brand"
            aria-label="L'Affogato anasayfası"
          >
            <span className="nav-brand-mark" aria-hidden="true">
              <svg viewBox="0 0 44 44" width="34" height="34">
                <circle cx="22" cy="22" r="20.5" fill="none" stroke="currentColor" strokeWidth="0.9" />
                <circle cx="22" cy="22" r="17.5" fill="none" stroke="currentColor" strokeWidth="0.4" opacity="0.55" />
                <text
                  x="22"
                  y="28"
                  textAnchor="middle"
                  fontFamily="var(--serif)"
                  fontStyle="italic"
                  fontSize="18"
                  fontWeight="600"
                  fill="currentColor"
                  letterSpacing="-0.5"
                >
                  L<tspan dy="-0.06em" fontSize="11">&#8217;</tspan>A
                </text>
                <circle cx="30.5" cy="13" r="1.15" fill="currentColor" />
              </svg>
            </span>
            <span className="nav-brand-lockup">
              <span className="nav-brand-text">
                L<span style={{ fontStyle: "italic" }}>’</span>Affogato
              </span>
              <span className="nav-brand-tag">caffè · gelato · est. 1987</span>
            </span>
          </a>
        </div>
        <div
          className="nav-center"
          onMouseLeave={onHoverClose}
        >
          {LINKS.map((link) => {
            const hasDropdown = !!link.dropdown;
            const isActive = route === link.route;
            const isOpen = openDropdown === link.route;
            return (
              <div
                key={link.route}
                className={`nav-link-wrap ${hasDropdown ? "has-dropdown" : ""}`}
                onMouseEnter={hasDropdown ? () => onHoverOpen(link.route) : undefined}
              >
                <a
                  href={hrefFor(link.route)}
                  onClick={go(link.route)}
                  className={`nav-link ${isActive ? "active" : ""} ${isOpen ? "is-open" : ""}`}
                  aria-haspopup={hasDropdown ? "true" : undefined}
                  aria-expanded={hasDropdown ? isOpen : undefined}
                >
                  {link.label}
                  {hasDropdown && (
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
                  )}
                </a>
                {hasDropdown && isOpen && (
                  <DropdownPanel
                    title={link.label}
                    basePath={link.basePath ?? hrefFor(link.route)}
                    entries={link.dropdown!}
                    parentRoute={link.route}
                    parentHref={hrefFor(link.route)}
                    onClose={() => setOpenDropdown(null)}
                  />
                )}
              </div>
            );
          })}
        </div>
        <div className="nav-right">
          <a
            href="/uye/giris"
            className="nav-link nav-link-account"
            aria-label="Hesabım"
            title="Hesabım"
          >
            Hesabım
          </a>
          <button className="nav-icon-btn" aria-label="Ara" onClick={onSearch}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <circle cx="7" cy="7" r="5" stroke="currentColor" strokeWidth="1.4" />
              <path d="M11 11 L14 14" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
            </svg>
          </button>
          <button className="nav-icon-btn cart" aria-label="Sepetim" {...cartHandler}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path
                d="M2 3 L4 3 L5.5 11 L13 11 L14 5 L5 5"
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinejoin="round"
                strokeLinecap="round"
              />
              <circle cx="6" cy="13.5" r="1.1" fill="currentColor" />
              <circle cx="12" cy="13.5" r="1.1" fill="currentColor" />
            </svg>
            {cartCount > 0 && <span className="badge">{cartCount}</span>}
          </button>
          <a href={hrefFor("visit")} onClick={go("visit")} className="btn btn-primary btn-sm nav-link-cta">
            Rezerve et
            <span className="arrow">→</span>
          </a>
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

      <div className={`mobile-sheet ${open ? "open" : ""}`}>
        <div className="mobile-sheet-links">
          {LINKS.map((link) => {
            const hasDropdown = !!link.dropdown;
            const isExpanded = mobileSection === link.route;
            if (!hasDropdown) {
              return (
                <a key={link.route} href={hrefFor(link.route)} onClick={go(link.route)}>
                  {link.label}
                </a>
              );
            }
            return (
              <div key={link.route} className="mobile-sheet-section">
                <button
                  type="button"
                  className={`mobile-sheet-section-head ${isExpanded ? "open" : ""}`}
                  onClick={() =>
                    setMobileSection(isExpanded ? null : link.route)
                  }
                  aria-expanded={isExpanded}
                >
                  <span>{link.label}</span>
                  <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
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
                <div className={`mobile-sheet-sublist ${isExpanded ? "open" : ""}`}>
                  <a
                    href={hrefFor(link.route)}
                    onClick={go(link.route)}
                    className="mobile-sheet-sublink mobile-sheet-sublink-all"
                  >
                    Tümünü gör →
                  </a>
                  {link.dropdown!.map((entry) => (
                    <a
                      key={entry.slug}
                      href={`${link.basePath ?? hrefFor(link.route)}/${entry.slug}`}
                      onClick={() => setOpen(false)}
                      className="mobile-sheet-sublink"
                    >
                      <span className={`mobile-sheet-sublink-swatch hue-${entry.hue}`} aria-hidden="true" />
                      <span>
                        <span className="mobile-sheet-sublink-label">{entry.label}</span>
                        <span className="mobile-sheet-sublink-it">{entry.italian}</span>
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
            style={{ fontFamily: "var(--serif)", fontStyle: "italic" }}
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
            Maltepe Park · rezerve et
            <span className="arrow">→</span>
          </a>
        </div>
        <div className="mobile-sheet-foot">
          <span>Maltepe Park · İstanbul</span>
          <span>Italia · 1987</span>
        </div>
      </div>
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
    <div className="nav-dropdown" role="menu" aria-label={`${title} alt menüsü`}>
      <div className="nav-dropdown-inner">
        <div className="nav-dropdown-head">
          <div className="eyebrow">
            {parentRoute === "menu" ? "Il menù · 5 kategori" : "La bottega · 5 kategori"}
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
              <span className={`nav-dropdown-swatch hue-${entry.hue}`} aria-hidden="true">
                <span className="nav-dropdown-swatch-dot" />
              </span>
              <span className="nav-dropdown-text">
                <span className="nav-dropdown-label">{entry.label}</span>
                <span className="nav-dropdown-italian">{entry.italian}</span>
              </span>
              <span className="nav-dropdown-arrow" aria-hidden="true">→</span>
            </a>
          ))}
        </div>
        <div className="nav-dropdown-foot">
          <span className="nav-dropdown-foot-mark">L'A</span>
          <span className="nav-dropdown-foot-line">
            Italia 1987 — {parentRoute === "menu" ? "tre rituali, un menù" : "dalla bottega alla casa"}
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
}

interface FooterProps {
  /** Optional SPA navigate — when provided, links call it (no full nav).
      When absent (non-SPA pages), links are plain anchors to real routes. */
  navigate?: (r: Route) => void;
  settings?: FooterSettings;
}

const DEFAULT_ADDRESS_LINES = ["Maltepe Park AVM", "Open-air rooftop", "Cevizli, İstanbul"];

function splitAddress(address?: string): string[] {
  if (!address) return DEFAULT_ADDRESS_LINES;
  const parts = address
    .split(/[\n,]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  return parts.length > 0 ? parts : DEFAULT_ADDRESS_LINES;
}

export function Footer({ navigate, settings }: FooterProps) {
  const hrefFor = (r: Route) => ROUTE_PATHS[r];
  const go = (r: Route) => (e: React.MouseEvent) => {
    if (!navigate) return; // allow default anchor navigation
    e.preventDefault();
    navigate(r);
    window.scrollTo({ top: 0 });
  };
  const phone = settings?.phone ?? "+90 216 459 30 60";
  const email = settings?.email ?? "maltepe@laffogato.it";
  const addressLines = splitAddress(settings?.address);
  const year = new Date().getFullYear();
  return (
    <footer className="footer">
      {/* Decorative top rule */}
      <div className="footer-deco" aria-hidden="true">
        <span className="footer-deco-line" />
        <span className="footer-deco-monogram">L'A</span>
        <span className="footer-deco-line" />
      </div>

      {/* Newsletter block */}
      <div className="footer-newsletter">
        <div>
          <div className="eyebrow on-dark" style={{ marginBottom: 14 }}>
            Lettera mensile · Ayda bir mektup
          </div>
          <h3>
            Bir mektup, <span className="script">ayda bir.</span>
          </h3>
          <p style={{ marginTop: 18, color: "rgba(255, 255, 255, 0.72)", maxWidth: 460, lineHeight: 1.65 }}>
            Yeni sezon affogati, İtalyan kavurma notları, küçük gelato denemeleri.
            Hiçbir zaman ayda birden fazla — söz veriyoruz.
          </p>
        </div>
        <form className="newsletter-form" onSubmit={(e) => e.preventDefault()}>
          <input type="email" placeholder="merhaba@example.com" autoComplete="email" />
          <button
            type="submit"
            className="btn btn-gold btn-sm"
            style={{ borderRadius: 999, whiteSpace: "nowrap" }}
          >
            Abone ol <span className="arrow">→</span>
          </button>
        </form>
      </div>

      {/* Trust strip */}
      <div className="footer-trust">
        <FooterTrust icon="lock" title="Güvenli ödeme" hint="256-bit SSL · 3D Secure" />
        <FooterTrust icon="truck" title="Ücretsiz kargo" hint="500₺ üzeri Türkiye geneli" />
        <FooterTrust icon="leaf" title="Taze kavurma" hint="Haftalık İtalyan roast" />
        <FooterTrust icon="return" title="14 gün cayma" hint="Mevzuata uygun iade" />
      </div>

      {/* Main link grid */}
      <div className="footer-grid">
        <div className="footer-brand-col">
          <div className="footer-mark">
            L<span style={{ fontStyle: "italic" }}>’</span>Affogato
          </div>
          <div className="footer-mark-script">caffè · gelato · est. 1987</div>
          <p>
            Italia 1987'den İstanbul Maltepe Park'a. İlk yurt dışı şubemiz —
            açık-hava teras kahve barı.
          </p>
          <div className="footer-social">
            <a className="nav-icon-btn" href={hrefFor("reels")} onClick={go("reels")} aria-label="Instagram">
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                <rect x="2" y="2" width="12" height="12" rx="3" stroke="currentColor" strokeWidth="1.4" />
                <circle cx="8" cy="8" r="2.6" stroke="currentColor" strokeWidth="1.4" />
                <circle cx="11.5" cy="4.5" r="0.7" fill="currentColor" />
              </svg>
            </a>
            <a className="nav-icon-btn" href={hrefFor("reels")} onClick={go("reels")} aria-label="TikTok">
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                <path
                  d="M9 1 L9 11 A 2.5 2.5 0 1 1 6.5 8.5"
                  stroke="currentColor"
                  strokeWidth="1.4"
                  strokeLinecap="round"
                />
                <path d="M9 1 Q 9 4 13 4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
              </svg>
            </a>
            <a className="nav-icon-btn" href={hrefFor("reels")} onClick={go("reels")} aria-label="YouTube">
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                <rect x="1.5" y="3.5" width="13" height="9" rx="2" stroke="currentColor" strokeWidth="1.4" />
                <path d="M7 6 L10 8 L7 10 Z" fill="currentColor" />
              </svg>
            </a>
          </div>
        </div>
        <div>
          <h5>Menu</h5>
          <ul>
            {MENU_DROPDOWN.map((m) => (
              <li key={m.slug}>
                <a href={`/menu/${m.slug}`}>{m.label}</a>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h5>Bottega</h5>
          <ul>
            {SHOP_DROPDOWN.map((s) => (
              <li key={s.slug}>
                <a href={`/magaza/${s.slug}`}>{s.label}</a>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h5>L'azienda</h5>
          <ul>
            <li><a href={hrefFor("story")} onClick={go("story")}>Hikayemiz</a></li>
            <li><a href={hrefFor("reels")} onClick={go("reels")}>Reels & Film</a></li>
            <li><a href={hrefFor("franchise")} onClick={go("franchise")}>Franchise</a></li>
            <li><a href={hrefFor("visit")} onClick={go("visit")}>Maltepe Park</a></li>
            <li><a href="/uye/hesap">Hesabım</a></li>
          </ul>
        </div>
        <div>
          <h5>Yasal</h5>
          <ul>
            <li><a href="/hukuk/kullanim-sartlari">Kullanım Şartları</a></li>
            <li><a href="/hukuk/gizlilik-politikasi">Gizlilik Politikası</a></li>
            <li><a href="/hukuk/mesafeli-satis-sozlesmesi">Mesafeli Satış Sözleşmesi</a></li>
            <li><a href="/hukuk/iade-ve-cayma">İade & Cayma</a></li>
            <li><a href="/hukuk/teslimat-ve-kargo">Teslimat & Kargo</a></li>
            <li><a href="/hukuk/cerez-politikasi">Çerez Politikası</a></li>
            <li><a href="/hukuk/kvkk-aydinlatma-metni">KVKK Aydınlatma</a></li>
          </ul>
        </div>
        <div className="footer-contact-col">
          <h5>İletişim</h5>
          <ul>
            {addressLines.map((line, i) => (
              <li key={i}>{line}</li>
            ))}
            <li className="footer-contact-mono">{phone}</li>
            <li className="footer-contact-mono">{email}</li>
            <li className="footer-contact-hours">
              <span>Her gün</span>
              <span className="tabular">10:00 — 23:00</span>
            </li>
          </ul>
        </div>
      </div>

      {/* Bottom strip */}
      <div className="footer-meta">
        <div className="footer-meta-left">
          <span>© {year} {SITE_LEGAL_NAME}</span>
          <span className="footer-meta-dot" />
          <span>Italia MCMLXXXVII — İstanbul MMXXVI</span>
        </div>
        <div className="footer-meta-script">Drink it. Eat the cup.</div>
        <div className="footer-meta-right">
          <FooterPay label="Visa" />
          <FooterPay label="Mastercard" />
          <FooterPay label="Troy" />
        </div>
      </div>
    </footer>
  );
}

const SITE_LEGAL_NAME = "L'Affogato Gıda ve Servis A.Ş.";

function FooterTrust({
  icon,
  title,
  hint,
}: {
  icon: "lock" | "truck" | "leaf" | "return";
  title: string;
  hint: string;
}) {
  return (
    <div className="footer-trust-item">
      <span className="footer-trust-icon" aria-hidden="true">
        {icon === "lock" && (
          <svg viewBox="0 0 20 20" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.4">
            <rect x="4" y="9" width="12" height="8" rx="2" />
            <path d="M6.5 9 V6.5 a3.5 3.5 0 0 1 7 0 V9" />
            <circle cx="10" cy="13" r="1" fill="currentColor" />
          </svg>
        )}
        {icon === "truck" && (
          <svg viewBox="0 0 20 20" width="18" height="16" fill="none" stroke="currentColor" strokeWidth="1.4">
            <path d="M1 5 H11 V14 H1 z" />
            <path d="M11 8 H16 L18 11 V14 H11 z" />
            <circle cx="5" cy="15" r="1.4" />
            <circle cx="14" cy="15" r="1.4" />
          </svg>
        )}
        {icon === "leaf" && (
          <svg viewBox="0 0 20 20" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.4">
            <path d="M3 17 C4 9 9 4 17 3 C17 11 13 16 5 17 Z" />
            <path d="M5 17 L11 11" />
          </svg>
        )}
        {icon === "return" && (
          <svg viewBox="0 0 20 20" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.4">
            <path d="M4 10 a6 6 0 1 0 2-4" />
            <path d="M2 4 L6 6 L4 10" strokeLinejoin="round" />
          </svg>
        )}
      </span>
      <div>
        <div className="footer-trust-title">{title}</div>
        <div className="footer-trust-hint">{hint}</div>
      </div>
    </div>
  );
}

function FooterPay({ label }: { label: string }) {
  return (
    <span className="footer-pay" aria-label={`${label} kabul edilir`}>
      {label}
    </span>
  );
}
