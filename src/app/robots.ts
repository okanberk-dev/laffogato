import type { MetadataRoute } from "next";

import { SITE } from "@/lib/seo/site";

export const dynamic = "force-static";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/"],
        disallow: ["/admin", "/admin/", "/api/", "/odeme/basarili"],
      },
      // Generative AI / LLM crawlers — allowed; llms.txt provides curated
      // content for them.
      { userAgent: "GPTBot", allow: "/" },
      { userAgent: "ChatGPT-User", allow: "/" },
      { userAgent: "OAI-SearchBot", allow: "/" },
      { userAgent: "ClaudeBot", allow: "/" },
      { userAgent: "Claude-Web", allow: "/" },
      { userAgent: "PerplexityBot", allow: "/" },
      { userAgent: "Perplexity-User", allow: "/" },
      { userAgent: "Google-Extended", allow: "/" },
      { userAgent: "GoogleOther", allow: "/" },
      { userAgent: "Applebot", allow: "/" },
      { userAgent: "Applebot-Extended", allow: "/" },
      { userAgent: "Bingbot", allow: "/" },
      { userAgent: "DuckDuckBot", allow: "/" },
      { userAgent: "YandexBot", allow: "/" },
      { userAgent: "Amazonbot", allow: "/" },
      { userAgent: "Meta-ExternalAgent", allow: "/" },
      { userAgent: "Bytespider", allow: "/" },
      { userAgent: "FacebookExternalHit", allow: "/" },
      { userAgent: "Twitterbot", allow: "/" },
      { userAgent: "LinkedInBot", allow: "/" },
    ],
    sitemap: `${SITE.url}/sitemap.xml`,
    host: SITE.url,
  };
}
