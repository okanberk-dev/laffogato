import Link from "next/link";

import type { AdminCategory } from "@/lib/admin/store";

import {
  Card,
  Field,
  GhostButton,
  PrimaryButton,
  Select,
  TextInput,
} from "./forms";

const SLUG_OPTIONS = [
  ["beans", "Çekirdek (beans)"],
  ["gift", "Hediye (gift)"],
  ["gear", "Ekipman (gear)"],
  ["merch", "Giyim (merch)"],
  ["pantry", "Kiler (pantry)"],
] as const;

export function CategoryForm({
  action,
  category,
  submitLabel,
  cancelHref,
}: {
  action: (formData: FormData) => void | Promise<void>;
  category?: AdminCategory;
  submitLabel: string;
  cancelHref: string;
}) {
  return (
    <form action={action}>
      <Card className="grid max-w-2xl gap-5">
        <Field
          label="Slug"
          hint="Sabit teknik isim; Shop ürün filtresinde anahtar olarak kullanılır."
        >
          <Select name="slug" defaultValue={category?.slug ?? "beans"}>
            {SLUG_OPTIONS.map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Etiket (Türkçe görünen isim)">
          <TextInput
            name="label"
            defaultValue={category?.label}
            placeholder="Çekirdek"
            required
          />
        </Field>

        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="İkon" hint="Tek karakter; ◯ ◉ ◈ ◇ ◐ gibi.">
            <TextInput
              name="icon"
              defaultValue={category?.icon ?? "◯"}
              maxLength={2}
            />
          </Field>
          <Field label="Sıralama">
            <TextInput
              name="sortOrder"
              type="number"
              min={0}
              defaultValue={category?.sortOrder ?? 0}
            />
          </Field>
        </div>

        <div className="mt-2 flex gap-2">
          <PrimaryButton type="submit">{submitLabel}</PrimaryButton>
          <Link href={cancelHref}>
            <GhostButton type="button">Vazgeç</GhostButton>
          </Link>
        </div>
      </Card>
    </form>
  );
}
