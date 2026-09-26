"use client";

import { useRouter } from "next/navigation";

import { useMemo, useRef, Fragment } from "react";
import Image from "next/image";

import { MENU_CATEGORY_ROUTES } from "@/lib/seo/pages";
import { priceLabel } from "@/lib/utils/format";

import { AppStoreLinks } from "./app-links";
import { HomeHeroSlider } from "./home-hero-slider";
import { PourModule } from "./pour-module";
import { MENU, LOCATION, type HomeSlideAction } from "./data";
import { ROUTE_PATHS, type Route } from "./route-paths";
import { MenuPlate } from "./visuals";
import { MENU_TAG_LABELS, type PageProps } from "./page-shared";

/** What the app does that the site does not - the reasons to install it. */
const APP_FEATURES = [
  {
    title: "Siparişini ver",
    body: "gel-al ya da Tuzla içi kurye, kafe menüsünün tamamı.",
  },
  {
    title: "Damga kartın",
    body: "her kafe siparişi bir damga, altıncı içecek bizden.",
  },
  {
    title: "Kasa kodu",
    body: "kasada tek okutmayla damga ve ödül.",
  },
  {
    title: "Karaoke ve kampanyalar",
    body: "odanı ayırt, köşkte olanları ilk sen gör.",
  },
];

/** The four figures under the signature block. */
const SIGNATURE_STATS = [
  { n: "27s", l: "Masada dökülür" },
  { n: "93°C", l: "Servis sıcaklığı" },
  { n: "36g", l: "Sirena espresso" },
  { n: "∅0", l: "Atık · zero waste" },
];

export function PageHome({
  navigate,
  menu,
  content,
  visit,
  settings,
  heroImageUrl,
}: PageProps) {
  const router = useRouter();
  // Operator-editable at /admin/ayarlar; the phone already reads it from
  // bootstrap, so the web quoting a constant was the odd one out.
  const courierFee = priceLabel(settings?.courierFeeMinor ?? 5500);
  const c = (k: string, fallback: string) => content?.[k] ?? fallback;
  const liveMenu = menu ?? MENU;
  const railRef = useRef<HTMLDivElement>(null);

  /**
   * The bar rail - what is on the counter today, drawn from the live cafe
   * menu rather than the shop catalogue.
   *
   * The prototype puts a "Sepete ekle" button on each of these. The web cart
   * cannot honour that: it carries shop products, whose price and stock the
   * checkout re-reads from the products table before charging. A cafe menu
   * item has no product row to validate against, so an "add" here would be a
   * button that cannot become an order. Cafe ordering from the web is a real
   * requirement - it exists in the mobile API already
   * (`/api/mobile/v1/orders`) - but wiring the web checkout to it is a
   * commercial-path change, not a restyle. Until then the card opens the
   * item's menu category, which is a promise the site can keep.
   */
  const railItems = useMemo(() => {
    const bySlug = new Map(MENU_CATEGORY_ROUTES.map((r) => [r.menuKey, r]));
    const out: Array<{
      key: string;
      name: string;
      desc: string;
      price: string;
      hue: string;
      image?: string;
      badge?: string;
      catKey: string;
      catLabel: string;
      href: string;
    }> = [];
    for (const [menuKey, cat] of Object.entries(liveMenu)) {
      const route = bySlug.get(menuKey);
      if (!route) continue;
      for (const item of cat.items) {
        out.push({
          key: `${menuKey}:${item.name}`,
          name: item.name,
          desc: item.desc,
          price: item.price,
          hue: item.hue,
          image: item.image,
          badge: item.tags?.map((t) => MENU_TAG_LABELS[t]).find(Boolean),
          catKey: menuKey,
          catLabel: route.breadcrumbLabel,
          href: `/menu/${route.slug}`,
        });
      }
    }
    return out.slice(0, 8);
  }, [liveMenu]);

  const menuItemCount = useMemo(
    () => Object.values(liveMenu).reduce((s, cat) => s + cat.items.length, 0),
    [liveMenu],
  );

  const scrollRail = (dir: 1 | -1) => {
    const el = railRef.current;
    if (!el) return;
    const reduced = window.matchMedia?.(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    el.scrollBy({ left: dir * 306, behavior: reduced ? "auto" : "smooth" });
  };

  const onSlideAction = (action: HomeSlideAction) => {
    switch (action) {
      case "menu":
        navigate("menu");
        break;
      case "seasonMenu":
        // The Strawberry Aşkı trio lives in the matcha bar.
        router.push("/menu/matcha");
        break;
      case "signature":
        // The L'Affogato itself is a cafe menu item, not a shop product, so
        // "see the product" means its menu category.
        router.push("/menu/espresso");
        break;
      case "story":
        navigate("story");
        break;
      case "visit":
        navigate("visit");
        break;
      case "karaoke":
        router.push("/karaoke");
        break;
    }
  };

  const go = (r: Route) => (e: React.MouseEvent) => {
    e.preventDefault();
    navigate(r);
  };

  const addressLines = visit?.addressLines ?? LOCATION.address;
  const phone = visit?.phone ?? LOCATION.phone;
  const email = visit?.email ?? LOCATION.email;

  return (
    <div className="page" data-screen-label="01 Home">
      {/* The page's one h1. The hero's three slide titles rotate, so none of
          them can hold it - an h1 that changes every seven seconds is worse
          for a screen reader than no h1, and a slider-led home page with no
          h1 at all is what the audit found. Visually hidden; it names the
          business and what it does, which is what the heading is for. */}
      <h1 className="sr-only">
        L&apos;Affogato - Tuzla&apos;da İtalyan kahve ve gelato barı. Menü,
        mağaza, karaoke ve ziyaret bilgileri.
      </h1>

      <HomeHeroSlider
        onAction={onSlideAction}
        content={content}
        heroImageUrl={heroImageUrl}
      />

      {/* The reference's banner board, pointing at /kampanyalar - the offers
          themselves are operator-managed and live there, so this is a door,
          not a second place to keep the same copy. */}
      <section className="home-section">
        <div className="wrap">
          <a className="promo-banner reveal" href="/kampanyalar">
            <svg
              className="promo-banner-wave"
              viewBox="0 0 1200 220"
              preserveAspectRatio="none"
              aria-hidden="true"
            >
              <path d="M0 150 C 220 60, 420 210, 660 130 S 1000 40, 1200 96 L1200 220 L0 220 Z" />
            </svg>
            <span className="promo-banner-copy">
              <span className="promo-banner-eyebrow">Köşkte bu ay</span>
              <span className="promo-banner-title">
                Kampanyalar ve etkinlikler
              </span>
              <span className="promo-banner-body">
                Sezon kampanyaları, iş birlikleri ve damga programı - hepsi tek
                sayfada.
              </span>
            </span>
            <span className="promo-banner-cta">Hepsini gör</span>
          </a>
        </div>
      </section>

      {/* Promo tiles ─────────────────────────────────────────── */}
      {/* Four doors, each on the surface the app gives that thing: green for
          ordering (which lives in the app, so the tile opens the app block
          below rather than a menu that cannot take an order), glass for the
          menu, brass for rewards, bordo for the karaoke room. */}
      <section className="home-tiles" aria-label="Kısayollar">
        <div className="wrap">
          <div className="home-tiles-grid">
            <a href="#uygulama" className="home-tile home-tile--green">
              <span className="home-tile-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24">
                  <path d="M5.25 8.25h13.5l-.9 11.1a1 1 0 0 1-1 .9H7.15a1 1 0 0 1-1-.9l-.9-11.1Z" />
                  <path d="M9 10.5V7.5a3 3 0 0 1 6 0v3" />
                </svg>
              </span>
              <span className="home-tile-kicker">Sipariş</span>
              <span className="home-tile-body">
                <span className="home-tile-title">Gel-al · 15 dk</span>
                <span className="home-tile-sub">
                  Uygulamadan; Tuzla içi kurye {courierFee}
                </span>
              </span>
            </a>
            <a
              href={ROUTE_PATHS.menu}
              onClick={go("menu")}
              className="home-tile home-tile--glass"
            >
              <span className="home-tile-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24">
                  <path d="M5 8.25h11.5v4.25a5 5 0 0 1-5 5h-1.5a5 5 0 0 1-5-5V8.25Z" />
                  <path d="M16.5 9.5h1.75a2.25 2.25 0 0 1 0 4.5H16.3" />
                </svg>
              </span>
              <span className="home-tile-kicker">Menü</span>
              <span className="home-tile-body">
                <span className="home-tile-title">{menuItemCount} lezzet</span>
                <span className="home-tile-sub">
                  Matcha barı, espresso, tatlılar
                </span>
              </span>
            </a>
            <a href="/uye/hesap" className="home-tile home-tile--brass">
              <span className="home-tile-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24">
                  <circle cx="12" cy="12" r="7.5" />
                  <path d="m9 12.2 2 2 4-4.4" />
                </svg>
              </span>
              <span className="home-tile-kicker">Ödüller</span>
              <span className="home-tile-body">
                <span className="home-tile-title">6 damgada 1 içecek</span>
                <span className="home-tile-sub">
                  Uygulama ve web’de tek hesap
                </span>
              </span>
            </a>
            <a href="/karaoke" className="home-tile home-tile--velvet">
              <span className="home-tile-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24">
                  <rect x="9" y="3.75" width="6" height="10.5" rx="3" />
                  <path d="M6.25 11.5a5.75 5.75 0 0 0 11.5 0M12 17.25v3" />
                </svg>
              </span>
              <span className="home-tile-kicker">Karaoke</span>
              <span className="home-tile-body">
                <span className="home-tile-title">Üst kat özel oda</span>
                <span className="home-tile-sub">8 kişiye kadar · 24:00’e</span>
              </span>
            </a>
          </div>
        </div>
      </section>

      {/* Bar rail ────────────────────────────────────────────── */}
      {railItems.length > 0 && (
        <section className="home-section band-cream">
          <div className="wrap">
            <div className="rail-head">
              <div>
                <div className="eyebrow">Sezon · Strawberry Aşkı</div>
                <h2 className="h2">Şimdi barda olanlar</h2>
              </div>
              <div className="rail-controls">
                <button
                  type="button"
                  className="rail-arrow"
                  onClick={() => scrollRail(-1)}
                  aria-label="Geri kaydır"
                >
                  ‹
                </button>
                <button
                  type="button"
                  className="rail-arrow"
                  onClick={() => scrollRail(1)}
                  aria-label="İleri kaydır"
                >
                  ›
                </button>
                <a
                  href={ROUTE_PATHS.menu}
                  onClick={go("menu")}
                  className="btn btn-outline btn-sm"
                >
                  Tüm menü
                </a>
              </div>
            </div>
            <div className="rail" ref={railRef}>
              {railItems.map((it) => {
                return (
                  <article className="rail-card" key={it.key}>
                    <a
                      className="rail-card-media"
                      href={it.href}
                      aria-label={`${it.name} - menüde gör`}
                    >
                      <MenuPlate
                        hue={it.hue}
                        name={it.name}
                        cat={it.catKey}
                        image={it.image}
                      />
                      {it.badge && (
                        <span
                          className={`rail-card-badge ${it.badge === "YENİ" ? "new" : ""}`}
                        >
                          {it.badge}
                        </span>
                      )}
                    </a>
                    <div className="rail-card-body">
                      <div>
                        <span className="rail-card-cat">{it.catLabel}</span>
                        <h3 className="rail-card-name">{it.name}</h3>
                        <p className="rail-card-desc">{it.desc}</p>
                      </div>
                      <div className="rail-card-foot">
                        <span className="rail-card-price">{it.price}</span>
                        <a href={it.href} className="btn btn-outline btn-sm">
                          Menüde gör
                        </a>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* Signature ───────────────────────────────────────────── */}
      <section className="home-section">
        <div className="wrap split-2col">
          <div className="signature-photos reveal">
            <div className="signature-photo">
              <Image
                src="/photos/affogato-cup.webp"
                alt="Yenilebilir waffle kupada affogato"
                width={685}
                height={1020}
                sizes="(max-width: 700px) 50vw, 320px"
              />
            </div>
            <div className="signature-photo offset">
              <Image
                src="/photos/affogato-tray.webp"
                alt="Avluda iki affogato"
                width={765}
                height={1020}
                sizes="(max-width: 700px) 50vw, 320px"
              />
            </div>
          </div>
          <div className="reveal r1">
            <div className="eyebrow">İmza ürün · 1897’den beri</div>
            <h2 className="h2" style={{ marginTop: 14 }}>
              İçilir, sonra <span className="script">kupası yenir.</span>
            </h2>
            <p className="lede" style={{ marginTop: 18 }}>
              {c(
                "home.signature.body",
                "L’Affogato bir bardağa servis edilmez; o bir bardaktır. Çıtır waffle kup, iç yüzeyinde yenilebilir glaze, bir top fior di latte. Çift shot Sirena masada dökülür. İçersin, yersin, geriye hiçbir şey kalmaz.",
              )}
            </p>
            <div className="stat-row">
              {SIGNATURE_STATS.map((s) => (
                <div key={s.l}>
                  <div className="stat-n">{s.n}</div>
                  <div className="stat-l">{s.l}</div>
                </div>
              ))}
            </div>
            <div className="cta-row">
              <a
                href={ROUTE_PATHS.menu}
                onClick={go("menu")}
                className="btn btn-primary"
              >
                Menüyü gör
                <span className="arrow">→</span>
              </a>
              <a
                href={ROUTE_PATHS.story}
                onClick={go("story")}
                className="btn btn-ghost"
              >
                Hikayemiz
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Loyalty ─────────────────────────────────────────────── */}
      {/* The bordo signature surface - in the app the stamp card IS the
          velvet card (one per screen). */}
      <section className="home-section">
        <div className="wrap">
          <div className="loyalty-block reveal" data-ground="dark">
            <div>
              <div className="eyebrow on-dark">
                L’Af Ödüller · uygulama ve web’de tek hesap
              </div>
              <h2 className="h2" style={{ marginTop: 12 }}>
                Altı damga, bir içecek bizden.
              </h2>
              <p>
                Uygulamadan verilen her kafe siparişi bir damga. Altıncı damga
                90 gün geçerli ücretsiz içecek kuponuna dönüşür.
              </p>
              <div className="cta-row">
                <a href="/uye/hesap" className="btn btn-light">
                  Hesabımı gör
                </a>
                <a href="#uygulama" className="btn btn-glass-dark">
                  Uygulamayı al
                </a>
              </div>
            </div>
            <div className="loyalty-card">
              <div className="loyalty-card-head">
                <span className="eyebrow caps on-dark">Damga kartı</span>
                <span className="loyalty-tier">6 damga</span>
              </div>
              {/* The programme explained, not a particular visitor's card -
                  this page is public and does not know who is reading it, so
                  the circles are numbered as a legend. The live card, with the
                  reader's own stamps on it, is on /uye/hesap. */}
              <div className="stamp-grid" aria-hidden="true">
                {Array.from({ length: 6 }, (_, i) => (
                  <div
                    key={i}
                    className={`stamp ${i < 2 ? "filled" : ""} ${i === 5 ? "reward" : ""}`}
                  >
                    {i === 5 ? (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                        <path
                          d="M5 8.25h11.5v4.25a5 5 0 0 1-5 5h-1.5a5 5 0 0 1-5-5V8.25Z"
                          stroke="currentColor"
                          strokeWidth="1.7"
                          strokeLinejoin="round"
                        />
                        <path
                          d="M16.5 9.5h1.75a2.25 2.25 0 0 1 0 4.5H16.3"
                          stroke="currentColor"
                          strokeWidth="1.7"
                          strokeLinecap="round"
                        />
                      </svg>
                    ) : (
                      i + 1
                    )}
                  </div>
                ))}
              </div>
              <div className="loyalty-headline">
                Altıncı içecek bizden - hesabında biriksin.
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* The app ─────────────────────────────────────────────── */}
      {/* The site's door into lafmobil: ordering, the stamp card and the
          counter code live there. Store buttons come from
          NEXT_PUBLIC_APP_STORE_URL / _PLAY_STORE_URL; until both are set the
          block says "yakında" instead of linking nowhere. */}
      <section className="home-section" id="uygulama">
        <div className="wrap">
          <div className="app-block reveal">
            <div className="app-block-copy">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/brand/app-icon-192.png"
                alt=""
                width={64}
                height={64}
                className="app-block-icon"
              />
              <div className="eyebrow">L’Affogato uygulaması</div>
              <h2 className="h2">Köşk, cebinde.</h2>
              <ul className="app-block-list">
                {APP_FEATURES.map((f) => (
                  <li key={f.title}>
                    <span className="app-block-tick" aria-hidden="true">
                      <svg viewBox="0 0 12 12" fill="none">
                        <path
                          d="m2.5 6.2 2.2 2.2 4.8-5"
                          stroke="currentColor"
                          strokeWidth="1.8"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </span>
                    <span>
                      <strong>{f.title}</strong> - {f.body}
                    </span>
                  </li>
                ))}
              </ul>
              <AppStoreLinks />
            </div>
            <div className="app-phone" aria-hidden="true">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/brand/app-screen-home.webp"
                alt=""
                width={600}
                height={1300}
                loading="lazy"
              />
            </div>
          </div>
        </div>
      </section>

      {/* The 3D cup, demoted to a toy low on the page. */}
      {/* "Gerçeğini sipariş et" goes to the app block: cafe drinks are
          ordered in the app, not from the web menu. */}
      <PourModule
        onOrder={() =>
          document
            .getElementById("uygulama")
            ?.scrollIntoView({ behavior: "smooth", block: "start" })
        }
      />

      {/* Visit ───────────────────────────────────────────────── */}
      <section className="home-section home-section-last band-cream">
        <div className="wrap split-2col">
          <div className="visit-photo reveal">
            <Image
              src="/photos/facade-night.webp"
              alt="Gece ışıklarıyla köşk cephesi"
              width={765}
              height={1020}
              sizes="(max-width: 700px) 100vw, 640px"
            />
          </div>
          <div className="reveal r1">
            <div className="eyebrow">Ziyaret · Tuzla, İstanbul</div>
            <h2 className="h2" style={{ marginTop: 14 }}>
              200 yıllık köşkte, gece 02:00’e kadar.
            </h2>
            <div className="visit-facts">
              <div>
                <div className="visit-fact-label">Adres</div>
                <p className="visit-fact-body">
                  {addressLines.map((line, i) => (
                    <Fragment key={line}>
                      {i > 0 && <br />}
                      {line}
                    </Fragment>
                  ))}
                </p>
              </div>
              <div>
                <div className="visit-fact-label">İletişim</div>
                <p className="visit-fact-body">
                  {phone}
                  <br />
                  {email}
                </p>
              </div>
            </div>
            <div className="cta-row">
              <a
                href={ROUTE_PATHS.visit}
                onClick={go("visit")}
                className="btn btn-primary"
              >
                Ziyaret bilgileri
                <span className="arrow">→</span>
              </a>
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(LOCATION.mapsQuery)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-ghost"
              >
                Yol tarifi al ↗
              </a>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
