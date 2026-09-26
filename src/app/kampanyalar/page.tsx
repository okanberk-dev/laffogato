import type { Metadata } from "next";

import { JsonLd } from "@/lib/seo/json-ld";
import { breadcrumbLd } from "@/lib/seo/structured-data";

import { CampaignsPage } from "@/components/laffogato/campaigns-page";
import { SiteChrome } from "@/components/laffogato/site-chrome";
import { getPublicSettings, listActiveAppPosts } from "@/lib/admin/store";
import { openGraphDefaults } from "@/lib/seo/site";

export const dynamic = "force-dynamic";

const TITLE = "Kampanyalar ve Etkinlikler - Tuzla | L'Affogato";
const DESCRIPTION =
  "Köşkte bu ay neler var: sezon kampanyaları, iş birlikleri ve etkinlikler. Damga programı ve davet ödülü de burada.";

export const metadata: Metadata = {
  title: { absolute: TITLE },
  description: DESCRIPTION,
  alternates: { canonical: "/kampanyalar" },
  openGraph: {
    ...openGraphDefaults(),
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
 *  - `listActiveAppPosts()` - the panel's campaigns, collaborations and
 *    events (/admin/mobil/icerik), already filtered to active and in-window.
 *    This is exactly what `GET /api/mobile/v1/app-content` serves.
 *  - `mobileApp.campaignCards` - the switches for the two house programmes
 *    (/admin/mobil/ayarlar). Pausing the invite scheme takes the card off the
 *    web and out of the app at once, with no release on either side.
 *
 * Nothing on this page is written here except the two house cards' copy,
 * and each of those answers to its switch.
 */
export default async function KampanyalarPage() {
  const [settings, posts] = await Promise.all([
    getPublicSettings(),
    listActiveAppPosts(),
  ]);

  return (
    <>
      <JsonLd
        data={breadcrumbLd([
          { name: "Ana Sayfa", url: "/" },
          { name: "Kampanyalar", url: "/kampanyalar" },
        ])}
      />
      <SiteChrome
        settings={{
          phone: settings.phone,
          email: settings.email,
          address: settings.address,
        }}
      >
        <CampaignsPage
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
