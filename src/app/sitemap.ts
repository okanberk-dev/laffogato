import type { MetadataRoute } from "next";

import { listProducts } from "@/lib/admin/store";
import { LEGAL_DOCS } from "@/lib/legal/documents";
import { GUIDES } from "@/lib/seo/guides";
import { allSeoRoutes } from "@/lib/seo/pages";
import { SITE } from "@/lib/seo/site";

// Dynamic: the product list is read from the database at request time. The build
// does not connect to the DB, so the fetch is guarded — an empty result simply
// omits product URLs rather than failing the build.
export const dynamic = "force-dynamic";

// Stable content-revision stamp for static/section routes — bump on major
// content updates. A request-time `new Date()` would report every URL as
// "just modified" on each crawl, noise that search engines learn to distrust.
// Product detail pages still use their real per-row updatedAt below.
const CONTENT_REVISION = new Date("2026-06-19T00:00:00.000Z");

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = CONTENT_REVISION;

  const main = allSeoRoutes().map((r) => ({
    url: `${SITE.url}${r.url}`,
    lastModified: now,
    changeFrequency: r.changefreq,
    priority: r.priority,
  }));

  // Active product detail pages (/magaza/urun/<slug>).
  let products: MetadataRoute.Sitemap = [];
  try {
    const all = await listProducts();
    products = all
      .filter((p) => p.isActive)
      .map((p) => {
        const imgs = (p.images ?? []).filter((u) => /^https?:\/\//i.test(u));
        return {
          url: `${SITE.url}/magaza/urun/${p.slug}`,
          lastModified: p.updatedAt ? new Date(p.updatedAt) : now,
          changeFrequency: "weekly" as const,
          priority: 0.8,
          ...(imgs.length ? { images: imgs } : {}),
        };
      });
  } catch {
    // No DB at build / connection issue — ship the sitemap without products.
  }

  // Guides — the editorial hub. Higher priority than the legal pages because
  // these are the pages built to earn search traffic.
  const guideHub = {
    url: `${SITE.url}/rehber`,
    lastModified: now,
    changeFrequency: "weekly" as const,
    priority: 0.8,
  };
  const guides = GUIDES.map((g) => ({
    url: `${SITE.url}/rehber/${g.slug}`,
    lastModified: new Date(g.updatedAt),
    changeFrequency: "monthly" as const,
    priority: 0.75,
  }));

  const legalIndex = {
    url: `${SITE.url}/hukuk`,
    lastModified: now,
    changeFrequency: "monthly" as const,
    priority: 0.4,
  };
  const legal = LEGAL_DOCS.map((d) => ({
    url: `${SITE.url}/hukuk/${d.slug}`,
    lastModified: now,
    changeFrequency: "monthly" as const,
    priority: 0.5,
  }));

  return [...main, ...products, guideHub, ...guides, legalIndex, ...legal];
}
