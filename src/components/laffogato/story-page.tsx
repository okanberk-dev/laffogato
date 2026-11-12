"use client";

import Image from "next/image";

import { Illustration, type IllustrationName } from "./illustration";
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

/**
 * A drawing for each milestone the timeline knows by its year: the Bologna
 * portico with the bar's sign, the cup and its spoon, a Bronte pistachio
 * branch, the Tuzla köşk. A year the panel adds later simply has none.
 */
const TIMELINE_ART: Record<string, IllustrationName> = {
  "1897": "story-1897",
  "1994": "story-1994",
  "2008": "story-2008",
  "2026": "story-2026",
};

export function PageStory({ press, storyTimeline, content }: PageProps) {
  const PRESS = press ?? SEED_PRESS;
  const heritage = storyTimeline ?? STORY.heritage;
  const c = (k: string, fallback: string) => content?.[k] ?? fallback;

  // Each card has its line icon: the köşk's door (the one bar), a cup with a
  // leaf (the recipe and the milk), a laptop asleep (no work after 18:00),
  // the refill tin, a slow clock, and a barista's apron with a heart.
  const values: Array<{
    n: string;
    icon: IllustrationName;
    t: string;
    d: string;
  }> = [
    {
      n: "01",
      icon: "ilke-kapi",
      t: "Tek bir bar, tek bir ritüel",
      d: "Menü kısa kalır. Sezonluk değişir ama liste hiçbir zaman altı affogato’dan fazla olmaz.",
    },
    {
      n: "02",
      icon: "ilke-fincan",
      t: "İtalyan reçete, yerel süt",
      d: "Haftalık taze kavurma. Trakya küçük mandıradan günlük süt. Her ürün izlenebilir.",
    },
    {
      n: "03",
      icon: "ilke-laptop",
      t: "Laptop yok, ses az",
      d: "Akşam 18:00’den sonra çalışma yok. Müzik 65dB üzerine çıkmaz. Bar, sohbet için.",
    },
    {
      n: "04",
      icon: "ilke-teneke",
      t: "Zero waste",
      d: "Yenilebilir kup, kompost gelato bardağı, yeniden doldurulan teneke. 2025'ten beri tek kullanımlık plastik yok.",
    },
    {
      n: "05",
      icon: "ilke-saat",
      t: "Yavaş büyüme",
      d: "Acele açılış yok. Her yeni fikir önce Tuzla köşkünde denenir; ana mekân her zaman ana mekân kalır.",
    },
    {
      n: "06",
      icon: "ilke-onluk",
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
        title={["Bologna 1897’den", "Tuzla’ya"]}
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
                loading="eager"
                fetchPriority="high"
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
            <Stat n="1897" l="Kuruluş" d="Bologna · 1897" />
            <Stat
              n="1994"
              l="Yenilebilir kup patenti"
              d="Mancuso ailesi patenti"
            />
            <Stat
              n="2026"
              l="İstanbul açılışı"
              d="Tuzla · ilk yurt dışı şube"
            />
            <Stat n="III" l="Kuşak" d="Eda Mancuso · 3. kuşak" />
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
              Eda <span className="script">Mancuso</span>
            </h2>
            <p className="lede" style={{ marginTop: 22 }}>
              {c("story.founder.bio", STORY.founder.bio)}
            </p>
            <blockquote
              style={{
                margin: "32px 0",
                padding: "24px 28px",
                borderLeft: "2px solid var(--amber)",
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
                fontFamily: "var(--headline)",
                fontSize: 38,
                lineHeight: 1,
                color: "var(--accent)",
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
        style={{ background: "var(--roast)", color: "var(--ink-on-dark)" }}
      >
        <div className="wrap-wide">
          <div className="reveal" style={{ marginBottom: 70 }}>
            <div className="eyebrow on-dark">Zaman çizelgesi</div>
            <h2
              className="h1"
              style={{ marginTop: 16, color: "var(--ink-on-dark)" }}
            >
              Buraya nasıl <span className="script">geldik</span>
            </h2>
          </div>
          <div className="timeline">
            {heritage.map((ev, i) => (
              <div
                key={ev.y}
                className="timeline-row reveal"
                style={{ transitionDelay: `${i * 60}ms` }}
              >
                <div className="timeline-when">
                  <div className="timeline-year">{ev.y}</div>
                  {TIMELINE_ART[ev.y.trim()] ? (
                    <Illustration
                      name={TIMELINE_ART[ev.y.trim()]}
                      className="timeline-art"
                    />
                  ) : null}
                </div>
                <div className="timeline-dot">
                  <span></span>
                </div>
                <div className="timeline-content">
                  <h3 className="h3" style={{ color: "var(--ink-on-dark)" }}>
                    {ev.t}
                  </h3>
                  <p
                    style={{
                      marginTop: 10,
                      color: "var(--night-ink-soft)",
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
            eyebrow="İlkeler"
            title={
              <>
                Koruduğumuz <span className="script">altı ilke</span>
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
                <Illustration name={v.icon} className="value-icon" />
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
            eyebrow="Ritüel · 27 saniye"
            title={
              <>
                Dört adımda <span className="script">döküş</span>
              </>
            }
          />
          <ol className="pour-steps" data-row="pour-row">
            {pourSteps.map((s, i) => (
              <li
                key={s.step}
                className="pour-step reveal"
                style={{ transitionDelay: `${i * 80}ms` }}
              >
                <PhotoSurface hue={["stone", "caramel", "espresso", "warm"][i]}>
                  <div className="pour-step-art">
                    {i === 0 && <BeanIllo />}
                    {i === 1 && <EspressoCup />}
                    {i === 2 && <EspressoCup />}
                    {i === 3 && <EdibleCupHero scoop="cream" topping="wafer" />}
                  </div>
                </PhotoSurface>
                <span className="pour-step-num" aria-hidden="true">
                  {s.step}
                </span>
                <div className="pour-step-copy">
                  <h3 className="pour-step-title">{s.t}</h3>
                  <p className="pour-step-note">{s.d}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Only quotes a publication actually gave (/admin/basin). None yet:
          no heading drawn over an empty wall. */}
      {PRESS.length > 0 ? (
        <section className="section-tight">
          <div className="wrap">
            <SectionHead
              alignment="center"
              eyebrow="Basında"
              title={
                <>
                  Hakkımızda <span className="script">yazılanlar</span>
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
                    borderRadius: "var(--r-card)",
                    background: "var(--surface)",
                    boxShadow: "var(--shadow-card)",
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
          {/* The whole brand in one picture: the cup, bitten. */}
          <Illustration name="story-kupa" className="story-close-art reveal" />
          {/* The registered slogan, in its own language (lang="en": the
              page is Turkish, and its upper case would dot every i). The
              "1897" signature and the "That’s the whole brand" line went on
              12 Kas 2026: the timeline dates the edible cup to 1994. */}
          <h2 className="h1 reveal r1" lang="en">
            “Drink it. <span className="script">Eat the cup</span>”
          </h2>
        </div>
      </section>
    </div>
  );
}
