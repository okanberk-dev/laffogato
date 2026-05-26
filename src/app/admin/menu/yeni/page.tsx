import { PageHeader } from "@/components/admin/forms";
import { MenuItemForm } from "@/components/admin/menu-item-form";
import { MENU_CATEGORY_KEYS, type MenuCategoryKey } from "@/lib/admin/store";

import { createMenuItemAction } from "../actions";

export const metadata = { title: "Admin · Yeni Menü Kalemi" };

interface PageProps {
  searchParams: Promise<{ cat?: string }>;
}

export default async function NewMenuItemPage({ searchParams }: PageProps) {
  const { cat } = await searchParams;
  const defaultCategoryKey: MenuCategoryKey =
    cat && MENU_CATEGORY_KEYS.includes(cat as MenuCategoryKey)
      ? (cat as MenuCategoryKey)
      : "affogato";

  return (
    <main className="mx-auto max-w-7xl px-6 py-10">
      <PageHeader
        eyebrow="Bar · Il menù"
        title="Yeni menü kalemi"
        description="Mevsimlik yeni bir affogato, matcha varyantı veya soğuk içecek ekle."
      />
      <MenuItemForm
        action={createMenuItemAction}
        defaultCategoryKey={defaultCategoryKey}
        submitLabel="Menüye ekle"
        cancelHref="/admin/menu"
      />
    </main>
  );
}
