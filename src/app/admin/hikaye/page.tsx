import {
  Card,
  Checkbox,
  DangerButton,
  Field,
  PageHeader,
  PrimaryButton,
  Textarea,
  TextInput,
} from "@/components/admin/forms";
import { requireRole } from "@/lib/admin/auth";
import { listStoryEvents, type AdminStoryEvent } from "@/lib/admin/store";

import { createStoryAction, deleteStoryAction, updateStoryAction } from "./actions";

export const metadata = { title: "Admin · Hikaye" };
export const dynamic = "force-dynamic";

function Row({ item }: { item: AdminStoryEvent }) {
  return (
    <Card>
      <form action={updateStoryAction.bind(null, item.id)} className="grid gap-3">
        <div className="grid gap-3 sm:grid-cols-[120px_1fr]">
          <Field label="Yıl"><TextInput name="year" defaultValue={item.year} /></Field>
          <Field label="Başlık"><TextInput name="title" defaultValue={item.title} /></Field>
        </div>
        <Field label="Açıklama"><Textarea name="body" defaultValue={item.body} /></Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Sıra"><TextInput name="sortOrder" type="number" defaultValue={item.sortOrder} /></Field>
          <div className="flex items-end justify-between gap-3">
            <Checkbox name="isActive" label="Aktif" defaultChecked={item.isActive} />
            <PrimaryButton type="submit">Kaydet</PrimaryButton>
          </div>
        </div>
      </form>
      <form action={deleteStoryAction} className="mt-2 border-t border-neutral-100 pt-2">
        <input type="hidden" name="id" value={item.id} />
        <DangerButton type="submit">Sil</DangerButton>
      </form>
    </Card>
  );
}

export default async function AdminStoryPage() {
  await requireRole("story");
  const items = await listStoryEvents();

  return (
    <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-10">
      <PageHeader
        eyebrow="İçerik · Hikaye"
        title="Hikaye zaman çizelgesi"
        description="Story sayfasındaki 1987 → 2026 miras adımları. Sıraya göre dikey çizelgede görünür."
      />

      <Card className="mb-6">
        <h3 className="mb-3 text-sm font-medium">+ Yeni dönem</h3>
        <form action={createStoryAction} className="grid gap-3">
          <div className="grid gap-3 sm:grid-cols-[120px_1fr]">
            <Field label="Yıl"><TextInput name="year" placeholder="1987" /></Field>
            <Field label="Başlık"><TextInput name="title" placeholder="Bologna · 1987" /></Field>
          </div>
          <Field label="Açıklama"><Textarea name="body" placeholder="Giancarlo Mancuso ilk L'Affogato barını açar…" /></Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Sıra"><TextInput name="sortOrder" type="number" defaultValue={items.length} /></Field>
            <div className="flex items-end justify-between gap-3">
              <Checkbox name="isActive" label="Aktif" defaultChecked />
              <PrimaryButton type="submit">Ekle</PrimaryButton>
            </div>
          </div>
        </form>
      </Card>

      <div className="grid gap-3">
        {items.map((e) => <Row key={e.id} item={e} />)}
      </div>
    </main>
  );
}
