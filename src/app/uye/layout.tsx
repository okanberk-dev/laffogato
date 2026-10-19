import type { Metadata } from "next";

import { SiteChrome } from "@/components/laffogato/site-chrome";
import { getSiteSettings } from "@/lib/seo/site-data";
import { footerSettings } from "@/lib/seo/contact";

export const metadata: Metadata = {
  title: "Üyelik",
  robots: { index: false, follow: false },
};

export default async function UyeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const settings = await getSiteSettings();
  return (
    <SiteChrome settings={footerSettings(settings)}>{children}</SiteChrome>
  );
}
