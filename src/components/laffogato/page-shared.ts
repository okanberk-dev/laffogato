/**
 * What the five SPA pages share. Each page lives in its own file
 * (home-page.tsx, menu-page.tsx, shop-page.tsx, story-page.tsx,
 * visit-page.tsx) so app.tsx can load only the one a route shows; this module
 * holds the props contract they are all rendered with and the one constant
 * two of them use.
 */

import type { MenuCategory, PRESS as SEED_PRESS, Product, STORY } from "./data";
import type { KaraokeFacts } from "./karaoke-today";
import type { Route } from "./route-paths";
import type { ShopHeroSlide } from "./shop-hero-slider";
import type { CartItem } from "./ui";

/** Menu item tags are stored as English keys; the site speaks Turkish. Only
    the two the prototype shows as badges are labelled - anything else is not
    worth a badge. */
export const MENU_TAG_LABELS: Record<string, string> = {
  signature: "İMZA",
  new: "YENİ",
};

/** The props LaffogatoApp (app.tsx) renders every page with. */
export interface PageProps {
  navigate: (r: Route) => void;
  /** Operator settings from /admin/ayarlar (contact + courier fee). */
  settings?: {
    phone?: string;
    email?: string;
    address?: string;
    courierFeeMinor?: number;
  };
  addToCart: (item: CartItem) => void;
  openProduct: (p: Product | null) => void;
  /** Live products fed from the admin store; falls back to design seed. */
  products?: Product[];
  /** Live cafe menu fed from the admin store; falls back to design seed. */
  menu?: Record<string, MenuCategory>;
  /** Admin-managed shop hero slides (PageShop kullanır). */
  shopHeroSlides?: ShopHeroSlide[];
  /** Admin-managed editorial content; undefined ise data.ts seed'ine düşer. */
  press?: typeof SEED_PRESS;
  storyTimeline?: typeof STORY.heritage;
  /** Admin-managed editable copy (key → value); undefined ise inline fallback. */
  content?: Record<string, string>;
  /** Ayarlar → "Hero görsel URL"; boşsa tasarımın kendi yüzeyi kullanılır. */
  heroImageUrl?: string;
  /** Visit page contact block from admin settings; undefined ise LOCATION seed. */
  visit?: {
    addressLines: string[];
    phone: string;
    email: string;
    /** Opening hours for the current day (server-computed). */
    todayHours?: string;
    hours: [string, string][];
  };
  /**
   * The karaoke room as the panel sets it, for the home page's band and
   * hero slide. Only `/` passes it (src/app/page.tsx).
   */
  karaoke?: KaraokeFacts;
}
