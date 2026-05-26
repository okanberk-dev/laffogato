import { LaffogatoApp } from "@/components/laffogato/app";
import { listShopProducts } from "@/lib/admin/store";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const products = await listShopProducts();
  return <LaffogatoApp products={products} />;
}
