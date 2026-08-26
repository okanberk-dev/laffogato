import type { Metadata } from "next";

import { SiteChrome } from "@/components/laffogato/site-chrome";
import { getPublicSettings } from "@/lib/admin/store";

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
    <SiteChrome
      settings={{
        phone: settings.phone,
        email: settings.email,
        address: settings.address,
      }}
    >
      <div style={{ background: "var(--bg-warm)" }}>{children}</div>
    </SiteChrome>
  );
}
