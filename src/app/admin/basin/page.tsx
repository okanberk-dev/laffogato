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
import { listPress, type AdminPress } from "@/lib/admin/store";
import { PRESS_LIMITS } from "@/lib/admin/story-press-form";

import {
  createPressAction,
  deletePressAction,
  updatePressAction,
} from "./actions";

export const metadata = { title: "Admin · Basın" };
export const dynamic = "force-dynamic";

/** Yayın adı and Alıntı with their refusals under them. */
function PressFields({ item }: { item?: AdminPress }) {
  return (
    <>
      <div className="grid content-start gap-1.5">
        <Field label="Yayın adı">
          <TextInput
            name="name"
            defaultValue={item?.name}
            placeholder={item ? undefined : "Yayının adı"}
            maxLength={PRESS_LIMITS.name}
          />
        </Field>
        <FormFieldError name="name" />
      </div>
      <div className="grid content-start gap-1.5">
        <Field
          label="Alıntı"
          hint="Yayının yazdığı cümle, olduğu gibi. En fazla 300 karakter."
        >
          <Textarea
            name="quote"
            defaultValue={item?.quote}
            placeholder={item ? undefined : "Yayının yazdığı cümle"}
            maxLength={PRESS_LIMITS.quote}
          />
        </Field>
        <FormFieldError name="quote" />
      </div>
    </>
  );
}

function Row({ item }: { item: AdminPress }) {
  return (
    <Card>
      <div role="group" aria-label={`Alıntı: ${item.name}`}>
        <ActionForm
          action={updatePressAction.bind(null, item.id)}
          className="grid gap-3"
        >
          <PressFields item={item} />
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
            action={deletePressAction}
            hidden={{ id: item.id }}
            label="Sil"
            ariaLabel={`Sil: ${item.name}`}
            title="Alıntı silinsin mi?"
            description="Alıntı hikaye sayfasının basın bölümünden kalkar ve kalıcı olarak silinir. Bir süreliğine kaldırmak için Aktif kutusunu kaldırıp kaydet."
          />
        </div>
      </div>
    </Card>
  );
}

export default async function AdminPressPage() {
  await requireRole("press");
  const items = await listPress();

  return (
    <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-10">
      <PageHeader
        eyebrow="İçerik · Basın"
        title="Basın"
        description="Hikaye sayfasındaki basın alıntıları; yalnız gerçekten yayımlanmış olanlar. Uygulamanın Hikâye ekranı da aynı alıntıları gösterir."
      />

      <Card className="mb-6">
        <h2 className="mb-3 text-sm font-medium">+ Yeni basın alıntısı</h2>
        <ActionForm
          action={createPressAction}
          resetOnSuccess
          className="grid gap-3"
        >
          <PressFields />
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

      <h2 className="mb-3 text-sm font-medium">Alıntılar ({items.length})</h2>
      {items.length === 0 ? (
        <EmptyState
          title="Henüz basın alıntısı yok"
          description="Hikaye sayfasının basın bölümü ilk alıntı eklenince görünür."
        />
      ) : (
        <div className="grid gap-3">
          {items.map((p) => (
            <Row key={p.id} item={p} />
          ))}
        </div>
      )}
    </main>
  );
}
