"use client";

import Image from "next/image";

import Link from "@/components/link";

import { PageHero } from "./page-hero";
import { PRESS as SEED_PRESS, STORY } from "./data";
import type { PageProps } from "./page-shared";

/**
 * /hikayemiz, in the reference's story layout: the wide photograph and the
 * title, then sections that alternate photograph and text on the white
 * page and the band, the timeline as ruled rows, the principles and the
 * pour as small grids. The copy is the panel's where the panel has a key
 * (story.hero.lede, story.founder.bio) and the timeline is /admin/hikaye.
 */
export function PageStory({ press, storyTimeline, content }: PageProps) {
  const PRESS = press ?? SEED_PRESS;
  const heritage = storyTimeline ?? STORY.heritage;
  const c = (k: string, fallback: string) => content?.[k] ?? fallback;

  const values = [
    {
      t: "Tek bir bar, tek bir ritüel",
      d: "Menü kısa kalır. Sezonluk değişir ama liste hiçbir zaman altı affogato’dan fazla olmaz.",
    },
    {
      t: "İtalyan reçete, yerel süt",
      d: "Haftalık taze kavurma. Trakya küçük mandıradan günlük süt. Her ürün izlenebilir.",
    },
    {
      t: "Laptop yok, ses az",
      d: "Akşam 18:00’den sonra çalışma yok. Müzik 65dB üzerine çıkmaz. Bar, sohbet için.",
    },
    {
      t: "Zero waste",
      d: "Yenilebilir kup, kompost gelato bardağı, yeniden doldurulan teneke. 2025'ten beri tek kullanımlık plastik yok.",
    },
    {
      t: "Yavaş büyüme",
      d: "Acele açılış yok. Her yeni fikir önce Tuzla köşkünde denenir; ana mekân her zaman ana mekân kalır.",
    },
    {
      t: "Personel mutluluğu",
      d: "İlk yıl çalışan turnover’ı %0. Yıllık 6 hafta tatil, sigorta artı, Bologna ziyareti.",
    },
  ];

  const pourSteps = [
    { t: "Tartı", d: "18g Sirena, taze öğüt." },
    { t: "Tamper", d: "15kg, eşit basınç." },
    { t: "27 saniye", d: "36g out, 93°C." },
    { t: "Döküş", d: "Masada, gelato üzerine." },
  ];

  const facts = [
    { n: "1897", l: "Kuruluş", d: "Bologna" },
    { n: "1994", l: "Yenilebilir kup", d: "Mancuso ailesi patenti" },
    { n: "2026", l: "İstanbul açılışı", d: "Tuzla, ilk yurt dışı şube" },
    { n: "III", l: "Kuşak", d: "Eda Mancuso" },
  ];

  return (
    <div className="page" data-screen-label="04 Story">
      <PageHero
        title="Bologna 1897’den Tuzla’ya"
        lede={c(
          "story.hero.lede",
          "İlk yurt dışı şubemiz - 200 yıllık, Rum’lardan kalma restore bir köşkte. İtalyan baba, İstanbullu anne: Eda Mancuso, büyük dedesinin 1897’de açtığı L’Affogato barını dördüncü kuşak olarak devraldı ve 2026’da markayı doğduğu şehre getirdi.",
        )}
        image={{ src: "/photos/hero-story.webp" }}
      />

      {/* The köşk ──────────────────────────────────────────── */}
      <section className="section section--band" aria-labelledby="story-kosk">
        <div className="wrap story-split">
          <div className="story-split-copy">
            <h2 id="story-kosk" className="t-display">
              Köşk
            </h2>
            <p className="t-body">
              Tuzla Postane Mahallesi&apos;nde, Rum&apos;lardan kalma 200 yıllık
              ahşap bir köşk. Altta bar ve bahçe terası, üst katta karaoke
              odası. Restorasyonda köşkün kapısı, aynası ve sandığı yerinde
              kaldı; bar onların arasına kuruldu.
            </p>
          </div>
          <div className="story-split-media story-mosaic">
            <div className="media story-mosaic-lead">
              <Image
                src="/photos/facade-day.webp"
                alt="Tuzla'daki restore ahşap köşk"
                fill
                sizes="(max-width: 767px) 100vw, 30vw"
                style={{ objectPosition: "50% 58%" }}
              />
            </div>
            <div className="media">
              <Image
                src="/photos/interior-mirror.webp"
                alt="Köşkün içi: terracotta duvar ve altın ayna"
                fill
                sizes="(max-width: 767px) 50vw, 15vw"
              />
            </div>
            <div className="media">
              <Image
                src="/photos/terrace-canopy.webp"
                alt="Hasır gölgelikli teras"
                fill
                sizes="(max-width: 767px) 50vw, 15vw"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Facts ─────────────────────────────────────────────── */}
      <section className="section" aria-label="Rakamlarla">
        <div className="wrap">
          <ul className="fact-row" role="list">
            {facts.map((f) => (
              <li key={f.n}>
                <p className="fact-n">{f.n}</p>
                <p className="t-label">{f.l}</p>
                <p className="t-small t-muted">{f.d}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* The founder ───────────────────────────────────────── */}
      <section className="section section--band" aria-labelledby="story-founder">
        <div className="wrap story-split story-split--flip">
          <div className="story-split-media media ratio-6-5">
            <Image
              src="/photos/interior-chest.webp"
              alt="Köşkün içi: ahşap sandık ve vitrin"
              fill
              sizes="(max-width: 767px) 100vw, 50vw"
            />
          </div>
          <div className="story-split-copy">
            <p className="t-label">Kurucu · Üçüncü kuşak</p>
            <h2 id="story-founder" className="t-display">
              Eda Mancuso
            </h2>
            <p className="t-body">{c("story.founder.bio", STORY.founder.bio)}</p>
            <blockquote className="story-quote">
              <p className="t-body">
                “Affogato benim için bir kahve değil, bir ritüel. Floransa’da
                Ditta’da çalışırken her servisin sonunda baristalar küçük bir
                gelato üzerine espresso döker, ayakta içerdik. L’Affogato o anı
                bir mekana dönüştürme denemesi.”
              </p>
              <footer className="t-label">Eda</footer>
            </blockquote>
          </div>
        </div>
      </section>

      {/* The timeline ──────────────────────────────────────── */}
      <section className="section" aria-labelledby="story-timeline">
        <div className="wrap">
          <div className="section-head">
            <h2 id="story-timeline" className="t-display">
              Buraya nasıl geldik
            </h2>
          </div>
          <ol className="timeline" role="list">
            {heritage.map((ev) => (
              <li key={ev.y} className="timeline-row">
                <p className="timeline-year">{ev.y}</p>
                <div>
                  <h3 className="t-title">{ev.t}</h3>
                  <p className="t-body t-muted">{ev.d}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* The principles ────────────────────────────────────── */}
      <section className="section section--band" aria-labelledby="story-values">
        <div className="wrap">
          <div className="section-head section-head--center">
            <h2
              id="story-values"
              className="t-display t-display--quiet t-center"
            >
              Koruduğumuz altı ilke
            </h2>
          </div>
          <ul className="value-grid" role="list">
            {values.map((v, i) => (
              <li key={v.t} className="value-card">
                <p className="t-label t-muted">
                  {String(i + 1).padStart(2, "0")}
                </p>
                <h3 className="t-title">{v.t}</h3>
                <p className="t-body">{v.d}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* The pour ──────────────────────────────────────────── */}
      <section className="section" aria-labelledby="story-pour">
        <div className="wrap">
          <div className="section-head">
            <h2 id="story-pour" className="t-display">
              Dört adımda döküş
            </h2>
          </div>
          <ol className="step-row" role="list">
            {pourSteps.map((s, i) => (
              <li key={s.t} className="step-card">
                <p className="t-title">
                  {i + 1}. {s.t}
                </p>
                <p className="t-body">{s.d}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Only quotes a publication actually gave (/admin/basin). */}
      {PRESS.length > 0 ? (
        <section className="section section--band" aria-labelledby="story-press">
          <div className="wrap">
            <div className="section-head section-head--center">
              <h2
                id="story-press"
                className="t-display t-display--quiet t-center"
              >
                Hakkımızda yazılanlar
              </h2>
            </div>
            <ul className="quote-row" role="list">
              {PRESS.map((p) => (
                <li key={p.name} className="quote-card">
                  <p className="t-body">“{p.quote}”</p>
                  <p className="t-label">{p.name}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>
      ) : null}

      {/* The registered slogan, in its own language (lang="en": the page is
          Turkish, and its upper case would dot every i). */}
      <section className="section story-close">
        <div className="wrap t-center">
          <h2 className="t-display t-display--xl" lang="en">
            Drink it. Eat the cup.
          </h2>
          <Link className="btn btn-wide" href="/menu">
            Menüyü gör
          </Link>
        </div>
      </section>
    </div>
  );
}
