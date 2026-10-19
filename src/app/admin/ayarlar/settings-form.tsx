"use client";

import {
  useCallback,
  useEffect,
  useId,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";

import {
  Checkbox,
  Field,
  Select,
  TextInput,
  Textarea,
} from "@/components/admin/forms";
import { Section, TONE_SOFT } from "@/components/admin/ui";
import { TONE_RULE } from "@/components/admin/ui/tone";
import { DAYS_OF_WEEK, DAY_LABELS, type DayOfWeek } from "@/lib/admin/days";
import { ADMIN_ROLES, ROLE_LABELS } from "@/lib/admin/roles";
import type { AdminSettings } from "@/lib/admin/store";
import type { EmailHealth } from "@/lib/email/health";
import { MENU_PRICES_DATE_FIELD } from "@/lib/menu/price-list";
import {
  KDV_RATE_CHOICES,
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
import {
  GENERAL_LIMITS,
  SETTINGS_TAB_PARAM,
  SETTINGS_TABS,
  tabAfterKey,
  type SettingsTabId,
} from "./settings-core";
import {
  DirtyReportContext,
  SaveBar,
  SettingsField,
  SettingsFieldError,
  SettingsTabForm,
  useSettingsForm,
} from "./settings-ui";

const tabId = (t: SettingsTabId) => `settings-tab-${t}`;
const panelId = (t: SettingsTabId) => `settings-panel-${t}`;

/**
 * Ayarlar: eight forms behind tabs.
 *
 * - Real tabs (role="tablist", arrow keys, Home / End), drawn as a select
 *   on a phone, where four of the eight buttons sat off screen with the
 *   scrollbar hidden.
 * - The open tab is in the address (`?sekme=email`), so a link from the
 *   dashboard, the karaoke panel, Olay kaydı or the test mail lands on it.
 * - A tab with unsaved changes carries a dot, and leaving the page while
 *   any form has them asks first.
 */
export function SettingsForm({
  settings,
  mail,
  initialTab = "general",
}: {
  settings: AdminSettings;
  mail: EmailHealth;
  initialTab?: SettingsTabId;
}) {
  const [tab, setTab] = useState<SettingsTabId>(initialTab);
  // A link to another ?sekme= while the page is open re-renders it with a
  // new initialTab: follow it (state adjusted during render, not in an
  // effect, so there is no flash of the old tab).
  const [linkedTab, setLinkedTab] = useState(initialTab);
  if (initialTab !== linkedTab) {
    setLinkedTab(initialTab);
    setTab(initialTab);
  }
  const [dirtyTabs, setDirtyTabs] = useState<ReadonlySet<SettingsTabId>>(
    () => new Set(),
  );
  const reportDirty = useCallback((t: SettingsTabId, dirty: boolean) => {
    setDirtyTabs((prev) => {
      if (prev.has(t) === dirty) return prev;
      const next = new Set(prev);
      if (dirty) next.add(t);
      else next.delete(t);
      return next;
    });
  }, []);

  const anyDirty = dirtyTabs.size > 0;
  useEffect(() => {
    if (!anyDirty) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      // Older browsers still want returnValue set to show their prompt.
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [anyDirty]);

  const select = (next: SettingsTabId) => {
    setTab(next);
    // The address follows without a navigation (Next keeps its router in
    // step with history.replaceState), so a reload or a copied link opens
    // the same tab.
    const url = new URL(window.location.href);
    if (next === "general") url.searchParams.delete(SETTINGS_TAB_PARAM);
    else url.searchParams.set(SETTINGS_TAB_PARAM, next);
    window.history.replaceState(null, "", `${url.pathname}${url.search}`);
  };

  const onTabKey = (e: KeyboardEvent<HTMLButtonElement>) => {
    const next = tabAfterKey(tab, e.key);
    if (!next) return;
    e.preventDefault();
    select(next);
    document.getElementById(tabId(next))?.focus();
  };

  return (
    <DirtyReportContext.Provider value={reportDirty}>
      <div className="grid gap-4 lg:grid-cols-[220px_minmax(0,1fr)]">
        <div className="sm:hidden">
          <Field label="Bölüm">
            <Select
              value={tab}
              onChange={(e) => select(e.target.value as SettingsTabId)}
            >
              {SETTINGS_TABS.map((t) => (
                <option key={t.id} value={t.id}>
                  {dirtyTabs.has(t.id) ? `${t.label} (kaydedilmedi)` : t.label}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <div
          role="tablist"
          aria-label="Ayar bölümleri"
          className="hidden flex-wrap content-start gap-1.5 sm:flex lg:flex-col lg:flex-nowrap"
        >
          {SETTINGS_TABS.map((t) => {
            const selected = tab === t.id;
            const dirty = dirtyTabs.has(t.id);
            return (
              <button
                key={t.id}
                id={tabId(t.id)}
                type="button"
                role="tab"
                aria-selected={selected}
                aria-controls={panelId(t.id)}
                tabIndex={selected ? 0 : -1}
                onClick={() => select(t.id)}
                onKeyDown={onTabKey}
                className={`inline-flex min-h-[44px] items-center justify-between gap-2 rounded-xl px-3.5 py-2 text-left text-sm whitespace-nowrap transition-colors ${
                  selected
                    ? "bg-[var(--admin-primary)] font-medium text-white"
                    : "border border-[var(--admin-border)] bg-[var(--admin-surface)] text-[var(--admin-text-soft)] hover:border-[var(--admin-primary)] hover:text-[var(--admin-primary)]"
                }`}
              >
                {t.label}
                {dirty ? (
                  <>
                    <span
                      aria-hidden="true"
                      className={`h-2 w-2 shrink-0 rounded-full ${
                        selected
                          ? "bg-[var(--admin-accent-soft)]"
                          : "bg-[var(--admin-warning)]"
                      }`}
                    />
                    <span className="sr-only"> (kaydedilmedi)</span>
                  </>
                ) : null}
              </button>
            );
          })}
        </div>

        {/* Hidden, not unmounted: these forms are uncontrolled, so
            unmounting a tab discarded everything typed into it. `hidden`
            keeps the values; each form still submits only its own
            section. */}
        <div className="min-w-0">
          <Pane tab="general" current={tab}>
            <GeneralTab settings={settings} />
          </Pane>
          <Pane tab="hours" current={tab}>
            <HoursTab settings={settings} />
          </Pane>
          <Pane tab="tax" current={tab}>
            <TaxTab settings={settings} />
          </Pane>
          <Pane tab="shipping" current={tab}>
            <ShippingTab settings={settings} />
          </Pane>
          <Pane tab="karaoke" current={tab}>
            <KaraokeTab settings={settings} />
          </Pane>
          <Pane tab="seo" current={tab}>
            <SeoTab settings={settings} />
          </Pane>
          <Pane tab="notifications" current={tab}>
            <NotificationsTab settings={settings} />
          </Pane>
          <Pane tab="email" current={tab}>
            <EmailTab settings={settings} mail={mail} />
          </Pane>
        </div>
      </div>
    </DirtyReportContext.Provider>
  );
}

/** One tab's panel; `hidden` keeps its fields alive between tab switches. */
function Pane({
  tab,
  current,
  children,
}: {
  tab: SettingsTabId;
  current: SettingsTabId;
  children: ReactNode;
}) {
  return (
    <div
      role="tabpanel"
      id={panelId(tab)}
      aria-labelledby={tabId(tab)}
      hidden={tab !== current}
    >
      {children}
    </div>
  );
}

/** A notice in the kit's tones: a soft ground with a left rule. */
function Banner({
  tone,
  children,
  testId,
}: {
  tone: "success" | "danger";
  children: ReactNode;
  testId?: string;
}) {
  return (
    <div
      data-testid={testId}
      className={`mb-4 rounded-xl border-l-4 px-3.5 py-2.5 text-sm ${TONE_SOFT[tone]} ${TONE_RULE[tone]}`}
    >
      {children}
    </div>
  );
}

function GeneralTab({ settings }: { settings: AdminSettings }) {
  const form = useSettingsForm(saveGeneralAction, { tab: "general" });
  return (
    <SettingsTabForm form={form}>
      <Section title="Genel bilgiler">
        <div className="grid gap-5">
          {/* Name and slogan reach only the panel and the printed receipt:
              the site, the app and the mails use the brand on the tax
              certificate (SITE.name), so the hints say so (admin audit
              SYS-04). */}
          <SettingsField
            name="name"
            label="Kafe adı"
            hint="Panelin üst satırında ve yazdırılan fişte görünür. Sitede, uygulamada ve e-postalarda marka adı değişmez."
          >
            <TextInput
              name="name"
              defaultValue={settings.name}
              required
              minLength={2}
              maxLength={GENERAL_LIMITS.name}
            />
          </SettingsField>
          <SettingsField
            name="tagline"
            label="Slogan"
            hint="Yalnız yazdırılan fişte, adın altında görünür."
          >
            <TextInput
              name="tagline"
              defaultValue={settings.tagline}
              maxLength={GENERAL_LIMITS.tagline}
            />
          </SettingsField>
          <div className="grid gap-5 sm:grid-cols-2">
            <SettingsField
              name="phone"
              label="Telefon"
              hint="Sitenin alt bilgisinde, anasayfada, ziyaret sayfasında, e-postaların altında ve uygulamada görünür. Boş bırakırsan kayıtlı numara görünür."
            >
              <TextInput
                name="phone"
                type="tel"
                defaultValue={settings.phone}
                maxLength={GENERAL_LIMITS.phone}
              />
            </SettingsField>
            <SettingsField
              name="email"
              label="E-posta"
              hint="E-postalara gelen yanıtlar buraya düşer (E-posta sekmesinde ayrı bir yanıt adresi yoksa)."
            >
              <TextInput
                name="email"
                type="email"
                defaultValue={settings.email}
                maxLength={GENERAL_LIMITS.email}
              />
            </SettingsField>
          </div>
          <SettingsField
            name="address"
            label="Adres"
            hint="Sitenin alt bilgisinde, anasayfada, ziyaret sayfasında, e-postaların altında ve uygulamada görünür. Haritadaki konum sabittir, bu alanla değişmez."
          >
            <Textarea
              name="address"
              defaultValue={settings.address}
              maxLength={GENERAL_LIMITS.address}
            />
          </SettingsField>
          <SettingsField
            name="heroImageUrl"
            label="Anasayfa yedek görseli"
            // Since the home hero moved to /admin/anasayfa-hero this only
            // reaches the bundled slides (app-props.ts): say so, or the
            // operator changes it and sees nothing happen.
            hint="Opsiyonel, https:// ile başlayan bir görsel adresi. Anasayfa slaytlarında yayında slayt yokken yerleşik ilk slaytın görselini değiştirir. Panelden eklediğin slaytlar kendi görselini kullanır; onları İçerik → Anasayfa slaytları'ndan düzenle."
          >
            <TextInput
              name="heroImageUrl"
              type="url"
              defaultValue={settings.heroImageUrl}
              maxLength={GENERAL_LIMITS.heroImageUrl}
              placeholder="https://…"
            />
          </SettingsField>
          {/* A fieldset, not a label: inside a label, a tap on the hint
              flipped the switch (admin audit SYS-05). */}
          <Field
            as="fieldset"
            label="Mağaza durumu"
            hint="Yalnızca kargolu mağaza siparişlerini durdurur. Kafe siparişi (gel-al / kurye) Mobil > Ayarlar altındaki sipariş anahtarlarına ve mekânın çalışma saatlerine bakar. Kapatırken onay istenir."
          >
            <Checkbox
              name="isShopOpen"
              label="Online mağaza açık (kargolu ürünler)"
              defaultChecked={settings.isShopOpen}
            />
          </Field>
        </div>
        <SaveBar form={form} />
      </Section>
    </SettingsTabForm>
  );
}

function HoursTab({ settings }: { settings: AdminSettings }) {
  const form = useSettingsForm(saveHoursAction, { tab: "hours" });
  const baseId = useId();
  return (
    <SettingsTabForm form={form}>
      <Section
        title="Haftalık çalışma saatleri"
        description="Sitenin alt bilgisinde, anasayfada, ziyaret sayfasında, e-postaların altında ve uygulamada görünür. Gece yarısından sonra kapanıyorsan kapanışa 00:00 ya da 02:00 gibi bir saat yaz: açılıştan erken bir kapanış ertesi güne sayılır."
      >
        <div className="grid gap-3">
          {DAYS_OF_WEEK.map((day: DayOfWeek) => {
            const hour = settings.weeklyHours[day];
            const dayLabelId = `${baseId}-${day}`;
            return (
              // One group per day, named by the day: the boxes inside are
              // "Açılış", "Kapanış", "Kapalı" seven times over, and a screen
              // reader used to hear them with no day at all.
              <div
                key={day}
                role="group"
                aria-labelledby={dayLabelId}
                className="grid gap-2 border-b border-[var(--admin-border)] pb-3 last:border-b-0 sm:grid-cols-[110px_minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-end sm:gap-3"
              >
                <span
                  id={dayLabelId}
                  className="text-sm font-medium text-[var(--admin-text)] sm:pb-3"
                >
                  {DAY_LABELS[day]}
                </span>
                <div className="grid grid-cols-2 gap-2 sm:contents">
                  <TimeBox
                    name={`${day}-open`}
                    caption="Açılış"
                    ariaLabel={`${DAY_LABELS[day]} açılış`}
                    defaultValue={hour.open}
                  />
                  <TimeBox
                    name={`${day}-close`}
                    caption="Kapanış"
                    ariaLabel={`${DAY_LABELS[day]} kapanış`}
                    defaultValue={hour.close}
                  />
                </div>
                <Checkbox
                  name={`${day}-closed`}
                  label="Kapalı"
                  aria-label={`Kapalı: ${DAY_LABELS[day]}`}
                  defaultChecked={hour.closed}
                />
              </div>
            );
          })}
        </div>
        <SaveBar form={form} />
      </Section>
    </SettingsTabForm>
  );
}

function TimeBox({
  name,
  caption,
  ariaLabel,
  defaultValue,
}: {
  name: string;
  caption: string;
  ariaLabel: string;
  defaultValue: string;
}) {
  return (
    <div className="grid min-w-0 gap-1">
      <label className="grid gap-1">
        <span className="text-xs text-[var(--admin-text-mute)]">{caption}</span>
        <TextInput
          type="time"
          name={name}
          aria-label={ariaLabel}
          defaultValue={defaultValue}
        />
      </label>
      <SettingsFieldError name={name} />
    </div>
  );
}

/**
 * What each default covers, and the rate the law gives it (src/lib/utils/kdv.ts;
 * operator decisions of 18 Oct 2026, LEGAL-REDLINES §16.4).
 */
const TAX_HINTS: Record<TaxRateKey, string> = {
  menu: "Kafede satılan yiyecek ve içecek: masada, gel-al ya da kuryeyle. Yasal oran %10 (alkollü içecek olsaydı %20).",
  karaoke: "Oda kiralama bir eğlence hizmeti: genel oran %20.",
  beans:
    "Paketli kahve: %10. Köşk kafe işletmesi olduğu için internetten satıp gönderdiği gıda da %10 sayılır (KDV GUT III/B-2.4.1).",
  pantry:
    "Matcha, bisküvi, krema, şurup gibi paketli gıda: %10, kahveyle aynı kural.",
  gift: "Gıda dışı hediyelik %20. Yalnız gıda olan kutuda (ör. yenilebilir kup) üründe %10 seç. Gıda ile gıda dışı ürün tek fiyatla bir aradaysa set %20 olur.",
  gear: "Değirmen, moka pot, fincan gibi ekipman: %20.",
  merch:
    "Fincan, bardak gibi marka ürünleri %20. Önlük, tişört gibi giyim ve çanta %10: o üründe %10 seç.",
  shipping:
    "Siparişteki kargo ve kurye ücreti ayrı bir taşıma hizmetidir: %20.",
};

function TaxTab({ settings }: { settings: AdminSettings }) {
  const form = useSettingsForm(saveTaxAction, { tab: "tax" });
  return (
    <SettingsTabForm form={form} className="grid gap-6">
      <Section
        title="KDV oranları"
        // Prices are KDV-included and no total is computed from a rate
        // (src/lib/utils/kdv.ts); since #130 a product or menu item may
        // carry its own rate and the rate of each sale is stored with it.
        description="Fiyatlar KDV dahildir. Oran hiçbir fiyatı ya da toplamı değiştirmez; yalnız fiyatın ne kadarının KDV olduğunu söyler (sipariş fişinde, panelde ve uygulamada). Buradakiler varsayılan oranlardır: kendi oranı seçilmemiş ürün ve menü kalemleri bunları kullanır. Kargo ve kurye ücreti faturada ayrı kalemdir ve kendi oranını alır. Değişiklik yalnız bundan sonraki siparişlere ve rezervasyonlara yansır; verilmiş siparişlerin kaydı değişmez. Oranları muhasebecinle teyit et."
      >
        <div className="grid gap-5 sm:grid-cols-2">
          {TAX_RATE_KEYS.map((key) => {
            const value = settings.taxRates?.[key] ?? LEGAL_TAX_RATES[key];
            // The rates the law uses today, as in the product form; a stored
            // rate outside them stays offered, so saving never changes it
            // unseen (saveTaxAction still reads it through parseTaxRateInput).
            const choices = KDV_RATE_CHOICES.includes(value)
              ? KDV_RATE_CHOICES
              : [...KDV_RATE_CHOICES, value].sort((a, b) => a - b);
            return (
              <SettingsField
                key={key}
                name={`taxRate_${key}`}
                label={TAX_RATE_LABELS[key]}
                hint={TAX_HINTS[key]}
              >
                <Select
                  name={`taxRate_${key}`}
                  defaultValue={String(value)}
                  required
                >
                  {choices.map((r) => (
                    <option key={r} value={String(r)}>
                      %{r}
                    </option>
                  ))}
                </Select>
              </SettingsField>
            );
          })}
        </div>
      </Section>
      {/* Fiyat Etiketi Yön. m.5/2-d: a price list carries the day its
          prices started to apply; /menu and /masa print this one. */}
      <Section
        title="Menü fiyat listesi"
        description="Menüdeki fiyatların uygulanmaya başladığı gün. Sitede menünün altında “Fiyatlarımıza KDV dahildir · Fiyatların uygulanmaya başladığı tarih: …” diye yazar (/menu, kategori sayfaları ve masa karekodu). Köşkteki basılı listelerle aynı gün olmalı."
      >
        <div className="grid gap-5 sm:grid-cols-2">
          <SettingsField
            name={MENU_PRICES_DATE_FIELD}
            label="Fiyatların uygulanmaya başladığı tarih"
            hint="Bir menü fiyatını değiştirdiğin gün bunu da o güne çek ve basılı listeleri yenile. Bugünden sonraki bir gün seçilemez. Boş bırakırsan menüde yalnız “Fiyatlarımıza KDV dahildir” yazar."
          >
            <TextInput
              name={MENU_PRICES_DATE_FIELD}
              type="date"
              min="2020-01-01"
              defaultValue={settings.menuPricesEffectiveDate ?? ""}
            />
          </SettingsField>
        </div>
        <SaveBar form={form} />
      </Section>
    </SettingsTabForm>
  );
}

function ShippingTab({ settings }: { settings: AdminSettings }) {
  const form = useSettingsForm(saveShippingAction, { tab: "shipping" });
  return (
    <SettingsTabForm form={form}>
      <Section title="Kargo ve kurye">
        <div className="grid gap-5 sm:grid-cols-2">
          <SettingsField
            name="shippingFlat"
            label="Standart kargo ücreti (₺)"
            hint="Ücretsiz kargo eşiğinin altında kalan mağaza siparişlerine eklenir."
          >
            <TextInput
              name="shippingFlat"
              inputMode="decimal"
              defaultValue={(settings.shippingFlatMinor / 100).toFixed(2)}
              required
            />
          </SettingsField>
          <SettingsField
            name="shippingFreeThreshold"
            label="Ücretsiz kargo eşiği (₺)"
            hint="İndirimden sonraki sepet tutarı bu tutara ulaşınca kargo ücretsiz olur. 0 yazarsan ücretsiz kargo kapalı."
          >
            <TextInput
              name="shippingFreeThreshold"
              inputMode="decimal"
              defaultValue={(settings.shippingFreeThresholdMinor / 100).toFixed(
                2,
              )}
              required
            />
          </SettingsField>
          <SettingsField
            name="courierFee"
            label="Kurye ücreti (₺)"
            hint="Uygulamadan verilen kafe siparişlerinde kuryeyle teslimat için; sıfırdan büyük olmalı. Ücretsiz kargo eşiği buna uygulanmaz."
          >
            <TextInput
              name="courierFee"
              inputMode="decimal"
              defaultValue={(settings.courierFeeMinor / 100).toFixed(2)}
              required
            />
          </SettingsField>
          <SettingsField
            name="pickupReadyMinutes"
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
          </SettingsField>
        </div>
        <SaveBar form={form} />
      </Section>
    </SettingsTabForm>
  );
}

function SeoTab({ settings }: { settings: AdminSettings }) {
  const form = useSettingsForm(saveSeoAction, { tab: "seo" });
  return (
    <SettingsTabForm form={form}>
      <Section title="SEO">
        <div className="grid gap-5">
          <SettingsField
            name="seoTitle"
            label="Ana sayfa başlığı"
            // Read only by app/page.tsx; every other page names itself.
            hint="Yalnız ana sayfanın arama sonucunda ve tarayıcı sekmesinde görünen başlığı. Boş bırakırsan hazır, anahtar kelimeli başlık kullanılır. Diğer sayfaların başlığı kendi içeriğinden gelir."
          >
            <TextInput
              name="seoTitle"
              defaultValue={settings.seoTitle}
              maxLength={120}
            />
          </SettingsField>
          <SettingsField
            name="seoOgImageUrl"
            label="Ana sayfa paylaşım görseli"
            hint="Ana sayfanın bağlantısı WhatsApp ya da sosyal medyada paylaşılınca görünen görselin adresi; 1200×630 önerilir. Diğer sayfaların kendi paylaşım görseli var."
          >
            <TextInput
              name="seoOgImageUrl"
              type="url"
              defaultValue={settings.seoOgImageUrl}
              maxLength={2000}
              placeholder="https://…/paylasim.jpg"
            />
          </SettingsField>
          <Field
            as="fieldset"
            label="Arama motorları"
            // robots.ts and sitemap.ts are all this switch reaches: page
            // meta stays indexable, and a page already in Google stays.
            hint="Kapatırsan arama motorlarına siteyi taramamalarını söyleriz ve site haritası boş döner. Google'da zaten görünen sayfalar kendiliğinden kalkmaz. Kapatırken onay istenir."
          >
            <Checkbox
              name="seoIndexable"
              label="Arama motorları siteyi tarayabilir"
              defaultChecked={settings.seoIndexable}
            />
          </Field>
        </div>
        <SaveBar form={form} />
      </Section>
    </SettingsTabForm>
  );
}

function NotificationsTab({ settings }: { settings: AdminSettings }) {
  const form = useSettingsForm(saveNotificationsAction, {
    tab: "notifications",
  });
  const roles = new Set(settings.orderNotifyRoles ?? []);
  return (
    <SettingsTabForm form={form}>
      <Section title="Bildirimler">
        <div className="grid gap-5">
          <SettingsField
            name="notificationEmail"
            label="Operasyon e-postası"
            hint="Test e-postasının varsayılan alıcısı. Yeni sipariş e-postası açıkken bu adrese de gider. Düşük stok uyarısı e-postayla gönderilmez; panelde görünür (Ürünler → Düşük stok)."
          >
            <TextInput
              name="notificationEmail"
              type="email"
              defaultValue={settings.notificationEmail}
              placeholder="operasyon@ornek.com"
            />
          </SettingsField>
          {/* Fieldsets, not <Field>: Field is a <label>, and each checkbox
              is a label of its own. */}
          <Field
            as="fieldset"
            label="Yeni sipariş e-postası"
            hint="Ödemesi alınan her sipariş için bir kez gider: sipariş numarası, ürünler, teslimat ya da masa, tutar ve müşterinin yalnız adı. Telefon, e-posta ve adres e-postaya yazılmaz. Kapatırken onay istenir."
          >
            <Checkbox
              name="orderNotifyEnabled"
              label="Yeni siparişte e-posta gönder"
              defaultChecked={settings.orderNotifyEnabled}
            />
          </Field>
          <Field
            as="fieldset"
            label="Alacak roller"
            hint="Seçilen rollerdeki aktif panel kullanıcılarına gider; Gmail, Hotmail gibi kişisel kutusu olan hesaba gitmez (sipariş bilgisi yurt dışında kalırdı). Kasiyer sipariş sayfasını açamaz; ona giden e-postanın düğmesi kasaya gider."
          >
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
          </Field>
          <SettingsField
            name="orderNotifyEmails"
            label="Ek adresler"
            hint="Her satıra ya da virgülle ayırarak bir adres. Panel hesabı olmayan alıcılar için (ör. mutfak tableti). Yalnız şirketin kurumsal adresleri; kişisel kutu (Gmail, Hotmail vb.) kaydedilmez."
          >
            <Textarea
              name="orderNotifyEmails"
              defaultValue={settings.orderNotifyEmails ?? ""}
              placeholder={"mutfak@ornek.com\nbar@ornek.com"}
              rows={3}
            />
          </SettingsField>
        </div>
        <SaveBar form={form} />
      </Section>
    </SettingsTabForm>
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
  const sender = useSettingsForm(saveEmailSenderAction, { tab: "email" });
  // The test mail is not a setting: typing a recipient is not "unsaved".
  const test = useSettingsForm(sendTestEmailAction, {
    tab: "email",
    trackDirty: false,
  });
  return (
    <div className="grid gap-4">
      <SettingsTabForm form={sender}>
        <Section title="E-posta gönderimi">
          {/*
            The status Resend itself reports, not what this deployment hopes.
            A verified key and an unverified DOMAIN look identical from inside
            the process, and only the second one is what stops mail today.
          */}
          <Banner tone={mail.ok ? "success" : "danger"}>
            {mail.ok ? (
              <>
                Gönderime hazır. Şu anki gönderen: <strong>{mail.from}</strong>
                {mail.status === "unknown" && (
                  <> (alan adının durumu Resend&apos;den okunamadı)</>
                )}
              </>
            ) : (
              <>
                <strong>Gönderilemiyor.</strong> {mail.message}
              </>
            )}
          </Banner>
          <div className="grid gap-5">
            <SettingsField
              name="emailFromName"
              label="Gönderen adı"
              hint="Alıcının gelen kutusunda görünen isim."
            >
              <TextInput
                name="emailFromName"
                defaultValue={settings.emailFromName}
                maxLength={80}
                placeholder="L'Affogato"
              />
            </SettingsField>
            <SettingsField
              name="emailFromAddress"
              label="Gönderen adresi"
              hint="Resend'de doğrulanmış bir alan adına ait olmalı; doğrulanmamış bir alan adı yazarsan kaydetmeden önce sorulur. Boş bırakırsan kurulumdaki varsayılan gönderen kullanılır."
            >
              <TextInput
                name="emailFromAddress"
                type="email"
                defaultValue={settings.emailFromAddress}
                placeholder="siparis@laffogato.net"
              />
            </SettingsField>
            <SettingsField
              name="emailReplyTo"
              label="Yanıt adresi"
              hint="Müşteri e-postayı yanıtladığında nereye düşsün. Boş bırakırsan Genel sekmesindeki e-posta kullanılır."
            >
              <TextInput
                name="emailReplyTo"
                type="email"
                defaultValue={settings.emailReplyTo}
                placeholder={settings.email}
              />
            </SettingsField>
          </div>
          <SaveBar form={sender} />
        </Section>
      </SettingsTabForm>

      <SettingsTabForm form={test}>
        <Section title="Test e-postası">
          <SettingsField
            name="testEmailTo"
            label="Alıcı"
            hint="Tek bir mesaj, kayıtlı gönderenle gider. Sağlayıcı reddederse nedeni burada görünür; spama düşen ya da geri dönen bir mesaj burada görünmez."
          >
            <TextInput
              name="testEmailTo"
              type="email"
              defaultValue={settings.notificationEmail || settings.email}
              placeholder="sen@ornek.com"
            />
          </SettingsField>
          <SaveBar
            form={test}
            label="Test gönder"
            pendingLabel="Gönderiliyor…"
            idle="Sitenin gönderdiği bütün e-postalar bu ayarları kullanır. Uygulamadaki kayıt ve şifre sıfırlama e-postalarını Supabase gönderir; onların ayarı Supabase panelindedir."
            // sendTestEmail reads the SAVED sender: with the form above
            // changed, a passing test proved the old address.
            disabledReason={
              sender.dirty
                ? "Önce yukarıdaki gönderen ayarlarını kaydet: test kayıtlı gönderenle gider."
                : undefined
            }
          />
        </Section>
      </SettingsTabForm>
    </div>
  );
}
