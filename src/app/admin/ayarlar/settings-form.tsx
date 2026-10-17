"use client";

import { useActionState, useState, type ReactNode } from "react";

import { Checkbox, Field, TextInput, Textarea } from "@/components/admin/forms";
import { DAYS_OF_WEEK, DAY_LABELS, type DayOfWeek } from "@/lib/admin/days";
import { ADMIN_ROLES, ROLE_LABELS } from "@/lib/admin/roles";
import type { AdminSettings } from "@/lib/admin/store";
import type { EmailHealth } from "@/lib/email/health";
import {
  LEGAL_TAX_RATES,
  TAX_RATE_KEYS,
  TAX_RATE_LABELS,
  type TaxRateKey,
} from "@/lib/utils/kdv";

import {
  saveEmailSenderAction,
  saveGeneralAction,
  saveHoursAction,
  saveNotificationsAction,
  saveSeoAction,
  saveShippingAction,
  saveTaxAction,
  sendTestEmailAction,
} from "./actions";
import { KaraokeTab } from "./karaoke-tab";
import { initial, SaveBar, Section } from "./settings-ui";

const TABS = [
  { id: "general", label: "Genel" },
  { id: "hours", label: "Saatler" },
  { id: "tax", label: "Vergi" },
  { id: "shipping", label: "Kargo" },
  { id: "karaoke", label: "Karaoke" },
  { id: "seo", label: "SEO" },
  { id: "notifications", label: "Bildirim" },
  { id: "email", label: "E-posta" },
] as const;

type TabId = (typeof TABS)[number]["id"];

export function SettingsForm({
  settings,
  mail,
}: {
  settings: AdminSettings;
  mail: EmailHealth;
}) {
  const [tab, setTab] = useState<TabId>("general");

  return (
    <div className="grid gap-4 lg:grid-cols-[220px_1fr]">
      <nav className="-mx-1 flex [scrollbar-width:none] flex-row gap-1 overflow-x-auto px-1 lg:mx-0 lg:flex-col lg:overflow-visible lg:px-0 [&::-webkit-scrollbar]:hidden">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`min-h-[44px] shrink-0 rounded-md px-3 py-2 text-left text-sm whitespace-nowrap transition-colors lg:shrink ${
              tab === t.id
                ? "bg-[var(--admin-primary)] text-white"
                : "border border-[var(--admin-border)] text-neutral-700 hover:border-[var(--admin-primary)] hover:text-[var(--admin-primary)]"
            }`}
          >
            {t.label}
          </button>
        ))}
      </nav>

      {/* Hidden, not unmounted - the same reason as the mobile settings
          screen: these eight forms are uncontrolled, so unmounting a tab
          silently discarded everything typed into it (the seven-row çalışma
          saatleri table above all). `hidden` keeps the values; each form
          still submits only its own section. */}
      <div>
        <Pane show={tab === "general"}>
          <GeneralTab settings={settings} />
        </Pane>
        <Pane show={tab === "hours"}>
          <HoursTab settings={settings} />
        </Pane>
        <Pane show={tab === "tax"}>
          <TaxTab settings={settings} />
        </Pane>
        <Pane show={tab === "shipping"}>
          <ShippingTab settings={settings} />
        </Pane>
        <Pane show={tab === "karaoke"}>
          <KaraokeTab settings={settings} />
        </Pane>
        <Pane show={tab === "seo"}>
          <SeoTab settings={settings} />
        </Pane>
        <Pane show={tab === "notifications"}>
          <NotificationsTab settings={settings} />
        </Pane>
        <Pane show={tab === "email"}>
          <EmailTab settings={settings} mail={mail} />
        </Pane>
      </div>
    </div>
  );
}

/** One tab's panel; `hidden` keeps its fields alive between tab switches. */
function Pane({ show, children }: { show: boolean; children: ReactNode }) {
  return <div hidden={!show}>{children}</div>;
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
            // Since the home hero moved to /admin/anasayfa-hero this only
            // reaches the bundled slides (app-props.ts): say so, or the
            // operator changes it and sees nothing happen.
            hint="Opsiyonel. Anasayfa slaytlarında yayında slayt yokken yerleşik ilk slaytın görselini değiştirir. Panelden eklediğin slaytlar kendi görselini kullanır; onları İçerik → Anasayfa slaytları'ndan düzenle."
          >
            <TextInput
              name="heroImageUrl"
              type="url"
              defaultValue={settings.heroImageUrl}
              placeholder="https://…"
            />
          </Field>
          <Field
            label="Mağaza durumu"
            hint="Yalnızca kargolu mağaza siparişlerini durdurur. Kafe siparişi (gel-al / kurye) Mobil > Ayarlar altındaki sipariş anahtarlarına ve mekânın çalışma saatlerine bakar."
          >
            <Checkbox
              name="isShopOpen"
              label="Online mağaza açık (kargolu ürünler)"
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
                    className="rounded-md border border-[var(--admin-border)] bg-neutral-50 px-2 py-2.5 text-base focus:border-[var(--admin-primary)] focus:bg-white focus:outline-none sm:py-1.5 sm:text-sm"
                  />
                  <input
                    type="time"
                    name={`${day}-close`}
                    defaultValue={hour.close}
                    className="rounded-md border border-[var(--admin-border)] bg-neutral-50 px-2 py-2.5 text-base focus:border-[var(--admin-primary)] focus:bg-white focus:outline-none sm:py-1.5 sm:text-sm"
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

/** What each default covers, and the rate the law gives it (src/lib/utils/kdv.ts). */
const TAX_HINTS: Record<TaxRateKey, string> = {
  menu: "Kafede satılan yiyecek ve içecek: masada, gel-al ya da kuryeyle. Yasal oran %10 (alkollü içecek olsaydı %20).",
  karaoke: "Oda kiralama bir eğlence hizmeti: genel oran %20.",
  beans: "Paketli kavrulmuş ya da öğütülmüş kahve: %1.",
  pantry: "Krema, şurup, şeker, kakao ürünü gibi paketli gıda: %1.",
  gift: "Gıda dışı hediyelik: %20. Yalnız gıdaysa (ör. yenilebilir kup kutusu) üründe %1 seç. Kahve ve fincan bir aradaysa %20 güvenli seçim.",
  gear: "Değirmen, moka pot, fincan gibi ekipman: %20.",
  merch: "Önlük, çanta, tişört gibi marka ürünleri: %20.",
};

function TaxTab({ settings }: { settings: AdminSettings }) {
  const [state, action, pending] = useActionState(saveTaxAction, initial);
  return (
    <form action={action}>
      <Section title="KDV oranları">
        <p className="mb-4 text-sm text-neutral-600">
          Fiyatlar KDV dahil. Oran fiyatı değiştirmez, yalnız fişte ve
          uygulamada fiyatın içindeki KDV&apos;yi gösterir. Kendi oranı seçili
          ürün ya da menü kalemi bu varsayılanı kullanmaz. Kargo ve kurye ücreti
          taşıdığı ürünün oranını alır. Değişiklik yeni siparişlere uygulanır,
          verilmiş siparişin fişi değişmez. Oranları muhasebecinle teyit et.
        </p>
        <div className="grid gap-5 sm:grid-cols-2">
          {TAX_RATE_KEYS.map((key) => (
            <Field
              key={key}
              label={`${TAX_RATE_LABELS[key]} (%)`}
              hint={TAX_HINTS[key]}
            >
              <TextInput
                name={`taxRate_${key}`}
                type="number"
                inputMode="numeric"
                min={0}
                max={100}
                step={1}
                defaultValue={String(
                  settings.taxRates?.[key] ?? LEGAL_TAX_RATES[key],
                )}
                required
              />
            </Field>
          ))}
        </div>
        <SaveBar state={state} pending={pending} />
      </Section>
    </form>
  );
}

function ShippingTab({ settings }: { settings: AdminSettings }) {
  const [state, action, pending] = useActionState(saveShippingAction, initial);
  return (
    <form action={action}>
      <Section title="Kargo ve kurye">
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
              defaultValue={(settings.shippingFreeThresholdMinor / 100).toFixed(
                2,
              )}
            />
          </Field>
          <Field
            label="Kurye ücreti (₺)"
            hint="Uygulamadan verilen kafe siparişlerinde kuryeyle teslimat için. Ücretsiz kargo eşiği buna uygulanmaz."
          >
            <TextInput
              name="courierFee"
              inputMode="decimal"
              defaultValue={(settings.courierFeeMinor / 100).toFixed(2)}
            />
          </Field>
          <Field
            label="Gel-al hazırlık süresi (dk)"
            hint="Anasayfadaki sipariş kartında “Gel-al · 15 dk” diye yazan süre. Yalnız gösterilir; siparişin kendisini etkilemez."
          >
            <TextInput
              name="pickupReadyMinutes"
              type="number"
              inputMode="numeric"
              min={1}
              max={180}
              step={1}
              defaultValue={String(settings.pickupReadyMinutes)}
              required
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
              placeholder="L'Affogato - Tuzla"
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
  const roles = new Set(settings.orderNotifyRoles ?? []);
  return (
    <form action={action}>
      <Section title="Bildirimler">
        <Field
          label="Operasyon e-postası"
          hint="Test e-postasının varsayılan alıcısı. Yeni sipariş e-postası açıkken bu adrese de gider. Düşük stok uyarısı e-postayla gönderilmez; panelde görünür (Ürünler → Düşük stok)."
        >
          <TextInput
            name="notificationEmail"
            type="email"
            defaultValue={settings.notificationEmail}
            placeholder="info@nextgenlab.com.tr"
          />
        </Field>
        <div className="mt-5 grid gap-2">
          <Checkbox
            name="orderNotifyEnabled"
            label="Yeni siparişte e-posta gönder"
            defaultChecked={settings.orderNotifyEnabled}
          />
          <p className="text-xs text-[var(--admin-text-mute)]">
            Ödemesi alınan her sipariş için bir kez gider: sipariş numarası,
            ürünler, teslimat ya da masa, tutar ve müşterinin yalnız adı.
            Telefon, e-posta ve adres e-postaya yazılmaz.
          </p>
        </div>
        {/* A fieldset, not <Field>: Field is a <label>, and each checkbox
            is a label of its own. */}
        <fieldset className="mt-5 grid gap-2">
          <legend
            className="mb-2 text-[10px] tracking-[0.22em] text-[var(--admin-text-mute)] uppercase"
            style={{ fontFamily: "var(--mono), monospace" }}
          >
            Alacak roller
          </legend>
          <div className="grid gap-1 sm:grid-cols-2">
            {ADMIN_ROLES.map((role) => (
              <Checkbox
                key={role}
                name="orderNotifyRoles"
                value={role}
                label={ROLE_LABELS[role]}
                defaultChecked={roles.has(role)}
              />
            ))}
          </div>
          <span className="text-xs text-[var(--admin-text-mute)]">
            Seçilen rollerdeki aktif panel kullanıcılarına gider. Kasiyer
            sipariş sayfasını açamaz; ona giden e-postanın düğmesi kasaya gider.
          </span>
        </fieldset>
        <div className="mt-5">
          <Field
            label="Ek adresler"
            hint="Her satıra ya da virgülle ayırarak bir adres. Panel hesabı olmayan alıcılar için (ör. mutfak tableti)."
          >
            <Textarea
              name="orderNotifyEmails"
              defaultValue={settings.orderNotifyEmails ?? ""}
              placeholder={"mutfak@ornek.com\nbar@ornek.com"}
              rows={3}
            />
          </Field>
        </div>
        <SaveBar state={state} pending={pending} />
      </Section>
    </form>
  );
}

/**
 * Where mail comes from, and proof that it leaves.
 *
 * Resend delivers only from a domain verified on its own account, and that
 * verification lives in DNS, outside this codebase. So the address is a field
 * rather than a constant, and the test button is how the operator finds out
 * they typed one Resend will refuse - short of a customer telling them their
 * password reset never arrived.
 */
function EmailTab({
  settings,
  mail,
}: {
  settings: AdminSettings;
  mail: EmailHealth;
}) {
  const [state, action, pending] = useActionState(
    saveEmailSenderAction,
    initial,
  );
  const [testState, testAction, testPending] = useActionState(
    sendTestEmailAction,
    initial,
  );
  return (
    <div className="grid gap-4">
      <form action={action}>
        <Section title="E-posta gönderimi">
          {/*
            The status Resend itself reports, not what this deployment hopes.
            A verified key and an unverified DOMAIN look identical from inside
            the process, and only the second one is what stops mail today.
          */}
          <p
            className={`mb-4 rounded-md border px-3 py-2 text-xs ${
              mail.ok
                ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                : "border-rose-200 bg-rose-50 text-rose-800"
            }`}
          >
            {mail.ok ? (
              <>
                Gönderime hazır. Şu anki gönderen: <strong>{mail.from}</strong>
                {mail.status === "unknown" && (
                  <> (alan adı durumu Resend&apos;den okunamadı)</>
                )}
              </>
            ) : (
              <>
                <strong>Gönderilemiyor.</strong> {mail.message}
              </>
            )}
          </p>
          <Field
            label="Gönderen adı"
            hint="Alıcının gelen kutusunda görünen isim."
          >
            <TextInput
              name="emailFromName"
              defaultValue={settings.emailFromName}
              placeholder="L'Affogato"
            />
          </Field>
          <Field
            label="Gönderen adresi"
            hint="Resend'de doğrulanmış bir alan adına ait olmalı. Boş bırakılırsa sunucudaki EMAIL_FROM kullanılır."
          >
            <TextInput
              name="emailFromAddress"
              type="email"
              defaultValue={settings.emailFromAddress}
              placeholder="siparis@laffogato.net"
            />
          </Field>
          <Field
            label="Yanıt adresi"
            hint="Müşteri e-postayı yanıtladığında nereye düşsün. Boş bırakılırsa Genel sekmesindeki e-posta kullanılır."
          >
            <TextInput
              name="emailReplyTo"
              type="email"
              defaultValue={settings.emailReplyTo}
              placeholder={settings.email}
            />
          </Field>
          <SaveBar state={state} pending={pending} />
        </Section>
      </form>

      <form action={testAction}>
        <Section title="Test e-postası">
          <Field
            label="Alıcı"
            hint="Tek bir mesaj gönderilir; ulaşmazsa sağlayıcının verdiği hata burada görünür."
          >
            <TextInput
              name="testEmailTo"
              type="email"
              defaultValue={settings.notificationEmail || settings.email}
              placeholder="siz@ornek.com"
            />
          </Field>
          <SaveBar
            state={testState}
            pending={testPending}
            label="Test gönder"
            pendingLabel="Gönderiliyor…"
            idle="Sitenin gönderdiği e-postaların hepsi bu ayarları kullanır. Uygulamadaki kayıt ve şifre sıfırlama mesajlarını Supabase gönderir - onların ayarı Supabase panelindedir (docs/EMAIL-RESEND.md §3)."
          />
        </Section>
      </form>
    </div>
  );
}
