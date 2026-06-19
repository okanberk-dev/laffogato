import Link from "next/link";

import {
  type AdminMenuItem,
  MENU_CATEGORY_KEYS,
  MENU_CATEGORY_LABELS,
} from "@/lib/admin/store";

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
  ["dark", "Koyu"],
  ["matcha", "Matcha"],
  ["pistachio", "Pistachio"],
  ["strawberry", "Çilek"],
  ["rose", "Rose"],
  ["dawn", "Şafak"],
  ["gold", "Altın"],
  ["sky", "Gök"],
] as const;

export interface MenuItemFormProps {
  action: (formData: FormData) => void | Promise<void>;
  item?: AdminMenuItem;
  defaultCategoryKey?: string;
  submitLabel: string;
  cancelHref: string;
}

export function MenuItemForm({
  action,
  item,
  defaultCategoryKey,
  submitLabel,
  cancelHref,
}: MenuItemFormProps) {
  const priceValue = item ? (item.priceMinor / 100).toFixed(2) : "";
  const tagsValue = item ? item.tags.join(", ") : "";

  return (
    <form action={action} className="grid gap-6 lg:grid-cols-3">
      <Card className="grid gap-5 lg:col-span-2">
        <Field label="Ürün adı" hint="Örn: Affogato Strawberry">
          <TextInput name="name" defaultValue={item?.name} required />
        </Field>

        <Field label="Açıklama">
          <Textarea name="desc" defaultValue={item?.desc} required />
        </Field>

        <div className="grid gap-5 md:grid-cols-2">
          <Field label="Fiyat (₺)" hint="Örn: 155,00">
            <TextInput
              name="price"
              type="text"
              inputMode="decimal"
              defaultValue={priceValue}
              required
            />
          </Field>
          <Field label="Sıralama" hint="Kategori içinde küçükten büyüğe">
            <TextInput
              name="sortOrder"
              type="number"
              min={0}
              defaultValue={item?.sortOrder ?? 0}
            />
          </Field>
        </div>

        <Field
          label="Etiketler"
          hint="Virgülle ayır. Örn: signature, new, iced, nuts, IGP"
        >
          <TextInput
            name="tags"
            defaultValue={tagsValue}
            placeholder="signature, new"
          />
        </Field>
      </Card>

      <Card className="grid gap-5 self-start">
        <Field label="Kategori">
          <Select
            name="categoryKey"
            defaultValue={item?.categoryKey ?? defaultCategoryKey ?? "affogato"}
          >
            {MENU_CATEGORY_KEYS.map((k) => (
              <option key={k} value={k}>
                {MENU_CATEGORY_LABELS[k]}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Görsel ton" hint="MenuPlate gradient zemini.">
          <Select name="hue" defaultValue={item?.hue ?? "cream"}>
            {HUE_OPTIONS.map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </Select>
        </Field>

        <div className="border-t border-[var(--admin-border)] pt-5">
          <Checkbox
            name="isActive"
            label="Menüde göster"
            defaultChecked={item?.isActive ?? true}
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
