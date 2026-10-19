import { PageHeader } from "@/components/admin/forms";
import { MenuItemForm } from "@/components/admin/menu-item-form";
import { requireRole } from "@/lib/admin/auth";
import {
  getSettings,
  MENU_CATEGORY_KEYS,
  type MenuCategoryKey,
} from "@/lib/admin/store";

import { createMenuItemAction } from "../actions";

export const metadata = { title: "Admin · Yeni menü kalemi" };

interface PageProps {
  searchParams: Promise<{ cat?: string }>;
}

export default async function NewMenuItemPage({ searchParams }: PageProps) {
  await requireRole("menu");
  const [{ cat }, settings] = await Promise.all([searchParams, getSettings()]);
  const defaultCategoryKey: MenuCategoryKey =
    cat && MENU_CATEGORY_KEYS.includes(cat as MenuCategoryKey)
      ? (cat as MenuCategoryKey)
      : "matcha";

  return (
    <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-10">
      <PageHeader
        eyebrow="Katalog · Kafe menüsü"
        title="Yeni menü kalemi"
        description="Menüye yeni bir içecek, tatlı veya atıştırmalık ekle."
      />
      <MenuItemForm
        action={createMenuItemAction}
        defaultCategoryKey={defaultCategoryKey}
        submitLabel="Menüye ekle"
        cancelHref="/admin/menu"
        menuTaxRate={settings.taxRates.menu}
      />
    </main>
  );
}
