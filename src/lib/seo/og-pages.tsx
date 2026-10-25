import "server-only";

import { readFile } from "node:fs/promises";
import { join } from "node:path";

import type { ReactElement } from "react";

import { DAYS_OF_WEEK, type WeeklyHours } from "@/lib/admin/days";
import { LEGAL_ENTITY } from "@/lib/legal/entity";
import type { Guide } from "@/lib/seo/guides";
import type { MenuCategoryRoute, ShopCategoryRoute } from "@/lib/seo/pages";
import { SITE } from "@/lib/seo/site";

import {
  OG_BIG_MARK_WIDTH,
  OgBigMark,
  OgFramedPhoto,
  OgPageCard,
  ogPhoto,
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
 * Nothing here reads the database: the cards are drawn from the site's own
 * copy and files, so a database outage cannot blank a preview. The one
 * panel value a card prints, the /ziyaret hours, is handed in by its route.
 * A photograph that cannot be read gives way to the mark.
 */

/** The venue photographs are 3:4. */
const PORTRAIT = { width: 372, height: 478 };
/** The karaoke drawing and the shop's product photos are square. */
const SQUARE = 446;

/**
 * The cards' pictures, each read from public/ by a literal path. Literal on
 * purpose: the bundler copies every file a function may read into it, and a
 * path built from a variable makes it copy all of public/ (7.7 MB) - into
 * every page that loads a card. The karaoke file is
 * ILLUSTRATIONS["karaoke-room"]; the test holds the two to the same name.
 */
const PICTURES = {
  karaoke: () =>
    readFile(join(process.cwd(), "public/illustrations/karaoke-room.webp")),
  menu: () => readFile(join(process.cwd(), "public/photos/affogato-cup.webp")),
  visit: () => readFile(join(process.cwd(), "public/photos/facade-night.webp")),
  story: () => readFile(join(process.cwd(), "public/photos/facade-day.webp")),
};

/**
 * Each guide's photograph (public/rehber/), by literal path for the reason
 * PICTURES gives. A guide without an entry gets the mark.
 */
const GUIDE_PICTURES: Record<string, () => Promise<Uint8Array>> = {
  "affogato-nedir": () =>
    readFile(join(process.cwd(), "public/rehber/affogato-nedir.webp")),
  "matcha-nedir": () =>
    readFile(join(process.cwd(), "public/rehber/matcha-nedir.webp")),
  "espresso-cesitleri": () =>
    readFile(join(process.cwd(), "public/rehber/espresso-cesitleri.webp")),
  "san-sebastian-cheesecake": () =>
    readFile(
      join(process.cwd(), "public/rehber/san-sebastian-cheesecake.webp"),
    ),
  "yenilebilir-kahve-fincani": () =>
    readFile(
      join(process.cwd(), "public/rehber/yenilebilir-kahve-fincani.webp"),
    ),
  "tiramisu-tarifi": () =>
    readFile(join(process.cwd(), "public/rehber/tiramisu-tarifi.webp")),
  "cold-brew-nedir": () =>
    readFile(join(process.cwd(), "public/rehber/cold-brew-nedir.webp")),
  "frappe-nedir": () =>
    readFile(join(process.cwd(), "public/rehber/frappe-nedir.webp")),
  "spanish-latte-nedir": () =>
    readFile(join(process.cwd(), "public/rehber/spanish-latte-nedir.webp")),
  "chai-tea-latte": () =>
    readFile(join(process.cwd(), "public/rehber/chai-tea-latte.webp")),
};

async function photoArt(
  read: () => Promise<Uint8Array>,
  width: number,
  height: number,
): Promise<{ art: ReactElement; artWidth: number }> {
  let src: string | null;
  try {
    src = await ogPhoto(await read(), width, height);
  } catch {
    src = null;
  }
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
      {...await photoArt(PICTURES.karaoke, SQUARE, SQUARE)}
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
      {...await photoArt(PICTURES.menu, PORTRAIT.width, PORTRAIT.height)}
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

/**
 * The /ziyaret card's hours line, from the panel's weekly hours as the page
 * shows them: "Her gün 09:00 - 02:00" when the seven days are open with the
 * same hours (the page compacts them the same way, visit-page.tsx). When
 * they differ or a day is closed, one line cannot say it, so there is none;
 * the page has the rows. Without the panel's hours (the build, an error) the
 * köşk's constant (LEGAL_ENTITY.cafeHours), as the structured data does.
 */
export function visitHoursLine(
  hours: WeeklyHours | null | undefined,
): string | undefined {
  if (!hours) {
    const { opens, closes } = LEGAL_ENTITY.cafeHours;
    return `Her gün ${opens} - ${closes}`;
  }
  const days = DAYS_OF_WEEK.map((d) => hours[d]);
  const first = days[0];
  const same = days.every(
    (h) => h && !h.closed && h.open === first?.open && h.close === first?.close,
  );
  return same && first ? `Her gün ${first.open} - ${first.close}` : undefined;
}

export async function visitCard(
  hours?: WeeklyHours | null,
): Promise<ReactElement> {
  return (
    <OgPageCard
      eyebrow="Ziyaret · Tuzla, İstanbul"
      title="200 yıllık köşkte buluşalım"
      subtitle={visitHoursLine(hours)}
      detail={`${SITE.address.streetAddress.replace(/ İç Kapı.*$/, "")}, Tuzla`}
      path="/ziyaret"
      footer={SITE.address.landmark}
      {...await photoArt(PICTURES.visit, PORTRAIT.width, PORTRAIT.height)}
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
      {...await photoArt(PICTURES.story, PORTRAIT.width, PORTRAIT.height)}
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
      detail="Tiramisu · Cold brew · Frappe · Matcha · Affogato"
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

export async function guideCard(guide: Guide): Promise<ReactElement> {
  const picture = GUIDE_PICTURES[guide.slug];
  return (
    <OgPageCard
      eyebrow={`Rehber · ${guide.readingMinutes} dk okuma`}
      title={ogText(guide.title, 60)}
      detail={guideLine(guide.excerpt)}
      path={`/rehber/${guide.slug}`}
      {...(picture ? await photoArt(picture, SQUARE, SQUARE) : MARK_ART)}
    />
  );
}
