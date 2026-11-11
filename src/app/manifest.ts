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
    // The installed app's splash and status bar: the site's cream canvas
    // (globals.css --bg, layout.tsx themeColor), since the roast restyle of
    // 11 Kas 2026.
    background_color: "#faf7f2",
    theme_color: "#faf7f2",
    lang: SITE.language,
    dir: "ltr",
    categories: ["food", "lifestyle", "shopping"],
    // The app icon itself (lafmobil icon candidate A: the L'Af mark in cream
    // with the brass bean, on the house green), drawn from the vector mark in
    // public/brand. The maskable cut keeps the mark inside the 80 % circle a
    // launcher may crop to.
    icons: [
      { src: "/favicon.ico", sizes: "any", type: "image/x-icon" },
      { src: "/brand/app-icon-192.png", sizes: "192x192", type: "image/png" },
      {
        src: "/brand/app-icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/brand/app-icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
