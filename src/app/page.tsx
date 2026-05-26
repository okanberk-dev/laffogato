import { LaffogatoApp } from "@/components/laffogato/app";
import { getSettings, listShopProducts } from "@/lib/admin/store";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ cart?: string; item?: string; available?: string }>;
}

export default async function HomePage({ searchParams }: PageProps) {
  const [{ cart, item, available }, products, settings] = await Promise.all([
    searchParams,
    listShopProducts(),
    getSettings(),
  ]);

  let notice: string | undefined;
  if (cart === "out_of_stock") {
    const remain = Number(available);
    const tail = Number.isFinite(remain) && remain >= 0 ? ` (kalan: ${remain})` : "";
    notice = `Üzgünüz, "${item ?? "ürün"}" için yeterli stok yok${tail}. Sepetinden adedini azaltıp tekrar dene.`;
  } else if (cart === "empty") {
    notice = "Sepetin boş — bir affogato seçip dene.";
  }

  return (
    <LaffogatoApp
      products={products}
      settings={{
        phone: settings.phone,
        email: settings.email,
        address: settings.address,
      }}
      notice={notice}
    />
  );
}
