"use client";

import { useActionState } from "react";

import {
  Card,
  Field,
  PrimaryButton,
  TextInput,
} from "@/components/admin/forms";

import type { CafeTableFormState } from "./actions";

const initial: CafeTableFormState = {};

/**
 * Name (and, when editing, sort order) of a table. The code is never a field:
 * the server draws it, and only "Kodu yenile" changes it.
 */
export function CafeTableForm({
  action,
  table,
  submitLabel,
}: {
  action: (
    prev: CafeTableFormState,
    formData: FormData,
  ) => Promise<CafeTableFormState>;
  table?: { id: string; name: string; sortOrder: number };
  submitLabel: string;
}) {
  const [state, formAction, pending] = useActionState(action, initial);
  return (
    <Card>
      <form action={formAction} className="grid gap-4">
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
        {table ? (
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
        ) : null}
        {state.error ? (
          <p role="alert" className="text-sm text-[var(--admin-danger)]">
            {state.error}
          </p>
        ) : null}
        <div>
          <PrimaryButton type="submit" disabled={pending}>
            {pending ? "Kaydediliyor…" : submitLabel}
          </PrimaryButton>
        </div>
      </form>
    </Card>
  );
}
