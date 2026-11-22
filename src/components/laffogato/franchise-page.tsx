import Image from "next/image";

import Link from "@/components/link";
import type { SiteImage } from "@/lib/admin/site-images-core";
import {
  FRANCHISE_PRIVACY_PATH,
  FRANCHISE_RETENTION_MONTHS,
} from "@/lib/franchise/franchise-core";

import { FranchiseForm } from "./franchise-form";
import { PageHero } from "./page-hero";

/**
 * /franchise (operator, 22 Kas 2026: "franchise bölümü ekle form
 * doldurulan ve açılır sectionlar dahil tasarım metriklerine uyumlu olsun
 * estetik yap"). The site's language throughout: the page opener, a split
 * on the band, accordions under hairlines with the heading on the left,
 * the steps as ruled rows, the form on the band. White and band alternate.
 *
 * Copy is careful by design: no fee, royalty, investment figure, return or
 * branch count is promised here. The legal texts say no one may ask for an
 * application fee in the company's name (src/lib/legal/content.ts, "Kurumsal
 * Satış ve Basın İletişimi"); the FAQ says the same.
 *
 * A server component; only the form is a client island.
 */

const OFFERS: Array<{ title: string; body: string[] }> = [
  {
    title: "Marka ve mekân kimliği",
    body: [
      "L'Affogato adı ve L'Af işareti, sitede ve köşkte gördüğün görsel dil: yazı, renk, malzeme, tabela ve ambalaj.",
      "Mekânın yerleşimini ve iç düzenini, kendi yerinin ölçülerine göre birlikte planlarız.",
    ],
  },
  {
    title: "Menü ve reçeteler",
    body: [
      "Espresso bazlı kahveler, matcha, soğuk içecekler ve imzamız affogato; yenilebilir kupta servis dahil.",
      "Reçeteler ve sunum köşktekiyle aynıdır; menünün sezon değişiklikleri birlikte planlanır.",
    ],
  },
  {
    title: "Eğitim ve açılış",
    body: [
      "Bar ve servis ekibinin reçeteleri, ekipmanı ve misafir karşılamayı öğrenmesi açılıştan önce planlanır.",
      "Eğitimin süresi ve açılış dönemindeki destek, görüşmede mekâna göre netleşir.",
    ],
  },
  {
    title: "Tedarik",
    body: [
      "Çekirdek kahve, mağazada satılan ürünler ve servis malzemeleri için tedarik düzeni sözleşmede yazılı olarak belirlenir.",
    ],
  },
  {
    title: "Dijital kanallar",
    body: [
      "Bugün online mağaza, L'Affogato uygulaması, damga programı ve masadan sipariş Tuzla köşkü için çalışıyor.",
      "Bunların yeni bir şubede nasıl açılacağı, görüşmenin konularından biridir.",
    ],
  },
  {
    title: "Karaoke odası",
    body: [
      "Köşkün üst katındaki karaoke odası konseptin parçası. Yerin uygunsa yeni şubede de bir oda planlanabilir.",
    ],
  },
];

const STEPS: Array<{ title: string; body: string }> = [
  {
    title: "Başvuru",
    body: "Aşağıdaki formu doldurursun; başvurun doğrudan ekibimize ulaşır.",
  },
  {
    title: "Tanışma görüşmesi",
    body: "Seni ararız; beklentilerini, yerini ve konsepti birlikte konuşuruz.",
  },
  {
    title: "Lokasyon değerlendirmesi",
    body: "Önerdiğin mekânı ya da bölgeyi; trafiği, ölçüleri ve çevresiyle birlikte değerlendiririz.",
  },
  {
    title: "Sözleşme",
    body: "Koşullar netleşince franchise sözleşmesi yazılı olarak imzalanır.",
  },
  {
    title: "Kurulum ve açılış",
    body: "Mekân hazırlanır, ekip eğitilir ve kapılar açılır.",
  },
];

function faq(email: string): Array<{ q: string; a: React.ReactNode }> {
  return [
    {
      q: "Başvuru ücretli mi?",
      a: (
        <>
          Hayır. Başvuru ve tanışma görüşmesi ücretsizdir. L&apos;Affogato
          adına başvuru ücreti, dosya bedeli ya da ön ödeme isteyen biriyle
          karşılaşırsan bize <a href={`mailto:${email}`}>{email}</a> adresinden
          bildir.
        </>
      ),
    },
    {
      q: "Yatırım tutarı ve franchise bedeli ne kadar?",
      a: "Mekânın büyüklüğüne, şehrine ve kurulum ihtiyacına göre değişir. Rakamları ve koşulları tanışma görüşmesinde, yazılı olarak paylaşırız.",
    },
    {
      q: "Hangi şehirlerde franchise veriyorsunuz?",
      a: "Başvuruları şehir şehir, yerin kendisiyle birlikte değerlendiriyoruz. Formda il ve ilçeni yazman yeterli.",
    },
    {
      q: "Sektör deneyimi gerekli mi?",
      a: "Deneyimin değerlendirmenin bir parçasıdır, tek ölçütü değildir. Yiyecek-içecek ya da perakende deneyimin yoksa da başvurabilirsin.",
    },
    {
      q: "Hazır bir mekânım yoksa başvurabilir miyim?",
      a: "Evet. Formda yer aradığını ya da henüz bakmadığını seç; uygun yeri birlikte değerlendiririz.",
    },
    {
      q: "Başvurudan sonra ne olur?",
      a: "Başvurun ekibimize ulaşır. Okuduktan sonra formda yazdığın telefondan ya da e-postadan sana döneriz.",
    },
    {
      q: "Bilgilerim nasıl kullanılır?",
      a: (
        <>
          Yalnız başvurunu değerlendirmek ve seninle iletişime geçmek için.
          Başvurun {FRANCHISE_RETENTION_MONTHS} ay sonra silinir; daha önce
          silinmesini istersen bize yazman yeterli. Ayrıntı:{" "}
          <Link href={FRANCHISE_PRIVACY_PATH}>KVKK Aydınlatma Metni</Link>.
        </>
      ),
    },
  ];
}

/** An accordion row: Archivo title, a drawn plus that turns to a minus. */
function Accordion({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <details className="franchise-acc-item">
      <summary>
        <span className="t-title">{title}</span>
        <span className="franchise-acc-mark" aria-hidden="true" />
      </summary>
      <div className="franchise-acc-body">{children}</div>
    </details>
  );
}

export function FranchisePage({
  heroImage,
  conceptImage,
  contactEmail,
}: {
  heroImage: SiteImage;
  conceptImage: SiteImage;
  contactEmail: string;
}) {
  return (
    <>
      <PageHero
        eyebrow="İş ortaklığı"
        title="Franchise"
        lede="Köşkte kurduğumuz kahve, affogato ve karaoke düzenini yeni şehirlere ve semtlere taşıyacak iş ortaklarıyla konuşuyoruz. Başvurunu bırak, seni arayalım."
        image={heroImage.src ? { src: heroImage.src, alt: heroImage.alt } : undefined}
      >
        <a className="btn btn-dark btn-wide" href="#basvuru">
          Başvuru formuna git
        </a>
      </PageHero>

      {/* The concept ─────────────────────────────────────── */}
      <section
        className="section section--band"
        aria-labelledby="franchise-concept"
      >
        <div className="wrap franchise-split">
          <div className="franchise-split-copy">
            <p className="t-label t-muted">Konsept</p>
            <h2 id="franchise-concept" className="t-display">
              Köşkten doğan bir kahve evi
            </h2>
            <p className="t-body">
              L&apos;Affogato, Tuzla&apos;da 200 yıllık restore bir Rum
              köşkünde açıldı. Gündüz kahve ve affogato, akşam üst kattaki
              karaoke odası; aynı adla online mağaza ve uygulama.
            </p>
            <ul className="franchise-points" role="list">
              <li>
                <p className="t-title">Kahve ve affogato</p>
                <p className="t-small t-muted">
                  Espresso bazlı içecekler ve imzamız: yenilebilir kupta
                  affogato.
                </p>
              </li>
              <li>
                <p className="t-title">Karaoke odası</p>
                <p className="t-small t-muted">
                  Saatlik ayrılan, yalnız misafirine ait bir oda.
                </p>
              </li>
              <li>
                <p className="t-title">Mağaza ve uygulama</p>
                <p className="t-small t-muted">
                  Çekirdek kahve ve hediye setleri, damga programı ve
                  uygulamadan sipariş.
                </p>
              </li>
            </ul>
          </div>
          {conceptImage.src ? (
            <div className="franchise-split-media media">
              <Image
                src={conceptImage.src}
                unoptimized={conceptImage.src.startsWith("/gorsel/")}
                alt={conceptImage.alt}
                fill
                sizes="(max-width: 1023px) 100vw, 58vw"
                style={{ objectPosition: "50% 55%" }}
              />
            </div>
          ) : null}
        </div>
      </section>

      {/* What we offer ───────────────────────────────────── */}
      <section className="section" aria-labelledby="franchise-offers">
        <div className="wrap franchise-duo">
          <div className="franchise-duo-head">
            <h2 id="franchise-offers" className="t-display">
              Neler sunuyoruz
            </h2>
            <p className="t-body">
              Kapsam ve koşullar şehre ve mekâna göre değişir; ayrıntıları
              tanışma görüşmesinde yazılı olarak paylaşırız.
            </p>
          </div>
          <div className="franchise-acc">
            {OFFERS.map((o) => (
              <Accordion key={o.title} title={o.title}>
                {o.body.map((p) => (
                  <p key={p} className="t-body">
                    {p}
                  </p>
                ))}
              </Accordion>
            ))}
          </div>
        </div>
      </section>

      {/* The process ─────────────────────────────────────── */}
      <section
        className="section section--band"
        aria-labelledby="franchise-steps"
      >
        <div className="wrap franchise-duo">
          <div className="franchise-duo-head">
            <h2 id="franchise-steps" className="t-display">
              Başvurudan açılışa
            </h2>
            <p className="t-body">
              Formdan kapıların açıldığı güne beş adım; koşullar her zaman
              yazılı.
            </p>
          </div>
          <ol className="franchise-steps">
            {STEPS.map((s, i) => (
              <li key={s.title} className="franchise-step">
                <span className="franchise-step-n" aria-hidden="true">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <h3 className="t-title">{s.title}</h3>
                <p className="t-body franchise-step-body">{s.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Questions ───────────────────────────────────────── */}
      <section className="section" aria-labelledby="franchise-faq">
        <div className="wrap franchise-duo">
          <div className="franchise-duo-head">
            <h2 id="franchise-faq" className="t-display">
              Sık sorulan sorular
            </h2>
            <p className="t-body">
              Burada olmayan bir sorun varsa{" "}
              <a href={`mailto:${contactEmail}`}>{contactEmail}</a> adresine
              yaz.
            </p>
          </div>
          <div className="franchise-acc">
            {faq(contactEmail).map((e) => (
              <Accordion key={e.q} title={e.q}>
                <p className="t-body">{e.a}</p>
              </Accordion>
            ))}
          </div>
        </div>
      </section>

      {/* The application ─────────────────────────────────── */}
      <section
        id="basvuru"
        className="section section--band franchise-apply"
        aria-labelledby="franchise-apply"
      >
        <div className="wrap franchise-duo">
          <div className="franchise-duo-head">
            <p className="t-label t-muted">Başvuru</p>
            <h2 id="franchise-apply" className="t-display">
              Başvuru formu
            </h2>
            <p className="t-body">
              Formu doldur; başvurunu okuyup seni arayalım. Bütün alanlar
              zorunlu, isteğe bağlı olanlar yanında yazıyor.
            </p>
            <p className="t-small t-muted">
              Başvuru ücretsizdir; bizden kimse ödeme istemez.
            </p>
          </div>
          <div className="franchise-form-panel">
            <FranchiseForm contactEmail={contactEmail} />
          </div>
        </div>
      </section>
    </>
  );
}
