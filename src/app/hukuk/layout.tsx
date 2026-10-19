import type { Metadata } from "next";

import { SiteChrome } from "@/components/laffogato/site-chrome";
import { getPublicSettings } from "@/lib/admin/store";
import { footerSettings } from "@/lib/seo/contact";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: {
    default: "Hukuki bilgiler · L'Affogato",
    template: "%s · L'Affogato",
  },
};

export default async function HukukLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const settings = await getPublicSettings();
  return (
    <SiteChrome settings={footerSettings(settings)}>{children}</SiteChrome>
  );
}
