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
  ["home", "Home"],
  ["menu", "Menu"],
  ["shop", "Shop"],
  ["story", "Story"],
  ["reels", "Reels"],
  ["visit", "Visit"],
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
      <nav className={`nav ${scrolled ? "scrolled" : ""} ${dark && !scrolled ? "on-dark" : ""}`}>
        <div className="nav-left">
          <a href="#home" onClick={go("home")} className="nav-brand">
            L<span style={{ fontStyle: "italic" }}>’</span>Affogato
            <span className="dot"></span>
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
          <button className="nav-icon-btn" aria-label="Search" onClick={onSearch}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <circle cx="7" cy="7" r="5" stroke="currentColor" strokeWidth="1.4" />
              <path d="M11 11 L14 14" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
            </svg>
          </button>
          <button className="nav-icon-btn cart" aria-label="Sepet" onClick={onCart}>
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
            aria-label="Menu"
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
        </div>
        <div style={{ marginTop: 40 }}>
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
  return (
    <footer className="footer">
      <div className="footer-newsletter">
        <div>
          <div className="eyebrow on-dark" style={{ marginBottom: 14 }}>
            Lettera mensile · Ayda bir mektup
          </div>
          <h3>
            Bir mektup, <span className="script">ayda bir.</span>
          </h3>
          <p style={{ marginTop: 18, color: "rgba(255, 255, 255, 0.7)", maxWidth: 460, lineHeight: 1.55 }}>
            Yeni sezon affogati, Bologna kavurma notları, küçük gelato denemeleri. Hiçbir zaman ayda birden fazla.
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

      <div className="footer-grid">
        <div>
          <div className="footer-mark">L’Affogato</div>
          <div
            style={{
              fontFamily: "Pinyon Script",
              fontSize: 28,
              color: "var(--gold-soft)",
              marginTop: -4,
              marginBottom: 18,
            }}
          >
            But first, affogato.
          </div>
          <p style={{ maxWidth: 320, opacity: 0.7, fontSize: 14, lineHeight: 1.55 }}>
            Bologna 1987’den İstanbul Maltepe Park’a. İlk yurt dışı şubemiz, açık-hava teras kahve barı.
          </p>
          <div style={{ display: "flex", gap: 8, marginTop: 22 }}>
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
          <h5>Shop</h5>
          <ul>
            <li><a href="#shop" onClick={go("shop")}>Çekirdek</a></li>
            <li><a href="#shop" onClick={go("shop")}>Edible Cups</a></li>
            <li><a href="#shop" onClick={go("shop")}>Gift Box</a></li>
            <li><a href="#shop" onClick={go("shop")}>Ekipman</a></li>
            <li><a href="#shop" onClick={go("shop")}>Giyim</a></li>
          </ul>
        </div>
        <div>
          <h5>Marka</h5>
          <ul>
            <li><a href="#story" onClick={go("story")}>Hikayemiz</a></li>
            <li><a href="#reels" onClick={go("reels")}>Reels & Film</a></li>
            <li><a href="#franchise" onClick={go("franchise")}>Franchise</a></li>
            <li><a href="#visit" onClick={go("visit")}>Maltepe Park</a></li>
            <li><a href="#" onClick={(e) => e.preventDefault()}>Press</a></li>
          </ul>
        </div>
        <div>
          <h5>İletişim</h5>
          <ul>
            {addressLines.map((line, i) => (
              <li key={i}>{line}</li>
            ))}
            <li style={{ marginTop: 6, fontFamily: "JetBrains Mono", fontSize: 12 }}>{phone}</li>
            <li style={{ fontFamily: "JetBrains Mono", fontSize: 12 }}>{email}</li>
          </ul>
        </div>
      </div>

      <div className="footer-meta">
        <span>© MMXXVI L’Affogato Italia · Bologna MCMLXXXVII</span>
        <span>Drink it. Eat the cup.</span>
        <span>Privacy · Terms · Allergens · Cookies</span>
      </div>
    </footer>
  );
}
