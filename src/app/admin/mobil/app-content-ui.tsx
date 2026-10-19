"use client";

import Link from "next/link";
import type { ReactNode } from "react";

import {
  FormFieldError,
  FormMessage,
  SubmitButton,
} from "@/components/admin/action-form";
import { BUTTON } from "@/components/admin/ui";

// The pieces the slide, announcement and post forms share: a field with its
// refusal under it, and the form's last row.

/** One field with the last refusal for it underneath, outside the label. */
export function FieldRow({
  name,
  children,
}: {
  name: string;
  children: ReactNode;
}) {
  return (
    <div className="grid min-w-0 content-start gap-1.5">
      {children}
      <FormFieldError name={name} />
    </div>
  );
}

/** The form-level refusal, the submit button and "Vazgeç" back to the list. */
export function FormActions({
  submitLabel,
  backHref,
}: {
  submitLabel: string;
  backHref: string;
}) {
  return (
    <div className="grid gap-3">
      <FormMessage />
      <div className="flex flex-wrap gap-2">
        <SubmitButton>{submitLabel}</SubmitButton>
        <Link href={backHref} className={BUTTON.ghost}>
          Vazgeç
        </Link>
      </div>
    </div>
  );
}
