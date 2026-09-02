import type { Metadata } from "next";
import Link from "next/link";

import { SiteChrome } from "@/components/laffogato/site-chrome";
import { CupEmblem } from "@/components/laffogato/visuals";
import { getPublicSettings } from "@/lib/admin/store";

export const metadata: Metadata = {
  title: "Sayfa bulunamadı",
  description:
    "Aradığınız sayfa bulunamadı. Menümüze veya mağazamıza göz atın, ya da anasayfaya dönün.",
  robots: { index: false, follow: true },
};

/**
 * Global 404. Rendered by Next.js for any unmatched route — there is no
 * parent route segment here, so unlike /hukuk/* or /uye/* it cannot inherit
 * a layout's chrome and wires SiteChrome itself.
 *
 * getPublicSettings() degrades to sane defaults on a database outage rather
 * than throwing, so this page never itself breaks while explaining that
 * another page could not be found.
 */
export default async function NotFound() {
  const settings = await getPublicSettings();

  return (
    <SiteChrome
      settings={{
        phone: settings.phone,
        email: settings.email,
        address: settings.address,
      }}
    >
      <div className="not-found-page">
        <div className="wrap-narrow not-found-content">
          <CupEmblem size={148} />
          <div className="eyebrow" style={{ marginTop: 32 }}>
            404 · Sayfa bulunamadı
          </div>
          <h1
            className="h-display"
            style={{ marginTop: 20, fontSize: "clamp(38px, 6vw, 64px)" }}
          >
            Bu sayfa <span className="script">kayıp.</span>
          </h1>
          <p className="lede" style={{ margin: "24px auto 0" }}>
            Aradığınız bağlantı taşınmış ya da hiç var olmamış olabilir. Neyse
            ki menümüz ve mağazamız yerli yerinde.
          </p>
          <div className="not-found-actions">
            <Link href="/" className="btn btn-primary btn-lg">
              Anasayfaya dön <span className="arrow">→</span>
            </Link>
            <Link href="/menu" className="btn btn-ghost btn-lg">
              Menüyü gör
            </Link>
            <Link href="/magaza" className="btn btn-ghost btn-lg">
              Mağazaya git
            </Link>
          </div>
        </div>
      </div>
    </SiteChrome>
  );
}
