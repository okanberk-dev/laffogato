import { LaffogatoApp } from "@/components/laffogato/app";
import { getSettings, listShopProducts } from "@/lib/admin/store";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [products, settings] = await Promise.all([
    listShopProducts(),
    getSettings(),
  ]);
  return (
    <LaffogatoApp
      products={products}
      settings={{
        phone: settings.phone,
        email: settings.email,
        address: settings.address,
      }}
    />
  );
}
