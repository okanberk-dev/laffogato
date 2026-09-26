import type { Metadata } from "next";

import { SiteChrome } from "@/components/laffogato/site-chrome";
import { getPublicSettings } from "@/lib/admin/store";

export const metadata: Metadata = {
  title: "Üyelik",
  robots: { index: false, follow: false },
};

export default async function UyeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const settings = await getPublicSettings();
  return (
    <SiteChrome
      settings={{
        phone: settings.phone,
        email: settings.email,
        address: settings.address,
      }}
    >
      {children}
    </SiteChrome>
  );
}
