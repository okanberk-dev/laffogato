"use client";

import Link from "next/link";
import { useRef } from "react";

import type { ActionResult } from "@/lib/admin/action-result";
import { LEGAL_LIMITS } from "@/lib/admin/legal-schema";

import {
  ActionForm,
  FormFieldError,
  FormMessage,
  SubmitButton,
} from "./action-form";
import { Card, Checkbox, Field, Textarea, TextInput } from "./forms";
import { BUTTON, NUMERIC_STYLE } from "./ui";
import { useUnsavedGuard } from "./ui/unsaved-guard";

export interface LegalDocInitial {
  slug: string;
  title: string;
  summary: string;
  effectiveDate: string;
  bodyMarkdown: string;
  isPublished: boolean;
}

interface Props {
  initial: LegalDocInitial;
  action: (
    prev: ActionResult | null,
    formData: FormData,
  ) => Promise<ActionResult>;
}

// Markdown in a real monospace face: --mono resolves to Poppins. The size is
// the field's own (16px on a phone, so iOS does not zoom; an inline 13px
// used to beat that guard).
const MARKDOWN_STYLE = { fontFamily: NUMERIC_STYLE.fontFamily } as const;

/**
 * The legal editor. Posts through ActionForm (by hand, no form reset): a
 * refused save used to come back with the whole edited Markdown body
 * replaced by the stored one. Each refusal sits under its own field.
 *
 * Leaving with edits not saved asks (a link such as Vazgeç, the palette, a
 * reload). A save redirects to the list, so there is no in-place "saved"
 * to tell the guard: the page, and the guard with it, are gone.
 */
export function LegalDocForm({ initial, action }: Props) {
  const formRef = useRef<HTMLFormElement>(null);
  useUnsavedGuard(formRef);
  return (
    <ActionForm action={action} formRef={formRef} className="grid gap-5">
      <Card className="grid gap-5">
        <div className="grid content-start gap-1.5">
          <Field label="Başlık">
            <TextInput
              name="title"
              defaultValue={initial.title}
              required
              maxLength={LEGAL_LIMITS.title}
            />
          </Field>
          <FormFieldError name="title" />
        </div>
        <div className="grid content-start gap-1.5">
          <Field label="Özet" hint="Başlığın altındaki kısa açıklama.">
            <Textarea
              name="summary"
              defaultValue={initial.summary}
              rows={2}
              maxLength={LEGAL_LIMITS.summary}
            />
          </Field>
          <FormFieldError name="summary" />
        </div>
        <div className="grid content-start gap-1.5">
          <Field
            label="Yürürlük tarihi"
            hint="26 Mayıs 2026 gibi yaz. Boş bırakırsan yayınladığın gün yazılır."
          >
            <TextInput
              name="effectiveDate"
              defaultValue={initial.effectiveDate}
              maxLength={LEGAL_LIMITS.effectiveDate}
              autoComplete="off"
            />
          </Field>
          <FormFieldError name="effectiveDate" />
        </div>
        <div className="grid content-start gap-1.5">
          <Field
            label="İçerik (Markdown)"
            hint="## Başlık · ### Alt başlık · - madde · 1. sıralı · **kalın** desteklenir. Yayınlamadığın sürece sitede hazır metin görünür."
          >
            <Textarea
              name="bodyMarkdown"
              defaultValue={initial.bodyMarkdown}
              rows={26}
              maxLength={LEGAL_LIMITS.bodyMarkdown}
              className="min-h-[480px]"
              style={MARKDOWN_STYLE}
            />
          </Field>
          <FormFieldError name="bodyMarkdown" />
        </div>
        <Field
          as="fieldset"
          label="Yayın durumu"
          hint="İşaretsiz kaydedersen metin taslak olur ve sitede hazır metin görünür."
        >
          <Checkbox
            name="isPublished"
            label="Yayında: bu metni /hukuk sayfasında ve uygulamada göster"
            defaultChecked={initial.isPublished}
          />
        </Field>

        <FormMessage />
      </Card>

      <Card className="flex flex-wrap items-center justify-between gap-3">
        <Link href="/admin/hukuk" className={BUTTON.ghost}>
          Vazgeç
        </Link>
        <SubmitButton>Kaydet</SubmitButton>
      </Card>
    </ActionForm>
  );
}
