import { notFound } from "next/navigation";

import { PageHeader } from "@/components/admin/forms";
import { MenuItemForm } from "@/components/admin/menu-item-form";
import { requireRole } from "@/lib/admin/auth";
import { getMenuItem, getSettings } from "@/lib/admin/store";

import { updateMenuItemAction } from "../../actions";

export const metadata = { title: "Admin · Menü kalemi düzenle" };

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function EditMenuItemPage({ params }: PageProps) {
  await requireRole("menu");
  const { id } = await params;
  const [item, settings] = await Promise.all([getMenuItem(id), getSettings()]);
  if (!item) notFound();

  const boundUpdate = updateMenuItemAction.bind(null, item.id);

  return (
    <main className="w-full px-4 pt-5 pb-10 sm:px-5 lg:px-6 lg:pt-6">
      <PageHeader title={item.name} />
      <MenuItemForm
        action={boundUpdate}
        item={item}
        submitLabel="Değişiklikleri kaydet"
        cancelHref="/admin/menu"
        menuTaxRate={settings.taxRates.menu}
      />
    </main>
  );
}
