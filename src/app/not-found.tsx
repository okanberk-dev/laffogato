import type { Metadata } from "next";

import { SiteChrome } from "@/components/laffogato/site-chrome";
import { SCENES, type SceneKey } from "@/components/laffogato/scenes";
import Link from "@/components/link";
import { getSiteSettings } from "@/lib/seo/site-data";
import { footerSettings } from "@/lib/seo/contact";

export const metadata: Metadata = {
  title: "Sayfa bulunamadı",
  description:
    "Aradığınız sayfa bulunamadı. Menümüze veya mağazamıza göz atın, ya da anasayfaya dönün.",
  robots: { index: false, follow: true },
};

/** Where a lost visitor most likely wanted to go, each in its own light. */
const STOPS: Array<{
  href: string;
  title: string;
  line: string;
  scene: SceneKey;
}> = [
  {
    href: "/menu",
    title: "Menü",
    line: "Matcha bar, espresso, tatlılar",
    scene: "matcha",
  },
  {
    href: "/magaza",
    title: "Mağaza",
    line: "Çekirdek, hediye seti, ekipman",
    scene: "caramel",
  },
  {
    href: "/kampanyalar",
    title: "Kampanyalar",
    line: "Köşkte bu ay olanlar",
    scene: "citrus",
  },
  {
    href: "/karaoke",
    title: "Karaoke",
    line: "Üst kattaki oda, 8 kişiye kadar",
    scene: "berry",
  },
  {
    href: "/ziyaret",
    title: "Ziyaret",
    line: "Adres, saatler, yol tarifi",
    scene: "house",
  },
  {
    href: "/hikayemiz",
    title: "Hikayemiz",
    line: "Bologna 1897'den Tuzla'ya",
    scene: "velvet",
  },
];

/**
 * Global 404. Rendered by Next.js for any unmatched route - there is no
 * parent route segment here, so unlike /hukuk/* or /uye/* it cannot inherit
 * a layout's chrome and wires SiteChrome itself.
 *
 * The café-retail split: the copy on white beside a house-green block. Since
 * 6 Kas 2026 (owner's brief, a "wayfinder" 404) the block is the köşk's
 * garden at dusk with a signpost whose boards name the real ways out -
 * Menü, Mağaza, Ziyaret, Ana sayfa - and a cup steaming at its foot. The
 * drawing is decoration; the same ways are the links beside and below it.
 * Below, the six places a lost visitor most likely meant, as white cards.
 *
 * The status is the file convention's: Next serves this with a 404.
 *
 * getSiteSettings() degrades to sane defaults on a database outage rather
 * than throwing, so this page never itself breaks while explaining that
 * another page could not be found.
 */
export default async function NotFound() {
  const settings = await getSiteSettings();

  return (
    <SiteChrome settings={footerSettings(settings)}>
      <div className="nf-page">
        <div className="wrap">
          <section
            className="nf-hero nf-hero--split"
            aria-labelledby="nf-title"
          >
            <div className="nf-copy">
              <p className="nf-code">
                <span>404</span> Sayfa bulunamadı
              </p>
              <h1 id="nf-title" className="nf-title">
                Yolunu mu <span className="script">kaybettin?</span>
              </h1>
              <p className="nf-lede">
                Bu bağlantı bir yere çıkmıyor: sayfa taşınmış ya da hiç var
                olmamış olabilir. Bahçedeki tabela yerinde; menü, mağaza ve köşk
                birer adım ötede.
              </p>
              <div className="nf-actions">
                <Link href="/" className="btn btn-primary btn-lg">
                  Anasayfaya dön
                </Link>
                <Link href="/menu" className="btn btn-outline btn-lg">
                  Menüye göz at
                </Link>
              </div>
            </div>

            <div className="nf-art" aria-hidden="true">
              <Signpost />
            </div>
          </section>

          <h2 className="nf-stops-title">Belki şunu arıyordun</h2>
          <nav className="nf-stops" aria-label="Popüler sayfalar">
            {STOPS.map((stop) => {
              const s = SCENES[stop.scene];
              return (
                <a key={stop.href} href={stop.href} className="nf-stop">
                  <span
                    className="nf-stop-orb"
                    style={{ background: s.mid }}
                    aria-hidden="true"
                  />
                  <span className="nf-stop-text">
                    <span className="nf-stop-title">{stop.title}</span>
                    <span className="nf-stop-line">{stop.line}</span>
                  </span>
                  <svg
                    className="nf-stop-chev"
                    width="12"
                    height="12"
                    viewBox="0 0 12 12"
                    aria-hidden="true"
                  >
                    <path
                      d="M4.5 2.5 8 6l-3.5 3.5"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      fill="none"
                    />
                  </svg>
                </a>
              );
            })}
          </nav>
        </div>
      </div>
    </SiteChrome>
  );
}

/** The four boards: where each points, and which way. */
const BOARDS: Array<{ label: string; tone: string; dir: 1 | -1 }> = [
  { label: "Menü", tone: "menu", dir: 1 },
  { label: "Mağaza", tone: "shop", dir: -1 },
  { label: "Ziyaret", tone: "visit", dir: 1 },
  { label: "Ana sayfa", tone: "home", dir: -1 },
];

/**
 * The signpost in the köşk's garden: a wooden post, four arrow boards, two
 * shrubs, a lawn and a cup at the foot of the post. Original drawing; every
 * colour is a token through the `nf-sign-*` classes in globals.css.
 */
function Signpost() {
  return (
    <svg
      className="nf-sign"
      viewBox="0 0 320 340"
      focusable="false"
      aria-hidden="true"
    >
      <ellipse className="nf-sign-lawn" cx="160" cy="318" rx="150" ry="26" />
      <circle className="nf-sign-shrub" cx="40" cy="300" r="30" />
      <circle className="nf-sign-shrub" cx="70" cy="308" r="22" />
      <circle className="nf-sign-shrub" cx="282" cy="302" r="26" />
      <rect
        className="nf-sign-post"
        x="152"
        y="44"
        width="16"
        height="276"
        rx="3"
      />
      <path className="nf-sign-cap" d="M148 48 160 34l12 14Z" />
      {BOARDS.map((b, i) => {
        const y = 66 + i * 52;
        const tip = b.dir === 1 ? 296 : 24;
        const end = tip - b.dir * 20;
        const d = `M160 ${y}H${end}L${tip} ${y + 19}L${end} ${y + 38}H160Z`;
        return (
          <g key={b.label} className={`nf-sign-board nf-sign-board--${b.tone}`}>
            <path d={d} />
            <text x={b.dir === 1 ? 222 : 98} y={y + 25} textAnchor="middle">
              {b.label}
            </text>
          </g>
        );
      })}
      <rect
        className="nf-sign-nail"
        x="157"
        y="81"
        width="6"
        height="6"
        rx="3"
      />
      <rect
        className="nf-sign-nail"
        x="157"
        y="133"
        width="6"
        height="6"
        rx="3"
      />
      <rect
        className="nf-sign-nail"
        x="157"
        y="185"
        width="6"
        height="6"
        rx="3"
      />
      <rect
        className="nf-sign-nail"
        x="157"
        y="237"
        width="6"
        height="6"
        rx="3"
      />
      <g className="nf-sign-cup">
        <path d="M190 292h44c0 14-9 24-22 24s-22-10-22-24Z" />
        <path d="M233 296c8-1 12 4 10 9-2 4-7 6-12 5" />
        <ellipse cx="212" cy="318" rx="30" ry="4" />
      </g>
      <g className="nf-sign-steam">
        <path d="M204 284c-6-8 6-12 0-20s4-12 0-18" />
        <path d="M218 284c-6-8 6-12 0-20s4-12 0-18" />
      </g>
    </svg>
  );
}
