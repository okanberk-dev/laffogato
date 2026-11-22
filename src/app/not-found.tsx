import type { Metadata } from "next";
import Image, { getImageProps } from "next/image";

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

/** Where a lost visitor most likely wanted to go, each with its photograph. */
const STOPS: Array<{
  href: string;
  title: string;
  line: string;
  photo: string;
  position?: string;
}> = [
  {
    href: "/menu",
    title: "Menü",
    line: "Matcha bar, espresso, tatlılar",
    photo: "/photos/affogato-cup.webp",
  },
  {
    href: "/magaza",
    title: "Mağaza",
    line: "Çekirdek, hediye seti, ekipman",
    photo: "/photos/hero-shop.webp",
    position: "42% 50%",
  },
  {
    href: "/karaoke",
    title: "Karaoke",
    line: "Üst kattaki oda, 8 kişiye kadar",
    photo: "/photos/hero-karaoke.webp",
    position: "28% 50%",
  },
  {
    href: "/ziyaret",
    title: "Ziyaret",
    line: "Adres, saatler, yol tarifi",
    photo: "/photos/facade-night.webp",
  },
];

/**
 * The opening photograph: the film's first poster (an affogato pour), the
 * wide cut on a screen, the tall cut on a phone. One <picture>, so only
 * the cut that is shown is fetched, and that one at high priority: it is
 * the page's largest paint.
 */
function StagePhoto() {
  const common = { alt: "", sizes: "100vw", quality: 75 };
  const {
    props: { srcSet: tall },
  } = getImageProps({
    ...common,
    src: "/video/hero-1-tall.webp",
    width: 720,
    height: 1280,
  });
  const {
    props: { srcSet: wide, ...rest },
  } = getImageProps({
    ...common,
    src: "/video/hero-1-wide.webp",
    width: 1920,
    height: 1080,
    loading: "eager",
    fetchPriority: "high",
  });
  return (
    <picture>
      <source media="(max-width: 767px)" srcSet={tall} />
      <source media="(min-width: 768px)" srcSet={wide} />
      <img {...rest} alt="" className="nf-stage-img" />
    </picture>
  );
}

/**
 * Global 404. Rendered by Next.js for any unmatched route - there is no
 * parent route segment here, so unlike /hukuk/* or /uye/* it cannot inherit
 * a layout's chrome and wires SiteChrome itself.
 *
 * The film's first frame to the edges under the bar, dimmed flat so white
 * type holds anywhere on it: the code, one wide line, one sentence, the
 * way home and the site's search (the header's own: /magaza?ara=1). Under
 * it, on the band, the four places a lost visitor most likely meant.
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
      <section
        className="nf-stage"
        data-ground="dark"
        aria-labelledby="nf-title"
      >
        <StagePhoto />
        <div className="nf-stage-dim" aria-hidden="true" />
        <div className="wrap nf-stage-copy">
          <p className="t-label nf-stage-code">404 · Sayfa bulunamadı</p>
          <h1 id="nf-title" className="nf-stage-title">
            <span>Aradığın sayfa</span> <span>burada değil</span>
          </h1>
          <p className="t-body nf-stage-lede">
            Bağlantı eskimiş ya da sayfa taşınmış olabilir. Menü, mağaza ve
            karaoke birer adım ötede.
          </p>
          <div className="btn-row nf-stage-actions">
            <Link href="/" className="btn btn-light btn-wide">
              Ana sayfaya dön
            </Link>
            <Link href="/magaza?ara=1" className="btn btn-light">
              Sitede ara
            </Link>
          </div>
        </div>
      </section>

      <section className="section section--band" aria-labelledby="nf-stops">
        <div className="wrap">
          <div className="section-head">
            <h2 id="nf-stops" className="t-display">
              Belki şunu arıyordun
            </h2>
          </div>
          <nav aria-labelledby="nf-stops">
            <ul className="tile-row nf-tiles" role="list">
              {STOPS.map((stop) => (
                <li key={stop.href}>
                  <Link href={stop.href} className="tile-link nf-tile">
                    <span className="media nf-tile-media">
                      <Image
                        src={stop.photo}
                        alt=""
                        fill
                        sizes="(max-width: 767px) 50vw, 25vw"
                        className="media-img"
                        style={
                          stop.position
                            ? { objectPosition: stop.position }
                            : undefined
                        }
                      />
                    </span>
                    <span className="t-title">{stop.title}</span>
                    <span className="t-small t-muted">{stop.line}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </section>
    </SiteChrome>
  );
}
