import {
  ActionForm,
  FormFieldError,
  FormMessage,
  SubmitButton,
} from "@/components/admin/action-form";
import {
  Card,
  Checkbox,
  Field,
  PageHeader,
  Textarea,
  TextInput,
} from "@/components/admin/forms";
import { ConfirmButton } from "@/components/admin/ui";
import { requireRole } from "@/lib/admin/auth";
import { listStoryEvents, type AdminStoryEvent } from "@/lib/admin/store";

import {
  createStoryAction,
  deleteStoryAction,
  updateStoryAction,
} from "./actions";

export const metadata = { title: "Admin · Hikaye" };
export const dynamic = "force-dynamic";

function Row({ item }: { item: AdminStoryEvent }) {
  return (
    <Card>
      <ActionForm
        action={updateStoryAction.bind(null, item.id)}
        className="grid gap-3"
      >
        <div className="grid gap-3 sm:grid-cols-[120px_1fr]">
          <Field label="Yıl">
            <TextInput name="year" defaultValue={item.year} />
          </Field>
          <div className="grid content-start gap-1.5">
            <Field label="Başlık">
              <TextInput name="title" defaultValue={item.title} />
            </Field>
            <FormFieldError name="title" />
          </div>
        </div>
        <Field label="Açıklama">
          <Textarea name="body" defaultValue={item.body} />
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Sıra">
            <TextInput
              name="sortOrder"
              type="number"
              defaultValue={item.sortOrder}
            />
          </Field>
          <div className="flex items-end justify-between gap-3">
            <Checkbox
              name="isActive"
              label="Aktif"
              defaultChecked={item.isActive}
            />
            <SubmitButton>Kaydet</SubmitButton>
          </div>
        </div>
        <FormMessage />
      </ActionForm>
      <div className="mt-2 border-t border-neutral-100 pt-2">
        <ConfirmButton
          action={deleteStoryAction}
          hidden={{ id: item.id }}
          label="Sil"
          title="Dönem silinsin mi?"
          description="Dönem hikaye sayfasından kalkar ve kalıcı olarak silinir. Bir süreliğine kaldırmak için Aktif kutusunu kaldırıp kaydet."
        />
      </div>
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
        description="Story sayfasındaki 1897 → 2026 miras adımları. Sıraya göre dikey çizelgede görünür."
      />

      <Card className="mb-6">
        <h3 className="mb-3 text-sm font-medium">+ Yeni dönem</h3>
        <ActionForm
          action={createStoryAction}
          resetOnSuccess
          className="grid gap-3"
        >
          <div className="grid gap-3 sm:grid-cols-[120px_1fr]">
            <Field label="Yıl">
              <TextInput name="year" placeholder="1897" />
            </Field>
            <div className="grid content-start gap-1.5">
              <Field label="Başlık">
                <TextInput name="title" placeholder="Bologna · 1897" />
              </Field>
              <FormFieldError name="title" />
            </div>
          </div>
          <Field label="Açıklama">
            <Textarea
              name="body"
              placeholder="Giancarlo Mancuso ilk L'Affogato barını açar…"
            />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Sıra">
              <TextInput
                name="sortOrder"
                type="number"
                defaultValue={items.length}
              />
            </Field>
            <div className="flex items-end justify-between gap-3">
              <Checkbox name="isActive" label="Aktif" defaultChecked />
              <SubmitButton pendingLabel="Ekleniyor…">Ekle</SubmitButton>
            </div>
          </div>
          <FormMessage />
        </ActionForm>
      </Card>

      <div className="grid gap-3">
        {items.map((e) => (
          <Row key={e.id} item={e} />
        ))}
      </div>
    </main>
  );
}
