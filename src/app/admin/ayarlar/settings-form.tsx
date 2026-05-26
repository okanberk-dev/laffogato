"use client";

import { useActionState } from "react";

import {
  Card,
  Checkbox,
  Field,
  PrimaryButton,
  TextInput,
  Textarea,
} from "@/components/admin/forms";
import type { AdminSettings } from "@/lib/admin/store";

import { updateSettingsAction, type SettingsState } from "./actions";

const initialState: SettingsState = {};

export function SettingsForm({ settings }: { settings: AdminSettings }) {
  const [state, formAction, pending] = useActionState(
    updateSettingsAction,
    initialState,
  );

  return (
    <form action={formAction} className="grid gap-6 lg:grid-cols-3">
      <Card className="grid gap-5 lg:col-span-2">
        <Field label="Kafe adı">
          <TextInput name="name" defaultValue={settings.name} required />
        </Field>
        <Field label="Slogan">
          <TextInput name="tagline" defaultValue={settings.tagline} />
        </Field>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Telefon">
            <TextInput name="phone" defaultValue={settings.phone} />
          </Field>
          <Field label="E-posta">
            <TextInput
              name="email"
              type="email"
              defaultValue={settings.email}
            />
          </Field>
        </div>
        <Field label="Adres">
          <Textarea name="address" defaultValue={settings.address} />
        </Field>
        <Field
          label="Çalışma saatleri"
          hint="Tek satırda görsel olarak yazılır; gerçek tablo Visit sayfasında ayrı tutuluyor."
        >
          <TextInput
            name="openingHours"
            defaultValue={settings.openingHours}
          />
        </Field>
        <Field
          label="Hero görsel URL"
          hint="Opsiyonel. Boş bırakırsan tasarımdaki SVG placeholder kullanılır."
        >
          <TextInput
            name="heroImageUrl"
            type="url"
            defaultValue={settings.heroImageUrl}
            placeholder="https://…"
          />
        </Field>
      </Card>

      <Card className="grid gap-5 self-start">
        <Field label="Mağaza durumu">
          <Checkbox
            name="isShopOpen"
            label="Online mağaza açık"
            defaultChecked={settings.isShopOpen}
          />
        </Field>

        <div className="border-t border-neutral-200 pt-5">
          <PrimaryButton type="submit" disabled={pending} className="w-full">
            {pending ? "Kaydediliyor…" : "Ayarları kaydet"}
          </PrimaryButton>
          {state.message && (
            <div className="mt-3 rounded-md border border-green-200 bg-green-50 px-3 py-2 text-xs text-green-700">
              {state.message}
            </div>
          )}
        </div>
      </Card>
    </form>
  );
}
