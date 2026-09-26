import type { Metadata } from "next";

import { SiteChrome } from "@/components/laffogato/site-chrome";
import { getPublicSettings } from "@/lib/admin/store";

/**
 * The guides themselves are static, but the chrome around them reads live
 * settings (phone, e-mail, address in the footer), so the segment stays
 * dynamic - the same trade-off `/hukuk` makes.
 */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: {
    default: "Rehber · L'Affogato",
    template: "%s · L'Affogato",
  },
};

export default async function RehberLayout({
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
