"use client";

import Link from "next/link";
import { useState, useEffect, useMemo, useRef, Fragment } from "react";

import { ShopHeroSlider, type ShopHeroSlide } from "./shop-hero-slider";
import {
  MENU,
  PRODUCTS,
  REELS as SEED_REELS,
  PRESS as SEED_PRESS,
  STORY,
  LOCATION,
  BRAND,
} from "./data";
import type { MenuCategory } from "./data";
import { ProductCard, SectionHead, Stat, CartItem } from "./ui";
import type { Product } from "./data";
import type { Route } from "./chrome";
import {
  BarRenderScene,
  BeanIllo,
  CoffeeBag,
  CupEmblem,
  EdibleCupHero,
  EspressoCup,
  FounderPortrait,
  GelatoScoop,
  MapPlaceholder,
  MatchaGlass,
  MenuPlate,
  PhotoSurface,
  ReelScene,
  useReveal,
} from "./visuals";

interface PageProps {
  navigate: (r: Route) => void;
  addToCart: (item: CartItem) => void;
  openProduct: (p: Product | null) => void;
  /** Live products fed from the admin store; falls back to design seed. */
  products?: Product[];
  /** Live cafe menu fed from the admin store; falls back to design seed. */
  menu?: Record<string, MenuCategory>;
  /** Admin-managed shop hero slides (PageShop kullanır). */
  shopHeroSlides?: ShopHeroSlide[];
  /** Admin-managed editorial content; undefined ise data.ts seed'ine düşer. */
  reels?: typeof SEED_REELS;
  press?: typeof SEED_PRESS;
  storyTimeline?: typeof STORY.heritage;
  /** Admin-managed editable copy (key → value); undefined ise inline fallback. */
  content?: Record<string, string>;
  /** Visit page contact block from admin settings; undefined ise LOCATION seed. */
  visit?: {
    addressLines: string[];
    phone: string;
    email: string;
    /** Opening hours for the current day (server-computed). */
    todayHours?: string;
    hours: [string, string][];
  };
}

/* ──────────────────────────────────────────────────────────────
   HOME
   ────────────────────────────────────────────────────────────── */

export function PageHome({
  navigate,
  addToCart,
  products,
  menu,
  reels,
  press,
  content,
  visit,
}: PageProps) {
  const REELS = reels ?? SEED_REELS;
  const PRESS = press ?? SEED_PRESS;
  const c = (k: string, fallback: string) => content?.[k] ?? fallback;
  useReveal();
  const shopProducts = products && products.length > 0 ? products : PRODUCTS;
  const liveMenu = menu ?? MENU;
  const go = (r: Route) => (e: React.MouseEvent) => {
    e.preventDefault();
    navigate(r);
  };

  return (
    <div className="page" data-screen-label="01 Home">
      <section className="hero hero-dark">
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "radial-gradient(58% 50% at 18% 26%, rgba(184, 138, 74, 0.15), transparent 72%)",
            pointerEvents: "none",
          }}
        />
        <div
          className="wrap"
          style={{ position: "relative", zIndex: 2, width: "100%" }}
        >
          <div className="hero-grid hero-2col">
            <div>
              <div
                className="reveal"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 12,
                }}
              >
                <span
                  aria-hidden="true"
                  style={{
                    width: 28,
                    height: 1,
                    background:
                      "linear-gradient(90deg, var(--gold), transparent)",
                  }}
                />
                <span
                  className="eyebrow on-dark"
                  style={{ color: "rgba(255,255,255,0.7)" }}
                >
                  {c("home.hero.eyebrow", "Bologna · 1987 → İstanbul · 2026")}
                </span>
              </div>
              <h1 className="h-display reveal r1" style={{ marginTop: 32 }}>
                Drink
                <br />
                it. Eat
                <br />
                the <span className="script">cup.</span>
              </h1>
              <p
                className="lede reveal r2"
                style={{
                  marginTop: 28,
                  color: "rgba(255, 255, 255, 0.72)",
                  maxWidth: 430,
                }}
              >
                {c(
                  "home.hero.lede",
                  "İtalya’dan ithal kahve barı konsepti. Tek-origin Sirena espresso’yu fior di latte gelato üzerine, 1994 patentli yenilebilir waffle kup içinde döküyoruz. Bittiğinde kaşığa gerek yok — kupu yiyorsunuz.",
                )}
              </p>
              <div
                className="reveal r3"
                style={{
                  display: "flex",
                  gap: 12,
                  flexWrap: "wrap",
                  marginTop: 40,
                }}
              >
                <Link
                  href="/menu"
                  onClick={go("menu")}
                  className="btn btn-light btn-lg"
                >
                  Menüyü gör <span className="arrow">→</span>
                </Link>
                <Link
                  href="/magaza"
                  onClick={go("shop")}
                  className="btn btn-ghost btn-lg"
                  style={{
                    color: "#FFF",
                    borderColor: "rgba(255, 255, 255, 0.3)",
                  }}
                >
                  Online sipariş
                </Link>
              </div>
              <div
                className="reveal r4"
                data-row="home-hero-stats"
                style={{
                  marginTop: 72,
                  paddingTop: 32,
                  borderTop: "1px solid rgba(255, 255, 255, 0.1)",
                }}
              >
                {[
                  ["Şube", c("home.hero.stat.branch", "Tuzla")],
                  ["Açık", visit?.todayHours ?? "10:00 — 23:00"],
                  ["Yeni", c("home.hero.stat.featured", "Strawberry Matcha")],
                ].map(([k, v]) => (
                  <div key={k}>
                    <div
                      className="eyebrow on-dark"
                      style={{ marginBottom: 8, opacity: 0.65 }}
                    >
                      {k}
                    </div>
                    <div
                      style={{
                        fontFamily: "var(--serif-display)",
                        fontSize: 18,
                      }}
                    >
                      {v}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div
              className="reveal r2"
              style={{
                aspectRatio: "4/5",
                borderRadius: "var(--r-lg)",
                overflow: "hidden",
                background: "linear-gradient(180deg, #2A1B0F, #14100B)",
                position: "relative",
                border: "1px solid rgba(255, 255, 255, 0.08)",
              }}
            >
              <PhotoSurface hue="caramel" vignette={false}>
                <div
                  style={{
                    width: "100%",
                    height: "100%",
                    display: "grid",
                    placeItems: "center",
                  }}
                >
                  <div style={{ maxWidth: "78%", maxHeight: "88%" }}>
                    <EdibleCupHero scoop="strawberry" topping="strawberry" />
                  </div>
                </div>
              </PhotoSurface>
              <div
                style={{
                  position: "absolute",
                  left: 24,
                  top: 24,
                  padding: "6px 12px",
                  background: "rgba(255, 255, 255, 0.92)",
                  borderRadius: 999,
                  fontFamily: "var(--mono)",
                  fontSize: 10,
                  letterSpacing: "0.22em",
                  textTransform: "uppercase",
                  color: "var(--ink)",
                }}
              >
                No.001 — La firma
              </div>
              <div
                style={{
                  position: "absolute",
                  left: 24,
                  bottom: 24,
                  right: 24,
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "flex-end",
                  color: "#FFF",
                  pointerEvents: "none",
                }}
              >
                <div>
                  <div className="eyebrow on-dark" style={{ marginBottom: 4 }}>
                    Affogato Strawberry
                  </div>
                  <div
                    style={{
                      fontFamily: "var(--serif)",
                      fontStyle: "normal",
                      fontSize: 28,
                      lineHeight: 1,
                    }}
                  >
                    155 ₺
                  </div>
                </div>
                <button
                  className="btn btn-light btn-sm"
                  onClick={(e) => {
                    e.preventDefault();
                    addToCart({ name: "Affogato Strawberry", price: 155 });
                  }}
                  style={{ pointerEvents: "auto" }}
                >
                  + Sepete ekle
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="section-tight" style={{ background: "var(--bg)" }}>
        <div className="wrap-wide">
          <div className="reveal" data-row="locale-head">
            <div>
              <div className="eyebrow">01 — Il locale</div>
              <h2 className="h1" style={{ marginTop: 16 }}>
                Tuzla, <span className="script">altın saat.</span>
              </h2>
            </div>
            <a href="/ziyaret" onClick={go("visit")} className="btn-link">
              Yol tarifi & saatler <span>→</span>
            </a>
          </div>
          <div
            className="reveal r1"
            style={{
              aspectRatio: "16/8",
              borderRadius: "var(--r-lg)",
              overflow: "hidden",
              border: "1px solid var(--ink-line)",
            }}
          >
            <BarRenderScene />
          </div>
          <div
            className="reveal r2"
            data-row="locale-grid"
            style={{ marginTop: 30 }}
          >
            {[
              ["Konum", "Tuzla · 200 yıllık Rum köşkü"],
              ["Kapasite", "24 koltuk · 12 bar + 12 lounge"],
              ["Saat", "Her gün · 10:00 — 23:00"],
              ["Mimari", "Studio Pellegrini"],
            ].map(([k, v]) => (
              <div key={k}>
                <div className="eyebrow" style={{ marginBottom: 6 }}>
                  {k}
                </div>
                <div
                  style={{ fontFamily: "var(--serif-display)", fontSize: 17 }}
                >
                  {v}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section">
        <div
          className="wrap"
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 80,
            alignItems: "center",
          }}
          data-row="sig-row"
        >
          <div className="reveal">
            <div className="eyebrow">02 — La firma · since 1987</div>
            <h2 className="h1" style={{ marginTop: 16 }}>
              The <span className="script">edible</span>
              <br />
              affogato.
            </h2>
            <p className="lede" style={{ marginTop: 26 }}>
              L’Affogato bir bardağa servis edilmez; o <em>bir bardaktır</em>.
              Çıtır waffle kup, iç yüzeyinde edible glaze, bir scoop fior di
              latte. Çift shot Sirena masada dökülür. İçersin, yersin, geriye
              hiçbir şey kalmaz. 1994’ten beri Mancuso ailesinin patentli
              reçetesi.
            </p>
            <div data-row="sig-stats">
              <Stat n="27s" l="Tableside pour" />
              <Stat n="93°C" l="Servis sıcaklığı" />
              <Stat n="36g" l="Sirena espresso" />
              <Stat n="∅0" l="Atık · zero waste" />
            </div>
            <div
              style={{
                display: "flex",
                gap: 12,
                marginTop: 36,
                flexWrap: "wrap",
              }}
            >
              <Link
                href="/menu"
                onClick={go("menu")}
                className="btn btn-primary"
              >
                Affogato menüsü <span className="arrow">→</span>
              </Link>
              <a
                href="/hikayemiz"
                onClick={go("story")}
                className="btn btn-ghost"
              >
                Hikayemiz
              </a>
            </div>
          </div>
          <div
            className="reveal r1"
            style={{
              aspectRatio: "4/5",
              borderRadius: "var(--r-lg)",
              overflow: "hidden",
            }}
          >
            <PhotoSurface hue="dawn" dotLabel="Tableside · 19:00" dotPos="tr">
              <div
                style={{
                  width: "100%",
                  height: "100%",
                  display: "grid",
                  placeItems: "center",
                  padding: 30,
                }}
              >
                <EdibleCupHero scoop="cream" topping="wafer" />
              </div>
            </PhotoSurface>
          </div>
        </div>
      </section>

      <section className="section" style={{ background: "var(--bg-warm)" }}>
        <div className="wrap">
          <div className="reveal" data-row="section-head-split">
            <div>
              <div className="eyebrow">03 — Dal menù</div>
              <h2 className="h1" style={{ marginTop: 16 }}>
                Altı <span className="script">affogato,</span>
                <br />
                tek ritüel.
              </h2>
            </div>
            <Link href="/menu" onClick={go("menu")} className="btn-link">
              Tam menü <span>→</span>
            </Link>
          </div>
          <div className="shop-grid-preview">
            {(liveMenu.affogato?.items ?? MENU.affogato.items)
              .slice(0, 3)
              .map((it, i) => (
                <div
                  key={it.name}
                  className="product-card reveal"
                  style={{ transitionDelay: `${i * 80}ms` }}
                >
                  <div className="product-card-img">
                    <MenuPlate hue={it.hue} name={it.name} />
                    {it.tags?.includes("new") && (
                      <div className="product-card-flag new">NUOVO</div>
                    )}
                    {it.tags?.includes("signature") && (
                      <div className="product-card-flag gold">FIRMA</div>
                    )}
                  </div>
                  <div className="product-card-meta">
                    <div className="product-card-cat">
                      Affogato · No.{String(i + 1).padStart(2, "0")}
                    </div>
                    <h3 className="product-card-name">{it.name}</h3>
                    <p
                      style={{
                        fontSize: 13,
                        lineHeight: 1.55,
                        color: "var(--ink-soft)",
                        margin: "6px 0 12px",
                        minHeight: 40,
                      }}
                    >
                      {it.desc}
                    </p>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                    >
                      <div className="product-card-price">{it.price}</div>
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={(e) => {
                          e.preventDefault();
                          addToCart({
                            name: it.name,
                            price: parseFloat(it.price),
                          });
                        }}
                      >
                        + Ekle
                      </button>
                    </div>
                  </div>
                </div>
              ))}
          </div>
        </div>
      </section>

      <section className="section">
        <div
          className="wrap"
          style={{
            display: "grid",
            gridTemplateColumns: "1.05fr 0.95fr",
            gap: 80,
            alignItems: "center",
          }}
          data-row="matcha-row"
        >
          <div className="reveal r1" data-row="matcha-imgs">
            <div
              style={{
                aspectRatio: "4/5",
                borderRadius: "var(--r-lg)",
                overflow: "hidden",
              }}
            >
              <PhotoSurface
                hue="matcha"
                dotLabel="Uji · ceremonial"
                dotPos="bl"
              >
                <div
                  style={{
                    width: "100%",
                    height: "100%",
                    display: "grid",
                    placeItems: "center",
                    padding: 24,
                  }}
                >
                  <MatchaGlass />
                </div>
              </PhotoSurface>
            </div>
            <div
              style={{
                aspectRatio: "4/5",
                borderRadius: "var(--r-lg)",
                overflow: "hidden",
                marginTop: 50,
              }}
            >
              <PhotoSurface hue="rose" dotLabel="Strawberry · yaz" dotPos="bl">
                <div
                  style={{
                    width: "100%",
                    height: "100%",
                    display: "grid",
                    placeItems: "center",
                    padding: 24,
                  }}
                >
                  <MatchaGlass strawberry />
                </div>
              </PhotoSurface>
            </div>
          </div>
          <div className="reveal">
            <div className="eyebrow">04 — Il banco matcha</div>
            <h2 className="h1" style={{ marginTop: 16 }}>
              Matcha & <span className="script">strawberry.</span>
            </h2>
            <p className="lede" style={{ marginTop: 26 }}>
              Tuzla için yaz menüsü — Japonya Uji’dan ceremonial grade matcha,
              bambu chasen ile dövülmüş, ipeksi süt katmanları, taze çilek
              püresi. Sıcak veya buzlu; bardakta veya yenilebilir waffle kupta.
            </p>
            <div
              style={{
                marginTop: 30,
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 20,
              }}
            >
              {(liveMenu.matcha?.items ?? MENU.matcha.items)
                .slice(0, 4)
                .map((it) => (
                  <div
                    key={it.name}
                    style={{
                      padding: "20px 0",
                      borderTop: "1px solid var(--ink-line)",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "baseline",
                      }}
                    >
                      <div
                        style={{
                          fontFamily: "var(--serif-display)",
                          fontSize: 18,
                        }}
                      >
                        {it.name}
                      </div>
                      <div
                        style={{
                          fontFamily: "var(--mono)",
                          fontSize: 13,
                          color: "var(--gold-deep)",
                        }}
                      >
                        {it.price}
                      </div>
                    </div>
                    <div
                      style={{
                        fontSize: 12,
                        color: "var(--ink-mute)",
                        marginTop: 6,
                        lineHeight: 1.5,
                      }}
                    >
                      {it.desc}
                    </div>
                  </div>
                ))}
            </div>
            <Link
              href="/menu"
              onClick={go("menu")}
              className="btn btn-primary"
              style={{ marginTop: 36 }}
            >
              Tüm matcha menüsü <span className="arrow">→</span>
            </Link>
          </div>
        </div>
      </section>

      <section className="section" style={{ background: "var(--bg-warm)" }}>
        <div className="wrap">
          <div className="reveal" data-row="section-head-split">
            <div>
              <div className="eyebrow">05 — La bottega</div>
              <h2 className="h1" style={{ marginTop: 16 }}>
                Bring it <span className="script">home.</span>
              </h2>
            </div>
            <Link href="/magaza" onClick={go("shop")} className="btn-link">
              Shop <span>→</span>
            </Link>
          </div>
          <div className="shop-grid">
            {shopProducts.slice(0, 4).map((p, i) => (
              <ProductCard
                key={p.name}
                product={p}
                idx={i}
                addToCart={addToCart}
              />
            ))}
          </div>
        </div>
      </section>

      <section
        className="section"
        style={{ background: "var(--bg-espresso)", color: "#FFF" }}
      >
        <div className="wrap-wide">
          <div className="reveal" data-row="section-head-split">
            <div>
              <div className="eyebrow on-dark">06 — Il film</div>
              <h2 className="h1" style={{ marginTop: 16, color: "#FFF" }}>
                Barın arkasında, <span className="script">sahnede.</span>
              </h2>
            </div>
            <a
              href="/reels"
              onClick={go("reels")}
              className="btn-link"
              style={{ color: "#FFF", borderColor: "#FFF" }}
            >
              Tüm reels <span>→</span>
            </a>
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(4, 1fr)",
              gap: 18,
            }}
            data-row="reels-row"
          >
            {REELS.slice(0, 4).map((r, i) => (
              <a
                key={i}
                href="/reels"
                onClick={go("reels")}
                className="reveal"
                style={{
                  aspectRatio: "9/16",
                  borderRadius: "var(--r-md)",
                  overflow: "hidden",
                  position: "relative",
                  cursor: "pointer",
                  transitionDelay: `${i * 60}ms`,
                }}
              >
                <ReelScene variant={i} />
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    background:
                      "linear-gradient(180deg, transparent 50%, rgba(0,0,0,0.6) 100%)",
                    padding: 18,
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "flex-end",
                  }}
                >
                  <div
                    style={{
                      fontFamily: "var(--serif-display)",
                      fontSize: 15,
                      lineHeight: 1.2,
                    }}
                  >
                    {r.caption}
                  </div>
                  <div
                    style={{
                      display: "flex",
                      gap: 12,
                      marginTop: 6,
                      fontFamily: "var(--mono)",
                      fontSize: 10,
                      letterSpacing: "0.18em",
                      textTransform: "uppercase",
                      opacity: 0.78,
                    }}
                  >
                    <span>{r.meta.split("·")[0].trim()}</span>
                    <span>{r.meta.split("·")[1].trim()}</span>
                  </div>
                </div>
              </a>
            ))}
          </div>
        </div>
      </section>

      <section
        className="section-tight"
        style={{ background: "var(--bg-warm)" }}
      >
        <div className="wrap">
          <div
            className="eyebrow reveal"
            style={{ textAlign: "center", marginBottom: 50 }}
          >
            Basın · Hakkımızda yazılanlar
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(4, 1fr)",
              gap: 30,
            }}
            data-row="press-row"
          >
            {PRESS.map((p, i) => (
              <div
                key={p.name}
                className="reveal"
                style={{
                  transitionDelay: `${i * 60}ms`,
                  padding: 28,
                  background: "#FFF",
                  borderRadius: "var(--r-md)",
                }}
              >
                <div
                  style={{
                    fontFamily: "var(--serif-display)",
                    fontSize: 18,
                    marginBottom: 14,
                  }}
                >
                  {p.name}
                </div>
                <div
                  style={{
                    fontFamily: "var(--serif)",
                    fontStyle: "normal",
                    fontSize: 15,
                    lineHeight: 1.4,
                    color: "var(--ink-soft)",
                  }}
                >
                  “{p.quote}”
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────
   MENU
   ────────────────────────────────────────────────────────────── */

export function PageMenu({ menu }: PageProps) {
  useReveal();
  const liveMenu = menu ?? MENU;
  const cats = Object.keys(liveMenu);
  const [active, setActive] = useState<string>("all");
  const [query, setQuery] = useState("");
  const controlsRef = useRef<HTMLDivElement>(null);

  // Restaurant-menu feel: tapping a category brings the freshly filtered list
  // up under the sticky bar instead of leaving the guest stranded mid-scroll.
  const selectCat = (key: string) => {
    setActive(key);
    const el = controlsRef.current;
    if (!el) return;
    const top = el.getBoundingClientRect().top + window.scrollY - 64;
    if (window.scrollY > top + 4) window.scrollTo({ top, behavior: "smooth" });
  };

  const totalCount = Object.values(liveMenu).reduce(
    (s, c) => s + c.items.length,
    0,
  );
  const visible = active === "all" ? cats : [active];

  // Self-servis görüntüleme menüsü — yalnızca arama + kategoriyle süzülür
  // (sepet yok). Boş kategoriler gizlenir.
  const sections = useMemo(() => {
    const q = query.trim().toLowerCase();
    return visible
      .map((key) => {
        const c = liveMenu[key];
        const items = !q
          ? c.items
          : c.items.filter(
              (it) =>
                it.name.toLowerCase().includes(q) ||
                it.desc.toLowerCase().includes(q),
            );
        return { key, c, items };
      })
      .filter((s) => s.items.length > 0);
  }, [visible, liveMenu, query]);

  return (
    <div className="page" data-screen-label="02 Menu">
      {/* ── Sinematik koyu hero + self-servis QR kartı ── */}
      <header className="menu-hero">
        <div className="menu-hero-glow" aria-hidden="true" />
        <div className="wrap menu-hero-inner">
          <div className="menu-hero-copy reveal">
            <div className="menu-hero-eyebrow">
              <span className="menu-hero-pip" />
              <span>II — Menü · Summer 2026</span>
            </div>
            <h1 className="menu-hero-title">
              Genel <span className="script">menü.</span>
            </h1>
            <p className="menu-hero-lede">
              Bologna 1987 reçetesi, Tuzla köşkü için sezonluk matcha bar ve
              buzlu içecekler. Üç ritüel — espresso, gelato, yenilebilir kup. 39
              yıldır değişmedi.
            </p>
            <div className="menu-hero-stats">
              <div>
                <b>{totalCount}</b>
                <span>lezzet</span>
              </div>
              <div>
                <b>{cats.length}</b>
                <span>ritüel</span>
              </div>
              <div>
                <b>~4dk</b>
                <span>hazırlık</span>
              </div>
              <div>
                <b>06:00</b>
                <span>taze gelato</span>
              </div>
            </div>
          </div>

        </div>
      </header>

      {/* ── Sticky kontrol çubuğu: kategoriler + arama + görünüm + diyet ── */}
      <div className="menu-controls" ref={controlsRef}>
        <div className="wrap menu-controls-inner">
          <div
            className="menu-tabs"
            role="tablist"
            aria-label="Menü kategorileri"
          >
            <button
              className={`menu-tab ${active === "all" ? "on" : ""}`}
              onClick={() => selectCat("all")}
            >
              <span>Tümü</span>
              <span className="count">{totalCount}</span>
            </button>
            {cats.map((c) => (
              <button
                key={c}
                className={`menu-tab ${active === c ? "on" : ""}`}
                onClick={() => selectCat(c)}
              >
                <span>{liveMenu[c].title}</span>
                <span className="count">{liveMenu[c].items.length}</span>
              </button>
            ))}
          </div>
          <div className="menu-tools">
            <div className="menu-search">
              <svg
                width="15"
                height="15"
                viewBox="0 0 16 16"
                fill="none"
                aria-hidden="true"
              >
                <circle
                  cx="7"
                  cy="7"
                  r="5"
                  stroke="currentColor"
                  strokeWidth="1.4"
                />
                <path
                  d="M11 11 L14 14"
                  stroke="currentColor"
                  strokeWidth="1.4"
                  strokeLinecap="round"
                />
              </svg>
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Menüde ara…"
                aria-label="Menüde ara"
              />
              {query && (
                <button
                  className="menu-search-clear"
                  onClick={() => setQuery("")}
                  aria-label="Aramayı temizle"
                >
                  ×
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Boş sonuç ── */}
      {sections.length === 0 && (
        <section className="section-tight">
          <div className="wrap menu-empty">
            <div className="menu-empty-mark">∅</div>
            <h2
              className="h2"
              style={{ fontFamily: "var(--serif)", fontStyle: "normal" }}
            >
              Aradığın tatla eşleşen ürün yok.
            </h2>
            <p style={{ color: "var(--ink-mute)", marginTop: 10 }}>
              Farklı bir kelime dene ya da filtreleri sıfırla.
            </p>
            <button
              className="btn btn-ghost"
              style={{ marginTop: 22 }}
              onClick={() => {
                setQuery("");
                setActive("all");
              }}
            >
              Filtreleri temizle
            </button>
          </div>
        </section>
      )}

      {/* ── Kategoriler ── */}
      {sections.map(({ key, c, items }, idx) => {
        const firstWord = c.title.split(" ")[0];
        const restWords = c.title.split(" ").slice(1).join(" ");
        return (
          <section
            key={key}
            className="menu-category section-tight"
            style={{ background: idx % 2 === 1 ? "var(--bg-warm)" : "#FFF" }}
          >
            <div className="wrap">
              <div className="menu-cat-hero reveal">
                <div className="menu-cat-info">
                  <div className="menu-cat-index">
                    {String(idx + 1).padStart(2, "0")}
                  </div>
                  <div className="eyebrow" style={{ marginBottom: 16 }}>
                    {c.sub}
                  </div>
                  <h2 className="h1">
                    {firstWord}
                    {restWords && (
                      <>
                        {" "}
                        <span className="script">{restWords}</span>
                      </>
                    )}
                  </h2>
                  <div className="menu-cat-italian">{c.italian}</div>
                  {c.note && <p className="menu-cat-note">{c.note}</p>}
                </div>
                <div className="menu-cat-hero-img">
                  <PhotoSurface
                    hue={items[0].hue || "warm"}
                    dotLabel={`${String(idx + 1).padStart(2, "0")} / ${sections.length.toString().padStart(2, "0")}`}
                    dotPos="tr"
                  >
                    <div
                      style={{
                        width: "100%",
                        height: "100%",
                        display: "grid",
                        placeItems: "center",
                        padding: 30,
                      }}
                    >
                      <MenuPlate hue={items[0].hue} name={items[0].name} />
                    </div>
                  </PhotoSurface>
                </div>
              </div>

              <div className="menu-grid">
                {items.map((it, i) => (
                  <article
                    key={it.name}
                    className="menu-item-card reveal"
                    style={{ transitionDelay: `${(i % 4) * 60}ms` }}
                  >
                    <div className="menu-item-img">
                      <MenuPlate hue={it.hue} name={it.name} />
                      {it.tags?.includes("signature") && (
                        <div className="product-card-flag gold">FIRMA</div>
                      )}
                      {it.tags?.includes("new") &&
                        !it.tags.includes("signature") && (
                          <div className="product-card-flag new">NUOVO</div>
                        )}
                    </div>
                    <div className="menu-item-body">
                      <div className="menu-item-row">
                        <h3 className="menu-item-name">{it.name}</h3>
                        <div className="menu-item-price">{it.price}</div>
                      </div>
                      <p className="menu-item-desc">{it.desc}</p>
                      {(it.tags ?? []).filter(
                        (t) => !["signature", "new"].includes(t),
                      ).length > 0 && (
                        <div className="menu-item-tags">
                          {(it.tags ?? [])
                            .filter((t) => !["signature", "new"].includes(t))
                            .map((t) => (
                              <span key={t} className="chip chip-outline">
                                {t}
                              </span>
                            ))}
                        </div>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            </div>
          </section>
        );
      })}

      {/* ── Bilgi notları ── */}
      <section
        className="section-tight"
        style={{ background: "var(--bg-cream)" }}
      >
        <div
          className="wrap"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gap: 40,
          }}
          data-row="menu-notes"
        >
          <div className="reveal">
            <div className="eyebrow">Self-servis</div>
            <p
              style={{
                marginTop: 14,
                fontSize: 14,
                lineHeight: 1.65,
                color: "var(--ink-soft)",
              }}
            >
              Menüye buradan göz at, beğendiğini barda söyle. Sipariş ve servis
              bardan verilir — self-servis, garson beklemeden.
            </p>
          </div>
          <div className="reveal r1">
            <div className="eyebrow">Alerjenler</div>
            <p
              style={{
                marginTop: 14,
                fontSize: 14,
                lineHeight: 1.65,
                color: "var(--ink-soft)",
              }}
            >
              Süt, gluten, kuruyemiş, soya — mutfağımızda çapraz temas olabilir.
              Cölyak için baristaya bildirin, pirinç bisküvili alternatif
              hazırlarız.
            </p>
          </div>
          <div className="reveal r2">
            <div className="eyebrow">Köken</div>
            <p
              style={{
                marginTop: 14,
                fontSize: 14,
                lineHeight: 1.65,
                color: "var(--ink-soft)",
              }}
            >
              Espresso: Sirena harmanı (Bologna kavurma). Matcha: Uji ceremonial
              grade. Pistacchio: Bronte IGP. Süt: Tuzla yerel mandıra.
            </p>
          </div>
          <div className="reveal r3">
            <div className="eyebrow">Servis</div>
            <p
              style={{
                marginTop: 14,
                fontSize: 14,
                lineHeight: 1.65,
                color: "var(--ink-soft)",
              }}
            >
              Bar köşesi 6 koltuk yürüyüş trafiği için ayrı. Akşam 19:00 sonrası
              rezervasyon. Köpekler hoş geldi.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────
   SHOP
   ────────────────────────────────────────────────────────────── */

function ShopBadge({ icon, k, v }: { icon: string; k: string; v: string }) {
  return (
    <div
      style={{
        padding: 18,
        background: "var(--bg-warm)",
        borderRadius: "var(--r-md)",
      }}
    >
      <div style={{ fontSize: 20, color: "var(--gold)", marginBottom: 10 }}>
        {icon}
      </div>
      <div className="eyebrow" style={{ marginBottom: 6 }}>
        {k}
      </div>
      <div style={{ fontFamily: "var(--serif-display)", fontSize: 15 }}>
        {v}
      </div>
    </div>
  );
}

export function PageShop({
  addToCart,
  openProduct,
  products,
  shopHeroSlides,
}: PageProps) {
  useReveal();
  const shopProducts = products && products.length > 0 ? products : PRODUCTS;
  const slides = shopHeroSlides ?? [];
  const [cat, setCat] = useState<string>("all");
  const [sort, setSort] = useState<string>("featured");
  const [priceMin, setPriceMin] = useState(0);
  const [priceMax, setPriceMax] = useState(900);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const cats = [
    { id: "all", label: "Hepsi", icon: "◯" },
    { id: "beans", label: "Çekirdek", icon: "◉" },
    { id: "gift", label: "Hediye", icon: "◈" },
    { id: "gear", label: "Ekipman", icon: "◇" },
    { id: "merch", label: "Giyim", icon: "◐" },
    { id: "pantry", label: "Kiler", icon: "◇" },
  ];

  let list = shopProducts.filter((p) => cat === "all" || p.cat === cat);
  list = list.filter((p) => {
    const price = parseFloat(p.price);
    return price >= priceMin && price <= priceMax;
  });
  if (sort === "price-asc")
    list = [...list].sort((a, b) => parseFloat(a.price) - parseFloat(b.price));
  if (sort === "price-desc")
    list = [...list].sort((a, b) => parseFloat(b.price) - parseFloat(a.price));

  const priceTouched = priceMin > 0 || priceMax < 900;
  const activeFilterCount = (cat !== "all" ? 1 : 0) + (priceTouched ? 1 : 0);

  const resetFilters = () => {
    setCat("all");
    setPriceMin(0);
    setPriceMax(900);
  };

  // Lock body scroll while the mobile filter sheet is open.
  useEffect(() => {
    if (filtersOpen) document.body.classList.add("is-no-scroll");
    else document.body.classList.remove("is-no-scroll");
    return () => document.body.classList.remove("is-no-scroll");
  }, [filtersOpen]);

  // Filter controls — shared by the desktop sidebar and the mobile sheet.
  const renderFilters = () => (
    <>
      <div className="shop-filter-block">
        <div className="eyebrow" style={{ marginBottom: 14 }}>
          Kategoriler
        </div>
        <div className="shop-cat-list">
          {cats.map((c) => {
            const count =
              c.id === "all"
                ? shopProducts.length
                : shopProducts.filter((p) => p.cat === c.id).length;
            return (
              <button
                key={c.id}
                className={`shop-cat ${cat === c.id ? "on" : ""}`}
                onClick={() => setCat(c.id)}
              >
                <span>{c.label}</span>
                <span className="count">{count}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="shop-filter-block">
        <div className="eyebrow" style={{ marginBottom: 14 }}>
          Fiyat aralığı
        </div>
        <div
          style={{ fontFamily: "var(--mono)", fontSize: 13, marginBottom: 16 }}
        >
          {priceMin}₺ — {priceMax}₺
        </div>
        <div style={{ position: "relative", height: 28 }}>
          <div
            style={{
              position: "absolute",
              top: 12,
              left: 0,
              right: 0,
              height: 2,
              background: "var(--ink-line)",
            }}
          />
          <div
            style={{
              position: "absolute",
              top: 12,
              left: `${(priceMin / 900) * 100}%`,
              right: `${100 - (priceMax / 900) * 100}%`,
              height: 2,
              background: "var(--ink)",
            }}
          />
          <input
            type="range"
            min="0"
            max="900"
            step="20"
            value={priceMin}
            onChange={(e) =>
              setPriceMin(Math.min(parseInt(e.target.value), priceMax - 40))
            }
            className="price-range"
            aria-label="En düşük fiyat"
            style={{ position: "absolute", top: 0, left: 0, right: 0 }}
          />
          <input
            type="range"
            min="0"
            max="900"
            step="20"
            value={priceMax}
            onChange={(e) =>
              setPriceMax(Math.max(parseInt(e.target.value), priceMin + 40))
            }
            className="price-range"
            aria-label="En yüksek fiyat"
            style={{ position: "absolute", top: 0, left: 0, right: 0 }}
          />
        </div>
      </div>

      <div className="shop-filter-block">
        <div className="eyebrow" style={{ marginBottom: 14 }}>
          Etiketler
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {[
            "Yeni",
            "Limited",
            "En çok satan",
            "Bologna import",
            "Gift ready",
          ].map((t) => (
            <span key={t} className="chip" style={{ cursor: "pointer" }}>
              {t}
            </span>
          ))}
        </div>
      </div>

      <div className="shop-filter-block" style={{ borderTop: 0 }}>
        <div className="shop-helpline">
          <div className="eyebrow" style={{ marginBottom: 10 }}>
            Yardım
          </div>
          <div
            style={{
              fontFamily: "var(--serif)",
              fontStyle: "normal",
              fontSize: 22,
              lineHeight: 1.2,
            }}
          >
            Hangi çekirdek?
          </div>
          <p
            style={{
              fontSize: 13,
              color: "var(--ink-soft)",
              marginTop: 10,
              lineHeight: 1.55,
            }}
          >
            Espresso mu, filtre mi karar veremediysen — barista chat’i aç, sana
            yardımcı olalım.
          </p>
          <button
            className="btn btn-ghost btn-sm"
            style={{ marginTop: 16, width: "100%", justifyContent: "center" }}
          >
            Chat’i aç <span className="arrow">→</span>
          </button>
        </div>
      </div>
    </>
  );

  return (
    <div className="page" data-screen-label="03 Shop">
      {slides.length > 0 && <ShopHeroSlider slides={slides} />}
      <header className="page-head shop-head-wrap" id="products">
        <div className="wrap">
          <div
            className="reveal"
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 0.95fr",
              gap: 60,
              alignItems: "end",
            }}
            data-row="shop-head"
          >
            <div>
              <div className="eyebrow">III — La bottega</div>
              <h1 className="h1" style={{ marginTop: 24 }}>
                <span className="script">Mağaza.</span>
              </h1>
              <p className="lede" style={{ marginTop: 22 }}>
                Tuzla köşkünde servis ettiğimiz her şey — Bologna’da kavrulan
                çekirdek, 1994 patentli edible kup, bambu chasen, Bialetti ×
                L’Affogato moka pot. Eve, ofise, hediyeye.
              </p>
            </div>
            <div data-row="shop-badges">
              <ShopBadge icon="↗" k="Aynı gün" v="İstanbul içi" />
              <ShopBadge icon="✦" k="Free shipping" v="500₺+ siparişte" />
              <ShopBadge icon="↻" k="14 gün iade" v="Açılmamış ürün" />
            </div>
          </div>
        </div>
      </header>

      {/* ── Mobil yapışkan kontrol çubuğu: kategori pill'leri + filtre + sırala ── */}
      <div className="shop-mobilebar">
        <div
          className="shop-mobilebar-cats"
          role="tablist"
          aria-label="Ürün kategorileri"
        >
          {cats.map((c) => {
            const count =
              c.id === "all"
                ? shopProducts.length
                : shopProducts.filter((p) => p.cat === c.id).length;
            return (
              <button
                key={c.id}
                className={`shop-pill ${cat === c.id ? "on" : ""}`}
                onClick={() => setCat(c.id)}
              >
                {c.label}
                <span className="shop-pill-count">{count}</span>
              </button>
            );
          })}
        </div>
        <div className="shop-mobilebar-actions">
          <button
            className="shop-filter-trigger"
            onClick={() => setFiltersOpen(true)}
          >
            <svg
              width="15"
              height="15"
              viewBox="0 0 16 16"
              fill="none"
              aria-hidden="true"
            >
              <path
                d="M2 4 H14 M4 8 H12 M6 12 H10"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
            Filtrele
            {activeFilterCount > 0 && (
              <span className="shop-filter-badge">{activeFilterCount}</span>
            )}
          </button>
          <label className="shop-sort-inline">
            <span className="eyebrow">Sırala</span>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value)}
              aria-label="Sırala"
            >
              <option value="featured">Önerilen</option>
              <option value="price-asc">Fiyat ↑</option>
              <option value="price-desc">Fiyat ↓</option>
              <option value="new">Yeni</option>
            </select>
          </label>
        </div>
      </div>

      <section className="section-tight">
        <div className="wrap-wide shop-layout">
          <aside className="shop-sidebar reveal">{renderFilters()}</aside>

          <div className="shop-main">
            <div className="shop-toolbar reveal">
              <div style={{ fontFamily: "var(--serif-display)", fontSize: 18 }}>
                <span
                  style={{ fontFamily: "var(--serif)", fontStyle: "normal" }}
                >
                  {list.length}
                </span>{" "}
                ürün
                {cat !== "all" && (
                  <>
                    {" "}
                    ·{" "}
                    <span style={{ color: "var(--ink-mute)" }}>
                      {cats.find((c) => c.id === cat)?.label}
                    </span>
                  </>
                )}
              </div>
              <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                <span className="eyebrow">Sırala</span>
                <select
                  className="select"
                  value={sort}
                  onChange={(e) => setSort(e.target.value)}
                  style={{ width: "auto", padding: "8px 14px", fontSize: 13 }}
                >
                  <option value="featured">Önerilen</option>
                  <option value="price-asc">Fiyat ↑</option>
                  <option value="price-desc">Fiyat ↓</option>
                  <option value="new">Yeni</option>
                </select>
              </div>
            </div>

            <div className="shop-grid-3">
              {list.map((p, i) => (
                <ProductCard
                  key={p.name}
                  product={p}
                  idx={i}
                  addToCart={addToCart}
                  onOpen={openProduct}
                />
              ))}
            </div>

            {list.length === 0 && (
              <div style={{ textAlign: "center", padding: "80px 20px" }}>
                <div
                  style={{
                    fontFamily: "var(--serif)",
                    fontStyle: "normal",
                    fontSize: 36,
                  }}
                >
                  Bu filtreyle ürün yok.
                </div>
                <button
                  className="btn btn-ghost"
                  style={{ marginTop: 24 }}
                  onClick={resetFilters}
                >
                  Filtreleri temizle
                </button>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ── Mobil filtre alt-sayfası (bottom sheet) ── */}
      <div
        className={`shop-sheet-overlay ${filtersOpen ? "open" : ""}`}
        onClick={() => setFiltersOpen(false)}
        aria-hidden={!filtersOpen}
      />
      <div
        className={`shop-sheet ${filtersOpen ? "open" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label="Filtreler"
      >
        <div className="shop-sheet-grip" aria-hidden="true" />
        <header className="shop-sheet-head">
          <div>
            <div className="eyebrow" style={{ marginBottom: 4 }}>
              Filtrele & sırala
            </div>
            <div
              style={{
                fontFamily: "var(--serif)",
                fontStyle: "normal",
                fontSize: 22,
                lineHeight: 1,
              }}
            >
              {list.length} ürün
            </div>
          </div>
          <button
            onClick={() => setFiltersOpen(false)}
            className="nav-icon-btn"
            aria-label="Kapat"
          >
            <svg width="14" height="14" viewBox="0 0 16 16">
              <path
                d="M3 3 L13 13 M13 3 L3 13"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </header>
        <div className="shop-sheet-body">{renderFilters()}</div>
        <footer className="shop-sheet-foot">
          <button
            className="btn btn-ghost"
            onClick={resetFilters}
            disabled={activeFilterCount === 0}
          >
            Sıfırla
          </button>
          <button
            className="btn btn-primary"
            style={{ flex: 1, justifyContent: "center" }}
            onClick={() => setFiltersOpen(false)}
          >
            {list.length} ürünü göster
          </button>
        </footer>
      </div>

      <section className="section" style={{ background: "var(--bg-warm)" }}>
        <div
          className="wrap"
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 60,
            alignItems: "center",
          }}
          data-row="featured-row"
        >
          <div
            className="reveal"
            style={{
              aspectRatio: "4/3",
              borderRadius: "var(--r-lg)",
              overflow: "hidden",
            }}
          >
            <PhotoSurface
              hue="caramel"
              dotLabel="Limited · Friday drop"
              dotPos="tl"
            >
              <div
                style={{
                  width: "100%",
                  height: "100%",
                  padding: 30,
                  display: "grid",
                  gap: 18,
                  placeItems: "stretch",
                }}
                data-row="featured-inner"
              >
                <div style={{ display: "grid", placeItems: "center" }}>
                  <CoffeeBag
                    label="Sirena"
                    sub="ESPRESSO BLEND · 250G"
                    tone="dark"
                  />
                </div>
                <div style={{ display: "grid", placeItems: "center" }}>
                  <EdibleCupHero scoop="cream" topping="wafer" />
                </div>
                <div style={{ display: "grid", placeItems: "center" }}>
                  <EspressoCup />
                </div>
                <div style={{ display: "grid", placeItems: "center" }}>
                  <GelatoScoop flavor="cream" />
                </div>
              </div>
            </PhotoSurface>
          </div>
          <div className="reveal r1">
            <div className="eyebrow">Affogato Kit · For Two</div>
            <h2 className="h1" style={{ marginTop: 16 }}>
              Evde <span className="script">tableside</span> servis.
            </h2>
            <p className="lede" style={{ marginTop: 22 }}>
              200g taze kavrulmuş Sirena · 1 pint fior di latte gelato · 2
              edible kup · porselen kaşık · el yazısı tarif kartı. Cuma teslimat
              İstanbul içi. Eve veya hediyeye.
            </p>
            <div
              style={{
                display: "flex",
                gap: 16,
                alignItems: "baseline",
                marginTop: 26,
              }}
            >
              <span
                style={{
                  fontFamily: "var(--serif)",
                  fontStyle: "normal",
                  fontSize: 44,
                }}
              >
                780₺
              </span>
              <span
                style={{
                  fontFamily: "var(--mono)",
                  fontSize: 14,
                  color: "var(--ink-mute)",
                  textDecoration: "line-through",
                }}
              >
                880₺
              </span>
              <span className="chip chip-gold">−12%</span>
            </div>
            <div style={{ display: "flex", gap: 12, marginTop: 28 }}>
              <button
                className="btn btn-primary btn-lg"
                onClick={() =>
                  addToCart({ name: "Affogato Kit · For Two", price: 780 })
                }
              >
                Sepete ekle <span className="arrow">→</span>
              </button>
              <button className="btn btn-ghost btn-lg">Detay</button>
            </div>
          </div>
        </div>
      </section>

      <section className="section-tight">
        <div
          className="wrap"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gap: 30,
          }}
          data-row="trust-row"
        >
          {[
            { k: "Bologna import", v: "Bologna kavurma · haftalık taze" },
            { k: "Aynı gün", v: "İstanbul içi · 14:00'a kadar" },
            { k: "Avrupa kargo", v: "5–7 iş günü · DHL Express" },
            { k: "14 gün iade", v: "Açılmamış ürünlerde kolay iade" },
          ].map((b, i) => (
            <div
              key={b.k}
              className="reveal"
              style={{
                transitionDelay: `${i * 60}ms`,
                padding: 26,
                border: "1px solid var(--ink-line)",
                borderRadius: "var(--r-md)",
              }}
            >
              <div className="eyebrow" style={{ marginBottom: 12 }}>
                {b.k}
              </div>
              <div style={{ fontFamily: "var(--serif-display)", fontSize: 18 }}>
                {b.v}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────
   STORY
   ────────────────────────────────────────────────────────────── */

export function PageStory({ press, storyTimeline, content }: PageProps) {
  const PRESS = press ?? SEED_PRESS;
  const heritage = storyTimeline ?? STORY.heritage;
  const c = (k: string, fallback: string) => content?.[k] ?? fallback;
  useReveal();

  const values = [
    {
      n: "01",
      t: "Tek bir bar, tek bir ritüel",
      d: "Menü kısa kalır. Sezonluk değişir ama liste hiçbir zaman altı affogato’dan fazla olmaz.",
    },
    {
      n: "02",
      t: "İtalyan reçete, yerel süt",
      d: "Haftalık taze kavurma. Trakya küçük mandıradan günlük süt. Her ürün izlenebilir.",
    },
    {
      n: "03",
      t: "Laptop yok, ses az",
      d: "Akşam 18:00’dan sonra çalışma yok. Müzik 65dB üzerine çıkmaz. Bar, sohbet için.",
    },
    {
      n: "04",
      t: "Zero waste",
      d: "Yenilebilir kup, kompost gelato bardağı, yeniden doldurulan teneke. 2025'ten beri tek kullanımlık plastik yok.",
    },
    {
      n: "05",
      t: "Yavaş büyüme",
      d: "Acele açılış yok. Her yeni fikir önce Tuzla köşkünde denenir; ana mekân her zaman ana mekân kalır.",
    },
    {
      n: "06",
      t: "Personel mutluluğu",
      d: "İlk yıl çalışan turnover’ı %0. Yıllık 6 hafta tatil, sigorta artı, Bologna ziyareti.",
    },
  ];

  const pourSteps = [
    { step: "01", t: "Tartı", d: "18g Sirena, taze öğüt." },
    { step: "02", t: "Tamper", d: "15kg, eşit basınç." },
    { step: "03", t: "27s", d: "36g out, 93°C." },
    { step: "04", t: "Pour", d: "Tableside, gelato üzerine." },
  ];

  return (
    <div className="page" data-screen-label="04 Story">
      <section className="story-hero">
        <div className="wrap">
          <div
            className="reveal"
            style={{ maxWidth: 720, margin: "0 auto", textAlign: "center" }}
          >
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 12,
                marginBottom: 30,
              }}
            >
              <span
                aria-hidden="true"
                style={{
                  width: 28,
                  height: 1,
                  background:
                    "linear-gradient(90deg, var(--gold), transparent)",
                }}
              />
              <span className="eyebrow">IV — La storia · since 1987</span>
            </div>
            <h1
              className="h-display"
              style={{ fontSize: "clamp(56px, 11vw, 160px)" }}
            >
              From <span className="script">Bologna</span>
              <br />
              to Tuzla.
            </h1>
            <p
              className="lede"
              style={{ marginTop: 36, margin: "36px auto 0", maxWidth: 580 }}
            >
              {c(
                "story.hero.lede",
                "Üç kuşak Mancuso ailesi. Patentli bir kup. 39 yıldır değişmeyen tek bir ritüel. Şimdi İstanbul’da.",
              )}
            </p>
          </div>
        </div>
      </section>

      <section className="section-tight" style={{ background: "var(--bg)" }}>
        <div className="wrap">
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(4, 1fr)",
              gap: 40,
              padding: "40px 0",
              borderTop: "1px solid var(--ink-line)",
              borderBottom: "1px solid var(--ink-line)",
            }}
            data-row="story-stats"
          >
            <Stat n="1987" l="Anno fondazione" d="Bologna · 1987" />
            <Stat n="1994" l="Brevetto edible cup" d="Mancuso ailesi patenti" />
            <Stat
              n="2026"
              l="İstanbul açılışı"
              d="Tuzla · ilk yurt dışı şube"
            />
            <Stat n="III" l="Generazione" d="Eda Mancuso · 3. kuşak" />
          </div>
        </div>
      </section>

      <section className="section">
        <div
          className="wrap"
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 80,
            alignItems: "center",
          }}
          data-row="founder-row"
        >
          <div
            className="reveal"
            style={{
              aspectRatio: "4/5",
              borderRadius: "var(--r-lg)",
              overflow: "hidden",
            }}
          >
            <PhotoSurface
              hue="warm"
              dotLabel="Eda Mancuso · Founder"
              dotPos="bl"
            >
              <div
                style={{
                  width: "100%",
                  height: "100%",
                  display: "grid",
                  placeItems: "center",
                }}
              >
                <FounderPortrait />
              </div>
            </PhotoSurface>
          </div>
          <div className="reveal r1">
            <div className="eyebrow">Founder · Roaster · Üçüncü kuşak</div>
            <h2 className="h1" style={{ marginTop: 16 }}>
              Eda <span className="script">Mancuso.</span>
            </h2>
            <p className="lede" style={{ marginTop: 22 }}>
              {c("story.founder.bio", STORY.founder.bio)}
            </p>
            <blockquote
              style={{
                margin: "32px 0",
                padding: "24px 28px",
                borderLeft: "2px solid var(--gold)",
                fontFamily: "var(--serif)",
                fontStyle: "normal",
                fontSize: 20,
                lineHeight: 1.5,
                color: "var(--ink)",
              }}
            >
              “Affogato benim için bir kahve değil, bir ritüel. Floransa’da
              Ditta’da çalışırken her servisin sonunda baristalar küçük bir
              gelato üzerine espresso döker, ayakta içerdik. L’Affogato o anı
              bir mekana dönüştürme denemesi.”
            </blockquote>
            <div
              style={{
                fontFamily: "var(--script)",
                fontSize: 38,
                color: "var(--gold)",
              }}
            >
              — Eda
            </div>
          </div>
        </div>
      </section>

      <section
        className="section"
        style={{ background: "var(--bg-espresso)", color: "#FFF" }}
      >
        <div className="wrap-wide">
          <div className="reveal" style={{ marginBottom: 70 }}>
            <div className="eyebrow on-dark">Linea del tempo</div>
            <h2 className="h1" style={{ marginTop: 16, color: "#FFF" }}>
              How we got <span className="script">here.</span>
            </h2>
          </div>
          <div className="timeline">
            {heritage.map((ev, i) => (
              <div
                key={ev.y}
                className="timeline-row reveal"
                style={{ transitionDelay: `${i * 60}ms` }}
              >
                <div className="timeline-year">{ev.y}</div>
                <div className="timeline-dot">
                  <span></span>
                </div>
                <div className="timeline-content">
                  <h3 className="h3" style={{ color: "#FFF" }}>
                    {ev.t}
                  </h3>
                  <p
                    style={{
                      marginTop: 10,
                      color: "rgba(255, 255, 255, 0.7)",
                      lineHeight: 1.6,
                      maxWidth: 540,
                    }}
                  >
                    {ev.d}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section">
        <div className="wrap">
          <SectionHead
            alignment="center"
            eyebrow="Cosa contiamo"
            title={
              <>
                Koruduğumuz <span className="script">beş ilke.</span>
              </>
            }
          />
          <div className="values-grid" style={{ marginTop: 60 }}>
            {values.map((v, i) => (
              <div
                key={v.n}
                className="reveal value-card"
                style={{ transitionDelay: `${(i % 3) * 60}ms` }}
              >
                <div className="value-num">{v.n}</div>
                <h3 className="h3">{v.t}</h3>
                <p>{v.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section" style={{ background: "var(--bg-warm)" }}>
        <div className="wrap">
          <SectionHead
            alignment="center"
            eyebrow="Il rituale · 27 secondi"
            title={
              <>
                The <span className="script">pour.</span>
              </>
            }
          />
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(4, 1fr)",
              gap: 24,
              marginTop: 50,
            }}
            data-row="pour-row"
          >
            {pourSteps.map((s, i) => (
              <div
                key={s.step}
                className="reveal"
                style={{
                  transitionDelay: `${i * 80}ms`,
                  aspectRatio: "4/5",
                  borderRadius: "var(--r-md)",
                  overflow: "hidden",
                  position: "relative",
                }}
              >
                <PhotoSurface hue={["stone", "caramel", "espresso", "warm"][i]}>
                  <div
                    style={{
                      width: "100%",
                      height: "100%",
                      display: "grid",
                      placeItems: "center",
                      padding: 24,
                    }}
                  >
                    {i === 0 && <BeanIllo />}
                    {i === 1 && <EspressoCup />}
                    {i === 2 && <EspressoCup />}
                    {i === 3 && <EdibleCupHero scoop="cream" topping="wafer" />}
                  </div>
                </PhotoSurface>
                <div
                  style={{
                    position: "absolute",
                    top: 20,
                    left: 20,
                    fontFamily: "var(--mono)",
                    fontSize: 10,
                    letterSpacing: "0.22em",
                    textTransform: "uppercase",
                    padding: "5px 10px",
                    background: "rgba(255,255,255,0.92)",
                    borderRadius: 999,
                  }}
                >
                  {s.step}
                </div>
                <div
                  style={{
                    position: "absolute",
                    bottom: 20,
                    left: 20,
                    right: 20,
                    color: i === 2 ? "#FFF" : "#14100B",
                  }}
                >
                  <div
                    style={{ fontFamily: "var(--serif-display)", fontSize: 22 }}
                  >
                    {s.t}
                  </div>
                  <div
                    style={{
                      fontFamily: "var(--mono)",
                      fontSize: 11,
                      letterSpacing: "0.18em",
                      textTransform: "uppercase",
                      marginTop: 4,
                      opacity: 0.75,
                    }}
                  >
                    {s.d}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section-tight">
        <div className="wrap">
          <SectionHead
            alignment="center"
            eyebrow="Press · stamping kindly"
            title={
              <>
                People <span className="script">talking.</span>
              </>
            }
          />
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(2, 1fr)",
              gap: 30,
              marginTop: 50,
            }}
            data-row="press-wall"
          >
            {PRESS.concat(PRESS).map((p, i) => (
              <div
                key={i}
                className="reveal"
                style={{
                  transitionDelay: `${(i % 4) * 60}ms`,
                  padding: 36,
                  border: "1px solid var(--ink-line)",
                  borderRadius: "var(--r-md)",
                  background: "#FFF",
                }}
              >
                <div className="eyebrow" style={{ marginBottom: 20 }}>
                  {p.name}
                </div>
                <div
                  style={{
                    fontFamily: "var(--serif)",
                    fontStyle: "normal",
                    fontSize: 22,
                    lineHeight: 1.35,
                  }}
                >
                  “{p.quote}”
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section" style={{ background: "var(--bg-cream)" }}>
        <div className="wrap-narrow" style={{ textAlign: "center" }}>
          <div className="eyebrow reveal" style={{ marginBottom: 24 }}>
            Per chiudere
          </div>
          <h2 className="h1 reveal r1">
            “Drink it. <span className="script">Eat the cup.</span>
            <br />
            That’s the whole brand.”
          </h2>
          <div
            className="reveal r2"
            style={{
              marginTop: 24,
              fontFamily: "var(--mono)",
              fontSize: 11,
              letterSpacing: "0.22em",
              textTransform: "uppercase",
              color: "var(--ink-mute)",
            }}
          >
            Giancarlo Mancuso · 1987
          </div>
        </div>
      </section>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────
   VISIT
   ────────────────────────────────────────────────────────────── */

export function PageVisit({ visit }: PageProps) {
  const addressLines = visit?.addressLines ?? LOCATION.address;
  const visitPhone = visit?.phone ?? LOCATION.phone;
  const visitEmail = visit?.email ?? LOCATION.email;
  const visitHours = visit?.hours ?? LOCATION.hours;
  useReveal();
  // Real directions links so /ziyaret carries a genuine local signal + works
  // (the map illustration links straight to Google Maps directions).
  const mapQuery = ["L'Affogato", ...addressLines, "İstanbul"].join(", ");
  const directionsUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(mapQuery)}`;
  const appleMapsUrl = `https://maps.apple.com/?q=${encodeURIComponent(mapQuery)}`;
  const [partySize, setPartySize] = useState(2);
  const [day, setDay] = useState("Bu akşam");
  const [time, setTime] = useState("19:30");

  const scrollTo = (id: string) => (e: React.MouseEvent) => {
    e.preventDefault();
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <div className="page" data-screen-label="05 Visit">
      <section className="visit-hero">
        <div className="visit-hero-bg">
          <BarRenderScene />
          <div className="visit-hero-overlay" />
        </div>
        <div className="wrap visit-hero-content">
          <div className="reveal">
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 12,
                marginBottom: 22,
              }}
            >
              <span
                aria-hidden="true"
                style={{
                  width: 28,
                  height: 1,
                  background:
                    "linear-gradient(90deg, var(--gold), transparent)",
                }}
              />
              <span
                className="eyebrow on-dark"
                style={{ color: "rgba(255,255,255,0.7)" }}
              >
                V — Vieni a trovarci · İstanbul
              </span>
            </div>
            <h1
              className="h-display"
              style={{ color: "#FFF", fontSize: "clamp(56px, 9vw, 132px)" }}
            >
              Tuzla,{" "}
              <span className="script" style={{ color: "var(--gold-soft)" }}>
                İstanbul.
              </span>
            </h1>
            <p
              className="lede"
              style={{
                marginTop: 26,
                color: "rgba(255, 255, 255, 0.86)",
                maxWidth: 580,
              }}
            >
              İlk yurt dışı şubemiz — Tuzla’da restore edilmiş 200 yıllık bir
              Rum köşkü. Köşkün bahçesinde Akdeniz bougainvillea’sı, altın saat
              ışıkları, on iki sandalyeli bar. Marmaray Tuzla + E-5 girişinden 4
              dakika.
            </p>
            <div
              style={{
                display: "flex",
                gap: 12,
                flexWrap: "wrap",
                marginTop: 36,
              }}
            >
              <a
                href="#book"
                onClick={scrollTo("book")}
                className="btn btn-light btn-lg"
              >
                Masa rezerve et <span className="arrow">→</span>
              </a>
              <a
                href="#map"
                onClick={scrollTo("map")}
                className="btn btn-ghost btn-lg"
                style={{
                  color: "#FFF",
                  borderColor: "rgba(255, 255, 255, 0.3)",
                }}
              >
                Yol tarifi
              </a>
            </div>
          </div>
        </div>
      </section>

      <section id="map" className="section">
        <div
          className="wrap"
          style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 60 }}
          data-row="visit-map-row"
        >
          <div className="reveal">
            <div className="eyebrow">{LOCATION.short}</div>
            <h2 className="h1" style={{ marginTop: 16 }}>
              Postane, <span className="script">Tuzla.</span>
            </h2>
            <div
              style={{
                marginTop: 22,
                fontFamily: "var(--serif-display)",
                fontSize: 18,
                lineHeight: 1.6,
              }}
            >
              {addressLines.map((l, i) => (
                <div key={i}>{l}</div>
              ))}
            </div>

            <div data-row="visit-address">
              <div>
                <div className="eyebrow" style={{ marginBottom: 10 }}>
                  Telefon
                </div>
                <div style={{ fontFamily: "var(--mono)", fontSize: 15 }}>
                  {visitPhone}
                </div>
              </div>
              <div>
                <div className="eyebrow" style={{ marginBottom: 10 }}>
                  E-posta
                </div>
                <div style={{ fontFamily: "var(--mono)", fontSize: 15 }}>
                  {visitEmail}
                </div>
              </div>
            </div>

            <div
              style={{
                marginTop: 36,
                padding: 22,
                background: "var(--bg-warm)",
                borderRadius: "var(--r-md)",
              }}
            >
              <div className="eyebrow" style={{ marginBottom: 10 }}>
                L’Affogato Italia · Sede principale
              </div>
              <div
                style={{
                  fontFamily: "var(--serif)",
                  fontStyle: "normal",
                  fontSize: 18,
                  lineHeight: 1.4,
                }}
              >
                {LOCATION.parent}
              </div>
            </div>

            <div
              style={{
                marginTop: 30,
                display: "flex",
                gap: 8,
                flexWrap: "wrap",
              }}
            >
              <span className="chip">Marmaray Tuzla · 6 dk</span>
              <span className="chip">Vale · ücretsiz</span>
              <span className="chip">Sabiha Gökçen · 15 dk</span>
              <span className="chip">E-5 / TEM Tuzla çıkışı</span>
            </div>

            <div className="btn-group-wrap" style={{ marginTop: 30 }}>
              <a
                className="btn btn-primary"
                href={appleMapsUrl}
                target="_blank"
                rel="noopener"
              >
                Apple Maps <span className="arrow">→</span>
              </a>
              <a
                className="btn btn-ghost"
                href={directionsUrl}
                target="_blank"
                rel="noopener"
              >
                Google Maps · yol tarifi
              </a>
            </div>
          </div>

          <a
            className="reveal r1"
            href={directionsUrl}
            target="_blank"
            rel="noopener"
            aria-label="Google Haritalar'da yol tarifi al"
            style={{
              display: "block",
              aspectRatio: "4/5",
              borderRadius: "var(--r-lg)",
              overflow: "hidden",
              border: "1px solid var(--ink-line)",
            }}
          >
            <PhotoSurface hue="warm" vignette={false}>
              <MapPlaceholder />
            </PhotoSurface>
          </a>
        </div>
      </section>

      <section
        id="book"
        className="section"
        style={{ background: "var(--bg-warm)" }}
      >
        <div
          className="wrap"
          style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 80 }}
          data-row="visit-book-row"
        >
          <div className="reveal">
            <div className="eyebrow">Saatler · AVM açık saatleri</div>
            <h2 className="h1" style={{ marginTop: 16 }}>
              Her gün, <span className="script">10–23.</span>
            </h2>
            <div className="hours-table">
              {visitHours.map(([d, h]) => (
                <Fragment key={d}>
                  <div className="hours-day">{d}</div>
                  <div className="hours-h">{h}</div>
                </Fragment>
              ))}
            </div>
            <div className="open-now">
              <span className="open-dot" />
              <div>
                <div
                  style={{ fontFamily: "var(--serif-display)", fontSize: 17 }}
                >
                  Şu an açık
                </div>
                <div className="eyebrow" style={{ marginTop: 4 }}>
                  Son siparişler 22:30
                </div>
              </div>
            </div>
            <div
              style={{
                marginTop: 30,
                padding: 22,
                background: "#FFF",
                borderRadius: "var(--r-md)",
              }}
            >
              <div className="eyebrow" style={{ marginBottom: 10 }}>
                Yarın · 27 Mayıs
              </div>
              <div style={{ fontFamily: "var(--serif-display)", fontSize: 18 }}>
                10:00 — 23:00
              </div>
              <p
                style={{
                  fontSize: 13,
                  color: "var(--ink-soft)",
                  marginTop: 10,
                  lineHeight: 1.6,
                }}
              >
                Yağmur tahmini. Köşkün avlusu hava müsait olursa açılır,
                kötüleşirse köşk salonlarında devam ediyoruz.
              </p>
            </div>
          </div>

          <div className="reveal r1 reserve-card">
            <div className="reserve-card-head">
              <div>
                <div className="eyebrow" style={{ marginBottom: 6 }}>
                  Rezervasyon
                </div>
                <h3
                  style={{
                    fontFamily: "var(--serif)",
                    fontStyle: "normal",
                    fontSize: 28,
                    margin: 0,
                  }}
                >
                  Bu akşam · Tuzla
                </h3>
              </div>
              <div
                style={{
                  fontFamily: "var(--script)",
                  fontSize: 28,
                  color: "var(--gold)",
                }}
              >
                prenotare
              </div>
            </div>

            <div className="reserve-section">
              <div className="label" id="rv-party-label">
                Kişi sayısı
              </div>
              <div
                className="reserve-party"
                role="group"
                aria-labelledby="rv-party-label"
              >
                {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
                  <button
                    key={n}
                    className={`reserve-num ${partySize === n ? "on" : ""}`}
                    onClick={() => setPartySize(n)}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>

            <div className="reserve-section">
              <div className="label" id="rv-day-label">
                Gün
              </div>
              <div
                className="reserve-chips"
                role="group"
                aria-labelledby="rv-day-label"
              >
                {["Bu akşam", "Yarın", "Cuma", "Cumartesi", "Pazar"].map(
                  (d) => (
                    <button
                      key={d}
                      className={`reserve-chip ${day === d ? "on" : ""}`}
                      onClick={() => setDay(d)}
                    >
                      {d}
                    </button>
                  ),
                )}
              </div>
            </div>

            <div className="reserve-section">
              <div className="label" id="rv-time-label">
                Saat
              </div>
              <div
                className="reserve-chips"
                role="group"
                aria-labelledby="rv-time-label"
              >
                {[
                  "18:00",
                  "18:30",
                  "19:00",
                  "19:30",
                  "20:00",
                  "20:30",
                  "21:00",
                  "21:30",
                ].map((t) => (
                  <button
                    key={t}
                    className={`reserve-chip ${time === t ? "on" : ""}`}
                    onClick={() => setTime(t)}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            <div className="reserve-section">
              <label className="label" htmlFor="rv-note">
                Özel istek (isteğe bağlı)
              </label>
              <input
                id="rv-note"
                type="text"
                className="input"
                placeholder="Doğum günü, balkon masası, alerjenler…"
              />
            </div>

            <button
              className="btn btn-primary btn-lg"
              style={{
                width: "100%",
                justifyContent: "space-between",
                marginTop: 8,
              }}
            >
              <span>
                {partySize} kişi · {day} · {time}
              </span>
              <span className="arrow">→</span>
            </button>

            <div
              style={{
                fontSize: 12,
                color: "var(--ink-mute)",
                lineHeight: 1.55,
                marginTop: 14,
              }}
            >
              90 dk masa. İptal için en az 3 saat önce bildirim. Bar köşesi
              rezervasyona kapalı — yürüyüşle gelin.
            </div>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="wrap-wide">
          <SectionHead
            eyebrow="Il locale · tarihi köşk"
            title={
              <>
                <span className="script">Mekan.</span>
              </>
            }
            action={
              <a
                href="/reels"
                className="btn-link"
                onClick={(e) => {
                  e.preventDefault();
                  window.location.hash = "reels";
                  window.scrollTo({ top: 0 });
                }}
              >
                Tüm fotoğraflar <span>→</span>
              </a>
            }
          />
          <div className="gallery">
            <div className="gallery-cell large reveal">
              <PhotoSurface
                hue="caramel"
                dotLabel="Bar · golden hour"
                dotPos="bl"
              >
                <BarRenderScene />
              </PhotoSurface>
            </div>
            <div className="gallery-cell reveal r1">
              <PhotoSurface hue="dawn" dotLabel="Edible cup" dotPos="bl">
                <div
                  style={{
                    width: "100%",
                    height: "100%",
                    display: "grid",
                    placeItems: "center",
                    padding: 30,
                  }}
                >
                  <CupEmblem size={240} bg="#F5E6D3" />
                </div>
              </PhotoSurface>
            </div>
            <div className="gallery-cell reveal r2">
              <PhotoSurface hue="rose" dotLabel="Strawberry matcha">
                <div
                  style={{
                    width: "100%",
                    height: "100%",
                    display: "grid",
                    placeItems: "center",
                    padding: 30,
                  }}
                >
                  <MatchaGlass strawberry />
                </div>
              </PhotoSurface>
            </div>
            <div className="gallery-cell reveal r3">
              <PhotoSurface hue="espresso" dotLabel="Doppio · 36g" dotPos="bl">
                <div
                  style={{
                    width: "100%",
                    height: "100%",
                    display: "grid",
                    placeItems: "center",
                    padding: 30,
                  }}
                >
                  <EspressoCup />
                </div>
              </PhotoSurface>
            </div>
            <div className="gallery-cell wide reveal r4">
              <PhotoSurface
                hue="matcha"
                dotLabel="Matcha bar · Uji"
                dotPos="bl"
              >
                <div
                  style={{
                    width: "100%",
                    height: "100%",
                    display: "grid",
                    placeItems: "center",
                    padding: 30,
                  }}
                >
                  <MatchaGlass />
                </div>
              </PhotoSurface>
            </div>
          </div>
        </div>
      </section>

      <section
        className="section"
        style={{ background: "var(--bg-espresso)", color: "#FFF" }}
      >
        <div
          className="wrap"
          style={{
            display: "grid",
            gridTemplateColumns: "1.05fr 0.95fr",
            gap: 80,
            alignItems: "center",
          }}
          data-row="private-row"
        >
          <div className="reveal">
            <div className="eyebrow on-dark">Eventi privati</div>
            <h2 className="h1" style={{ marginTop: 16, color: "#FFF" }}>
              Özel <span className="script">kiralama.</span>
            </h2>
            <p
              className="lede"
              style={{ marginTop: 24, color: "rgba(255, 255, 255, 0.78)" }}
            >
              Pazartesi günleri köşkü tamamen kiralayabilirsiniz. 24 koltuk,
              özel menü, barista demonstrasyonu, gelato workshop’u. Marka
              lansmanları, sosyal medya çekimleri ve yakın gruplar için ideal.
            </p>
            <button className="btn btn-light btn-lg" style={{ marginTop: 30 }}>
              Detaylı bilgi <span className="arrow">→</span>
            </button>
          </div>
          <div className="reveal r1" data-row="private-stats">
            {[
              ["24", "Koltuk"],
              ["90dk", "Demo süresi"],
              ["76m²", "Toplam alan"],
              ["10–24", "Esnek saat"],
            ].map(([n, l]) => (
              <div
                key={l}
                style={{
                  padding: 26,
                  border: "1px solid rgba(255, 255, 255, 0.15)",
                  borderRadius: "var(--r-md)",
                }}
              >
                <div
                  style={{
                    fontFamily: "var(--serif)",
                    fontStyle: "normal",
                    fontSize: 42,
                    lineHeight: 1,
                  }}
                >
                  {n}
                </div>
                <div className="eyebrow on-dark" style={{ marginTop: 14 }}>
                  {l}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────
   REELS
   ────────────────────────────────────────────────────────────── */

export function PageReels({ reels, press }: PageProps) {
  const REELS = reels ?? SEED_REELS;
  const PRESS = press ?? SEED_PRESS;
  useReveal();
  const [active, setActive] = useState<number | null>(null);
  const [filter, setFilter] = useState("all");

  const handles = [
    {
      name: "Instagram",
      handle: "@laffogato",
      stat: "24.6K",
      icon: "instagram",
    },
    { name: "TikTok", handle: "@laffogato.bar", stat: "38.2K", icon: "tiktok" },
    { name: "YouTube", handle: "/laffogato", stat: "4.1K", icon: "youtube" },
    {
      name: "Spotify",
      handle: "Bar Playlist",
      stat: "6h · 88 track",
      icon: "spotify",
    },
  ];

  return (
    <div className="page" data-screen-label="06 Reels">
      <header className="page-head">
        <div className="wrap">
          <div className="reveal" data-row="reels-header">
            <div>
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 12,
                }}
              >
                <span
                  aria-hidden="true"
                  style={{
                    width: 28,
                    height: 1,
                    background:
                      "linear-gradient(90deg, var(--gold), transparent)",
                  }}
                />
                <span className="eyebrow">VI — Il film & social</span>
              </div>
              <h1 style={{ marginTop: 24 }}>
                Reels & <span className="script">film.</span>
              </h1>
              <p className="lede" style={{ marginTop: 22 }}>
                Tuzla köşkünden, Bologna kavurma odasından, Bronte pistacchio
                hasadından kısa filmler. Aylık bir 4K bölüm, haftalık reels.
                @laffogato — 24.6K takipçi, hızla büyüyor.
              </p>
            </div>
            <div style={{ display: "flex", gap: 12, alignItems: "baseline" }}>
              <div>
                <div className="eyebrow" style={{ marginBottom: 6 }}>
                  Takipçi
                </div>
                <div
                  style={{
                    fontFamily: "var(--serif)",
                    fontStyle: "normal",
                    fontSize: 36,
                  }}
                >
                  72.9K
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      <section style={{ padding: "20px 0 50px" }}>
        <div
          className="wrap"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gap: 16,
          }}
          data-row="handles-row"
        >
          {handles.map((s, i) => (
            <a
              key={s.name}
              href="#"
              onClick={(e) => e.preventDefault()}
              className="reveal handle-card"
              style={{ transitionDelay: `${i * 60}ms` }}
            >
              <div className="handle-icon">
                {s.icon === "instagram" && (
                  <svg width="20" height="20" viewBox="0 0 16 16" fill="none">
                    <rect
                      x="2"
                      y="2"
                      width="12"
                      height="12"
                      rx="3"
                      stroke="currentColor"
                      strokeWidth="1.4"
                    />
                    <circle
                      cx="8"
                      cy="8"
                      r="2.6"
                      stroke="currentColor"
                      strokeWidth="1.4"
                    />
                    <circle cx="11.5" cy="4.5" r="0.7" fill="currentColor" />
                  </svg>
                )}
                {s.icon === "tiktok" && (
                  <svg width="20" height="20" viewBox="0 0 16 16" fill="none">
                    <path
                      d="M9 1 L9 11 A 2.5 2.5 0 1 1 6.5 8.5"
                      stroke="currentColor"
                      strokeWidth="1.4"
                      strokeLinecap="round"
                    />
                    <path
                      d="M9 1 Q 9 4 13 4"
                      stroke="currentColor"
                      strokeWidth="1.4"
                      strokeLinecap="round"
                    />
                  </svg>
                )}
                {s.icon === "youtube" && (
                  <svg width="20" height="20" viewBox="0 0 16 16" fill="none">
                    <rect
                      x="1.5"
                      y="3.5"
                      width="13"
                      height="9"
                      rx="2"
                      stroke="currentColor"
                      strokeWidth="1.4"
                    />
                    <path d="M7 6 L10 8 L7 10 Z" fill="currentColor" />
                  </svg>
                )}
                {s.icon === "spotify" && (
                  <svg width="20" height="20" viewBox="0 0 16 16" fill="none">
                    <circle
                      cx="8"
                      cy="8"
                      r="6.5"
                      stroke="currentColor"
                      strokeWidth="1.4"
                    />
                    <path
                      d="M4 6 Q 8 5 12 7 M4 8 Q 8 7 11 9 M4 10 Q 7 9 10 11"
                      stroke="currentColor"
                      strokeWidth="1.4"
                      fill="none"
                      strokeLinecap="round"
                    />
                  </svg>
                )}
              </div>
              <div>
                <div className="eyebrow" style={{ marginBottom: 6 }}>
                  {s.name}
                </div>
                <div
                  style={{
                    fontFamily: "var(--serif-display)",
                    fontSize: 22,
                    marginBottom: 4,
                  }}
                >
                  {s.handle}
                </div>
                <div
                  style={{
                    fontFamily: "var(--mono)",
                    fontSize: 11,
                    letterSpacing: "0.18em",
                    color: "var(--ink-mute)",
                  }}
                >
                  {s.stat}
                </div>
              </div>
              <div
                style={{
                  marginLeft: "auto",
                  alignSelf: "flex-start",
                  fontSize: 14,
                  color: "var(--ink-mute)",
                }}
              >
                ↗
              </div>
            </a>
          ))}
        </div>
      </section>

      <section className="section-tight">
        <div className="wrap-wide">
          <div className="reveal" style={{ marginBottom: 30 }}>
            <div className="eyebrow">Featured · Ep. 04 · Mayıs 2026</div>
            <h2 className="h1" style={{ marginTop: 16 }}>
              Bu ayın <span className="script">kısa filmi.</span>
            </h2>
          </div>
          <div className="reveal r1 featured-film">
            <div className="featured-film-img">
              <PhotoSurface hue="caramel" vignette={false}>
                <div
                  style={{
                    width: "100%",
                    height: "100%",
                    display: "grid",
                    placeItems: "center",
                    padding: 40,
                  }}
                >
                  <EdibleCupHero scoop="cream" topping="wafer" />
                </div>
              </PhotoSurface>
              <div className="featured-film-play">
                <svg width="20" height="20" viewBox="0 0 16 16">
                  <path d="M3 2 L13 8 L3 14 Z" fill="currentColor" />
                </svg>
              </div>
              <div
                style={{
                  position: "absolute",
                  top: 24,
                  left: 24,
                  padding: "6px 12px",
                  background: "rgba(0,0,0,0.7)",
                  backdropFilter: "blur(8px)",
                  borderRadius: 999,
                  color: "#FFF",
                  fontFamily: "var(--mono)",
                  fontSize: 10,
                  letterSpacing: "0.22em",
                  textTransform: "uppercase",
                }}
              >
                4K · 4:12
              </div>
            </div>
            <div className="featured-film-meta">
              <div className="eyebrow">Director · Kerem Aksoy</div>
              <h3 className="h2" style={{ marginTop: 16 }}>
                How an affogato is born.
              </h3>
              <p className="lede" style={{ marginTop: 20 }}>
                Sabah 6’da gelato bazını çevirmeye başlıyoruz, 7:30’da Sirena’yı
                kavurmaya. 10’da ilk müşteri. Bu 4 dakikalık kısa film bir günü
                27 saniyelik ekstraksiyona indirgemenin hikayesini anlatıyor.
              </p>
              <div
                style={{
                  display: "flex",
                  gap: 12,
                  marginTop: 28,
                  flexWrap: "wrap",
                }}
              >
                <button className="btn btn-primary">
                  <svg
                    width="10"
                    height="10"
                    viewBox="0 0 16 16"
                    style={{ fill: "currentColor" }}
                  >
                    <path d="M3 2 L13 8 L3 14 Z" />
                  </svg>
                  Oynat · 4:12
                </button>
                <button className="btn btn-ghost">Daha fazla bölüm</button>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="section-tight">
        <div className="wrap-wide">
          <div
            className="reveal"
            data-row="reels-header"
            style={{ marginBottom: 40 }}
          >
            <div>
              <div className="eyebrow">Reels · son yayınlananlar</div>
              <h2 className="h1" style={{ marginTop: 16 }}>
                Akışın <span className="script">en yenisi.</span>
              </h2>
            </div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {[
                ["all", "Tümü"],
                ["bar", "Bar"],
                ["gelato", "Gelato"],
                ["origin", "Köken"],
              ].map(([id, label]) => (
                <button
                  key={id}
                  className={`reserve-chip ${filter === id ? "on" : ""}`}
                  onClick={() => setFilter(id)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div className="reels-grid">
            {REELS.map((r, i) => (
              <button
                key={i}
                className="reel-card reveal"
                onClick={() => setActive(i)}
                style={{ transitionDelay: `${(i % 4) * 60}ms` }}
              >
                <ReelScene variant={i} />
                <div className="reel-card-overlay">
                  <div className="reel-card-caption">{r.caption}</div>
                  <div className="reel-card-meta">
                    <span>{r.meta.split("·")[0].trim()}</span>
                    <span>{r.meta.split("·")[1].trim()}</span>
                  </div>
                </div>
                <div className="reel-card-play">
                  <svg width="14" height="14" viewBox="0 0 16 16">
                    <path d="M3 2 L13 8 L3 14 Z" fill="currentColor" />
                  </svg>
                </div>
              </button>
            ))}
          </div>
        </div>
      </section>

      {active !== null && (
        <div
          onClick={() => setActive(null)}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 90,
            background: "rgba(20, 16, 11, 0.92)",
            backdropFilter: "blur(20px)",
            display: "grid",
            placeItems: "center",
            padding: 20,
            animation: "pageIn 0.3s var(--ease-out)",
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "min(380px, 100%)",
              aspectRatio: "9/16",
              borderRadius: "var(--r-md)",
              overflow: "hidden",
              position: "relative",
              background: "var(--bg-espresso)",
              boxShadow: "0 30px 80px rgba(0,0,0,0.5)",
            }}
          >
            <ReelScene variant={active} />
            <div className="reel-card-overlay" style={{ padding: 24 }}>
              <div
                style={{
                  fontFamily: "var(--serif-display)",
                  fontSize: 18,
                  color: "#FFF",
                  lineHeight: 1.2,
                }}
              >
                {REELS[active].caption}
              </div>
              <div
                style={{
                  display: "flex",
                  gap: 14,
                  marginTop: 8,
                  color: "rgba(255,255,255,0.78)",
                  fontFamily: "var(--mono)",
                  fontSize: 11,
                  letterSpacing: "0.18em",
                  textTransform: "uppercase",
                }}
              >
                <span>{REELS[active].meta.split("·")[0].trim()}</span>
                <span>{REELS[active].meta.split("·")[1].trim()}</span>
              </div>
            </div>
            <button
              onClick={() => setActive(null)}
              aria-label="Kapat"
              style={{
                position: "absolute",
                top: 12,
                right: 12,
                width: 36,
                height: 36,
                borderRadius: "50%",
                background: "rgba(255,255,255,0.92)",
                color: "#14100B",
                display: "grid",
                placeItems: "center",
              }}
            >
              <svg width="14" height="14" viewBox="0 0 16 16">
                <path
                  d="M3 3 L13 13 M13 3 L3 13"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                />
              </svg>
            </button>
          </div>
        </div>
      )}

      <section className="section" style={{ background: "var(--bg-warm)" }}>
        <div className="wrap">
          <SectionHead
            alignment="center"
            eyebrow="Press · stamping kindly"
            title={
              <>
                People <span className="script">talking.</span>
              </>
            }
          />
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(4, 1fr)",
              gap: 24,
              marginTop: 50,
            }}
            data-row="press-strip"
          >
            {PRESS.map((p, i) => (
              <div
                key={p.name}
                className="reveal"
                style={{
                  transitionDelay: `${i * 60}ms`,
                  padding: 28,
                  background: "#FFF",
                  borderRadius: "var(--r-md)",
                }}
              >
                <div className="eyebrow" style={{ marginBottom: 14 }}>
                  {p.name}
                </div>
                <div
                  style={{
                    fontFamily: "var(--serif)",
                    fontStyle: "normal",
                    fontSize: 17,
                    lineHeight: 1.4,
                  }}
                >
                  “{p.quote}”
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
