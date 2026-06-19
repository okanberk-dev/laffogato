import Link from "next/link";

import type { AdminCategory, AdminProduct } from "@/lib/admin/store";

import {
  Card,
  Checkbox,
  Field,
  GhostButton,
  PrimaryButton,
  Select,
  TextInput,
  Textarea,
} from "./forms";

const HUE_OPTIONS = [
  ["cream", "Krem"],
  ["warm", "Sıcak"],
  ["stone", "Taş"],
  ["caramel", "Karamel"],
  ["espresso", "Espresso"],
  ["matcha", "Matcha"],
  ["pistachio", "Pistachio"],
  ["rose", "Rose"],
  ["dawn", "Şafak"],
  ["gold", "Altın"],
  ["sky", "Gök"],
] as const;

export interface ProductFormProps {
  action: (formData: FormData) => void | Promise<void>;
  product?: AdminProduct;
  categories: AdminCategory[];
  submitLabel: string;
  cancelHref: string;
}

export function ProductForm({
  action,
  product,
  categories,
  submitLabel,
  cancelHref,
}: ProductFormProps) {
  const p = product;
  const priceValue = p ? (p.priceMinor / 100).toFixed(2) : "";

  return (
    <form action={action} className="grid gap-6 lg:grid-cols-3">
      <Card className="grid gap-5 lg:col-span-2">
        <Field label="Ürün adı" hint="Örn: Sirena — Espresso Blend">
          <TextInput name="name" defaultValue={p?.name} required />
        </Field>

        <Field label="Etiket / alt başlık" hint="Örn: Whole Bean · 250g">
          <TextInput name="tag" defaultValue={p?.tag} required />
        </Field>

        <Field label="Açıklama">
          <Textarea name="desc" defaultValue={p?.desc} required />
        </Field>

        <div className="grid gap-5 md:grid-cols-2">
          <Field label="Fiyat (₺)" hint="Örn: 320,00">
            <TextInput
              name="price"
              type="text"
              inputMode="decimal"
              defaultValue={priceValue}
              required
            />
          </Field>
          <Field label="Stok">
            <TextInput
              name="stock"
              type="number"
              min={0}
              defaultValue={p?.stock ?? 0}
              required
            />
          </Field>
        </div>
      </Card>

      <Card className="grid gap-5 self-start">
        <Field label="Kategori">
          <Select name="cat" defaultValue={p?.cat ?? "beans"}>
            {categories.map((c) => (
              <option key={c.slug} value={c.slug}>
                {c.label}
              </option>
            ))}
          </Select>
        </Field>

        <Field
          label="Görsel ton"
          hint="Ürün kartının gradient zemin tonu (gerçek fotoğraf gelene kadar)."
        >
          <Select name="img" defaultValue={p?.img ?? "cream"}>
            {HUE_OPTIONS.map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </Select>
        </Field>

        <div className="flex flex-col gap-3 border-t border-[var(--admin-border)] pt-5">
          <Checkbox
            name="isActive"
            label="Aktif (vitrinde göster)"
            defaultChecked={p?.isActive ?? true}
          />
          <Checkbox
            name="featured"
            label="Öne çıkan ürün"
            defaultChecked={p?.featured ?? false}
          />
          <Checkbox
            name="isNew"
            label="Yeni ürün rozeti"
            defaultChecked={p?.isNew ?? false}
          />
        </div>

        <div className="mt-2 flex flex-col gap-2">
          <PrimaryButton type="submit">{submitLabel}</PrimaryButton>
          <Link href={cancelHref}>
            <GhostButton type="button" className="w-full">
              Vazgeç
            </GhostButton>
          </Link>
        </div>
      </Card>
    </form>
  );
}
