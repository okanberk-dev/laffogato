import type { Metadata } from "next";

import { getPublicSettings } from "@/lib/admin/store";
import { footerSettings } from "@/lib/seo/contact";

import { OdemeChrome } from "./odeme-chrome";

export const metadata: Metadata = {
  title: "Ödeme",
  robots: { index: false, follow: false },
};

export default async function OdemeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const settings = await getPublicSettings();
  return (
    <OdemeChrome settings={footerSettings(settings)}>{children}</OdemeChrome>
  );
}
