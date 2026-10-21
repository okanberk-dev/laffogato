"use client";

import Link from "next/link";

import {
  ActionForm,
  FormFieldError,
  FormMessage,
  SubmitButton,
} from "@/components/admin/action-form";
import { Card, Field, TextInput } from "@/components/admin/forms";
import { BUTTON, type ModalAction } from "@/components/admin/ui";
import {
  SAVE_AND_NEW_FIELD,
  SAVE_AND_NEW_VALUE,
} from "@/lib/admin/save-and-new";

/**
 * Name (and, when editing, sort order) of a table. The code is never a field:
 * the server draws it, and only "Kodu yenile" changes it.
 *
 * Posted by hand (ActionForm): a refusal keeps what was typed and says what
 * to change under the field, and a database error answers "Bir hata oldu…"
 * in place instead of the panel's error screen (admin audit KAR-14).
 * `back` is where Vazgeç goes (KAR-24).
 */
export function CafeTableForm({
  action,
  table,
  submitLabel,
  back,
  saveAndNew = false,
}: {
  action: ModalAction;
  table?: { id: string; name: string; sortOrder: number };
  submitLabel: string;
  back: string;
  /**
   * A new table's second button, "Kaydet ve yenisini ekle": setting up a
   * room of tables without a round trip through each table's page.
   */
  saveAndNew?: boolean;
}) {
  return (
    <Card>
      <ActionForm action={action} className="grid gap-4">
        {table ? <input type="hidden" name="id" value={table.id} /> : null}
        <Field
          label="Masa adı"
          hint="1-40 karakter. Örn. Bahçe 3, Pencere önü."
        >
          <TextInput
            name="name"
            defaultValue={table?.name ?? ""}
            maxLength={40}
            required
            autoFocus
          />
        </Field>
        <FormFieldError name="name" />
        {table ? (
          <>
            <Field
              label="Sıra"
              hint="Listede ve baskı sayfasında küçükten büyüğe."
            >
              <TextInput
                name="sortOrder"
                type="number"
                min={0}
                max={9999}
                inputMode="numeric"
                defaultValue={String(table.sortOrder)}
              />
            </Field>
            <FormFieldError name="sortOrder" />
          </>
        ) : null}
        <FormMessage />
        <div className="flex flex-wrap items-center gap-2">
          <SubmitButton>{submitLabel}</SubmitButton>
          {saveAndNew ? (
            <SubmitButton
              variant="ghost"
              name={SAVE_AND_NEW_FIELD}
              value={SAVE_AND_NEW_VALUE}
            >
              Kaydet ve yenisini ekle
            </SubmitButton>
          ) : null}
          <Link href={back} className={BUTTON.ghost}>
            Vazgeç
          </Link>
        </div>
      </ActionForm>
    </Card>
  );
}
