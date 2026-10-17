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
import { ConfirmButton, EmptyState } from "@/components/admin/ui";
import { requireRole } from "@/lib/admin/auth";
import { listStoryEvents, type AdminStoryEvent } from "@/lib/admin/store";
import { STORY_LIMITS } from "@/lib/admin/story-press-form";

import {
  createStoryAction,
  deleteStoryAction,
  updateStoryAction,
} from "./actions";

export const metadata = { title: "Admin · Hikaye" };
export const dynamic = "force-dynamic";

/** Yıl, Başlık and Açıklama with their refusals under them. */
function StoryFields({ item }: { item?: AdminStoryEvent }) {
  return (
    <>
      <div className="grid gap-3 sm:grid-cols-[120px_1fr]">
        <div className="grid content-start gap-1.5">
          <Field label="Yıl">
            <TextInput
              name="year"
              defaultValue={item?.year}
              placeholder={item ? undefined : "1897"}
              maxLength={STORY_LIMITS.year}
            />
          </Field>
          <FormFieldError name="year" />
        </div>
        <div className="grid content-start gap-1.5">
          <Field label="Başlık">
            <TextInput
              name="title"
              defaultValue={item?.title}
              placeholder={item ? undefined : "Bologna · 1897"}
              maxLength={STORY_LIMITS.title}
            />
          </Field>
          <FormFieldError name="title" />
        </div>
      </div>
      <div className="grid content-start gap-1.5">
        <Field label="Açıklama" hint="En fazla 500 karakter.">
          <Textarea
            name="body"
            defaultValue={item?.body}
            placeholder={
              item ? undefined : "Giancarlo Mancuso ilk L'Affogato barını açar…"
            }
            maxLength={STORY_LIMITS.body}
          />
        </Field>
        <FormFieldError name="body" />
      </div>
    </>
  );
}

function Row({ item }: { item: AdminStoryEvent }) {
  const name = [item.year, item.title].filter(Boolean).join(" · ");
  return (
    <Card>
      <div role="group" aria-label={`Dönem: ${name}`}>
        <ActionForm
          action={updateStoryAction.bind(null, item.id)}
          className="grid gap-3"
        >
          <StoryFields item={item} />
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
        <div className="mt-2 border-t border-[var(--admin-border)] pt-2">
          <ConfirmButton
            action={deleteStoryAction}
            hidden={{ id: item.id }}
            label="Sil"
            ariaLabel={`Sil: ${name}`}
            title="Dönem silinsin mi?"
            description="Dönem hikaye sayfasından kalkar ve kalıcı olarak silinir. Bir süreliğine kaldırmak için Aktif kutusunu kaldırıp kaydet."
          />
        </div>
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
        description="Hikaye sayfasındaki 1897 → 2026 miras adımları. Sıraya göre dikey çizelgede görünür; uygulamanın Hikâye ekranı da aynı listeyi gösterir."
      />

      <Card className="mb-6">
        <h2 className="mb-3 text-sm font-medium">+ Yeni dönem</h2>
        <ActionForm
          action={createStoryAction}
          resetOnSuccess
          className="grid gap-3"
        >
          <StoryFields />
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

      <h2 className="mb-3 text-sm font-medium">Dönemler ({items.length})</h2>
      {items.length === 0 ? (
        <EmptyState
          title="Henüz dönem yok"
          description="Hikaye sayfasındaki zaman çizelgesi boş görünür. İlk dönemi yukarıdan ekle."
        />
      ) : (
        <div className="grid gap-3">
          {items.map((e) => (
            <Row key={e.id} item={e} />
          ))}
        </div>
      )}
    </main>
  );
}
