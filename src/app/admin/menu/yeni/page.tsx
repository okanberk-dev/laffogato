import { PageHeader } from "@/components/admin/forms";
import { MenuItemForm } from "@/components/admin/menu-item-form";
import { requireRole } from "@/lib/admin/auth";
import { menuItemCopy } from "@/lib/admin/menu-panel";
import {
  getMenuItem,
  getSettings,
  MENU_CATEGORY_KEYS,
  type MenuCategoryKey,
} from "@/lib/admin/store";

import { createMenuItemAction } from "../actions";

export const metadata = { title: "Admin · Yeni menü kalemi" };

interface PageProps {
  searchParams: Promise<{ cat?: string; kopya?: string }>;
}

/**
 * A new menu item, empty or (`?kopya=<id>`, the ⋯ menu's "Kopyala") filled
 * from an existing one. A copy posts to the same create action as any new
 * item; nothing of the original changes.
 */
export default async function NewMenuItemPage({ searchParams }: PageProps) {
  await requireRole("menu");
  const [{ cat, kopya }, settings] = await Promise.all([
    searchParams,
    getSettings(),
  ]);
  const source = kopya ? await getMenuItem(kopya) : null;
  const defaultCategoryKey: MenuCategoryKey =
    cat && MENU_CATEGORY_KEYS.includes(cat as MenuCategoryKey)
      ? (cat as MenuCategoryKey)
      : "matcha";

  return (
    <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-10">
      <PageHeader
        eyebrow="Katalog · Kafe menüsü"
        title={source ? "Menü kalemini kopyala" : "Yeni menü kalemi"}
        description={
          source
            ? `“${source.name}” yeni bir kalem olarak kopyalandı. Adını ve fiyatını kontrol et; kopya, “Menüde göster”i işaretleyene kadar menüde görünmez.`
            : "Menüye yeni bir içecek, tatlı veya atıştırmalık ekle."
        }
      />
      <MenuItemForm
        action={createMenuItemAction}
        item={source ? menuItemCopy(source) : undefined}
        defaultCategoryKey={defaultCategoryKey}
        submitLabel="Menüye ekle"
        cancelHref="/admin/menu"
        menuTaxRate={settings.taxRates.menu}
        saveAndNew={!source}
      />
    </main>
  );
}
