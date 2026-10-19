"use client";

import type { ReactNode } from "react";

import {
  ActionForm,
  FormFieldError,
  FormMessage,
  SubmitButton,
} from "@/components/admin/action-form";
import {
  Card,
  Checkbox,
  Field,
  Select,
  Textarea,
  TextInput,
} from "@/components/admin/forms";

import { saveVenueStatusAction } from "./actions";

/**
 * Client-side copy of the venue vocabulary. `@/lib/mobile/venue` starts with
 * `import "server-only"` and reaches `pg`; importing its constants here would
 * pull the database driver into the browser bundle and fail the build.
 */
export interface VenueStatusDefaults {
  manualOverride: "auto" | "open" | "closed";
  freeTables: number;
  totalTables: number;
  wifi: "stable" | "slow" | "down";
  noise: "low" | "medium" | "high";
  power: boolean;
  note: string;
}

const OVERRIDE_OPTIONS: {
  value: VenueStatusDefaults["manualOverride"];
  label: string;
}[] = [
  { value: "auto", label: "Otomatik - çalışma saatlerine göre" },
  { value: "open", label: "Açık (saatlerden bağımsız)" },
  { value: "closed", label: "Kapalı (saatlerden bağımsız)" },
];

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
 */
export function VenueStatusForm({
  defaults,
}: {
  defaults: VenueStatusDefaults;
}) {
  return (
    <ActionForm action={saveVenueStatusAction} className="grid gap-4">
      <Card>
        <div className="grid gap-4">
          <Field
            label="Açık / kapalı"
            hint="Otomatikte çalışma saatleri kullanılır (Ayarlar → Saatler; sahip değiştirir). 02:00 kapanış gece yarısından sonra da açık sayılır."
          >
            <Select
              name="manualOverride"
              defaultValue={defaults.manualOverride}
            >
              {OVERRIDE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Row name="freeTables">
              <Field label="Boş masa">
                <TextInput
                  name="freeTables"
                  type="number"
                  min={0}
                  max={999}
                  inputMode="numeric"
                  defaultValue={String(defaults.freeTables)}
                  required
                />
              </Field>
            </Row>
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
          </div>
        </div>
      </Card>

      <Card>
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
      </Card>

      <FormMessage />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="min-w-0 flex-1 basis-56 text-xs text-[var(--admin-text-soft)]">
          Kaydedince uygulamanın ana sayfası en geç 30 saniyede güncellenir.
        </p>
        <SubmitButton>Kaydet</SubmitButton>
      </div>
    </ActionForm>
  );
}
