import Link from "next/link";

import { PageHeader } from "@/components/admin/forms";
import { MenuFoodInfoStatus } from "@/components/admin/menu-food-info-status";
import { MenuList } from "@/components/admin/menu-list";
import { requireRole } from "@/lib/admin/auth";
import {
  getSettings,
  listMenuItems,
  MENU_CATEGORY_KEYS,
  MENU_CATEGORY_LABELS,
  type AdminMenuItem,
  type MenuCategoryKey,
} from "@/lib/admin/store";

export const metadata = { title: "Admin · Kafe Menüsü" };
export const dynamic = "force-dynamic";

export default async function AdminMenuPage() {
  await requireRole("menu");
  const [all, settings] = await Promise.all([listMenuItems(), getSettings()]);
  const byCategory = Object.fromEntries(
    MENU_CATEGORY_KEYS.map((k) => [k, [] as AdminMenuItem[]]),
  ) as Record<MenuCategoryKey, AdminMenuItem[]>;
  for (const it of all) {
    byCategory[it.categoryKey].push(it);
  }

  return (
    <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-10">
      <PageHeader
        eyebrow="Katalog · Kafe menüsü"
        title="Kafe Menüsü"
        description="Basılı menünün tamamı - matcha bar, espresso, buzlu kahveler, soğuk/sıcak içecekler, frappe, smoothie, frozen, ice tea, tatlılar ve atıştırmalıklar. Birden fazla seçerek toplu işlem yapabilirsin."
        action={
          <Link
            href="/admin/menu/yeni"
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-[var(--admin-primary)] px-5 py-2.5 text-sm font-medium text-white hover:bg-[var(--admin-primary-hover)]"
          >
            + Yeni menü kalemi
          </Link>
        }
      />

      <MenuFoodInfoStatus
        items={all}
        priceDate={settings.menuPricesEffectiveDate}
      />

      <MenuList
        itemsByCategory={byCategory}
        categoryKeys={[...MENU_CATEGORY_KEYS]}
        categoryLabels={MENU_CATEGORY_LABELS}
      />
    </main>
  );
}
