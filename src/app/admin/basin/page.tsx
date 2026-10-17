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
import { listPress, type AdminPress } from "@/lib/admin/store";

import {
  createPressAction,
  deletePressAction,
  updatePressAction,
} from "./actions";

export const metadata = { title: "Admin · Basın" };
export const dynamic = "force-dynamic";

function Row({ item }: { item: AdminPress }) {
  return (
    <Card>
      <ActionForm
        action={updatePressAction.bind(null, item.id)}
        className="grid gap-3"
      >
        <div className="grid content-start gap-1.5">
          <Field label="Yayın adı">
            <TextInput name="name" defaultValue={item.name} />
          </Field>
          <FormFieldError name="name" />
        </div>
        <Field label="Alıntı">
          <Textarea name="quote" defaultValue={item.quote} />
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
          action={deletePressAction}
          hidden={{ id: item.id }}
          label="Sil"
          title="Alıntı silinsin mi?"
          description="Alıntı sitenin basın bölümünden kalkar ve kalıcı olarak silinir. Bir süreliğine kaldırmak için Aktif kutusunu kaldırıp kaydet."
        />
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
        description="Ana sayfa ve hikaye bölümündeki basın alıntıları (Monocle, Cereal, …)."
      />

      <Card className="mb-6">
        <h3 className="mb-3 text-sm font-medium">+ Yeni basın alıntısı</h3>
        <ActionForm
          action={createPressAction}
          resetOnSuccess
          className="grid gap-3"
        >
          <div className="grid content-start gap-1.5">
            <Field label="Yayın adı">
              <TextInput name="name" placeholder="Monocle" />
            </Field>
            <FormFieldError name="name" />
          </div>
          <Field label="Alıntı">
            <Textarea
              name="quote"
              placeholder="The most considered new espresso bar…"
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
        {items.map((p) => (
          <Row key={p.id} item={p} />
        ))}
      </div>
    </main>
  );
}
