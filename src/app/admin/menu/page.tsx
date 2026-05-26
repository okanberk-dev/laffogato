import Link from "next/link";

import { PageHeader } from "@/components/admin/forms";
import { MenuList } from "@/components/admin/menu-list";
import {
  listMenuItems,
  MENU_CATEGORY_KEYS,
  MENU_CATEGORY_LABELS,
  type AdminMenuItem,
  type MenuCategoryKey,
} from "@/lib/admin/store";

export const metadata = { title: "Admin · Kafe Menüsü" };
export const dynamic = "force-dynamic";

export default async function AdminMenuPage() {
  const all = await listMenuItems();
  const byCategory: Record<MenuCategoryKey, AdminMenuItem[]> = {
    affogato: [],
    matcha: [],
    espresso: [],
    cold: [],
    gelato: [],
  };
  for (const it of all) {
    byCategory[it.categoryKey].push(it);
  }

  return (
    <main className="mx-auto max-w-7xl px-6 py-10">
      <PageHeader
        eyebrow="Bar · Il menù"
        title="Kafe Menüsü"
        description="Her gün servis ettiğiniz affogato, matcha, espresso, soğuk içecek ve gelato kalemleri. Birden fazla seçerek toplu işlem yapabilirsin."
        action={
          <Link
            href="/admin/menu/yeni"
            className="inline-flex items-center justify-center gap-2 rounded-full bg-neutral-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-neutral-800"
          >
            + Yeni menü kalemi
          </Link>
        }
      />

      <MenuList
        itemsByCategory={byCategory}
        categoryKeys={[...MENU_CATEGORY_KEYS]}
        categoryLabels={MENU_CATEGORY_LABELS}
      />
    </main>
  );
}
