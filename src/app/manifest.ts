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
    // The installed app's splash and status bar: the app's own porcelain
    // (lafmobil app.json backgroundColor #F7F3ED = globals.css --bg) and the
    // glass header's ground (layout.tsx themeColor #fbf8f4). The site took
    // the app's palette on 25 Eyl 2026, so the installed web app opens on the
    // same ground the phone app does.
    background_color: "#f7f3ed",
    theme_color: "#fbf8f4",
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
