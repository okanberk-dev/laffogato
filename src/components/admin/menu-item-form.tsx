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
  Select,
  TextInput,
  Textarea,
} from "./forms";
import {
  ActionForm,
  FormFieldError,
  FormMessage,
  SubmitButton,
} from "./action-form";
import type { ModalAction } from "./ui";
import { BackdropField } from "@/components/admin/backdrop-field";
import { ImageUpload } from "@/components/admin/image-upload";
import { photoKind } from "@/lib/backdrop/scene-core";
import {
  MENU_ALLERGENS,
  MENU_ALLERGENS_FIELD,
  MENU_ALLERGENS_NONE,
  MENU_ALLERGENS_SHOWN_FIELD,
  normalizeMenuAllergens,
} from "@/lib/menu/allergens";
import { KDV_RATE_CHOICES, LEGAL_TAX_RATES } from "@/lib/utils/kdv";

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
  /** Answers a refusal with field errors; a save redirects with a toast. */
  action: ModalAction;
  item?: AdminMenuItem;
  defaultCategoryKey?: string;
  submitLabel: string;
  cancelHref: string;
  /** The menu's KDV default (Ayarlar > Vergi), named in the select. */
  menuTaxRate?: number;
}

export function MenuItemForm({
  action,
  item,
  defaultCategoryKey,
  submitLabel,
  cancelHref,
  menuTaxRate = LEGAL_TAX_RATES.menu,
}: MenuItemFormProps) {
  const priceValue = item ? (item.priceMinor / 100).toFixed(2) : "";
  const priceLValue =
    item && item.priceMinorL > 0 ? (item.priceMinorL / 100).toFixed(2) : "";
  const tagsValue = item ? item.tags.join(", ") : "";
  // null: not entered yet, no box ticked; []: "Hiçbirini içermez".
  const allergens = normalizeMenuAllergens(item?.allergens);
  const ownTaxRate =
    typeof item?.taxRatePct === "number" ? item.taxRatePct : null;
  // A stored rate the standard list does not have stays selectable.
  const taxRateChoices =
    ownTaxRate === null || KDV_RATE_CHOICES.includes(ownTaxRate)
      ? KDV_RATE_CHOICES
      : [...KDV_RATE_CHOICES, ownTaxRate].sort((a, b) => a - b);

  return (
    <ActionForm action={action} className="grid gap-6 lg:grid-cols-3">
      <Card className="grid gap-5 lg:col-span-2">
        <Field label="Ürün adı" hint="Örn: Çilekli Matcha">
          <TextInput
            name="name"
            defaultValue={item?.name}
            required
            maxLength={120}
          />
        </Field>
        <FormFieldError name="name" />

        <Field label="Açıklama">
          <Textarea name="desc" defaultValue={item?.desc} required />
        </Field>

        <div className="grid gap-5 md:grid-cols-3">
          <div className="grid content-start gap-1.5">
            <Field
              label="Fiyat M (₺)"
              hint="Tek boy ise buraya yaz. Örn: 245 ya da 1.250,00"
            >
              <TextInput
                name="price"
                type="text"
                inputMode="decimal"
                defaultValue={priceValue}
                required
              />
            </Field>
            <FormFieldError name="price" />
          </div>
          <div className="grid content-start gap-1.5">
            <Field label="Fiyat L (₺)" hint="İkinci boy yoksa boş bırak.">
              <TextInput
                name="priceL"
                type="text"
                inputMode="decimal"
                defaultValue={priceLValue}
                placeholder="-"
              />
            </Field>
            <FormFieldError name="priceL" />
          </div>
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
          hint="Uzun kenarı 1600 px'e küçültülür; en iyi sonuç için en az 1600 px'lik bir fotoğraf seç (kaynak dosya en çok 12 MB, saklanan hâli 2 MB, sığmazsa küçültülür). Arka planı saydam (dekupe) bir PNG ya da WebP saydamlığını korur; uygulama onu doğrudan sahnenin üstüne çizer. Kaydettikten sonra sitede hemen, uygulamada en geç 5 dakika içinde görünür. Boş bırakırsan kategorisine uygun çizim kullanılır."
        >
          {/* Bu alan eskiden yalnızca `public/` altındaki bir dosya yolunu
              kabul ediyordu - Vercel'de panelden oraya dosya koymanın yolu yok
              - ve girilen https adresi sessizce siliniyordu. Artık ürünlerdeki
              yükleyicinin aynısı, tek görsellik hâli. */}
          <ImageUpload
            name="image"
            max={1}
            initial={item?.image ? [item.image] : []}
          />
        </Field>

        {/* Only the scene columns and the photo's kind cross to the client:
            the photo itself is already in the payload once, for the uploader. */}
        <BackdropField
          stored={
            item && {
              backdrop: item.backdrop,
              backdropSource: item.backdropSource,
              backdropHex: item.backdropHex,
              vessel: item.vessel,
            }
          }
          photo={photoKind(item?.image)}
          hue={item?.hue ?? "cream"}
          category={item?.categoryKey ?? defaultCategoryKey ?? "matcha"}
        />

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

        {/* TGK Etiketleme Yön. m.15/5: every item says which of the
            fourteen Ek-1 groups it contains, on the menu and in the app.
            A fieldset, not a label, so a tap on the hint toggles nothing. */}
        <div className="grid content-start gap-1.5">
          <Field
            as="fieldset"
            label="Alerjenler"
            hint="Türk Gıda Kodeksi'nin 14 alerjen grubu. Kalemin içerdiklerini işaretle: şurup, sos, süt ve süsleme dahil, tedarikçi etiketine bakarak; köşkteki alerjen tablosuyla aynı olmalı. Hiçbirini içermiyorsa yalnız “Hiçbirini içermez”i işaretle. Hiçbir kutu işaretli değilse bilgi girilmemiş sayılır ve menüde yazmaz. Sert kabuklu meyve seçersen kuruyemiş (nuts) etiketi kendiliğinden eklenir. Tarif ya da tedarikçi değişince aynı gün güncelle."
          >
            <input type="hidden" name={MENU_ALLERGENS_SHOWN_FIELD} value="1" />
            <div className="grid gap-x-4 sm:grid-cols-2">
              {MENU_ALLERGENS.map((a) => (
                <Checkbox
                  key={a.key}
                  name={MENU_ALLERGENS_FIELD}
                  value={a.key}
                  label={a.panel}
                  defaultChecked={allergens?.includes(a.key) ?? false}
                />
              ))}
            </div>
            <div className="border-t border-[var(--admin-border)]">
              <Checkbox
                name={MENU_ALLERGENS_FIELD}
                value={MENU_ALLERGENS_NONE}
                label="Hiçbirini içermez"
                defaultChecked={allergens?.length === 0}
              />
            </div>
          </Field>
          <FormFieldError name={MENU_ALLERGENS_FIELD} />
        </div>
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

        <div className="grid content-start gap-1.5">
          <Field
            label="KDV oranı"
            hint="Fiyat KDV dahil; oran fiyatı değiştirmez. Kafede satılan yiyecek ve içecek %10 (masada, gel-al, kurye)."
          >
            <Select
              name="taxRatePct"
              defaultValue={ownTaxRate === null ? "" : String(ownTaxRate)}
            >
              <option value="">Menünün oranı (%{menuTaxRate})</option>
              {taxRateChoices.map((r) => (
                <option key={r} value={String(r)}>
                  %{r}
                </option>
              ))}
            </Select>
          </Field>
          <FormFieldError name="taxRatePct" />
        </div>

        <Field
          label="Görsel ton"
          hint="Fotoğrafsız kalemin sitedeki çizim rengi. Uygulamada sahne seçiminin ipucu; seçim yoksa sahne bu tondan gelir."
        >
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
          <FormMessage />
          <SubmitButton>{submitLabel}</SubmitButton>
          <Link href={cancelHref}>
            <GhostButton type="button" className="w-full">
              Vazgeç
            </GhostButton>
          </Link>
        </div>
      </Card>
    </ActionForm>
  );
}
