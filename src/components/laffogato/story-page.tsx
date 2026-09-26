"use client";

import Image from "next/image";

import { PageHero } from "./page-hero";
import { PRESS as SEED_PRESS, STORY } from "./data";
import { SectionHead, Stat } from "./ui";
import {
  BeanIllo,
  EdibleCupHero,
  EspressoCup,
  FounderPortrait,
  PhotoSurface,
} from "./visuals";
import type { PageProps } from "./page-shared";

export function PageStory({ press, storyTimeline, content }: PageProps) {
  const PRESS = press ?? SEED_PRESS;
  const heritage = storyTimeline ?? STORY.heritage;
  const c = (k: string, fallback: string) => content?.[k] ?? fallback;

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
      <PageHero
        scene="velvet"
        eyebrow="Hikaye · 1897 → 2026"
        title={["Bologna 1897’den", "Tuzla’ya."]}
        lede={c(
          "story.hero.lede",
          "İlk yurt dışı şubemiz - 200 yıllık, Rum’lardan kalma restore bir köşkte. İtalyan baba, İstanbullu anne: Eda Mancuso, büyük dedesinin 1897’de açtığı L’Affogato barını dördüncü kuşak olarak devraldı ve 2026’da markayı doğduğu şehre getirdi.",
        )}
      />
      <section className="story-hero">
        <div className="wrap">
          {/* The köşk itself. These are the venue photographs from the design
              handoff - the page used to carry only drawn illustrations. */}
          <div className="story-mosaic">
            <div className="story-mosaic-lead">
              <Image
                src="/photos/facade-day.webp"
                alt="Tuzla'daki restore ahşap köşk"
                width={765}
                height={1020}
                sizes="(max-width: 560px) 100vw, 640px"
                style={{ objectPosition: "50% 58%" }}
              />
            </div>
            <div>
              <Image
                src="/photos/interior-mirror.webp"
                alt="Köşkün içi - terracotta duvar ve altın ayna"
                width={765}
                height={1020}
                sizes="(max-width: 560px) 50vw, 320px"
              />
            </div>
            <div>
              <Image
                src="/photos/interior-chest.webp"
                alt="Köşkün içi - ahşap sandık ve vitrin"
                width={765}
                height={1020}
                sizes="(max-width: 560px) 50vw, 320px"
              />
            </div>
            <div>
              <Image
                src="/photos/terrace-canopy.webp"
                alt="Hasır gölgelikli teras"
                width={765}
                height={1020}
                sizes="(max-width: 560px) 50vw, 320px"
              />
            </div>
            <div>
              <Image
                src="/photos/drinks-tray.webp"
                alt="Terasta soğuk içecekler"
                width={765}
                height={1020}
                sizes="(max-width: 560px) 50vw, 320px"
              />
            </div>
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
            <Stat n="1897" l="Anno fondazione" d="Bologna · 1897" />
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
              - Eda
            </div>
          </div>
        </div>
      </section>

      <section
        className="section"
        data-ground="dark"
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
                    color: i === 2 ? "#FFF" : "#1d1c1c",
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

      {/* Only quotes a publication actually gave (/admin/basin). None yet:
          no heading drawn over an empty wall. */}
      {PRESS.length > 0 ? (
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
              {PRESS.map((p, i) => (
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
      ) : null}

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
            Giancarlo Mancuso · 1897
          </div>
        </div>
      </section>
    </div>
  );
}
