"use client";

import { siteImage } from "@/lib/admin/site-images-core";
import Image from "next/image";
import { useMemo } from "react";

import Link from "@/components/link";
import {
  OTHER_BRANCHES,
  branchAddressLines,
  branchMapUrl,
  branchTel,
  type SiteBranch,
} from "@/lib/seo/branches";
import { SITE } from "@/lib/seo/site";
import { priceLabel } from "@/lib/utils/format";

import { AppStoreLinks } from "./app-links";
import { AppPhones, TableOrderBand } from "./app-showcase";
import { PageHero } from "./page-hero";
import { LOCATION } from "./data";
import { openStatusDetail, useOpenStatus } from "./use-open-status";
import { DEFAULT_PICKUP_MINUTES, type PageProps } from "./page-shared";
import { cx } from "./cx";

/**
 * /ziyaret, in the reference's cafés layout: the wide photograph and the
 * title with one dark button, the places as photograph cards (the Tuzla
 * köşk, the Marina branch, private hire), then the hours, the way there and
 * the rooms. Every figure is the panel's (Ayarlar → İletişim, saatler).
 */
export function PageVisit({ visit, settings, images }: PageProps) {
  const courierFee = priceLabel(settings?.courierFeeMinor ?? 5500);
  // Mobil → Ayarlar → Kurye. While it is off the courier's figure gives its
  // place to the pickup time.
  const courierEnabled = settings?.courierEnabled !== false;
  const pickupMinutes = settings?.pickupReadyMinutes ?? DEFAULT_PICKUP_MINUTES;
  const addressLines = visit?.addressLines ?? LOCATION.address;
  // `||`: a field cleared in Ayarlar arrives as "" and must not print (or
  // dial) nothing.
  const visitPhone = visit?.phone || LOCATION.phone;
  const visitTel = visitPhone.replace(/[^\d+]/g, "") || SITE.phoneE164;
  const visitEmail = visit?.email || LOCATION.email;
  const visitHours = visit?.hours ?? LOCATION.hours;

  /** One row says "Her gün" when every day carries the same hours. */
  const compactHours = useMemo(() => {
    if (visitHours.length < 2) return visitHours;
    const [, first] = visitHours[0];
    return visitHours.every(([, v]) => v === first)
      ? ([["Her gün", first]] as [string, string][])
      : visitHours;
  }, [visitHours]);

  // A fixed query, not the editable address lines: a stray edit in the
  // panel must not send visitors to the wrong place.
  const mapQuery = LOCATION.mapsQuery;
  const directionsUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(mapQuery)}`;
  const appleMapsUrl = `https://maps.apple.com/?q=${encodeURIComponent(mapQuery)}`;
  const mapUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapQuery)}`;
  const closing = closingStat(compactHours, visit?.todayHours);
  const today = visit?.todayHours ?? visitHours[0]?.[1];

  const facts = [
    { n: "24", l: "Koltuk", d: "12 bar, 12 lounge" },
    { n: closing.value, l: closing.label, d: "Mutfak 23:30'da kapanır" },
    courierEnabled
      ? { n: courierFee, l: "Tuzla içi kurye", d: "Uygulamadan" }
      : { n: `${pickupMinutes} dk`, l: "Gel-al", d: "Uygulamadan sipariş" },
    { n: "Var", l: "Otopark", d: "Sokak ve vale" },
  ];

  return (
    <div className="page" data-screen-label="05 Visit">
      <PageHero
        title="Bizi ziyaret edin"
        lede={`Postane Mahallesi'nde restore bir Rum köşkü: 24 koltuk, bahçe terası ve üst katta özel karaoke odası. ${
          closing.label === "gece kapanış"
            ? `Her gün gece ${untilTime(closing.value)} kadar açığız.`
            : ""
        }`.trim()}
        image={siteImage(images, "hero.visit")}
      >
        <a
          href={directionsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="btn btn-dark btn-wide"
        >
          Yol tarifi al
          <span className="sr-only"> (Google Haritalar, yeni sekme)</span>
        </a>
      </PageHero>

      {/* The places ────────────────────────────────────────── */}
      <section className="section section--band" aria-label="Şubeler">
        <div className="wrap">
          <ul className="place-grid" role="list">
            <li className="place-card">
              <div className="media ratio-4-3">
                <Image
                  src={siteImage(images, "visit.tuzla").src}
                  unoptimized={siteImage(images, "visit.tuzla").src.startsWith(
                    "/gorsel/",
                  )}
                  alt={siteImage(images, "visit.tuzla").alt}
                  fill
                  sizes="(max-width: 767px) 100vw, 33vw"
                  style={{ objectPosition: "50% 58%" }}
                />
              </div>
              <h2 className="t-title">Tuzla köşkü</h2>
              <div className="place-card-row">
                <a
                  className="link-u"
                  href={mapUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {addressLines.map((l) => (
                    <span key={l} className="place-card-line">
                      {l}
                    </span>
                  ))}
                  <span className="sr-only">
                    {" "}
                    (Google Haritalar, yeni sekme)
                  </span>
                </a>
                <OpenNow rows={visitHours} />
              </div>
              <Link className="link-u" href="/karaoke">
                Karaoke odası rezervasyonu
              </Link>
            </li>
            {OTHER_BRANCHES.map((b) => (
              <BranchCard key={b.id} branch={b} />
            ))}
            <li className="place-card">
              <div className="media ratio-4-3">
                <Image
                  src={siteImage(images, "visit.private").src}
                  unoptimized={siteImage(
                    images,
                    "visit.private",
                  ).src.startsWith("/gorsel/")}
                  alt={siteImage(images, "visit.private").alt}
                  fill
                  sizes="(max-width: 767px) 100vw, 33vw"
                />
              </div>
              <h2 className="t-title">Özel kiralama</h2>
              <p className="t-small">
                Pazartesi günleri köşkü tamamen kiralayabilirsiniz: özel menü,
                barista gösterisi, gelato atölyesi.
              </p>
              <a
                className="link-u"
                href={`mailto:${visitEmail}?subject=${encodeURIComponent("Özel kiralama")}`}
              >
                E-postayla sor
              </a>
            </li>
          </ul>
        </div>
      </section>

      {/* The hours ─────────────────────────────────────────── */}
      <section className="section" aria-labelledby="visit-hours">
        <div className="wrap visit-hours">
          <div>
            <h2 id="visit-hours" className="t-display">
              Saatler
            </h2>
            <p className="t-body t-muted">
              Köşkün avlusu hava müsait olduğunda açık; hava kötüleşirse
              salonlarda devam ediyoruz.
            </p>
          </div>
          <div>
            <dl className="ruled-rows">
              {compactHours.map(([d, h]) => (
                <div key={d}>
                  <dt className="t-label">{d}</dt>
                  <dd className="t-body tabular">{h}</dd>
                </div>
              ))}
              <div>
                <dt className="t-label">Karaoke</dt>
                <dd className="t-body tabular">12:00 - 24:00</dd>
              </div>
              <div>
                <dt className="t-label">Mutfak</dt>
                <dd className="t-body tabular">23:30&apos;da kapanır</dd>
              </div>
              {today ? (
                <div>
                  <dt className="t-label">Bugün</dt>
                  <dd className="t-body tabular">{today}</dd>
                </div>
              ) : null}
            </dl>
          </div>
        </div>
      </section>

      {/* Facts ─────────────────────────────────────────────── */}
      <section className="section section--band" aria-label="Köşk rakamlarla">
        <div className="wrap">
          <ul className="fact-row" role="list">
            {facts.map((f) => (
              <li key={f.l}>
                <p className="fact-n tabular">{f.n}</p>
                <p className="t-label">{f.l}</p>
                <p className="t-small t-muted">{f.d}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* The way there ─────────────────────────────────────── */}
      <section id="map" className="section" aria-labelledby="visit-way">
        <div className="wrap visit-way">
          <div className="stack-16">
            <h2 id="visit-way" className="t-display">
              Ulaşım
            </h2>
            <address className="t-body visit-address">
              {addressLines.map((l) => (
                <span key={l}>{l}</span>
              ))}
              <span className="t-muted">{LOCATION.landmark}</span>
            </address>
            <ul className="chip-row" role="list">
              <li className="chip">Marmaray Tuzla · 6 dk</li>
              <li className="chip">Vale · ücretsiz</li>
              <li className="chip">Sabiha Gökçen · 15 dk</li>
              <li className="chip">E-5 / TEM Tuzla çıkışı</li>
            </ul>
            <div className="btn-row">
              <a
                className="btn btn-dark"
                href={directionsUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                Google Haritalar
              </a>
              <a
                className="btn"
                href={appleMapsUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                Apple Haritalar
              </a>
            </div>
          </div>
          <dl className="ruled-rows">
            <div>
              <dt className="t-label">Telefon</dt>
              <dd className="t-body">
                <a href={`tel:${visitTel}`}>{visitPhone}</a>
              </dd>
            </div>
            <div>
              <dt className="t-label">E-posta</dt>
              <dd className="t-body">
                <a href={`mailto:${visitEmail}`}>{visitEmail}</a>
              </dd>
            </div>
            <div>
              <dt className="t-label">Merkez</dt>
              <dd className="t-body">{LOCATION.parent}</dd>
            </div>
          </dl>
        </div>
      </section>

      {/* Ordering from the table: the app's own screen and the steps. */}
      <TableOrderBand
        headingId="visit-table-title"
        mediaSide="end"
        media={<AppPhones only="table" />}
      >
        <AppStoreLinks tone="dark" className="table-order-store" />
      </TableOrderBand>

      {/* The rooms ─────────────────────────────────────────── */}
      <section className="section section--band" aria-labelledby="visit-rooms">
        <div className="wrap">
          <div className="section-head">
            <h2 id="visit-rooms" className="t-display">
              Mekan
            </h2>
          </div>
          <ul className="gallery-row" role="list">
            {GALLERY.map((g) => (
              <li key={g.src} className="media ratio-4-3">
                <Image
                  src={g.src}
                  alt={g.alt}
                  fill
                  sizes="(max-width: 767px) 50vw, 25vw"
                />
              </li>
            ))}
          </ul>
        </div>
      </section>
    </div>
  );
}

const GALLERY = [
  { src: "/photos/terrace-wide.webp", alt: "Köşkün terası ve bahçesi" },
  {
    src: "/photos/interior-mirror.webp",
    alt: "Terracotta duvar ve altın ayna",
  },
  { src: "/photos/terrace-canopy.webp", alt: "Hasır gölgelikli teras" },
  { src: "/photos/facade-night.webp", alt: "Gece ışıklarıyla köşk cephesi" },
] as const;

function BranchCard({ branch }: { branch: SiteBranch }) {
  const lines = branchAddressLines(branch);
  const tel = branchTel(branch);
  const mapUrl = branchMapUrl(branch);
  return (
    <li id={branch.id} className="place-card">
      {/* No photograph of the branch yet: the ground, not someone else's
          picture. */}
      <div className="media ratio-4-3">
        <span className="media-empty" aria-hidden="true" />
        <span className="badge">Yeni şube</span>
      </div>
      <h2 className="t-title">{branch.name}</h2>
      <div className="place-card-row">
        {lines.length > 0 ? (
          mapUrl ? (
            <a
              className="link-u"
              href={mapUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              {lines.map((line) => (
                <span key={line} className="place-card-line">
                  {line}
                </span>
              ))}
            </a>
          ) : (
            <address className="t-small">{lines.join(", ")}</address>
          )
        ) : (
          <p className="t-small">Adresi çok yakında bu sayfada.</p>
        )}
        {branch.hoursLabel ? (
          <p className="t-small tabular">{branch.hoursLabel}</p>
        ) : null}
      </div>
      {tel ? (
        <a className="t-small tabular" href={`tel:${tel}`}>
          {branch.phone}
        </a>
      ) : null}
      {lines.length > 0 && !(branch.hoursLabel && tel) ? (
        <p className="t-small t-muted">
          {branchPending(branch.hoursLabel, tel)}
        </p>
      ) : null}
      <p className="t-small t-muted">
        Uygulamadan gel-al siparişi ve karaoke odası Tuzla köşkü içindir.
      </p>
      {branch.id === "marina" ? (
        <Link className="link-u" href="/rehber/tuzla-marina-kafe">
          Marina şubesi hakkında
        </Link>
      ) : null}
    </li>
  );
}

/** The live line, in the köşk's time zone, once the browser has answered. */
function OpenNow({ rows }: { rows: [string, string][] }) {
  const st = useOpenStatus(rows);
  if (!st) return null;
  const detail = openStatusDetail(st);
  return (
    <p className={cx("open-line", st.open ? "is-open" : "is-closed")}>
      {st.open ? "Şu an açık" : "Şu an kapalı"}
      {detail ? <span className="t-muted tabular"> · {detail}</span> : null}
    </p>
  );
}

/**
 * "02:00'ye", "01:00'e", "00:30'a": the dative follows the last number word
 * read aloud (iki-ye, bir-e, otuz-a). Midnight reads "gece yarısına".
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
 * "02:00 · gece kapanış" from the hours the page shows: one row for the
 * whole week gives its closing time; a week with different days gives
 * today's ("Kapalı" on a closed day).
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

/** What a branch card with a known address still promises to add. */
export function branchPending(hoursLabel: string, tel: string | null): string {
  if (!hoursLabel && !tel)
    return "Çalışma saatleri ve telefonu çok yakında bu sayfada.";
  if (!tel) return "Telefonu çok yakında bu sayfada.";
  return "Çalışma saatleri çok yakında bu sayfada.";
}
