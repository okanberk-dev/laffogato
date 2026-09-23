"use client";

import { useActionState } from "react";

import {
  Card,
  Checkbox,
  Field,
  PrimaryButton,
  Select,
  Textarea,
  TextInput,
} from "@/components/admin/forms";

import { saveVenueStatusAction, type VenueStatusState } from "./actions";

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

const initial: VenueStatusState = {};

export function VenueStatusForm({
  defaults,
}: {
  defaults: VenueStatusDefaults;
}) {
  const [state, action, pending] = useActionState(
    saveVenueStatusAction,
    initial,
  );

  return (
    <form action={action} className="grid gap-4">
      <Card>
        <div className="grid gap-4">
          <Field
            label="Açık / kapalı"
            hint="Otomatikte Ayarlar → Saatler'deki çalışma saatleri kullanılır; 02:00 kapanış gece yarısından sonra da açık sayılır."
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
        </div>
      </Card>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="text-xs">
          {state.error ? (
            <span className="text-red-600">{state.error}</span>
          ) : state.message ? (
            <span className="text-emerald-700">{state.message}</span>
          ) : (
            <span className="text-neutral-400">
              Kaydedince uygulamanın ana sayfası en geç 30 saniyede güncellenir.
            </span>
          )}
        </span>
        <PrimaryButton type="submit" disabled={pending}>
          {pending ? "Kaydediliyor…" : "Kaydet"}
        </PrimaryButton>
      </div>
    </form>
  );
}
