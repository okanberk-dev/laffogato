"use client";

import { useEffect, useState } from "react";

export type Route =
  | "home"
  | "menu"
  | "shop"
  | "story"
  | "reels"
  | "visit"
  | "franchise";

interface NavProps {
  route: Route;
  navigate: (r: Route) => void;
  dark?: boolean;
  cart?: number;
  onCart?: () => void;
  onSearch?: () => void;
}

const LINKS: Array<[Route, string]> = [
  ["home", "Anasayfa"],
  ["menu", "Menü"],
  ["shop", "Mağaza"],
  ["story", "Hikaye"],
  ["reels", "Reels"],
  ["visit", "Ziyaret"],
  ["franchise", "Franchise"],
];

export function Nav({ route, navigate, dark, cart = 0, onCart, onSearch }: NavProps) {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    document.body.classList.toggle("is-no-scroll", open);
  }, [open]);

  const go = (r: Route) => (e: React.MouseEvent) => {
    e.preventDefault();
    setOpen(false);
    navigate(r);
  };

  return (
    <>
      {/* Sottile topbar — italian heritage strip, hidden once you scroll */}
      <div
        className={`nav-topbar ${scrolled ? "is-hidden" : ""} ${dark && !scrolled ? "on-dark" : ""}`}
        aria-hidden="true"
      >
        <div className="nav-topbar-inner">
          <span className="nav-topbar-item">Bologna · 1987</span>
          <span className="nav-topbar-dot" />
          <span className="nav-topbar-item">Maltepe Park · 10:00 — 23:00</span>
          <span className="nav-topbar-dot" />
          <span className="nav-topbar-item">500₺ üzeri Türkiye geneli ücretsiz kargo</span>
        </div>
      </div>
      <nav className={`nav ${scrolled ? "scrolled" : ""} ${dark && !scrolled ? "on-dark" : ""}`}>
        <div className="nav-left">
          <a
            href="#home"
            onClick={go("home")}
            className="nav-brand"
            aria-label="L'Affogato anasayfası"
          >
            <span className="nav-brand-mark" aria-hidden="true">
              <svg viewBox="0 0 32 32" width="26" height="26">
                <circle cx="16" cy="16" r="15" fill="none" stroke="currentColor" strokeWidth="0.9" />
                <text
                  x="16"
                  y="20.5"
                  textAnchor="middle"
                  fontFamily="var(--serif)"
                  fontStyle="italic"
                  fontSize="15"
                  fontWeight="600"
                  fill="currentColor"
                >
                  L
                </text>
                <circle cx="22" cy="9" r="1.1" fill="currentColor" />
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
        <div className="nav-center">
          {LINKS.map(([r, label]) => (
            <a
              key={r}
              href={`#${r}`}
              onClick={go(r)}
              className={`nav-link ${route === r ? "active" : ""}`}
            >
              {label}
            </a>
          ))}
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
          <button className="nav-icon-btn cart" aria-label="Sepetim" onClick={onCart}>
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
            {cart > 0 && <span className="badge">{cart}</span>}
          </button>
          <a href="#visit" onClick={go("visit")} className="btn btn-primary btn-sm nav-link-cta">
            Rezerve et
            <span className="arrow">→</span>
          </a>
          <button
            className={`nav-burger ${open ? "open" : ""}`}
            onClick={() => setOpen((v) => !v)}
            aria-label="Menü"
          >
            <span></span>
            <span></span>
            <span></span>
          </button>
        </div>
      </nav>

      <div className={`mobile-sheet ${open ? "open" : ""}`}>
        <div className="mobile-sheet-links">
          {LINKS.map(([r, label]) => (
            <a key={r} href={`#${r}`} onClick={go(r)}>
              {label}
            </a>
          ))}
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
            href="#visit"
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
          <span>Bologna · 1987</span>
        </div>
      </div>
    </>
  );
}

export interface FooterSettings {
  phone?: string;
  email?: string;
  address?: string;
}

interface FooterProps {
  navigate: (r: Route) => void;
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
  const go = (r: Route) => (e: React.MouseEvent) => {
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
            Yeni sezon affogati, Bologna kavurma notları, küçük gelato denemeleri.
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
        <FooterTrust icon="leaf" title="Taze kavurma" hint="Haftalık Bologna roast" />
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
            Bologna 1987'den İstanbul Maltepe Park'a. İlk yurt dışı şubemiz —
            açık-hava teras kahve barı.
          </p>
          <div className="footer-social">
            <a className="nav-icon-btn" href="#reels" onClick={go("reels")} aria-label="Instagram">
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                <rect x="2" y="2" width="12" height="12" rx="3" stroke="currentColor" strokeWidth="1.4" />
                <circle cx="8" cy="8" r="2.6" stroke="currentColor" strokeWidth="1.4" />
                <circle cx="11.5" cy="4.5" r="0.7" fill="currentColor" />
              </svg>
            </a>
            <a className="nav-icon-btn" href="#reels" onClick={go("reels")} aria-label="TikTok">
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
            <a className="nav-icon-btn" href="#reels" onClick={go("reels")} aria-label="YouTube">
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
            <li><a href="#menu" onClick={go("menu")}>Affogato</a></li>
            <li><a href="#menu" onClick={go("menu")}>Matcha Bar</a></li>
            <li><a href="#menu" onClick={go("menu")}>Espresso</a></li>
            <li><a href="#menu" onClick={go("menu")}>Cold Bar</a></li>
            <li><a href="#menu" onClick={go("menu")}>Gelato & Dolci</a></li>
          </ul>
        </div>
        <div>
          <h5>Bottega</h5>
          <ul>
            <li><a href="#shop" onClick={go("shop")}>Çekirdek</a></li>
            <li><a href="#shop" onClick={go("shop")}>Edible Cups</a></li>
            <li><a href="#shop" onClick={go("shop")}>Gift Box</a></li>
            <li><a href="#shop" onClick={go("shop")}>Ekipman</a></li>
            <li><a href="#shop" onClick={go("shop")}>Giyim</a></li>
          </ul>
        </div>
        <div>
          <h5>L'azienda</h5>
          <ul>
            <li><a href="#story" onClick={go("story")}>Hikayemiz</a></li>
            <li><a href="#reels" onClick={go("reels")}>Reels & Film</a></li>
            <li><a href="#franchise" onClick={go("franchise")}>Franchise</a></li>
            <li><a href="#visit" onClick={go("visit")}>Maltepe Park</a></li>
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
          <span>Bologna MCMLXXXVII — İstanbul MMXXVI</span>
        </div>
        <div className="footer-meta-script">Drink it. Eat the cup.</div>
        <div className="footer-meta-right">
          <FooterPay label="Visa" />
          <FooterPay label="Mastercard" />
          <FooterPay label="Troy" />
          <FooterPay label="AmEx" />
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
