"use client";

import {
  ActionForm,
  FormFieldError,
  FormMessage,
  SubmitButton,
} from "@/components/admin/action-form";
import { Card, Field, Select, TextInput } from "@/components/admin/forms";
import { BUTTON, type ModalAction } from "@/components/admin/ui";
import Link from "@/components/link";
import {
  SAVE_AND_NEW_FIELD,
  SAVE_AND_NEW_VALUE,
} from "@/lib/admin/save-and-new";

/**
 * Name, branch (and, when editing, sort order) of a table. The code is
 * never a field: the server draws it, and only "Kodu yenile" changes it.
 * The branch is where the card stands: orders and calls at the table go to
 * that branch's bar (src/lib/panel/branches.ts). LafPOS sends its own
 * branch's tables itself (`PUT /api/panel/tables`).
 *
 * Posted by hand (ActionForm): a refusal keeps what was typed and says what
 * to change under the field, and a database error answers "Bir hata oldu…"
 * in place instead of the panel's error screen (admin audit KAR-14).
 * `back` is where Vazgeç goes (KAR-24).
 */
export function CafeTableForm({
  action,
  table,
  branches,
  submitLabel,
  back,
  saveAndNew = false,
}: {
  action: ModalAction;
  table?: { id: string; name: string; sortOrder: number; branch: string };
  /** The deployment's branches, the home branch first. */
  branches: ReadonlyArray<{ id: string; label: string }>;
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
        {branches.length > 1 ? (
          <>
            <Field
              label="Şube"
              hint="Masanın durduğu şube. Bu masadan gelen sipariş ve çağrı o şubenin bar ekranına düşer."
            >
              <Select
                name="branch"
                defaultValue={table?.branch ?? branches[0]?.id}
              >
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.label}
                  </option>
                ))}
              </Select>
            </Field>
            <FormFieldError name="branch" />
          </>
        ) : (
          <input
            type="hidden"
            name="branch"
            value={table?.branch ?? branches[0]?.id ?? ""}
          />
        )}
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
