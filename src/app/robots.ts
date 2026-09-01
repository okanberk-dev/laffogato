import type { MetadataRoute } from "next";

import { getPublicSettings } from "@/lib/admin/store";
import { IS_PRODUCTION_DEPLOY, SITE } from "@/lib/seo/site";

// Dynamic: the admin's "open to search engines" switch is read at request
// time. It used to be force-static and never read the setting at all, so
// turning the site off in Ayarlar changed nothing.
export const dynamic = "force-dynamic";

/** Paths no crawler should follow, on any user-agent. */
const PRIVATE_PATHS = [
  "/admin",
  "/admin/",
  "/api/",
  "/uye",
  "/uye/",
  "/odeme",
  "/design-preview",
];

/**
 * Crawlers named individually so their access is explicit — search engines,
 * social unfurlers and the AI crawlers `llms.txt` is written for.
 *
 * Each still carries the private-path disallow list. A named group REPLACES
 * the `*` group for that agent rather than adding to it, so listing a bot with
 * a bare `allow: "/"` handed it /admin, /api, /odeme and /uye.
 */
const NAMED_CRAWLERS = [
  "GPTBot",
  "ChatGPT-User",
  "OAI-SearchBot",
  "ClaudeBot",
  "Claude-Web",
  "PerplexityBot",
  "Perplexity-User",
  "Google-Extended",
  "GoogleOther",
  "Applebot",
  "Applebot-Extended",
  "Bingbot",
  "DuckDuckBot",
  "YandexBot",
  "Amazonbot",
  "Meta-ExternalAgent",
  "Bytespider",
  "FacebookExternalHit",
  "Twitterbot",
  "LinkedInBot",
];

export default async function robots(): Promise<MetadataRoute.Robots> {
  // Preview / development deployments: tell every crawler to stay away so
  // they don't compete with the production domain in search results.
  if (!IS_PRODUCTION_DEPLOY) {
    return {
      rules: [{ userAgent: "*", disallow: "/" }],
      sitemap: `${SITE.url}/sitemap.xml`,
    };
  }

  // A database outage must not silently open a site the owner closed, nor
  // close one they left open. `getPublicSettings` degrades to the defaults,
  // where `seoIndexable` is true — the same answer as an untouched install.
  const settings = await getPublicSettings();
  if (!settings.seoIndexable) {
    return { rules: [{ userAgent: "*", disallow: "/" }] };
  }

  return {
    rules: [
      { userAgent: "*", allow: ["/"], disallow: PRIVATE_PATHS },
      ...NAMED_CRAWLERS.map((userAgent) => ({
        userAgent,
        allow: ["/"],
        disallow: PRIVATE_PATHS,
      })),
    ],
    sitemap: `${SITE.url}/sitemap.xml`,
    host: SITE.url,
  };
}
