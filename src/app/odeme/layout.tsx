import type { Metadata } from "next";

import { getPublicSettings } from "@/lib/admin/store";

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
    <OdemeChrome
      settings={{
        phone: settings.phone,
        email: settings.email,
        address: settings.address,
      }}
    >
      {children}
    </OdemeChrome>
  );
}
