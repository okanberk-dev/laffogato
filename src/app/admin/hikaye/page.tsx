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
import {
  ActionModal,
  ConfirmButton,
  EmptyState,
  FieldError,
  PageShell,
} from "@/components/admin/ui";
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

/**
 * Yıl, Başlık and Açıklama with their refusals under them. In the "Yeni"
 * modal the refusals come from the modal's own state, in a row's form from
 * the page form's.
 */
function StoryFields({
  item,
  modal = false,
}: {
  item?: AdminStoryEvent;
  modal?: boolean;
}) {
  const Refusal = modal ? FieldError : FormFieldError;
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
          <Refusal name="year" />
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
          <Refusal name="title" />
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
        <Refusal name="body" />
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

  // Name and values of the form are the old inline form's; only its home
  // moved, from a card above the list into a dialog.
  const newEvent = (variant: "primary" | "ghost") => (
    <ActionModal
      action={createStoryAction}
      title="Yeni dönem"
      trigger="Yeni dönem"
      triggerVariant={variant}
      submitLabel="Ekle"
      pendingLabel="Ekleniyor…"
    >
      <div className="grid gap-3">
        <StoryFields modal />
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Sıra">
            <TextInput
              name="sortOrder"
              type="number"
              defaultValue={items.length}
            />
          </Field>
          <div className="flex items-end">
            <Checkbox name="isActive" label="Aktif" defaultChecked />
          </div>
        </div>
      </div>
    </ActionModal>
  );

  return (
    <PageShell width="detail">
      <PageHeader
        title="Hikaye"
        description="Hikaye sayfasındaki 1897 → 2026 miras adımları."
        help={
          <p>
            Adımlar sıraya göre dikey çizelgede görünür; uygulamanın Hikâye
            ekranı da aynı listeyi gösterir.
          </p>
        }
        primary={newEvent("primary")}
      />

      <h2 className="mb-3 text-sm font-medium">Dönemler ({items.length})</h2>
      {items.length === 0 ? (
        <EmptyState
          title="Henüz dönem yok."
          description="Hikaye sayfasındaki zaman çizelgesi boş görünür."
          action={newEvent("ghost")}
        />
      ) : (
        <div className="grid gap-3">
          {items.map((e) => (
            <Row key={e.id} item={e} />
          ))}
        </div>
      )}
    </PageShell>
  );
}
