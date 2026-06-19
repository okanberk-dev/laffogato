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
import {
  listFranchisePackages,
  listFranchiseSteps,
  type AdminFranchisePackage,
  type AdminFranchiseStep,
} from "@/lib/admin/store";

import {
  createPackageAction,
  createStepAction,
  deletePackageAction,
  deleteStepAction,
  updatePackageAction,
  updateStepAction,
} from "./actions";

export const metadata = { title: "Admin · Franchise" };
export const dynamic = "force-dynamic";

function PackageRow({ p }: { p: AdminFranchisePackage }) {
  return (
    <Card>
      <form
        action={updatePackageAction.bind(null, p.id)}
        className="grid gap-3 sm:grid-cols-2"
      >
        <Field label="Paket adı">
          <TextInput name="name" defaultValue={p.name} />
        </Field>
        <Field label="Alan (m²)">
          <TextInput name="area" defaultValue={p.area} />
        </Field>
        <Field label="Koltuk">
          <TextInput name="seats" defaultValue={p.seats} />
        </Field>
        <Field label="Yatırım">
          <TextInput name="invest" defaultValue={p.invest} />
        </Field>
        <Field label="Aylık">
          <TextInput name="monthly" defaultValue={p.monthly} />
        </Field>
        <Field label="İdeal konum">
          <TextInput name="ideal" defaultValue={p.ideal} />
        </Field>
        <div className="sm:col-span-2">
          <Field label="İçerik (her satır bir madde)">
            <Textarea name="includes" defaultValue={p.includes.join("\n")} />
          </Field>
        </div>
        <Field label="Sıra">
          <TextInput
            name="sortOrder"
            type="number"
            defaultValue={p.sortOrder}
          />
        </Field>
        <div className="flex items-end justify-between gap-3">
          <div className="flex flex-col gap-1">
            <Checkbox
              name="featured"
              label="Öne çıkan"
              defaultChecked={p.featured}
            />
            <Checkbox
              name="isActive"
              label="Aktif"
              defaultChecked={p.isActive}
            />
          </div>
          <PrimaryButton type="submit">Kaydet</PrimaryButton>
        </div>
      </form>
      <form
        action={deletePackageAction}
        className="mt-2 border-t border-neutral-100 pt-2"
      >
        <input type="hidden" name="id" value={p.id} />
        <DangerButton type="submit">Sil</DangerButton>
      </form>
    </Card>
  );
}

function StepRow({ s }: { s: AdminFranchiseStep }) {
  return (
    <Card>
      <form action={updateStepAction.bind(null, s.id)} className="grid gap-3">
        <div className="grid gap-3 sm:grid-cols-[100px_1fr]">
          <Field label="No">
            <TextInput name="step" defaultValue={s.step} />
          </Field>
          <Field label="Başlık">
            <TextInput name="title" defaultValue={s.title} />
          </Field>
        </div>
        <Field label="Açıklama">
          <Textarea name="body" defaultValue={s.body} />
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Sıra">
            <TextInput
              name="sortOrder"
              type="number"
              defaultValue={s.sortOrder}
            />
          </Field>
          <div className="flex items-end justify-between gap-3">
            <Checkbox
              name="isActive"
              label="Aktif"
              defaultChecked={s.isActive}
            />
            <PrimaryButton type="submit">Kaydet</PrimaryButton>
          </div>
        </div>
      </form>
      <form
        action={deleteStepAction}
        className="mt-2 border-t border-neutral-100 pt-2"
      >
        <input type="hidden" name="id" value={s.id} />
        <DangerButton type="submit">Sil</DangerButton>
      </form>
    </Card>
  );
}

export default async function AdminFranchisePage() {
  await requireRole("franchise");
  const [packages, steps] = await Promise.all([
    listFranchisePackages(),
    listFranchiseSteps(),
  ]);

  return (
    <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-10">
      <PageHeader
        eyebrow="İçerik · Franchise"
        title="Franchise"
        description="Franchise sayfasındaki paketler (Kiosk / Bottega / Salone) ve başvuru süreç adımları."
      />

      <h2 className="mb-3 text-sm font-medium tracking-widest text-neutral-500 uppercase">
        Paketler
      </h2>
      <Card className="mb-4">
        <h3 className="mb-3 text-sm font-medium">+ Yeni paket</h3>
        <form
          action={createPackageAction}
          className="grid gap-3 sm:grid-cols-2"
        >
          <Field label="Paket adı">
            <TextInput name="name" placeholder="Kiosk" />
          </Field>
          <Field label="Alan (m²)">
            <TextInput name="area" placeholder="24–38 m²" />
          </Field>
          <Field label="Koltuk">
            <TextInput name="seats" placeholder="6–10" />
          </Field>
          <Field label="Yatırım">
            <TextInput name="invest" placeholder="Talep üzerine" />
          </Field>
          <Field label="Aylık">
            <TextInput name="monthly" placeholder="İletişim" />
          </Field>
          <Field label="İdeal konum">
            <TextInput name="ideal" placeholder="AVM teras, premium plaza" />
          </Field>
          <div className="sm:col-span-2">
            <Field label="İçerik (her satır bir madde)">
              <Textarea
                name="includes"
                placeholder={"Faema espresso makinesi\nGelato vitrini\n…"}
              />
            </Field>
          </div>
          <Field label="Sıra">
            <TextInput
              name="sortOrder"
              type="number"
              defaultValue={packages.length}
            />
          </Field>
          <div className="flex items-end justify-between gap-3">
            <div className="flex flex-col gap-1">
              <Checkbox name="featured" label="Öne çıkan" />
              <Checkbox name="isActive" label="Aktif" defaultChecked />
            </div>
            <PrimaryButton type="submit">Ekle</PrimaryButton>
          </div>
        </form>
      </Card>
      <div className="mb-10 grid gap-3">
        {packages.map((p) => (
          <PackageRow key={p.id} p={p} />
        ))}
      </div>

      <h2 className="mb-3 text-sm font-medium tracking-widest text-neutral-500 uppercase">
        Başvuru süreci
      </h2>
      <Card className="mb-4">
        <h3 className="mb-3 text-sm font-medium">+ Yeni adım</h3>
        <form action={createStepAction} className="grid gap-3">
          <div className="grid gap-3 sm:grid-cols-[100px_1fr]">
            <Field label="No">
              <TextInput name="step" placeholder="01" />
            </Field>
            <Field label="Başlık">
              <TextInput name="title" placeholder="Başvuru" />
            </Field>
          </div>
          <Field label="Açıklama">
            <Textarea
              name="body"
              placeholder="Online form. Lokasyon, deneyim, hedef şehir."
            />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Sıra">
              <TextInput
                name="sortOrder"
                type="number"
                defaultValue={steps.length}
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
        {steps.map((s) => (
          <StepRow key={s.id} s={s} />
        ))}
      </div>
    </main>
  );
}
