"use client";

import type { ReactNode } from "react";

import {
  ActionForm,
  FormFieldError,
  FormMessage,
  SubmitButton,
} from "@/components/admin/action-form";
import {
  Checkbox,
  Field,
  Select,
  Textarea,
  TextInput,
} from "@/components/admin/forms";
import { Section } from "@/components/admin/ui/detail";

import { saveVenueStatusAction } from "./actions";

/**
 * Client-side copy of the venue vocabulary. `@/lib/mobile/venue` starts with
 * `import "server-only"` and reaches `pg`; importing its constants here would
 * pull the database driver into the browser bundle and fail the build.
 */
export interface VenueStatusDefaults {
  freeTables: number;
  totalTables: number;
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
 * The live status form. ActionForm posts it by hand, so a refusal (more
 * free tables than tables) leaves every field as typed, a second press
 * before the answer is dropped, and the answer is a toast or a line by the
 * button that a screen reader hears.
 *
 * Personel (`venue` without `mobileApp`) sees the table count but cannot
 * change it: the field has no name, so nothing is posted, and the action
 * ignores a posted one anyway.
 */
export function VenueStatusForm({
  defaults,
  canEditTotal = true,
  savedAt,
}: {
  defaults: VenueStatusDefaults;
  /** False for Personel: the table count is read-only. */
  canEditTotal?: boolean;
  /** "Son güncelleme: …", shown by the button. */
  savedAt?: string;
}) {
  return (
    <ActionForm action={saveVenueStatusAction} className="grid gap-4 sm:gap-5">
      <Section
        title="Masalar"
        description="Uygulamada “Boş masa 9 / 20” olarak görünür."
      >
        <div className="grid gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Row name="freeTables">
              <Field label="Boş masa">
                <TextInput
                  name="freeTables"
                  type="number"
                  min={0}
                  max={canEditTotal ? 999 : defaults.totalTables}
                  inputMode="numeric"
                  defaultValue={String(defaults.freeTables)}
                  required
                />
              </Field>
            </Row>
            {canEditTotal ? (
              <Row name="totalTables">
                <Field label="Toplam masa">
                  <TextInput
                    name="totalTables"
                    type="number"
                    min={0}
                    max={999}
                    inputMode="numeric"
                    defaultValue={String(defaults.totalTables)}
                    required
                  />
                </Field>
              </Row>
            ) : (
              <Row name="totalTables">
                <Field
                  label="Toplam masa"
                  hint="Sahip ya da yönetici değiştirir."
                >
                  <TextInput
                    type="text"
                    value={String(defaults.totalTables)}
                    readOnly
                    aria-readonly="true"
                    data-venue-total-readonly=""
                  />
                </Field>
              </Row>
            )}
          </div>
        </div>
      </Section>

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
