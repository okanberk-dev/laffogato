import Link from "next/link";

import type { AdminCategory } from "@/lib/admin/store";

import {
  ActionForm,
  FormFieldError,
  FormMessage,
  SubmitButton,
} from "./action-form";
import { Card, Field, GhostButton, Select, TextInput } from "./forms";
import type { ModalAction } from "./ui";

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
  /** Answers a refusal with field errors; a save redirects with a toast. */
  action: ModalAction;
  category?: AdminCategory;
  submitLabel: string;
  cancelHref: string;
}) {
  return (
    <ActionForm action={action}>
      <Card className="grid max-w-2xl gap-5">
        <div className="grid gap-1.5">
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
          <FormFieldError name="slug" />
        </div>

        <div className="grid gap-1.5">
          <Field label="Etiket (Türkçe görünen isim)">
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
            <Field label="İkon" hint="Tek karakter; ◯ ◉ ◈ ◇ ◐ gibi.">
              <TextInput
                name="icon"
                defaultValue={category?.icon ?? "◯"}
                maxLength={2}
              />
            </Field>
            <FormFieldError name="icon" />
          </div>
          <div className="grid content-start gap-1.5">
            <Field label="Sıralama">
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
        <div className="mt-2 flex gap-2">
          <SubmitButton>{submitLabel}</SubmitButton>
          <Link href={cancelHref}>
            <GhostButton type="button">Vazgeç</GhostButton>
          </Link>
        </div>
      </Card>
    </ActionForm>
  );
}
