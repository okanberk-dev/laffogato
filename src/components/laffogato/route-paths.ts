/**
 * Customer SPA route tipi + Next.js route URL eşlemesi.
 *
 * Bu modül "use client" değil — hem server tarafından (sitemap, SEO,
 * breadcrumb) hem de chrome.tsx (client) tarafından import edilir.
 */

export type Route = "home" | "menu" | "shop" | "story" | "reels" | "visit";

/** Her SPA bölümünün gerçek Next.js route'u. */
export const ROUTE_PATHS: Record<Route, string> = {
  home: "/",
  menu: "/menu",
  shop: "/magaza",
  story: "/hikayemiz",
  reels: "/reels",
  visit: "/ziyaret",
};

/** Ürün detay sayfası (PDP) yolu. */
export function productPath(slug: string): string {
  return `/magaza/urun/${slug}`;
}
