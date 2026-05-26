import { SiteChrome } from "@/components/laffogato/site-chrome";
import { getSettings } from "@/lib/admin/store";

export default async function OdemeLayout({ children }: { children: React.ReactNode }) {
  const settings = await getSettings();
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
