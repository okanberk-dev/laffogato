"use client";

import { useActionState } from "react";

import { Card, Field, PrimaryButton, Textarea, TextInput } from "@/components/admin/forms";
import { CONTENT_FIELDS, CONTENT_GROUPS } from "@/lib/admin/content-fields";

import { saveContentAction, type ContentState } from "./actions";

export function ContentForm({ content }: { content: Record<string, string> }) {
  const [state, action, pending] = useActionState<ContentState, FormData>(
    saveContentAction,
    {},
  );

  return (
    <form action={action} className="grid gap-6">
      {CONTENT_GROUPS.map((group) => (
        <Card key={group}>
          <h3 className="mb-4 text-sm font-medium uppercase tracking-widest text-neutral-500">
            {group}
          </h3>
          <div className="grid gap-4">
            {CONTENT_FIELDS.filter((f) => f.group === group).map((f) => (
              <Field key={f.key} label={f.label} hint={f.key}>
                {f.kind === "textarea" ? (
                  <Textarea name={f.key} defaultValue={content[f.key] ?? f.default} />
                ) : (
                  <TextInput name={f.key} defaultValue={content[f.key] ?? f.default} />
                )}
              </Field>
            ))}
          </div>
        </Card>
      ))}

      <div className="sticky bottom-4 flex items-center gap-3">
        <PrimaryButton type="submit" disabled={pending}>
          {pending ? "Kaydediliyor…" : "Tümünü kaydet"}
        </PrimaryButton>
        {state.message && (
          <span className="rounded-full bg-emerald-50 px-3 py-1 text-sm text-emerald-700">
            {state.message}
          </span>
        )}
        {state.error && (
          <span className="rounded-full bg-red-50 px-3 py-1 text-sm text-red-700">
            {state.error}
          </span>
        )}
      </div>
    </form>
  );
}
