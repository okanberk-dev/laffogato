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
import { ImageUpload } from "@/components/admin/image-upload";

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
  ["bougainvillea", "Begonvil"],
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
  const priceLValue =
    item && item.priceMinorL > 0 ? (item.priceMinorL / 100).toFixed(2) : "";
  const tagsValue = item ? item.tags.join(", ") : "";

  return (
    <form action={action} className="grid gap-6 lg:grid-cols-3">
      <Card className="grid gap-5 lg:col-span-2">
        <Field label="Ürün adı" hint="Örn: Strawberry Matcha">
          <TextInput name="name" defaultValue={item?.name} required />
        </Field>

        <Field label="Açıklama">
          <Textarea name="desc" defaultValue={item?.desc} required />
        </Field>

        <div className="grid gap-5 md:grid-cols-3">
          <Field label="Fiyat M (₺)" hint="Tek boy ise buraya yaz. Örn: 245,00">
            <TextInput
              name="price"
              type="text"
              inputMode="decimal"
              defaultValue={priceValue}
              required
            />
          </Field>
          <Field label="Fiyat L (₺)" hint="İkinci boy yoksa boş bırak.">
            <TextInput
              name="priceL"
              type="text"
              inputMode="decimal"
              defaultValue={priceLValue}
              placeholder="—"
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
          label="Fotoğraf"
          hint="Yüklediğin görsel 1600 px'e küçültülür. Boş bırakırsan kategorisine uygun çizim kullanılır."
        >
          {/* Bu alan eskiden yalnızca `public/` altındaki bir dosya yolunu
              kabul ediyordu — Vercel'de panelden oraya dosya koymanın yolu yok
              — ve girilen https adresi sessizce siliniyordu. Artık ürünlerdeki
              yükleyicinin aynısı, tek görsellik hâli. */}
          <ImageUpload
            name="image"
            max={1}
            initial={item?.image ? [item.image] : []}
          />
        </Field>

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
            defaultValue={item?.categoryKey ?? defaultCategoryKey ?? "matcha"}
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
