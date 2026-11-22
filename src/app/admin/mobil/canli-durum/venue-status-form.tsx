"use client";

import type { ReactNode } from "react";

import {
  ActionForm,
  FormFieldError,
  FormMessage,
  SubmitButton,
} from "@/components/admin/action-form";
import { Checkbox, Field, Select, Textarea } from "@/components/admin/forms";
import { Section } from "@/components/admin/ui/detail";

import { saveVenueStatusAction } from "./actions";

/**
 * Client-side copy of the venue vocabulary. `@/lib/mobile/venue` starts with
 * `import "server-only"` and reaches `pg`; importing its constants here would
 * pull the database driver into the browser bundle and fail the build.
 */
export interface VenueStatusDefaults {
  wifi: "stable" | "slow" | "down";
  noise: "low" | "medium" | "high";
  power: boolean;
  note: string;
}

const WIFI_OPTIONS: { value: VenueStatusDefaults["wifi"]; label: string }[] = [
  { value: "stable", label: "Stabil" },
  { value: "slow", label: "Yavaş" },
  { value: "down", label: "Çalışmıyor" },
];

const NOISE_OPTIONS: { value: VenueStatusDefaults["noise"]; label: string }[] =
  [
    { value: "low", label: "Düşük" },
    { value: "medium", label: "Orta" },
    { value: "high", label: "Yüksek" },
  ];

/** A field with the last refusal for it underneath (outside the label). */
function Row({ name, children }: { name: string; children: ReactNode }) {
  return (
    <div className="grid min-w-0 content-start gap-1.5">
      {children}
      <FormFieldError name={name} />
    </div>
  );
}

/**
 * The live status form: Wi-Fi, noise, power and the note. ActionForm posts
 * it by hand, so a refusal leaves every field as typed, a second press
 * before the answer is dropped, and the answer is a toast or a line by the
 * button that a screen reader hears. No table counts (22 Kas 2026).
 */
export function VenueStatusForm({
  defaults,
  savedAt,
}: {
  defaults: VenueStatusDefaults;
  /** "Son güncelleme: …", shown by the button. */
  savedAt?: string;
}) {
  return (
    <ActionForm action={saveVenueStatusAction} className="grid gap-4 sm:gap-5">
      <Section
        title="Ortam"
        description="Çalışmaya gelen misafir için: bağlantı, ses ve priz."
      >
        <div className="grid gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Wi-Fi">
              <Select name="wifi" defaultValue={defaults.wifi}>
                {WIFI_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Gürültü">
              <Select name="noise" defaultValue={defaults.noise}>
                {NOISE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          <Checkbox
            name="power"
            label="Masalarda priz var"
            defaultChecked={defaults.power}
          />

          <Row name="note">
            <Field
              label="Not"
              hint="En fazla 200 karakter. Uygulamada olduğu gibi görünür: “Çalışmaya uygun - priz var, gürültü düşük”."
            >
              <Textarea
                name="note"
                defaultValue={defaults.note}
                maxLength={200}
                rows={3}
              />
            </Field>
          </Row>
        </div>
      </Section>

      <FormMessage />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="min-w-0 flex-1 basis-56 text-xs text-[var(--admin-text-soft)]">
          {savedAt ? <span className="block">{savedAt}</span> : null}
          Kaydedince uygulamanın ana sayfası en geç 30 saniyede güncellenir.
        </p>
        <SubmitButton>Kaydet</SubmitButton>
      </div>
    </ActionForm>
  );
}
