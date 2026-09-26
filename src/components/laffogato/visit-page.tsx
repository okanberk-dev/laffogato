"use client";

import { useState, useMemo, Fragment } from "react";

import { SITE } from "@/lib/seo/site";
import { priceLabel } from "@/lib/utils/format";

import { PageHero } from "./page-hero";
import { LOCATION } from "./data";
import { SectionHead } from "./ui";
import {
  BarRenderScene,
  CupEmblem,
  EspressoCup,
  MatchaGlass,
  PhotoSurface,
} from "./visuals";
import type { PageProps } from "./page-shared";

export function PageVisit({ visit, settings }: PageProps) {
  const courierFee = priceLabel(settings?.courierFeeMinor ?? 5500);
  const addressLines = visit?.addressLines ?? LOCATION.address;
  const visitPhone = visit?.phone ?? LOCATION.phone;
  const visitEmail = visit?.email ?? LOCATION.email;
  const visitHours = visit?.hours ?? LOCATION.hours;
  /**
   * Seven identical rows is not information, it is a wall. When every day
   * carries the same hours the block says "Her gün" once, as the printed sign
   * and the prototype both do; a venue with a different Sunday still gets its
   * seven rows.
   */
  const compactHours = useMemo(() => {
    if (visitHours.length < 2) return visitHours;
    const [, first] = visitHours[0];
    return visitHours.every(([, v]) => v === first)
      ? ([["Her gün", first]] as [string, string][])
      : visitHours;
  }, [visitHours]);
  // A fixed query rather than the displayed address lines: those are editable
  // from the admin panel, and a stray edit must not send visitors to the wrong
  // place or break the embed's geocoding.
  const mapQuery = LOCATION.mapsQuery;
  const directionsUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(mapQuery)}`;
  const appleMapsUrl = `https://maps.apple.com/?q=${encodeURIComponent(mapQuery)}`;
  const mapEmbedUrl = `https://www.google.com/maps?q=${encodeURIComponent(mapQuery)}&hl=tr&z=16&output=embed`;
  const [partySize, setPartySize] = useState(2);
  const [day, setDay] = useState("Bu akşam");
  const [time, setTime] = useState("19:30");

  return (
    <div className="page" data-screen-label="05 Visit">
      {/* The prototype's visit opening: the real terrace photograph beside a
          dark green facts block, rather than a full-bleed drawn scene under a
          132px headline. */}
      <PageHero
        scene="house"
        eyebrow="Ziyaret · Tuzla, İstanbul"
        title={["200 yıllık köşkte,", "gece 02:00'e kadar"]}
        lede="Postane Mahallesi'nde restore bir Rum köşkü: 24 koltuk, bahçe terası ve üst katta özel karaoke odası. Marmaray Tuzla'ya 6 dakika, ücretsiz vale."
      />
      <section className="visit-open">
        <div className="wrap">
          <div className="visit-open-grid">
            <div className="visit-open-photo">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/photos/terrace-wide.webp"
                alt="Köşkün terası ve bahçesi"
                loading="eager"
                fetchPriority="high"
              />
            </div>
            <div className="visit-open-side">
              <div className="visit-facts-card">
                <div>
                  <div className="eyebrow on-dark">Adres</div>
                  <p>
                    {addressLines.map((l, i) => (
                      <Fragment key={l}>
                        {i > 0 && <br />}
                        {l}
                      </Fragment>
                    ))}
                  </p>
                </div>
                <div>
                  <div className="eyebrow on-dark">Saatler</div>
                  <p>
                    {compactHours.map(([label, value]) => (
                      <Fragment key={label}>
                        {label} {value}
                        <br />
                      </Fragment>
                    ))}
                    Karaoke 12:00 - 24:00
                    <br />
                    Mutfak 23:30’da kapanır
                  </p>
                </div>
                <div>
                  <div className="eyebrow on-dark">İletişim</div>
                  <p>
                    {visitPhone}
                    <br />
                    {visitEmail}
                  </p>
                </div>
              </div>

              <div className="visit-stats-card">
                <div>
                  <div className="visit-stat-n">24</div>
                  <div className="visit-stat-l">
                    koltuk · 12 bar + 12 lounge
                  </div>
                </div>
                <div>
                  <div className="visit-stat-n">02:00</div>
                  <div className="visit-stat-l">gece kapanış</div>
                </div>
                <div>
                  <div className="visit-stat-n">{courierFee}</div>
                  <div className="visit-stat-l">Tuzla içi kurye</div>
                </div>
                <div>
                  <div className="visit-stat-n">Var</div>
                  <div className="visit-stat-l">otopark · sokak</div>
                </div>
              </div>

              <div className="visit-open-cta">
                <a
                  href={directionsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-primary"
                >
                  Yol tarifi al ↗
                </a>
                <a href="/karaoke" className="btn btn-ghost">
                  Karaoke rezervasyonu
                </a>
              </div>
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

          <figure className="reveal r1 visit-map" style={{ margin: 0 }}>
            <iframe
              title="L’Affogato - Tuzla konumu, Google Haritalar"
              src={mapEmbedUrl}
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              allow="fullscreen"
              className="visit-map-frame"
            />
            <figcaption className="visit-map-caption">
              <span>
                <strong>{LOCATION.landmark}</strong> ·{" "}
                {SITE.address.streetAddress}
              </span>
              <a href={directionsUrl} target="_blank" rel="noopener">
                Yol tarifi al <span className="arrow">→</span>
              </a>
            </figcaption>
          </figure>
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
            <div className="eyebrow">Saatler · Köşk</div>
            <h2 className="h1" style={{ marginTop: 16 }}>
              {/* Tek satırlık tarifede başlık tablodan türetilir; panelden saat
                  değişirse ikisi birlikte değişir. Çok satırlı tarifede genel
                  başlığa düşer - sabit "09-01" yazsaydık, panelin ilk
                  düzenlemesinde başlık tabloyla çelişirdi. */}
              {visitHours.length === 1 ? (
                <>
                  {visitHours[0][0]},{" "}
                  <span className="script">
                    {visitHours[0][1].replace(" - ", "-")}.
                  </span>
                </>
              ) : (
                <>
                  Açık olduğumuz <span className="script">saatler.</span>
                </>
              )}
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
                  {/* Kapanıştan yarım saat önce - 02:00 kapanışla 01:30.
                      (22:30, eski 23:00 kapanışından kalmıştı.) */}
                  Son siparişler 00:30
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
                09:00 - 02:00
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

            {/* Rezervasyon telefonla alınıyor: site üzerinden masa ayırtma
                yok ve Kullanım Şartları da bunu böyle yazıyor. Buradaki
                seçimler, aramadan önce ne söyleyeceğinizi hazırlar. */}
            <a
              className="btn btn-primary btn-lg"
              href={`tel:${SITE.phoneE164}`}
              style={{
                width: "100%",
                justifyContent: "space-between",
                marginTop: 8,
              }}
            >
              <span>
                {partySize} kişi · {day} · {time} için ara
              </span>
              <span className="arrow">→</span>
            </a>

            <div
              style={{
                fontSize: 12,
                color: "var(--ink-mute)",
                lineHeight: 1.55,
                marginTop: 14,
              }}
            >
              Rezervasyon yalnızca telefonla: <strong>{SITE.phone}</strong>. 90
              dk masa; iptal için en az 3 saat önce haber verin. Bar köşesi
              rezervasyona kapalı - yürüyüşle gelin.
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
                  <CupEmblem size={240} bg="#f3f5f2" />
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
        data-ground="dark"
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
              ["10-24", "Esnek saat"],
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
