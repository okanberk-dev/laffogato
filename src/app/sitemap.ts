import type { MetadataRoute } from "next";

import { LEGAL_DOCS } from "@/lib/legal/documents";
import { ROUTES, SITE } from "@/lib/seo/site";

export const dynamic = "force-static";
export const revalidate = 3600;

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const main = ROUTES.map((r) => ({
    url: `${SITE.url}${r.path}`,
    lastModified: now,
    changeFrequency: r.changefreq,
    priority: r.priority,
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
  return [...main, legalIndex, ...legal];
}
