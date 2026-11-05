"use client";

import Image from "next/image";
import { useMemo, Fragment } from "react";

import {
  OTHER_BRANCHES,
  branchAddressLines,
  branchMapUrl,
  branchTel,
  type SiteBranch,
} from "@/lib/seo/branches";
import { SITE } from "@/lib/seo/site";
import { priceLabel } from "@/lib/utils/format";

import { LafMark } from "./brand-mark";
import { PageHero } from "./page-hero";
import { LOCATION } from "./data";
import { openStatusDetail, useOpenStatus } from "./use-open-status";
import { SectionHead } from "./ui";
import {
  BarRenderScene,
  CupEmblem,
  EspressoCup,
  MatchaGlass,
  PhotoSurface,
} from "./visuals";
import { DEFAULT_PICKUP_MINUTES, type PageProps } from "./page-shared";
import { cx } from "./cx";

export function PageVisit({ visit, settings }: PageProps) {
  const courierFee = priceLabel(settings?.courierFeeMinor ?? 5500);
  // Mobil → Ayarlar → Kurye. While it is off (5 Kas 2026: pickup only for
  // now) the courier's stat gives its place to the pickup time.
  const courierEnabled = settings?.courierEnabled !== false;
  const pickupMinutes = settings?.pickupReadyMinutes ?? DEFAULT_PICKUP_MINUTES;
  const addressLines = visit?.addressLines ?? LOCATION.address;
  // `||`: a field cleared in Ayarlar arrives as "" and must not print (or
  // dial) nothing.
  const visitPhone = visit?.phone || LOCATION.phone;
  const visitTel = visitPhone.replace(/[^\d+]/g, "") || SITE.phoneE164;
  const visitEmail = visit?.email || LOCATION.email;
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
  // place.
  const mapQuery = LOCATION.mapsQuery;
  const directionsUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(mapQuery)}`;
  const appleMapsUrl = `https://maps.apple.com/?q=${encodeURIComponent(mapQuery)}`;
  const mapUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapQuery)}`;
  // The stat under the facts: the closing time when every day shares it,
  // today's otherwise. A fixed "02:00" outlived the first hours edit.
  const closing = closingStat(compactHours, visit?.todayHours);

  return (
    <div className="page" data-screen-label="05 Visit">
      {/* The prototype's visit opening: the real terrace photograph beside a
          dark green facts block, rather than a full-bleed drawn scene under a
          132px headline. */}
      <PageHero
        scene="house"
        eyebrow="Ziyaret · Tuzla, İstanbul"
        title={[
          "200 yıllık köşkte,",
          closing.label === "gece kapanış"
            ? `gece ${untilTime(closing.value)} kadar`
            : "gece geç saate kadar",
        ]}
        lede="Postane Mahallesi'nde restore bir Rum köşkü: 24 koltuk, bahçe terası ve üst katta özel karaoke odası. Marmaray Tuzla'ya 6 dakika, ücretsiz vale."
      />
      <section className="visit-open">
        <div className="wrap">
          <div className="visit-open-grid">
            <div className="visit-open-photo">
              {/* next/image, so a phone gets a phone-sized file: the plain
                  <img> shipped the full 223 KB original to every width and
                  was the page's LCP. */}
              <Image
                src="/photos/terrace-wide.webp"
                alt="Köşkün terası ve bahçesi"
                fill
                sizes="(max-width: 900px) 100vw, 55vw"
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
                  <div className="visit-stat-n">{closing.value}</div>
                  <div className="visit-stat-l">{closing.label}</div>
                </div>
                {courierEnabled ? (
                  <div>
                    <div className="visit-stat-n">{courierFee}</div>
                    <div className="visit-stat-l">Tuzla içi kurye</div>
                  </div>
                ) : (
                  <div>
                    <div className="visit-stat-n">{pickupMinutes} dk</div>
                    <div className="visit-stat-l">uygulamadan gel-al</div>
                  </div>
                )}
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
                  Yol tarifi al
                  <span className="arrow out" aria-hidden="true">
                    ↗
                  </span>
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
              Postane, <span className="script">Tuzla</span>
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
            {/* A link, not an embed. The embed loaded only on a click, but
                it still put Google's frame (and its cookies) inside our page
                with no standard contract behind the transfer abroad (KVKK
                m.9). The drawn card costs nothing and says where the köşk
                is; the real map opens on Google's own site, in a new tab. */}
            <div className="visit-map-frame visit-map-facade">
              <MapSketch />
              <span className="visit-map-pin" aria-hidden="true">
                <LafMark tone="cream" />
              </span>
              <div className="visit-map-cta">
                <a
                  className="btn btn-primary"
                  href={mapUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Haritayı göster
                  <span className="arrow out" aria-hidden="true">
                    ↗
                  </span>
                  <span className="sr-only"> (yeni sekmede açılır)</span>
                </a>
                <p>Google Haritalar yeni sekmede açılır.</p>
              </div>
            </div>
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
        {/* The hours on the left, the live line and today's card on the
            right, bottoms aligned. The right half used to hold a table
            booking card; the only booking on the site is the karaoke room
            (/karaoke). */}
        <div
          className="wrap"
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 80,
            alignItems: "end",
          }}
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
                  Açık olduğumuz <span className="script">saatler</span>
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
          </div>

          <div className="reveal r1 visit-today-col">
            <OpenNow rows={visitHours} />
            <div className="visit-today-card">
              <div className="eyebrow">Bugün</div>
              <div className="visit-today-hours tabular">
                {visit?.todayHours ?? visitHours[0]?.[1]}
              </div>
              <p>
                Köşkün avlusu hava müsait olduğunda açık; hava kötüleşirse
                köşkün salonlarında devam ediyoruz. Mutfak 23:30&apos;da
                kapanır.
              </p>
            </div>
          </div>
        </div>
      </section>

      {OTHER_BRANCHES.map((b) => (
        <BranchSection key={b.id} branch={b} />
      ))}

      <section className="section">
        <div className="wrap-wide">
          <SectionHead
            eyebrow="Il locale · tarihi köşk"
            title={
              <>
                <span className="script">Mekan</span>
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
            <div className="gallery-cell reveal r4">
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
              Özel <span className="script">kiralama</span>
            </h2>
            <p
              className="lede"
              style={{ marginTop: 24, color: "rgba(255, 255, 255, 0.78)" }}
            >
              Pazartesi günleri köşkü tamamen kiralayabilirsiniz. 24 koltuk,
              özel menü, barista demonstrasyonu, gelato workshop’u. Marka
              lansmanları, sosyal medya çekimleri ve yakın gruplar için ideal.
            </p>
            {/* There is no form behind this: it used to be a button with no
                handler. A private booking starts with a message or a call. */}
            <div className="cta-row" style={{ marginTop: 30 }}>
              <a
                className="btn btn-light btn-lg"
                href={`mailto:${visitEmail}?subject=${encodeURIComponent("Özel kiralama")}`}
              >
                E-postayla sor <span className="arrow">→</span>
              </a>
              <a className="btn btn-glass-dark btn-lg" href={`tel:${visitTel}`}>
                Ara
              </a>
            </div>
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

/**
 * The live line under the hours table - worked out from the same rows, in
 * the köşk's time zone, on the visitor's clock. Nothing renders on the
 * server (it does not know when the page will be read); the browser fills
 * it in after hydration.
 */
function OpenNow({ rows }: { rows: [string, string][] }) {
  const st = useOpenStatus(rows);
  if (!st) return null;
  const detail = openStatusDetail(st);
  return (
    <div className={cx("open-now", st.open ? "is-open" : "is-closed")}>
      <span className="open-dot" aria-hidden="true" />
      <div>
        <div className="open-now-title">
          {st.open ? "Şu an açık" : "Şu an kapalı"}
        </div>
        {detail && <div className="open-now-sub tabular">{detail}</div>}
      </div>
    </div>
  );
}

/**
 * "02:00'ye", "01:00'e", "00:30'a": the dative follows the last number word
 * read aloud (iki-ye, bir-e, otuz-a), so the hero can say the closing time
 * the panel sets. Midnight reads "gece yarısına".
 */
export function untilTime(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  if (h === 0 && m === 0) return "yarısına";
  const last = m === 0 ? h : m;
  const unit = last % 10;
  const tens = Math.floor(last / 10) % 10;
  const UNIT = ["", "e", "ye", "e", "e", "e", "ya", "ye", "e", "a"];
  const TENS = ["", "a", "ye", "a", "a", "ye"];
  const suffix = unit ? UNIT[unit] : TENS[tens];
  return `${hhmm}'${suffix}`;
}

/**
 * "02:00 · gece kapanış" from the hours the page already shows: one row for
 * the whole week gives its closing time; a week with different days gives
 * today's ("Bugün kapalı" on a closed day).
 */
function closingStat(
  rows: [string, string][],
  today: string | undefined,
): { value: string; label: string } {
  const close = (range: string | undefined) =>
    /^\d{2}:\d{2} - (\d{2}:\d{2})$/.exec(range ?? "")?.[1];
  if (rows.length === 1) {
    const c = close(rows[0][1]);
    if (c) return { value: c, label: "gece kapanış" };
  }
  const t = close(today);
  if (t) return { value: t, label: "bugün kapanış" };
  return { value: "Kapalı", label: "bugün" };
}

/**
 * A drawn stand-in for the map (the real one is a link to Google): the
 * Marmara shore along the bottom, the E-5 and the coast road, a few
 * neighbourhood streets, the station, a park - porcelain, not Google's
 * palette. Decorative only; the pin and the caption carry the meaning.
 */
function MapSketch() {
  return (
    <svg
      className="visit-map-art"
      viewBox="0 0 400 500"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
      focusable="false"
    >
      <rect width="400" height="500" fill="#f2ece4" />
      {/* Sea */}
      <path
        d="M0 392 C 70 372 120 402 190 386 S 320 356 400 372 L 400 500 L 0 500 Z"
        fill="#dce8ec"
      />
      <path
        d="M0 392 C 70 372 120 402 190 386 S 320 356 400 372"
        fill="none"
        stroke="#c9dbe1"
        strokeWidth="3"
      />
      {/* Parks */}
      <rect x="36" y="70" width="92" height="64" rx="10" fill="#dcebd9" />
      <circle cx="318" cy="118" r="42" fill="#dcebd9" />
      <rect x="252" y="262" width="78" height="52" rx="10" fill="#dcebd9" />
      {/* Blocks */}
      <g fill="#ebe3d8">
        <rect x="150" y="60" width="70" height="50" rx="6" />
        <rect x="150" y="128" width="70" height="60" rx="6" />
        <rect x="36" y="156" width="92" height="70" rx="6" />
        <rect x="36" y="246" width="92" height="84" rx="6" />
        <rect x="150" y="206" width="70" height="72" rx="6" />
        <rect x="244" y="176" width="110" height="64" rx="6" />
        <rect x="150" y="296" width="80" height="54" rx="6" />
      </g>
      {/* Streets */}
      <g fill="none" stroke="#fffdfa" strokeLinecap="round">
        <path d="M-10 142 C 120 150 260 130 410 150" strokeWidth="10" />
        <path d="M-10 350 C 90 340 200 362 410 336" strokeWidth="12" />
        <path d="M138 -10 L 140 510" strokeWidth="8" />
        <path d="M234 -10 C 238 120 230 250 240 380" strokeWidth="8" />
        <path d="M-10 238 C 90 236 190 244 410 250" strokeWidth="6" />
        <path d="M360 -10 C 350 120 372 240 360 340" strokeWidth="6" />
      </g>
      {/* The E-5, drawn as the main road */}
      <path
        d="M-10 40 C 120 30 270 52 410 34"
        fill="none"
        stroke="#e8c877"
        strokeWidth="12"
        strokeLinecap="round"
        opacity="0.75"
      />
      {/* Railway */}
      <path
        d="M-10 318 C 120 306 250 326 410 304"
        fill="none"
        stroke="#b9ada0"
        strokeWidth="3"
        strokeDasharray="10 7"
      />
      <circle
        cx="86"
        cy="314"
        r="7"
        fill="#fffdfa"
        stroke="#877d74"
        strokeWidth="3"
      />
    </svg>
  );
}

/**
 * Another branch of the house (src/lib/seo/branches.ts): its name, that it
 * opened, and only the facts that are known. Until the address is entered the
 * card says it follows; a phone, hours or map link appear the day they exist.
 * The last line keeps the app honest: it orders to the Tuzla köşk only.
 */
function BranchSection({ branch }: { branch: SiteBranch }) {
  const lines = branchAddressLines(branch);
  const tel = branchTel(branch);
  const mapUrl = branchMapUrl(branch);
  const titleId = `${branch.id}-title`;
  return (
    <section id={branch.id} className="section" aria-labelledby={titleId}>
      <div className="wrap">
        <div className="branch-card reveal">
          <p className="branch-badge">
            <span className="branch-badge-dot" aria-hidden="true" />
            Yeni şubemiz açıldı
          </p>
          <h2 id={titleId} className="branch-title">
            {branch.name}
          </h2>
          {lines.length > 0 ? (
            <address className="branch-address">
              {lines.map((line) => (
                <span key={line}>{line}</span>
              ))}
            </address>
          ) : (
            <p className="branch-text">
              Marina şubemiz kapılarını açtı. Adresi, çalışma saatleri ve
              telefonu çok yakında bu sayfada.
            </p>
          )}
          {branch.hoursLabel || tel ? (
            <p className="branch-facts">
              {branch.hoursLabel ? (
                <span className="tabular">{branch.hoursLabel}</span>
              ) : null}
              {tel ? (
                <a href={`tel:${tel}`} className="tabular">
                  {branch.phone}
                </a>
              ) : null}
            </p>
          ) : lines.length > 0 ? (
            // The address is known, the hours and the phone are not yet.
            <p className="branch-text">
              Çalışma saatleri ve telefonu çok yakında bu sayfada.
            </p>
          ) : null}
          {mapUrl ? (
            <a
              className="branch-map"
              href={mapUrl}
              target="_blank"
              rel="noopener"
            >
              Haritada gör <span className="arrow">→</span>
            </a>
          ) : null}
          <p className="branch-note">
            Uygulamadan verilen siparişler, masadaki QR ile sipariş ve karaoke
            odası Tuzla köşkü içindir.
          </p>
        </div>
      </div>
    </section>
  );
}
