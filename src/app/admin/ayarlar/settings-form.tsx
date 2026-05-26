"use client";

import { useActionState, useState, type ReactNode } from "react";

import {
  Card,
  Checkbox,
  Field,
  PrimaryButton,
  TextInput,
  Textarea,
} from "@/components/admin/forms";
import { DAYS_OF_WEEK, DAY_LABELS, type DayOfWeek } from "@/lib/admin/days";
import type { AdminSettings } from "@/lib/admin/store";

import {
  saveGeneralAction,
  saveHoursAction,
  saveNotificationsAction,
  saveSeoAction,
  saveShippingAction,
  saveTaxAction,
  type SettingsState,
} from "./actions";

const initial: SettingsState = {};

const TABS = [
  { id: "general", label: "Genel" },
  { id: "hours", label: "Saatler" },
  { id: "tax", label: "Vergi" },
  { id: "shipping", label: "Kargo" },
  { id: "seo", label: "SEO" },
  { id: "notifications", label: "Bildirim" },
] as const;

type TabId = (typeof TABS)[number]["id"];

export function SettingsForm({ settings }: { settings: AdminSettings }) {
  const [tab, setTab] = useState<TabId>("general");

  return (
    <div className="grid gap-4 lg:grid-cols-[220px_1fr]">
      <nav className="-mx-1 flex flex-row gap-1 overflow-x-auto px-1 [scrollbar-width:none] lg:mx-0 lg:flex-col lg:overflow-visible lg:px-0 [&::-webkit-scrollbar]:hidden">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`min-h-[44px] shrink-0 whitespace-nowrap rounded-md px-3 py-2 text-left text-sm transition-colors lg:shrink ${
              tab === t.id
                ? "bg-neutral-900 text-white"
                : "border border-neutral-200 text-neutral-700 hover:border-neutral-900 hover:text-neutral-900"
            }`}
          >
            {t.label}
          </button>
        ))}
      </nav>

      <div>
        {tab === "general" && <GeneralTab settings={settings} />}
        {tab === "hours" && <HoursTab settings={settings} />}
        {tab === "tax" && <TaxTab settings={settings} />}
        {tab === "shipping" && <ShippingTab settings={settings} />}
        {tab === "seo" && <SeoTab settings={settings} />}
        {tab === "notifications" && <NotificationsTab settings={settings} />}
      </div>
    </div>
  );
}

function SaveBar({
  state,
  pending,
}: {
  state: SettingsState;
  pending: boolean;
}) {
  return (
    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-neutral-100 pt-4">
      <span className="text-xs">
        {state.error ? (
          <span className="text-red-600">{state.error}</span>
        ) : state.message ? (
          <span className="text-emerald-700">{state.message}</span>
        ) : (
          <span className="text-neutral-400">
            Değişiklikler bu sekme kaydedildiğinde anında uygulanır.
          </span>
        )}
      </span>
      <PrimaryButton type="submit" disabled={pending}>
        {pending ? "Kaydediliyor…" : "Kaydet"}
      </PrimaryButton>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Card>
      <h2
        className="mb-4 text-xl"
        style={{
          fontFamily: "var(--serif), 'Playfair Display', serif",
          fontStyle: "italic",
          fontWeight: 500,
        }}
      >
        {title}
      </h2>
      {children}
    </Card>
  );
}

function GeneralTab({ settings }: { settings: AdminSettings }) {
  const [state, action, pending] = useActionState(saveGeneralAction, initial);
  return (
    <form action={action}>
      <Section title="Genel bilgiler">
        <div className="grid gap-5">
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
          <Field label="Mağaza durumu">
            <Checkbox
              name="isShopOpen"
              label="Online mağaza açık"
              defaultChecked={settings.isShopOpen}
            />
          </Field>
        </div>
        <SaveBar state={state} pending={pending} />
      </Section>
    </form>
  );
}

function HoursTab({ settings }: { settings: AdminSettings }) {
  const [state, action, pending] = useActionState(saveHoursAction, initial);
  return (
    <form action={action}>
      <Section title="Haftalık çalışma saatleri">
        <div className="grid gap-3">
          {DAYS_OF_WEEK.map((day: DayOfWeek) => {
            const hour = settings.weeklyHours[day];
            return (
              <div
                key={day}
                className="grid gap-2 border-b border-neutral-100 pb-3 last:border-b-0 sm:grid-cols-[90px_1fr_1fr_auto] sm:items-center sm:gap-3"
              >
                <span className="text-sm font-medium text-neutral-700">
                  {DAY_LABELS[day]}
                </span>
                <div className="grid grid-cols-2 gap-2 sm:contents">
                  <input
                    type="time"
                    name={`${day}-open`}
                    defaultValue={hour.open}
                    className="rounded-md border border-neutral-200 bg-neutral-50 px-2 py-2.5 text-base focus:border-neutral-900 focus:bg-white focus:outline-none sm:py-1.5 sm:text-sm"
                  />
                  <input
                    type="time"
                    name={`${day}-close`}
                    defaultValue={hour.close}
                    className="rounded-md border border-neutral-200 bg-neutral-50 px-2 py-2.5 text-base focus:border-neutral-900 focus:bg-white focus:outline-none sm:py-1.5 sm:text-sm"
                  />
                </div>
                <label className="flex min-h-[40px] items-center gap-2 text-xs text-neutral-600">
                  <input
                    type="checkbox"
                    name={`${day}-closed`}
                    defaultChecked={hour.closed}
                    className="h-5 w-5 rounded border-neutral-300"
                  />
                  Kapalı
                </label>
              </div>
            );
          })}
        </div>
        <SaveBar state={state} pending={pending} />
      </Section>
    </form>
  );
}

function TaxTab({ settings }: { settings: AdminSettings }) {
  const [state, action, pending] = useActionState(saveTaxAction, initial);
  return (
    <form action={action}>
      <Section title="Vergi">
        <Field
          label="KDV oranı (%)"
          hint="Sepet alt toplamına uygulanır. Türkiye'de standart %20."
        >
          <TextInput
            name="taxRatePct"
            inputMode="decimal"
            defaultValue={String(settings.taxRatePct)}
            required
          />
        </Field>
        <SaveBar state={state} pending={pending} />
      </Section>
    </form>
  );
}

function ShippingTab({ settings }: { settings: AdminSettings }) {
  const [state, action, pending] = useActionState(saveShippingAction, initial);
  return (
    <form action={action}>
      <Section title="Kargo">
        <div className="grid gap-5 sm:grid-cols-2">
          <Field
            label="Standart kargo ücreti (₺)"
            hint="Eşiğin altındaki siparişlere uygulanır."
          >
            <TextInput
              name="shippingFlat"
              inputMode="decimal"
              defaultValue={(settings.shippingFlatMinor / 100).toFixed(2)}
            />
          </Field>
          <Field
            label="Ücretsiz kargo eşiği (₺)"
            hint="Sepet bu tutarın üstündeyse kargo otomatik 0."
          >
            <TextInput
              name="shippingFreeThreshold"
              inputMode="decimal"
              defaultValue={(settings.shippingFreeThresholdMinor / 100).toFixed(2)}
            />
          </Field>
        </div>
        <SaveBar state={state} pending={pending} />
      </Section>
    </form>
  );
}

function SeoTab({ settings }: { settings: AdminSettings }) {
  const [state, action, pending] = useActionState(saveSeoAction, initial);
  return (
    <form action={action}>
      <Section title="SEO">
        <div className="grid gap-5">
          <Field
            label="Site başlığı (meta title)"
            hint="Tüm sayfaların varsayılan başlığı. Ürün/yazı sayfaları üstüne yazar."
          >
            <TextInput
              name="seoTitle"
              defaultValue={settings.seoTitle}
              placeholder="L'Affogato — Maltepe Park"
            />
          </Field>
          <Field
            label="Open Graph görsel URL"
            hint="Sosyal paylaşım kartlarında kullanılır. 1200×630 önerilir."
          >
            <TextInput
              name="seoOgImageUrl"
              type="url"
              defaultValue={settings.seoOgImageUrl}
              placeholder="https://…/og.jpg"
            />
          </Field>
          <Field label="Arama motorları">
            <Checkbox
              name="seoIndexable"
              label="Siteyi arama motorlarına aç (sitemap yayınla)"
              defaultChecked={settings.seoIndexable}
            />
          </Field>
        </div>
        <SaveBar state={state} pending={pending} />
      </Section>
    </form>
  );
}

function NotificationsTab({ settings }: { settings: AdminSettings }) {
  const [state, action, pending] = useActionState(
    saveNotificationsAction,
    initial,
  );
  return (
    <form action={action}>
      <Section title="Bildirimler">
        <Field
          label="Operasyon e-postası"
          hint="Yeni sipariş ve düşük stok uyarıları buraya gönderilir (Resend/Twilio entegrasyonu sonrası aktifleşir)."
        >
          <TextInput
            name="notificationEmail"
            type="email"
            defaultValue={settings.notificationEmail}
            placeholder="operasyon@laffogato.it"
          />
        </Field>
        <SaveBar state={state} pending={pending} />
      </Section>
    </form>
  );
}
