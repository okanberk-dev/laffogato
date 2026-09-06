import type { MetadataRoute } from "next";

import { SITE } from "@/lib/seo/site";

export const dynamic = "force-static";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: SITE.brand,
    short_name: SITE.name,
    description: SITE.shortDescription,
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    // The installed app's splash and Android status bar.
    //
    // These follow globals.css --bg and --bg-espresso, so the splash, the
    // browser chrome and the page ground are one colour set and none of them
    // disagrees with layout.tsx's own themeColor. Moved to the Köşk
    // redesign's white ground and deep green on 5 Eyl 2026.
    background_color: "#ffffff",
    theme_color: "#143d2b",
    lang: SITE.language,
    dir: "ltr",
    categories: ["food", "lifestyle", "shopping"],
    icons: [
      { src: "/favicon.ico", sizes: "any", type: "image/x-icon" },
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
    ],
  };
}
