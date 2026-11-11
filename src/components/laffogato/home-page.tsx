"use client";

import { useMemo, useRef, useState, Fragment } from "react";
import Image from "next/image";

import { STAMP_TARGET } from "@/lib/mobile/loyalty-core";
import { MENU_CATEGORY_ROUTES } from "@/lib/seo/pages";
import { priceLabel } from "@/lib/utils/format";

import { HomeAppIntro } from "./home-app-intro";
import { HomeRoast } from "./home-roast";
import { HomeKaraoke } from "./home-karaoke";
import { HomeTakeHome, pickTakeHomeProduct } from "./home-take-home";
import { Illustration } from "./illustration";
import { karaokeDoorLine } from "./karaoke-today";
import { MENU, LOCATION } from "./data";
import { MenuPhotoNote } from "./menu-photo-note";
import { RevealText } from "./reveal-text";
import { RoastPause, RoastStage } from "./roast-stage";
import { ROUTE_PATHS, type Route } from "./route-paths";
import { ScrambleText } from "./scramble-text";
import { MenuPlate } from "./visuals";
import {
  DEFAULT_PICKUP_MINUTES,
  MENU_TAG_LABELS,
  type PageProps,
} from "./page-shared";
import { splitLead } from "./split-lead";
import { useKaraokeToday } from "./use-karaoke-today";
import { useOpenStatus } from "./use-open-status";

/** The order door's second line: the courier and its fee while it runs. */
export function orderDoorSub(courierEnabled: boolean, courierFee: string) {
  return courierEnabled
    ? `Uygulamadan; Tuzla içi kurye ${courierFee}`
    : "Uygulamadan sipariş ver";
}

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
  karaoke,
  products,
}: PageProps) {
  // Operator-editable at /admin/ayarlar; the phone already reads it from
  // bootstrap, so the web quoting a constant was the odd one out.
  const courierFee = priceLabel(settings?.courierFeeMinor ?? 5500);
  // Mobil → Ayarlar → Kurye; a page rendered without settings keeps the
  // column default (offered).
  const courierEnabled = settings?.courierEnabled !== false;
  // The order and rewards shortcuts say what the panel says: Ayarlar →
  // "Gel-al hazırlık süresi" and the loyalty card's stamp count.
  const pickupMinutes = settings?.pickupReadyMinutes ?? DEFAULT_PICKUP_MINUTES;
  // Without settings, the loyalty rule's own default (loyalty-core.ts).
  const stampTarget = settings?.stampTarget ?? STAMP_TARGET;
  const c = (k: string, fallback: string) => content?.[k] ?? fallback;
  const liveMenu = menu ?? MENU;
  const railRef = useRef<HTMLDivElement>(null);
  // The shortcuts card starts open; its chevron folds the list.
  const [doorsOpen, setDoorsOpen] = useState(true);

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

  // One bag from the live shop for "Evde L'Affogato" (home-take-home.tsx);
  // none in stock, no section.
  const takeHome = useMemo(() => pickTakeHomeProduct(products), [products]);

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

  const go = (r: Route) => (e: React.MouseEvent) => {
    e.preventDefault();
    navigate(r);
  };

  // Today's karaoke calendar, read once after hydration and only where the
  // page has the room's facts: the band's chips and the karaoke door's
  // "Bugün N boş saat" share this one request.
  const karaokeToday = useKaraokeToday(!!karaoke);

  const doors: Array<{
    href: string;
    route?: Route;
    kicker: string;
    title: string;
    sub: string;
    icon: React.ReactNode;
  }> = [
    {
      href: "#uygulama",
      kicker: "Sipariş",
      title: `Gel-al · ${pickupMinutes} dk`,
      sub: orderDoorSub(courierEnabled, courierFee),
      icon: (
        <>
          <path d="M5.25 8.25h13.5l-.9 11.1a1 1 0 0 1-1 .9H7.15a1 1 0 0 1-1-.9l-.9-11.1Z" />
          <path d="M9 10.5V7.5a3 3 0 0 1 6 0v3" />
        </>
      ),
    },
    {
      href: ROUTE_PATHS.menu,
      route: "menu",
      kicker: "Menü",
      title: `${menuItemCount} lezzet`,
      sub: "Matcha barı, espresso, tatlılar",
      icon: (
        <>
          <path d="M5 8.25h11.5v4.25a5 5 0 0 1-5 5h-1.5a5 5 0 0 1-5-5V8.25Z" />
          <path d="M16.5 9.5h1.75a2.25 2.25 0 0 1 0 4.5H16.3" />
        </>
      ),
    },
    {
      href: "/uye/hesap",
      kicker: "Ödüller",
      title: `${stampTarget} damgada 1 içecek`,
      sub: "Uygulama ve web’de tek hesap",
      icon: (
        <>
          <circle cx="12" cy="12" r="7.5" />
          <path d="m9 12.2 2 2 4-4.4" />
        </>
      ),
    },
    {
      href: "/karaoke",
      kicker: "Karaoke",
      title: "Üst kat özel oda",
      sub: karaokeDoorLine(karaokeToday, karaoke),
      icon: (
        <>
          <rect x="9" y="3.75" width="6" height="10.5" rx="3" />
          <path d="M6.25 11.5a5.75 5.75 0 0 0 11.5 0M12 17.25v3" />
        </>
      ),
    },
  ];

  const addressLines = visit?.addressLines ?? LOCATION.address;
  const phone = visit?.phone ?? LOCATION.phone;
  const email = visit?.email ?? LOCATION.email;
  const hours = visit?.hours ?? LOCATION.hours;
  // app-props spells a closed day "Bugün kapalı"; the card's label already
  // says "Bugün".
  const todayHours = (visit?.todayHours ?? LOCATION.hours[0][1]).replace(
    /^Bugün kapalı$/,
    "Kapalı",
  );

  // The panel's "Hero üst etiket" / "Hero açıklama". They used to overwrite
  // the first slide's kicker and text; they are the brand's own line, so they
  // open the page under the hero instead (see the statement band below).
  const introKicker = content?.["home.hero.eyebrow"]?.trim();
  const [introLead, introMore] = splitLead(content?.["home.hero.lede"] ?? "");

  /**
   * The four doors as the frosted card of Band A: a header row that folds
   * the list, and one row per shortcut - ordering (which lives in the app,
   * so it opens the app block below), the menu, rewards, the karaoke room.
   */
  const doorsCard = (
    <div className="frost-card doors-card reveal r2">
      <div className="doors-card-head">
        <h2 id="doors-card-title" className="eyebrow">
          Kısayollar
        </h2>
        <button
          type="button"
          className="doors-card-fold"
          aria-expanded={doorsOpen}
          aria-controls="doors-card-list"
          aria-label={doorsOpen ? "Kısayolları gizle" : "Kısayolları göster"}
          onClick={() => setDoorsOpen((open) => !open)}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="m6.5 14.5 5.5-5.5 5.5 5.5" />
          </svg>
        </button>
      </div>
      <ul
        id="doors-card-list"
        className="doors-card-list"
        aria-labelledby="doors-card-title"
        hidden={!doorsOpen}
      >
        {doors.map((d) => (
          <li key={d.kicker}>
            <a
              href={d.href}
              onClick={d.route ? go(d.route) : undefined}
              className="door-row"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                {d.icon}
              </svg>
              <span className="door-row-copy">
                <span className="door-row-title">
                  <span className="sr-only">{d.kicker}: </span>
                  {d.title}
                </span>
                <span className="door-row-sub">{d.sub}</span>
              </span>
            </a>
          </li>
        ))}
      </ul>
    </div>
  );

  return (
    <div className="page" data-screen-label="01 Home">
      {/* The page's one h1. The hero's three words are a slogan, not the
          page's subject, and a home page with no h1 at all is what the
          audit found. Visually hidden; it names the business and what it
          does, which is what the heading is for. */}
      <h1 className="sr-only">
        L&apos;Affogato - Tuzla&apos;da İtalyan kahve ve gelato barı. Menü,
        mağaza, karaoke ve ziyaret bilgileri
      </h1>

      {/* The first screen: three words and a roasted bean that the scroll
          wakes (three.js, loaded after the page; the type is
          server-rendered). It is the whole entrance, as the valley was
          from 6 Kas to 11 Kas 2026: the operator's slides
          (/admin/anasayfa-hero) are not on the page. */}
      <HomeRoast
        hours={hours}
        onMenu={() => navigate("menu")}
        onVisit={() => navigate("visit")}
      />

      {/* Band A, "the pour" (docs/REDESIGN-ROAST.md §1): three stacked
          blocks under one tall live drawing, the portafilter's stream
          falling through the empty middle into the cup beside the bar
          opener. The drawing is decoration over the blocks; on a phone it
          takes a row of its own between the statement and the bar. */}
      <div className="pour-band">
        <div className="pour-top" aria-hidden="true" />

        {/* The statement - who we are: the panel's "Hero üst etiket" as
            the kicker and the first sentence of "Hero açıklama" as the
            small title (/admin/icerik), so the opener renders only when
            the panel has something to say. The four doors ride beside it
            either way. */}
        {introLead ? (
          <section className="home-intro" aria-label="L'Affogato hakkında">
            <div className="wrap home-intro-grid">
              <div className="home-intro-inner">
                <div className="opener-head">
                  <span className="ghost-n sm" aria-hidden="true">
                    02
                  </span>
                  <ScrambleText
                    as="p"
                    className="eyebrow"
                    text={introKicker || "Bölüm 2"}
                  />
                </div>
                <RevealText as="h2" className="home-intro-lead" delay={150}>
                  {introLead.replace(/\.$/, "")}
                </RevealText>
                {introMore && (
                  <p className="home-intro-text reveal">{introMore}</p>
                )}
                <div className="opener-actions reveal r1">
                  <a
                    href={ROUTE_PATHS.story}
                    onClick={go("story")}
                    className="btn btn-primary btn-sm"
                  >
                    Hikayemiz
                    <span className="arrow">→</span>
                  </a>
                </div>
              </div>
              {doorsCard}
            </div>
          </section>
        ) : (
          <section className="pour-doors" aria-label="Kısayollar">
            <div className="wrap home-intro-grid">{doorsCard}</div>
          </section>
        )}

        {/* The bar opener: the cup of the drawing on the left, the way to
            the menu on the right. */}
        <section className="pour-bar" aria-labelledby="pour-bar-title">
          <div className="wrap pour-bar-inner">
            <div className="opener pour-bar-copy">
              <ScrambleText as="p" className="eyebrow" text="Bölüm 3: Bar" />
              <RevealText
                as="h2"
                id="pour-bar-title"
                className="opener-title md"
                delay={150}
              >
                Şimdi barda
              </RevealText>
              <RevealText as="p" by="words" className="opener-text" delay={350}>
                {`Matcha barı, espresso ve tatlılar: menüde ${menuItemCount} lezzet var. Siparişini uygulamadan ver, gel-al ${pickupMinutes} dakikada hazır olsun.`}
              </RevealText>
              <div className="opener-actions reveal r1">
                <a
                  href={ROUTE_PATHS.menu}
                  onClick={go("menu")}
                  className="btn btn-primary"
                >
                  Tüm menü
                  <span className="arrow">→</span>
                </a>
              </div>
            </div>
          </div>
        </section>

        {/* The row only exists on a phone, where it carries the amber band
            behind the cup (globals.css). */}
        <div className="pour-art-row" aria-hidden="true">
          <div className="pour-art">
            <RoastStage kind="pour" />
          </div>
        </div>
        <RoastPause className="band-pause" />
      </div>

      {/* Band B, "the cup": two full-screen blocks beside one tall live
          drawing of the affogato (pushed right, spanning both): the
          signature drink, then the stamps it earns. */}
      <div className="cup-band">
        <section className="cup-block" aria-labelledby="cup-signature-title">
          <div className="wrap cup-wrap">
            <div className="dots-trio cup-dots" aria-hidden="true">
              <i className="on" />
              <i />
              <i />
            </div>
            <div className="opener cup-copy">
              <div className="opener-head">
                <span className="ghost-n" aria-hidden="true">
                  04
                </span>
                <ScrambleText
                  as="p"
                  className="eyebrow"
                  text="Bölüm 4: İmza ürün"
                />
              </div>
              {/* Two reveals in one heading: each carries its own hidden
                  copy, so the heading's name is the whole line. */}
              <h2 id="cup-signature-title" className="opener-title lg">
                <RevealText delay={150}>İçilir, sonra</RevealText>{" "}
                <RevealText className="script" delay={450}>
                  kupası yenir
                </RevealText>
              </h2>
              <RevealText as="p" by="words" className="opener-text" delay={350}>
                {c(
                  "home.signature.body",
                  "L’Affogato bir bardağa servis edilmez; o bir bardaktır. Çıtır waffle kup, iç yüzeyinde yenilebilir glaze, bir top fior di latte. Çift shot Sirena masada dökülür. İçersin, yersin, geriye hiçbir şey kalmaz.",
                )}
              </RevealText>
              <div className="stat-row reveal">
                {SIGNATURE_STATS.map((s) => (
                  <div key={s.l}>
                    <div className="stat-n">{s.n}</div>
                    <div className="stat-l">{s.l}</div>
                  </div>
                ))}
              </div>
              <div className="opener-actions reveal r1">
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

        <section className="cup-block" aria-labelledby="cup-rewards-title">
          <div className="wrap cup-wrap">
            <div className="opener cup-copy">
              <div className="opener-head">
                <span className="ghost-n" aria-hidden="true">
                  05
                </span>
                <p className="eyebrow">
                  <ScrambleText text="L’Af Ödüller" />
                  <br />
                  tek hesap
                </p>
              </div>
              <RevealText
                as="h2"
                id="cup-rewards-title"
                className="opener-title lg"
                delay={150}
              >
                {`${stampTarget} damga,`}
                <br />
                bir içecek
                <br />
                bizden
              </RevealText>
              <RevealText as="p" by="words" className="opener-text" delay={350}>
                Uygulamadan verilen 140 TL ve üzeri kafe siparişi damga
                kazandırır: 320 TL’ye kadar bir, 640 TL’ye kadar iki. Dolan kart
                90 gün geçerli ücretsiz içecek kuponuna dönüşür.
              </RevealText>
              {/* The programme explained, not a particular visitor's card -
                  this page is public and does not know who is reading it, so
                  the circles are numbered as a legend. The live card, with
                  the reader's own stamps on it, is on /uye/hesap. */}
              <div className="loyalty-block reveal" data-ground="dark">
                <div className="loyalty-card-head">
                  <span className="eyebrow caps on-dark">Damga kartı</span>
                  <span className="loyalty-tier">{stampTarget} damga</span>
                </div>
                <div className="stamp-grid" aria-hidden="true">
                  {Array.from({ length: stampTarget }, (_, i) => (
                    <div
                      key={i}
                      className={`stamp ${i < 2 ? "filled" : ""} ${i === stampTarget - 1 ? "reward" : ""}`}
                    >
                      {i === stampTarget - 1 ? (
                        <svg
                          width="18"
                          height="18"
                          viewBox="0 0 24 24"
                          fill="none"
                        >
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
              </div>
              <div className="opener-actions reveal r1">
                <a href="/uye/hesap" className="btn btn-primary">
                  Hesabımı gör
                  <span className="arrow">→</span>
                </a>
                <a href="#uygulama" className="btn btn-ghost">
                  Uygulamayı al
                </a>
              </div>
            </div>
          </div>
        </section>

        <div className="cup-art" aria-hidden="true">
          <RoastStage kind="affogato" />
        </div>
        <RoastPause className="band-pause" />
      </div>

      {/* The rest of the house, in the same language: each section opens
          with its number (a CSS counter that continues from Band B, so a
          section the panel leaves out does not leave a gap), a kicker, a
          title and a pill. */}

      {/* The karaoke room, highlighted (operator, 17 Eki 2026). */}
      {karaoke && <HomeKaraoke facts={karaoke} today={karaokeToday} />}

      {/* The banner board, pointing at /kampanyalar - the offers themselves
          are operator-managed and live there, so this is a door, not a
          second place to keep the same copy. */}
      <section className="home-section">
        <div className="wrap">
          <a
            className="promo-banner promo-banner--art reveal"
            href="/kampanyalar"
            data-ground="dark"
          >
            <span className="promo-banner-copy">
              <ScrambleText
                className="promo-banner-eyebrow bolum-kicker"
                text="Köşkte bu ay"
              />
              <RevealText className="promo-banner-title" delay={150}>
                Kampanyalar ve etkinlikler
              </RevealText>
              <span className="promo-banner-body">
                Sezon kampanyaları, iş birlikleri ve damga programı - hepsi tek
                sayfada.
              </span>
            </span>
            {/* A ticket, a strawberry and a matcha whisk: the month's
                offers, drawn. Hidden on a phone (globals.css). */}
            <Illustration name="kosk-ticket" className="promo-banner-art" />
            <span className="promo-banner-cta">
              Hepsini gör
              <span className="arrow">→</span>
            </span>
          </a>
        </div>
      </section>

      {/* Bar rail ────────────────────────────────────────────── */}
      {railItems.length > 0 && (
        <section className="home-section">
          <div className="wrap">
            <div className="rail-head">
              <div className="opener">
                <ScrambleText
                  as="p"
                  className="eyebrow bolum-kicker"
                  text="Sezon · Strawberry Aşkı"
                />
                <RevealText as="h2" className="h2" delay={150}>
                  Barda bu sezon
                </RevealText>
              </div>
              <div className="rail-controls">
                <button
                  type="button"
                  className="rail-arrow"
                  onClick={() => scrollRail(-1)}
                  aria-label="Geri kaydır"
                >
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="m14.5 6-6 6 6 6" />
                  </svg>
                </button>
                <button
                  type="button"
                  className="rail-arrow"
                  onClick={() => scrollRail(1)}
                  aria-label="İleri kaydır"
                >
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="m9.5 6 6 6-6 6" />
                  </svg>
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
                  <article className="rail-card reveal" key={it.key}>
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
                        {/* During an outage the menu arrives with every price
                            as "-" (a stale price at the counter is worse than
                            none); a lone hyphen read as a glitch here. */}
                        {/\d/.test(it.price) && (
                          <span className="rail-card-price">{it.price}</span>
                        )}
                        <a href={it.href} className="btn btn-outline btn-sm">
                          Menüde gör
                        </a>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
            <MenuPhotoNote show={railItems.some((it) => it.image)} />
          </div>
        </section>
      )}

      {/* Take home ───────────────────────────────────────────── */}
      {/* After the drink served at the köşk, the coffee to take home: one
          bag from the shop, its photo and its details on a white card. */}
      {takeHome && <HomeTakeHome product={takeHome} />}

      {/* The app ─────────────────────────────────────────────── */}
      {/* The site's door into lafmobil (home-app-intro.tsx): the copy and
          the store button beside a drawn phone, three benefit cards under
          them. */}
      <HomeAppIntro stampTarget={stampTarget} courierEnabled={courierEnabled} />

      {/* Visit ───────────────────────────────────────────────── */}
      <section className="home-section home-section-last">
        <div className="wrap visit-block">
          <div className="visit-photo reveal">
            <Image
              src="/photos/facade-night.webp"
              alt="Gece ışıklarıyla köşk cephesi"
              width={765}
              height={1020}
              sizes="(max-width: 700px) 100vw, 640px"
            />
          </div>
          <div className="opener">
            <ScrambleText
              as="p"
              className="eyebrow bolum-kicker"
              text="Ziyaret · Tuzla, İstanbul"
            />
            <RevealText as="h2" className="h2" delay={150}>
              200 yıllık köşkte, gece 02:00’e kadar
            </RevealText>
            {/* Where, when and how to reach us: the address across the
                top, today's hours with the live open/closed line beside the
                phone and e-mail (both tappable). */}
            <div className="visit-facts reveal">
              <div className="wide">
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
                <div className="visit-fact-label">Bugün</div>
                <p className="visit-fact-body">{todayHours}</p>
                <OpenLine hours={hours} />
              </div>
              <div>
                <div className="visit-fact-label">İletişim</div>
                <p className="visit-fact-body">
                  <a href={`tel:${phone.replace(/[^\d+]/g, "")}`}>{phone}</a>
                  <br />
                  <a href={`mailto:${email}`}>{email}</a>
                </p>
              </div>
            </div>
            <div className="opener-actions reveal r1">
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
                Yol tarifi al
                <span className="arrow out" aria-hidden="true">
                  ↗
                </span>
              </a>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

/**
 * "Şu an açık" / "Şu an kapalı" under today's hours in the visit block -
 * the same live answer as the hero's line (useOpenStatus), shorter: the
 * hours are printed right above it. Nothing until the browser has answered.
 */
function OpenLine({
  hours,
}: {
  hours: ReadonlyArray<readonly [string, string]>;
}) {
  const st = useOpenStatus(hours);
  if (!st) return null;
  return (
    <p className={`visit-fact-live ${st.open ? "is-open" : "is-closed"}`}>
      <span className="visit-fact-dot" aria-hidden="true" />
      {st.open ? "Şu an açık" : "Şu an kapalı"}
    </p>
  );
}
