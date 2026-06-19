"use client";

import Link from "next/link";
import { useActionState } from "react";

import type { LegalActionState } from "@/app/admin/hukuk/actions";

import {
  Card,
  Checkbox,
  Field,
  GhostButton,
  PrimaryButton,
  Textarea,
  TextInput,
} from "./forms";

const initialState: LegalActionState = {};

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
    prev: LegalActionState,
    formData: FormData,
  ) => Promise<LegalActionState>;
}

export function LegalDocForm({ initial, action }: Props) {
  const [state, formAction, pending] = useActionState(action, initialState);
  const fe = (k: string) => state.fieldErrors?.[k];

  return (
    <form action={formAction} className="grid gap-5">
      <Card className="grid gap-5">
        <Field label="Başlık" hint={fe("title")}>
          <TextInput
            name="title"
            defaultValue={initial.title}
            required
            aria-invalid={Boolean(fe("title"))}
          />
        </Field>
        <Field
          label="Özet"
          hint={fe("summary") ?? "H1 altındaki kısa açıklama."}
        >
          <Textarea name="summary" defaultValue={initial.summary} rows={2} />
        </Field>
        <Field label="Yürürlük tarihi" hint="Örn: 26 Mayıs 2026">
          <TextInput
            name="effectiveDate"
            defaultValue={initial.effectiveDate}
          />
        </Field>
        <Field
          label="İçerik (Markdown)"
          hint={
            fe("bodyMarkdown") ??
            "## Başlık · ### Alt başlık · - madde · 1. sıralı · **kalın** desteklenir. Boş bırakıp yayınlamazsan kodlu varsayılan metin gösterilir."
          }
        >
          <Textarea
            name="bodyMarkdown"
            defaultValue={initial.bodyMarkdown}
            rows={26}
            className="min-h-[480px]"
            style={{ fontFamily: "var(--mono, monospace)", fontSize: 13 }}
            aria-invalid={Boolean(fe("bodyMarkdown"))}
          />
        </Field>
        <Field label="Yayın durumu">
          <Checkbox
            name="isPublished"
            label="Yayında — bu özel metni /hukuk sayfasında göster"
            defaultChecked={initial.isPublished}
          />
        </Field>

        {state.error && (
          <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {state.error}
          </div>
        )}
      </Card>

      <Card className="flex flex-wrap items-center justify-between gap-3">
        <Link href="/admin/hukuk">
          <GhostButton type="button">Vazgeç</GhostButton>
        </Link>
        <PrimaryButton type="submit" disabled={pending}>
          {pending ? "Kaydediliyor…" : "Kaydet"}
        </PrimaryButton>
      </Card>
    </form>
  );
}
