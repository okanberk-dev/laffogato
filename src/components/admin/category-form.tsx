import Link from "next/link";

import type { ShopCategorySlug } from "@/lib/admin/category-schema";
import type { AdminCategory } from "@/lib/admin/store";

import {
  ActionForm,
  FormFieldError,
  FormMessage,
  SubmitButton,
} from "./action-form";
import { Card, Field, Select, TextInput } from "./forms";
import { BUTTON, type ModalAction } from "./ui";

const SLUG_OPTIONS: ReadonlyArray<readonly [ShopCategorySlug, string]> = [
  ["beans", "Çekirdek (beans)"],
  ["gift", "Hediye (gift)"],
  ["gear", "Ekipman (gear)"],
  ["merch", "Giyim (merch)"],
  ["pantry", "Kiler (pantry)"],
];

export function CategoryForm({
  action,
  category,
  slugs,
  submitLabel,
  cancelHref,
}: {
  /** Answers a refusal with field errors; a save redirects with a toast. */
  action: ModalAction;
  category?: AdminCategory;
  /**
   * The slugs to offer; default all five. A new category is offered only
   * the ones no row carries yet (the action refuses a twin either way).
   */
  slugs?: readonly ShopCategorySlug[];
  submitLabel: string;
  cancelHref: string;
}) {
  const options = slugs
    ? SLUG_OPTIONS.filter(([v]) => slugs.includes(v))
    : SLUG_OPTIONS;
  return (
    <ActionForm action={action}>
      <Card className="grid max-w-2xl gap-5">
        <div className="grid gap-1.5">
          <Field
            label="Slug"
            hint="Ürünler kategoriye bu anahtarla bağlanır. Mağazadaki filtre çubuğu ve kategori sayfaları bu beş anahtara sabittir; buradaki ad ve sıra yalnız paneldeki ürün formunda, ürün listesinde ve süzgeçlerde görünür."
          >
            <Select
              name="slug"
              defaultValue={category?.slug ?? options[0]?.[0] ?? "beans"}
            >
              {options.map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </Select>
          </Field>
          <FormFieldError name="slug" />
        </div>

        <div className="grid gap-1.5">
          <Field
            label="Görünen ad"
            hint="Panelde ürünün kategorisi olarak görünür."
          >
            <TextInput
              name="label"
              defaultValue={category?.label}
              placeholder="Çekirdek"
              required
              maxLength={40}
            />
          </Field>
          <FormFieldError name="label" />
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <div className="grid content-start gap-1.5">
            <Field
              label="Simge"
              hint="Tek karakter (◯ ◉ ◈ ◇ ◐ gibi); bu listede adın önünde durur."
            >
              <TextInput
                name="icon"
                defaultValue={category?.icon ?? "◯"}
                maxLength={2}
              />
            </Field>
            <FormFieldError name="icon" />
          </div>
          <div className="grid content-start gap-1.5">
            <Field label="Sıra" hint="Küçük sayı önce gelir.">
              <TextInput
                name="sortOrder"
                type="number"
                min={0}
                max={999}
                defaultValue={category?.sortOrder ?? 0}
              />
            </Field>
            <FormFieldError name="sortOrder" />
          </div>
        </div>

        <FormMessage />
        <div className="mt-2 flex flex-wrap gap-2">
          <SubmitButton>{submitLabel}</SubmitButton>
          <Link href={cancelHref} className={BUTTON.ghost}>
            Vazgeç
          </Link>
        </div>
      </Card>
    </ActionForm>
  );
}
