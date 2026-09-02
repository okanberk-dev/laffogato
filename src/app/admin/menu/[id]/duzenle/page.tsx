import { notFound } from "next/navigation";

import { PageHeader } from "@/components/admin/forms";
import { MenuItemForm } from "@/components/admin/menu-item-form";
import { requireRole } from "@/lib/admin/auth";
import { getMenuItem } from "@/lib/admin/store";

import { updateMenuItemAction } from "../../actions";

export const metadata = { title: "Admin · Menü Kalemi Düzenle" };

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function EditMenuItemPage({ params }: PageProps) {
  await requireRole("menu");
  const { id } = await params;
  const item = await getMenuItem(id);
  if (!item) notFound();

  const boundUpdate = updateMenuItemAction.bind(null, item.id);

  return (
    <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-10">
      <PageHeader eyebrow={`Düzenle · ${item.id}`} title={item.name} />
      <MenuItemForm
        action={boundUpdate}
        item={item}
        submitLabel="Değişiklikleri kaydet"
        cancelHref="/admin/menu"
      />
    </main>
  );
}
