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
    // These were the retired köşk cream and espresso: a phone that installed
    // the site painted a palette the site itself stopped using on 2 Eyl 2026,
    // and disagreed with layout.tsx's own themeColor. The
    // values are globals.css --bg and --bg-espresso — the app's bg.canvas and
    // bg.night — so splash, browser chrome and page ground are one colour set.
    background_color: "#f9f8f7",
    theme_color: "#12291f",
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
