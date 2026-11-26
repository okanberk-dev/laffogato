"use client";

import { siteImage, type SiteImages } from "@/lib/admin/site-images-core";
import { useMemo } from "react";
import Image from "next/image";

import Link from "@/components/link";
import {
  STAMP_MIN_ORDER_MINOR,
  STAMP_STEP_MINOR,
  STAMP_TARGET,
} from "@/lib/mobile/loyalty-core";
import { GUIDES } from "@/lib/seo/guides";
import { MENU_CATEGORY_ROUTES } from "@/lib/seo/pages";
import { priceLabel } from "@/lib/utils/format";

import { AppStoreLinks } from "./app-links";
import { AppPhones, TableOrderBand } from "./app-showcase";
import { MENU, LOCATION, type Product } from "./data";
import { HomeHero } from "./home-hero";
import { keepUnits } from "./keep-units";
import {
  hourToLabel,
  type KaraokeFacts,
  type KaraokeToday,
} from "./karaoke-today";
import { MenuPhotoNote } from "./menu-photo-note";
import {
  DEFAULT_PICKUP_MINUTES,
  MENU_TAG_LABELS,
  type PageProps,
} from "./page-shared";
import { productDiscount } from "./product-facts";
import { ROUTE_PATHS, productPath, type Route } from "./route-paths";
import { splitLead } from "./split-lead";
import { useKaraokeToday } from "./use-karaoke-today";
import { useOpenStatus } from "./use-open-status";
import { MenuPlate, ProductSurface } from "./visuals";
import { canOptimizeImage } from "./local-image";

/**
 * The home page (21 Kas 2026): the film (home-hero.tsx), then the
 * reference's sequence of sections, each mapped to something the köşk
 * really offers - what is on the bar, the signature drink, the menu's
 * families, a bag to take home, the app and its stamps, the karaoke room,
 * the guides, the visit. Every figure on it comes from the panel.
 */
export function PageHome({
  navigate,
  menu,
  content,
  visit,
  settings,
  karaoke,
  products,
  images,
}: PageProps) {
  const courierEnabled = settings?.courierEnabled !== false;
  const pickupMinutes = settings?.pickupReadyMinutes ?? DEFAULT_PICKUP_MINUTES;
  const stampTarget = settings?.stampTarget ?? STAMP_TARGET;
  const liveMenu = menu ?? MENU;
  const c = (k: string, fallback: string) => content?.[k]?.trim() || fallback;

  const go = (r: Route) => (e: React.MouseEvent) => {
    e.preventDefault();
    navigate(r);
  };

  /**
   * What is on the bar today: the live cafe menu, four (eight on a wide
   * screen's two rows) items with a photo first. A cafe item has no product
   * row to check out against, so a card opens its menu category; ordering
   * is the app's.
   */
  const barItems = useMemo(() => {
    const bySlug = new Map(MENU_CATEGORY_ROUTES.map((r) => [r.menuKey, r]));
    const out: Array<{
      key: string;
      name: string;
      desc: string;
      price: string;
      priceL?: string;
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
          priceL: item.priceL,
          image: item.image,
          badge: item.tags?.map((t) => MENU_TAG_LABELS[t]).find(Boolean),
          catKey: menuKey,
          catLabel: route.breadcrumbLabel,
          href: `/menu/${route.slug}`,
        });
      }
    }
    // Photographed items lead; the order inside each group is the panel's.
    return [
      ...out.filter((i) => i.image),
      ...out.filter((i) => !i.image),
    ].slice(0, 4);
  }, [liveMenu]);

  const takeHome = useMemo(() => pickTakeHomeProduct(products), [products]);
  const karaokeToday = useKaraokeToday(!!karaoke, karaoke?.today);

  // The panel's "Ana sayfa giriş etiketi" / "giriş metni" (/admin/icerik):
  // the band under the film, first sentence as its title. An empty text
  // hides the band, as the panel's hint says.
  const introKicker = content?.["home.hero.eyebrow"]?.trim();
  const [introLead, introMore] = splitLead(content?.["home.hero.lede"] ?? "");

  const guides = useMemo(() => {
    const wanted = ["affogato-nedir", "matcha-nedir", "espresso-cesitleri"];
    const picked = wanted
      .map((slug) => GUIDES.find((g) => g.slug === slug))
      .filter((g): g is (typeof GUIDES)[number] => Boolean(g?.image));
    return (picked.length >= 2 ? picked : GUIDES.filter((g) => g.image)).slice(
      0,
      2,
    );
  }, []);

  const hours = visit?.hours ?? LOCATION.hours;
  const addressLines = visit?.addressLines ?? LOCATION.address;
  const todayHours = (visit?.todayHours ?? LOCATION.hours[0][1]).replace(
    /^Bugün kapalı$/,
    "Kapalı",
  );

  return (
    <div className="page page-home" data-screen-label="01 Home">
      <h1 className="sr-only">
        L&rsquo;Affogato - Tuzla&rsquo;da İtalyan kahve ve gelato barı. Menü,
        mağaza, karaoke ve ziyaret bilgileri
      </h1>

      <HomeHero />

      {introLead ? (
        <section
          className="section home-intro-section"
          aria-labelledby="home-intro-title"
        >
          <div className="wrap home-intro">
            {introKicker ? <p className="t-kicker">{introKicker}</p> : null}
            <h2 id="home-intro-title" className="t-display">
              {introLead.replace(/\.$/, "")}
            </h2>
            {introMore ? <p className="t-body">{introMore}</p> : null}
            <a
              href={ROUTE_PATHS.story}
              onClick={go("story")}
              className="link-u"
            >
              Hikayemiz
            </a>
          </div>
        </section>
      ) : null}

      {/* What is on the bar ───────────────────────────────────── */}
      {barItems.length > 0 && (
        <section className="section" aria-labelledby="home-bar-title">
          <div className="wrap">
            <div className="section-head">
              <h2 id="home-bar-title" className="t-display">
                Şimdi barda
              </h2>
            </div>
            <ul className="card-row" role="list">
              {barItems.map((it) => (
                <li key={it.key} className="p-card">
                  <Link className="p-card-link" href={it.href}>
                    <div className="media ratio-5-4 p-card-media">
                      <MenuPlate
                        image={it.image}
                        sizes="(max-width: 767px) 75vw, (max-width: 1200px) 33vw, 330px"
                      />
                      {it.badge ? (
                        <span className="badge">{it.badge}</span>
                      ) : null}
                    </div>
                    <div className="p-card-head">
                      <h3 className="t-title">{it.name}</h3>
                      {/\d/.test(it.price) ? (
                        <span className="t-price tabular">
                          {it.priceL ? `${it.price} / ${it.priceL}` : it.price}
                        </span>
                      ) : null}
                    </div>
                    {it.desc ? (
                      <p className="t-small p-card-sub">{it.desc}</p>
                    ) : null}
                    <p className="t-small t-muted">{it.catLabel}</p>
                  </Link>
                </li>
              ))}
            </ul>
            <MenuPhotoNote show={barItems.some((it) => it.image)} />
            <div className="section-foot">
              <a
                href={ROUTE_PATHS.menu}
                onClick={go("menu")}
                className="btn btn-wide"
              >
                Tüm menü
              </a>
            </div>
          </div>
        </section>
      )}

      {/* The signature drink ─────────────────────────────────── */}
      <section className="split section--band" aria-labelledby="home-sig-title">
        <div className="split-copy">
          <h2 id="home-sig-title" className="t-display">
            İçilir, sonra kupası yenir
          </h2>
          <p className="t-body">
            {c(
              "home.signature.body",
              "L’Affogato bir bardağa servis edilmez; o bir bardaktır. Çıtır waffle kup, iç yüzeyinde yenilebilir glaze, bir top fior di latte. Çift shot espresso masada dökülür. İçersin, yersin, geriye hiçbir şey kalmaz.",
            )}
          </p>
          <a
            href={ROUTE_PATHS.menu}
            onClick={go("menu")}
            className="btn btn-wide"
          >
            Menüyü gör
          </a>
        </div>
        <div className="split-media media">
          <Image
            src={siteImage(images, "home.signature").src}
            unoptimized={
              !canOptimizeImage(siteImage(images, "home.signature").src)
            }
            alt={siteImage(images, "home.signature").alt}
            fill
            sizes="(max-width: 1023px) 100vw, 63vw"
          />
        </div>
      </section>

      {/* The menu's families ─────────────────────────────────── */}
      <section className="section" aria-labelledby="home-cats-title">
        <div className="wrap">
          <div className="section-head">
            <h2 id="home-cats-title" className="t-display">
              Kategoriler
            </h2>
          </div>
          <ul className="tile-row" role="list">
            {HOME_TILES.map((t) => (
              <li key={t.href} className="tile">
                <Link href={t.href} className="tile-link">
                  <div className="media ratio-1">
                    <Image
                      src={t.image}
                      alt=""
                      fill
                      sizes="(max-width: 767px) 50vw, 25vw"
                    />
                  </div>
                  <h3 className="t-title">{t.title}</h3>
                  <p className="t-small">{t.sub}</p>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* A bag to take home ──────────────────────────────────── */}
      {takeHome ? <TakeHome product={takeHome} /> : null}

      {/* The karaoke room ────────────────────────────────────── */}
      {karaoke ? (
        <KaraokeBlock facts={karaoke} today={karaokeToday} images={images} />
      ) : null}

      {/* The app and its stamps ──────────────────────────────── */}
      <AppBlock
        stampTarget={stampTarget}
        courierEnabled={courierEnabled}
        tableOrderEnabled={settings?.tableOrderEnabled !== false}
        pickupMinutes={pickupMinutes}
        images={images}
      />

      {/* The visit (white), then the guides on the band, as the reference
          ends on its brew guides ─────────────────────────────────── */}
      <section className="section" aria-labelledby="home-visit-title">
        <div className="wrap">
          <div className="section-head">
            <h2 id="home-visit-title" className="t-display">
              Bizi ziyaret edin
            </h2>
          </div>
          <div className="visit-row">
            {(["home.visit.1", "home.visit.2", "home.visit.3"] as const)
              .map((key) => ({ key, ...siteImage(images, key) }))
              .map((p) => (
                <div key={p.key} className="media ratio-4-3">
                  <Image
                    src={p.src}
                    unoptimized={!canOptimizeImage(p.src)}
                    alt={p.alt}
                    fill
                    sizes="(max-width: 767px) 100vw, 33vw"
                  />
                </div>
              ))}
          </div>
          <div className="visit-card">
            <div>
              <h3 className="t-title">Tuzla köşkü</h3>
              <a
                className="link-u visit-card-address"
                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(LOCATION.mapsQuery)}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                {addressLines.join(", ")}
                <span className="sr-only"> (Google Haritalar, yeni sekme)</span>
              </a>
            </div>
            <div className="visit-card-hours">
              <p className="t-small">Bugün {todayHours}</p>
              <OpenLine hours={hours} />
            </div>
            <a
              href={ROUTE_PATHS.visit}
              onClick={go("visit")}
              className="btn btn-dark btn-wide"
            >
              Ziyaret bilgileri
            </a>
          </div>
        </div>
      </section>

      {/* The guides ──────────────────────────────────────────── */}
      {guides.length > 0 && (
        <section
          className="section section--band"
          aria-labelledby="home-guides-title"
        >
          <div className="wrap">
            <div className="section-head">
              <h2 id="home-guides-title" className="t-display">
                Rehberler
              </h2>
            </div>
            <ul className="guide-row" role="list">
              {guides.map((g) => (
                <li key={g.slug} className="guide-tile">
                  <div className="media ratio-3-2 guide-tile-media">
                    <Image
                      src={g.image!.src}
                      alt={g.image!.alt}
                      fill
                      sizes="(max-width: 767px) 100vw, 25vw"
                    />
                  </div>
                  <div className="guide-tile-body">
                    <h3 className="t-title">{g.title}</h3>
                    <p className="t-small">{g.excerpt}</p>
                    <Link className="link-u" href={`/rehber/${g.slug}`}>
                      Devamını oku
                      <span className="sr-only">: {g.title}</span>
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
            <div className="section-foot">
              <Link className="btn btn-wide" href="/rehber">
                Tüm rehberler
              </Link>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}

/** The four families under "Kategoriler": three of the menu, the shop. */
const HOME_TILES = [
  {
    href: "/menu/espresso",
    title: "Espresso",
    sub: "Sıcak kahveler, M ve L boy",
    image: "/menu/cappuccino.webp",
  },
  {
    href: "/menu/matcha",
    title: "Matcha bar",
    sub: "Ceremonial grade, siparişte çırpılır",
    image: "/menu/matcha-latte.webp",
  },
  {
    href: "/menu/tatlilar",
    title: "Tatlılar",
    sub: "San Sebastian, tiramisu, magnolia",
    image: "/menu/san-sebastian-cheesecake.webp",
  },
  {
    href: "/magaza",
    title: "Mağaza",
    sub: "Çekirdek kahve, hediye, ekipman",
    image: "/menu/espresso.webp",
  },
] as const;

/**
 * One bag from the live shop for "Evde L'Affogato": the panel's featured
 * coffee, else the espresso blend, else the first coffee in stock. None in
 * stock, or no slug to link to, and there is no section.
 */
export function pickTakeHomeProduct(
  products: readonly Product[] | undefined,
): Product | null {
  const ready = (products ?? []).filter(
    (p) =>
      p.cat === "beans" &&
      Boolean(p.slug) &&
      (p.stock === undefined || p.stock > 0),
  );
  return (
    ready.find((p) => p.featured) ??
    ready.find((p) => /espresso/i.test(`${p.name} ${p.slug ?? ""}`)) ??
    ready[0] ??
    null
  );
}

function TakeHome({ product: p }: { product: Product }) {
  const price =
    typeof p.priceMinor === "number" ? priceLabel(p.priceMinor) : p.price;
  const discount = productDiscount(p);
  return (
    <section
      className="section section--band"
      aria-labelledby="take-home-title"
    >
      <div className="wrap feature">
        <div className="feature-media media ratio-6-5">
          <ProductSurface label={p.name} images={p.images} />
        </div>
        <div className="feature-copy">
          <h2 id="take-home-title" className="t-display">
            Evde L&rsquo;Affogato
          </h2>
          <p className="t-title">{keepUnits(p.name)}</p>
          {p.desc ? <p className="t-body">{p.desc}</p> : null}
          <p className="t-price tabular">
            {discount ? (
              <span className="price-was">{discount.was}</span>
            ) : null}
            {price}
          </p>
          {/* The discount's days beside the struck price (Ticari Reklam
              Yön. m.14/1), as on the shop's own cards. */}
          {discount ? (
            <p className="t-small t-muted">{discount.notice}</p>
          ) : null}
          <Link className="btn btn-wide" href={productPath(p.slug!)}>
            Ürünü gör
          </Link>
        </div>
      </div>
    </section>
  );
}

/**
 * The app, as the reference shows its subscriptions: the pitch and its
 * button on the left, three ruled points under it, three phones beside
 * (app-showcase.tsx), then the table-order band with the section's
 * photograph.
 * Only what the app does: table and pickup ordering (the courier only while
 * Mobil → Ayarlar offers it), the stamp card at the panel's target, order
 * stages.
 */
function AppBlock({
  stampTarget,
  courierEnabled,
  tableOrderEnabled,
  pickupMinutes,
  images,
}: {
  stampTarget: number;
  courierEnabled: boolean;
  /** Mobil → Ayarlar → Masaya sipariş. Off: no table line, phone or band. */
  tableOrderEnabled: boolean;
  pickupMinutes: number;
  images?: SiteImages;
}) {
  // The stamp rule as loyalty-core counts it: one stamp per started step
  // from the minimum up (₺140-₺320 one, up to ₺640 two), app cafe orders
  // only. The same sentence as the campaigns page.
  const min = Math.round(STAMP_MIN_ORDER_MINOR / 100);
  const step = Math.round(STAMP_STEP_MINOR / 100);
  const points = [
    ...(tableOrderEnabled
      ? [
          {
            title: "Masadan sipariş",
            body: "Masandaki QR'ı okut, menüden seç, uygulamada öde. Siparişin masana gelir.",
          },
        ]
      : []),
    {
      title: `Gel-al ${pickupMinutes} dakikada`,
      body: courierEnabled
        ? "Yoldayken sipariş ver, hazır olunca telefonuna bildirim gelsin. Tuzla içi kurye de uygulamada."
        : "Yoldayken sipariş ver, hazır olunca telefonuna bildirim gelsin. Sıra beklemeden al.",
    },
    {
      title: `${stampTarget} damgada bir içecek`,
      body: `Uygulamadan verilen ${min} TL ve üzeri kafe siparişi damga kazandırır: ${step} TL'ye kadar bir, ${step * 2} TL'ye kadar iki. Dolan kart ücretsiz içecek kuponuna dönüşür.`,
    },
  ];
  const photo = siteImage(images, "home.app");
  return (
    <>
      <section
        id="uygulama"
        className="section section--band"
        aria-labelledby="home-app-title"
      >
        <div className="wrap app-block">
          <div className="app-block-copy">
            <p className="t-label">L&rsquo;Affogato uygulaması</p>
            <h2 id="home-app-title" className="t-display">
              {tableOrderEnabled
                ? "Siparişin uygulamada, kahven masanda"
                : "Siparişin uygulamada, kahven hazır"}
            </h2>
            <p className="t-body">
              {tableOrderEnabled
                ? "Masandan ya da yoldayken sipariş ver, uygulamada öde."
                : "Yoldayken sipariş ver, uygulamada öde, sıra beklemeden al."}{" "}
              Kafe siparişlerin damga toplar, kartın dolunca içecek bizden.
            </p>
            <AppStoreLinks className="app-block-store" />
            <ul className="ruled-list" role="list">
              {points.map((pt) => (
                <li key={pt.title}>
                  <h3 className="t-label">{pt.title}</h3>
                  <p className="t-body">{pt.body}</p>
                </li>
              ))}
            </ul>
            <p className="t-small t-muted">
              Uygulama ve sitede aynı üyelik. Gel-al siparişi ve karaoke odası
              Tuzla köşkü içindir.
            </p>
          </div>
          <AppPhones className="app-block-phones" table={tableOrderEnabled} />
        </div>
      </section>
      {tableOrderEnabled ? (
        <TableOrderBand
          headingId="home-table-title"
          media={
            <div className="media ratio-6-5">
              <Image
                src={photo.src}
                unoptimized={!canOptimizeImage(photo.src)}
                alt={photo.alt}
                fill
                loading="lazy"
                sizes="(max-width: 1023px) 100vw, 50vw"
              />
            </div>
          }
        >
          <p className="t-small table-order-note">
            Uygulaman yoksa QR menüyü tarayıcıda açar; sipariş vermek için
            uygulamayı indirmen yeter.
          </p>
        </TableOrderBand>
      ) : null}
    </>
  );
}

/**
 * The karaoke room, as the reference shows its cafés: a wide picture, a
 * kicker and a title under it, the facts from the panel, today's free
 * hours read live after hydration, one button.
 */
function KaraokeBlock({
  facts,
  today,
  images,
}: {
  facts: KaraokeFacts;
  today: KaraokeToday;
  images?: SiteImages;
}) {
  const lines = [
    `${facts.capacity} kişiye kadar`,
    `Gece ${hourToLabel(facts.closeHour)} kadar`,
    `Saati ${priceLabel(facts.hourlyMinor)}`,
    facts.rubyDiscountPct > 0
      ? `${facts.rubyLabel} üyelere %${facts.rubyDiscountPct} indirim`
      : null,
  ].filter((l): l is string => l !== null);
  return (
    <section className="section" aria-labelledby="home-karaoke-title">
      <div className="wrap-wide karaoke-block">
        <div className="media ratio-16-9">
          <Image
            src={siteImage(images, "home.karaoke").src}
            unoptimized={
              !canOptimizeImage(siteImage(images, "home.karaoke").src)
            }
            alt={siteImage(images, "home.karaoke").alt}
            fill
            sizes="(max-width: 1200px) 100vw, 1216px"
          />
        </div>
        <div className="karaoke-block-copy">
          <p className="t-kicker">Köşkün üst katı</p>
          <h2 id="home-karaoke-title" className="t-display">
            Karaoke odası
          </h2>
          <p className="t-body">
            200 yıllık köşkün üst katında sana ve arkadaşlarına ait bir oda.{" "}
            {facts.prepay
              ? "Saatini seç, kartınla öde, rezervasyonun hemen kesinleşsin."
              : "Saatini seç, isteğini gönder."}
          </p>
          <p className="t-small t-muted karaoke-facts">
            {lines.map((l, i) => (
              <span key={l}>
                {l}
                {i < lines.length - 1 ? " ·" : ""}
              </span>
            ))}
          </p>
          <KaraokeLive today={today} />
          <Link className="btn btn-wide" href="/karaoke">
            Saatini seç
          </Link>
        </div>
      </div>
    </section>
  );
}

/** Up to three free hours today, or where to look instead. */
function KaraokeLive({ today }: { today: KaraokeToday }) {
  switch (today.kind) {
    case "loading":
    case "error":
      return <div className="karaoke-live" aria-hidden="true" />;
    case "open":
      return (
        <div className="karaoke-live">
          <p className="t-small" id="home-karaoke-hours">
            Bugün boş saatler
          </p>
          <ul
            className="karaoke-live-chips"
            aria-labelledby="home-karaoke-hours"
          >
            {today.chips.map((chip) => (
              <li key={chip.hour}>
                <a className="tag" href={chip.href}>
                  <span className="sr-only">Bugün </span>
                  {chip.label}
                </a>
              </li>
            ))}
          </ul>
        </div>
      );
    case "full":
    case "closed":
      return (
        <div className="karaoke-live">
          <a className="link-u" href={today.tomorrowHref}>
            {today.kind === "full"
              ? "Bugün oda dolu, yarına bak"
              : "Yarın için saatini seç"}
          </a>
        </div>
      );
  }
}

/** "Şu an açık" / "Şu an kapalı", once the browser has answered. */
function OpenLine({
  hours,
}: {
  hours: ReadonlyArray<readonly [string, string]>;
}) {
  const st = useOpenStatus(hours);
  if (!st) return null;
  return (
    <p className={`open-line ${st.open ? "is-open" : "is-closed"}`}>
      {st.open ? "Şu an açık" : "Şu an kapalı"}
    </p>
  );
}
