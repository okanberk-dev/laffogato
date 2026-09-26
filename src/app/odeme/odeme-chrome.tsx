"use client";

import { usePathname } from "next/navigation";

import { SiteChrome } from "@/components/laffogato/site-chrome";
import type { FooterSettings } from "@/components/laffogato/chrome";

/**
 * Pages under /odeme that open inside the phone app's in-app browser, not on
 * the site: the virtual POS sends a failed app checkout to /odeme/app-hata
 * (docs/API-MOBILE.md §3). There the site's header, tab bar and footer are
 * a second app drawn inside the first - a shop, a cart and a newsletter
 * around a screen whose only job is "back to the app". They render bare.
 */
const IN_APP_PATHS = new Set(["/odeme/app-hata"]);

export function OdemeChrome({
  settings,
  children,
}: {
  settings: FooterSettings;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  if (pathname && IN_APP_PATHS.has(pathname)) return <>{children}</>;
  return <SiteChrome settings={settings}>{children}</SiteChrome>;
}
