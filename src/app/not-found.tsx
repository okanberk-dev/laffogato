import type { Metadata } from "next";

import { SiteChrome } from "@/components/laffogato/site-chrome";
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
}> = [
  {
    href: "/menu",
    title: "Menü",
    line: "Matcha bar, espresso, tatlılar",
  },
  {
    href: "/magaza",
    title: "Mağaza",
    line: "Çekirdek, hediye seti, ekipman",
  },
  {
    href: "/kampanyalar",
    title: "Kampanyalar",
    line: "Köşkte bu ay olanlar",
  },
  {
    href: "/karaoke",
    title: "Karaoke",
    line: "Üst kattaki oda, 8 kişiye kadar",
  },
  {
    href: "/ziyaret",
    title: "Ziyaret",
    line: "Adres, saatler, yol tarifi",
  },
  {
    href: "/hikayemiz",
    title: "Hikayemiz",
    line: "Bologna 1897'den Tuzla'ya",
  },
];

/**
 * Global 404. Rendered by Next.js for any unmatched route - there is no
 * parent route segment here, so unlike /hukuk/* or /uye/* it cannot inherit
 * a layout's chrome and wires SiteChrome itself.
 *
 * The status code, one sentence and two buttons, then the six places a
 * lost visitor most likely meant, as tiles on the band.
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
          <section className="nf-hero" aria-labelledby="nf-title">
            <p className="nf-code" aria-hidden="true">
              404
            </p>
            <h1 id="nf-title" className="t-display">
              Sayfa bulunamadı
            </h1>
            <p className="t-body nf-lede">
              Bu bağlantı bir yere çıkmıyor: sayfa taşınmış ya da hiç var
              olmamış olabilir. Menü, mağaza ve köşk birer adım ötede.
            </p>
            <div className="btn-row">
              <Link href="/" className="btn btn-dark btn-wide">
                Ana sayfaya dön
              </Link>
              <Link href="/menu" className="btn btn-wide">
                Menüye göz at
              </Link>
            </div>
          </section>

          <h2 className="t-display nf-stops-title">Belki şunu arıyordun</h2>
          <nav aria-label="Popüler sayfalar">
            <ul className="nf-links" role="list">
              {STOPS.map((stop) => (
                <li key={stop.href}>
                  <Link href={stop.href}>
                    <span className="t-title">{stop.title}</span>
                    <span className="t-small t-muted">{stop.line}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </div>
    </SiteChrome>
  );
}
