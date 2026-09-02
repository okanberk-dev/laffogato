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
      <form
        action={updatePressAction.bind(null, item.id)}
        className="grid gap-3"
      >
        <Field label="Yayın adı">
          <TextInput name="name" defaultValue={item.name} />
        </Field>
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
            <PrimaryButton type="submit">Kaydet</PrimaryButton>
          </div>
        </div>
      </form>
      <form
        action={deletePressAction}
        className="mt-2 border-t border-neutral-100 pt-2"
      >
        <input type="hidden" name="id" value={item.id} />
        <DangerButton type="submit">Sil</DangerButton>
      </form>
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
        <form action={createPressAction} className="grid gap-3">
          <Field label="Yayın adı">
            <TextInput name="name" placeholder="Monocle" />
          </Field>
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
              <PrimaryButton type="submit">Ekle</PrimaryButton>
            </div>
          </div>
        </form>
      </Card>

      <div className="grid gap-3">
        {items.map((p) => (
          <Row key={p.id} item={p} />
        ))}
      </div>
    </main>
  );
}
