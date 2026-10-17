import "server-only";

import type { ReactElement } from "react";

import { ILLUSTRATIONS } from "@/components/laffogato/illustration";
import { LEGAL_ENTITY } from "@/lib/legal/entity";
import type { Guide } from "@/lib/seo/guides";
import type { MenuCategoryRoute, ShopCategoryRoute } from "@/lib/seo/pages";
import { SITE } from "@/lib/seo/site";

import {
  OG_BIG_MARK_WIDTH,
  OgBigMark,
  OgFramedPhoto,
  OgPageCard,
  ogPublicPhoto,
  ogText,
} from "./og-card";
import {
  OG_BAG_SIZE,
  OG_TICKETS_SIZE,
  OgCoffeeBag,
  OgTickets,
} from "./og-drawings";

/**
 * The link-preview card of each page that has one (see og-card.tsx for the
 * system). The route files (`src/app/<segment>/opengraph-image.tsx`) only
 * hand these to `ogImage()`.
 *
 * Nothing here reads the database: the cards are drawn at build time from
 * the site's own copy and files, so a database outage cannot blank a
 * preview. A photograph that cannot be read gives way to the mark.
 */

/** The venue photographs are 3:4. */
const PORTRAIT = { width: 372, height: 478 };
/** The karaoke drawing and the shop's product photos are square. */
const SQUARE = 446;

async function photoArt(
  sitePath: string,
  width: number,
  height: number,
): Promise<{ art: ReactElement; artWidth: number }> {
  const src = await ogPublicPhoto(sitePath, width, height);
  return src
    ? {
        art: <OgFramedPhoto src={src} width={width} height={height} />,
        artWidth: width,
      }
    : { art: <OgBigMark />, artWidth: OG_BIG_MARK_WIDTH };
}

/** The art for a page that has no picture of its own. */
const MARK_ART = { art: <OgBigMark />, artWidth: OG_BIG_MARK_WIDTH };

export async function karaokeCard(): Promise<ReactElement> {
  return (
    <OgPageCard
      eyebrow="Karaoke · köşkün üst katı"
      title="Özel karaoke odası"
      subtitle="Saatini seç, mikrofon senin"
      detail="Online rezervasyon · Tuzla, İstanbul"
      path="/karaoke"
      {...await photoArt(ILLUSTRATIONS["karaoke-room"].src, SQUARE, SQUARE)}
    />
  );
}

export async function menuCard(): Promise<ReactElement> {
  return (
    <OgPageCard
      eyebrow="Menü"
      title="Kahve, gelato ve tatlılar"
      subtitle={SITE.tagline}
      detail="Matcha · Espresso · Buzlu kahve · Affogato"
      path="/menu"
      {...await photoArt(
        "/photos/affogato-cup.webp",
        PORTRAIT.width,
        PORTRAIT.height,
      )}
    />
  );
}

export function menuCategoryCard(cat: MenuCategoryRoute): ReactElement {
  return (
    <OgPageCard
      eyebrow="Menü"
      title={cat.breadcrumbLabel}
      subtitle="L’Affogato menüsünden"
      detail="Köşkte servis · Tuzla, İstanbul"
      path={`/menu/${cat.slug}`}
      {...MARK_ART}
    />
  );
}

export function shopCard(): ReactElement {
  return (
    <OgPageCard
      eyebrow="Mağaza"
      title="Köşkün mağazası"
      subtitle="Çekirdek kahve, kupa, ekipman"
      detail="Türkiye’nin her yerine kargo"
      path="/magaza"
      art={<OgCoffeeBag />}
      artWidth={OG_BAG_SIZE.width}
    />
  );
}

export function shopCategoryCard(cat: ShopCategoryRoute): ReactElement {
  return (
    <OgPageCard
      eyebrow="Mağaza"
      title={cat.breadcrumbLabel}
      subtitle="Köşkün mağazasından"
      detail="Türkiye’nin her yerine kargo"
      path={`/magaza/${cat.slug}`}
      {...MARK_ART}
    />
  );
}

export async function visitCard(): Promise<ReactElement> {
  const { opens, closes } = LEGAL_ENTITY.cafeHours;
  return (
    <OgPageCard
      eyebrow="Ziyaret · Tuzla, İstanbul"
      title="200 yıllık köşkte buluşalım"
      subtitle={`Her gün ${opens} - ${closes}`}
      detail={`${SITE.address.streetAddress.replace(/ İç Kapı.*$/, "")}, Tuzla`}
      path="/ziyaret"
      footer={SITE.address.landmark}
      {...await photoArt(
        "/photos/facade-night.webp",
        PORTRAIT.width,
        PORTRAIT.height,
      )}
    />
  );
}

export async function storyCard(): Promise<ReactElement> {
  return (
    <OgPageCard
      eyebrow="Hikaye · 1897 → 2026"
      title="Bologna 1897’den Tuzla’ya"
      subtitle="İlk yurt dışı şubemiz"
      detail="200 yıllık, restore bir köşkte"
      path="/hikayemiz"
      {...await photoArt(
        "/photos/facade-day.webp",
        PORTRAIT.width,
        PORTRAIT.height,
      )}
    />
  );
}

export function campaignsCard(): ReactElement {
  return (
    <OgPageCard
      eyebrow="Kampanyalar · köşkte bu ay"
      title="Kampanyalar ve etkinlikler"
      subtitle="Sezon kampanyaları, iş birlikleri"
      detail="Uygulamada ve web’de aynı hesap"
      path="/kampanyalar"
      art={<OgTickets />}
      artWidth={OG_TICKETS_SIZE.width}
    />
  );
}

export function guideHubCard(): ReactElement {
  return (
    <OgPageCard
      eyebrow="Rehber"
      title="Kahve ve tatlı rehberi"
      subtitle="Barın mutfağından, Türkçe"
      detail="Affogato · Matcha · Espresso · Cheesecake"
      path="/rehber"
      {...MARK_ART}
    />
  );
}

/** A guide's first sentence, without its period: the card's small line. */
function guideLine(excerpt: string): string {
  const first = excerpt.split(/(?<=[.;])\s/)[0] ?? excerpt;
  return ogText(first, 120).replace(/[.;]$/, "");
}

export function guideCard(guide: Guide): ReactElement {
  return (
    <OgPageCard
      eyebrow={`Rehber · ${guide.readingMinutes} dk okuma`}
      title={ogText(guide.title, 60)}
      detail={guideLine(guide.excerpt)}
      path={`/rehber/${guide.slug}`}
      {...MARK_ART}
    />
  );
}
