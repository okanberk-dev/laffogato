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
import { listPress, type AdminPress } from "@/lib/admin/store";
import { PRESS_LIMITS } from "@/lib/admin/story-press-form";

import {
  createPressAction,
  deletePressAction,
  updatePressAction,
} from "./actions";

export const metadata = { title: "Admin · Basın" };
export const dynamic = "force-dynamic";

/**
 * Yayın adı and Alıntı with their refusals under them. In the "Yeni" modal
 * the refusals come from the modal's own state, in a row's form from the
 * page form's.
 */
function PressFields({
  item,
  modal = false,
}: {
  item?: AdminPress;
  modal?: boolean;
}) {
  const Refusal = modal ? FieldError : FormFieldError;
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
        <Refusal name="name" />
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
        <Refusal name="quote" />
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

  // Name and values of the form are the old inline form's; only its home
  // moved, from a card above the list into a dialog.
  const newPress = (variant: "primary" | "ghost") => (
    <ActionModal
      action={createPressAction}
      title="Yeni basın alıntısı"
      trigger="Yeni alıntı"
      triggerVariant={variant}
      submitLabel="Ekle"
      pendingLabel="Ekleniyor…"
    >
      <div className="grid gap-3">
        <PressFields modal />
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
        title="Basın"
        description="Hikaye sayfasında görünen, gerçekten yayımlanmış basın alıntıları."
        help={
          <p>
            Yalnız gerçekten yayımlanmış alıntılar girilir. Uygulamanın Hikâye
            ekranı da aynı alıntıları gösterir.
          </p>
        }
        primary={newPress("primary")}
      />

      <h2 className="mb-3 text-sm font-medium">Alıntılar ({items.length})</h2>
      {items.length === 0 ? (
        <EmptyState
          title="Henüz basın alıntısı yok."
          description="Hikaye sayfasının basın bölümü ilk alıntı eklenince görünür."
          action={newPress("ghost")}
        />
      ) : (
        <div className="grid gap-3">
          {items.map((p) => (
            <Row key={p.id} item={p} />
          ))}
        </div>
      )}
    </PageShell>
  );
}
