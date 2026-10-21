"use client";

import type { MouseEvent } from "react";

import {
  ActionForm,
  FormFieldError,
  FormMessage,
  SubmitButton,
} from "@/components/admin/action-form";
import { Card, Field, Textarea, TextInput } from "@/components/admin/forms";
import { BUTTON } from "@/components/admin/ui";
import {
  CONTENT_FIELDS,
  CONTENT_GROUPS,
  CONTENT_LIMIT,
  type ContentField,
} from "@/lib/admin/content-fields";

import { saveContentAction } from "./actions";

/**
 * Puts the field's default text back in the box. Nothing is written until
 * "Tümünü kaydet"; a value equal to the default then drops its override, so
 * the site follows the default again.
 */
function ResetToDefault({ field }: { field: ContentField }) {
  const onClick = (e: MouseEvent<HTMLButtonElement>) => {
    const control = e.currentTarget.form?.elements.namedItem(field.key);
    if (
      control instanceof HTMLInputElement ||
      control instanceof HTMLTextAreaElement
    ) {
      control.value = field.default;
      control.focus();
    }
  };
  return (
    <button
      type="button"
      onClick={onClick}
      className={BUTTON.link}
      aria-label={`Varsayılana dön: ${field.label}`}
    >
      Varsayılana dön
    </button>
  );
}

/**
 * Site Metinleri. Posts through ActionForm (by hand, no React form reset): a
 * refused save used to put every field back to the stored text.
 */
export function ContentForm({ content }: { content: Record<string, string> }) {
  return (
    <ActionForm action={saveContentAction} className="grid gap-6">
      {CONTENT_GROUPS.map((group) => (
        <Card key={group}>
          <h2 className="mb-4 text-sm font-medium tracking-widest text-[var(--admin-text-soft)] uppercase">
            {group}
          </h2>
          <div className="grid gap-5">
            {CONTENT_FIELDS.filter((f) => f.group === group).map((f) => (
              <div key={f.key} className="grid content-start gap-1.5">
                <Field label={f.label} hint={f.hint}>
                  {f.kind === "textarea" ? (
                    <Textarea
                      name={f.key}
                      defaultValue={content[f.key] ?? f.default}
                      maxLength={CONTENT_LIMIT.textarea}
                    />
                  ) : (
                    <TextInput
                      name={f.key}
                      defaultValue={content[f.key] ?? f.default}
                      maxLength={CONTENT_LIMIT.text}
                    />
                  )}
                </Field>
                <FormFieldError name={f.key} />
                <div className="-mt-1 flex justify-end">
                  <ResetToDefault field={f} />
                </div>
              </div>
            ))}
          </div>
        </Card>
      ))}

      <FormMessage />

      {/* Above the phone's bottom bar (--admin-bottom-inset, layout.tsx),
          not under it. */}
      <div className="sticky bottom-[calc(1rem+var(--admin-bottom-inset,0px))] z-10 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-3 shadow-[0_8px_24px_rgba(0,0,0,0.14)]">
        <SubmitButton>Tümünü kaydet</SubmitButton>
        <p className="min-w-0 flex-1 text-xs text-[var(--admin-text-soft)]">
          Hazır metinle aynı bıraktığın alan hazır metni izler.
        </p>
      </div>
    </ActionForm>
  );
}
