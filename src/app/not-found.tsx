import type { Metadata } from "next";
import Link from "next/link";

import { SiteChrome } from "@/components/laffogato/site-chrome";
import { SCENES, type SceneKey } from "@/components/laffogato/scenes";
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
 * The café-retail split (5 Kas 2026): the copy on white beside a solid
 * house-green block where the L'Af mark, in latte foam, fills with coffee
 * and steams once - so a wrong turn still lands on the brand's own moment,
 * and the headline says what the picture already does: the coffee is ready,
 * the page is not. Pure CSS; under reduced motion the mark is simply full.
 * Below, the six places a lost visitor most likely meant, as white cards.
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
                Kahve hazır, <span className="script">sayfa değil</span>
              </h1>
              <p className="nf-lede">
                Aradığın bağlantı taşınmış ya da hiç var olmamış olabilir. Menü,
                mağaza ve köşk ise yerli yerinde - buradan devam et.
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
              <div className="nf-stage">
                <span className="nf-steam">
                  <i />
                  <i />
                  <i />
                </span>
                <span className="nf-mark">
                  <span className="nf-coffee" />
                </span>
              </div>
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
