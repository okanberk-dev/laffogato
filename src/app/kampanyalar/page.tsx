import type { Metadata } from "next";

import { JsonLd } from "@/lib/seo/json-ld";
import { breadcrumbLd } from "@/lib/seo/structured-data";

import { CampaignsPage } from "@/components/laffogato/campaigns-page";
import { SiteChrome } from "@/components/laffogato/site-chrome";
import { openGraphBase } from "@/lib/seo/site";
import { footerSettings } from "@/lib/seo/contact";
import {
  getSiteImages,
  getSiteSettings,
  listSiteAppPosts,
} from "@/lib/seo/site-data";
import { siteImage } from "@/lib/admin/site-images-core";

export const dynamic = "force-dynamic";

const TITLE = "Kampanyalar ve Etkinlikler - Tuzla | L'Affogato";
const DESCRIPTION =
  "Köşkte bu ay neler var: sezon kampanyaları, iş birlikleri ve etkinlikler. Damga programı ve davet ödülü de burada.";

export const metadata: Metadata = {
  title: { absolute: TITLE },
  description: DESCRIPTION,
  alternates: { canonical: "/kampanyalar" },
  openGraph: {
    ...openGraphBase(),
    title: TITLE,
    description: DESCRIPTION,
    url: "/kampanyalar",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
  },
};

/**
 * `/kampanyalar` - the offers page.
 *
 * Deliberately the SAME two sources the app's Kampanyalar screen reads, so an
 * operator publishes once and both surfaces move:
 *
 *  - `listSiteAppPosts()` - the panel's campaigns, collaborations and
 *    events (/admin/mobil/icerik), filtered to active and in-window: the
 *    rows `GET /api/mobile/v1/app-content` serves (`listActiveAppPosts`),
 *    read through the site's cache (src/lib/seo/site-data.ts).
 *  - `mobileApp.campaignCards` - the switches for the two house programmes
 *    (/admin/mobil/ayarlar). Pausing the invite scheme takes the card off the
 *    web and out of the app at once, with no release on either side.
 *
 * Nothing on this page is written here except the two house cards' copy,
 * and each of those answers to its switch.
 */
export default async function KampanyalarPage() {
  const [settings, posts, images] = await Promise.all([
    getSiteSettings(),
    listSiteAppPosts(),
    getSiteImages(),
  ]);

  return (
    <>
      <JsonLd
        data={breadcrumbLd([
          { name: "Ana Sayfa", url: "/" },
          { name: "Kampanyalar", url: "/kampanyalar" },
        ])}
      />
      <SiteChrome settings={footerSettings(settings)}>
        <CampaignsPage
          heroImage={siteImage(images, "hero.campaigns")}
          posts={posts.map((p) => ({
            id: p.id,
            kind: p.kind,
            title: p.title,
            body: p.body,
            image: p.image,
            linkUrl: p.linkUrl,
            linkLabel: p.linkLabel,
          }))}
          cards={settings.mobileApp.campaignCards}
          stampTarget={settings.mobileApp.loyalty.stampTarget}
          rewardTitle={settings.mobileApp.loyalty.rewardTitle}
        />
      </SiteChrome>
    </>
  );
}
