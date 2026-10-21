"use client";

import { useId, useRef, useState, type ReactNode } from "react";

import {
  Checkbox,
  Field,
  Select,
  Textarea,
  TextInput,
} from "@/components/admin/forms";
import {
  Badge,
  NUMERIC_STYLE,
  Section,
  TONE_SOFT,
} from "@/components/admin/ui";
import { cx } from "@/components/laffogato/cx";
import {
  APP_CONFIG_LIMITS as L,
  type MobileAppConfig,
  type MobileAppReminder,
} from "@/lib/mobile/app-config";

import {
  saveCampaignCardsAction,
  saveHappyHourAction,
  saveKaraokeRulesAction,
  saveLoyaltyAction,
  saveOrderingAction,
  saveRemindersAction,
  saveStoreAction,
  saveVenueAction,
  saveVersionAction,
} from "./actions";
import {
  APP_CONFIG_TABS,
  appConfigTabHref,
  tabAfterKey,
  type AppConfigTabId,
} from "./app-config-core";
import {
  ConfigField,
  ConfigForm,
  SaveBar,
  useAppConfigForm,
} from "./app-config-ui";

/**
 * Nine independent forms, one per section of `settings."mobileApp"`, laid
 * out like Ayarlar: each saves only its own section (the action merges it
 * onto the live document), so an operator can tune the courier ETA without
 * re-submitting the reminders. `@/lib/mobile/app-config` is safe to import
 * here - it has no "server-only" and no database.
 *
 * The tabs are real tabs (tablist / tab / tabpanel, arrow keys) and the
 * open one is in the address (`?bolum=`), so a reload, the back button and
 * a link from elsewhere land on the same section. Below `sm` they are a
 * select: nine labels in a sideways scroll with a hidden scrollbar showed
 * two of them on a phone and said nothing about the other seven.
 */
export function AppConfigForm({
  config,
  initialTab = "version",
}: {
  config: MobileAppConfig;
  initialTab?: AppConfigTabId;
}) {
  const [tab, setTab] = useState<AppConfigTabId>(initialTab);
  const baseId = useId();
  const tabRefs = useRef<Partial<Record<AppConfigTabId, HTMLButtonElement>>>(
    {},
  );
  const tabId = (t: AppConfigTabId) => `${baseId}-tab-${t}`;
  const panelId = (t: AppConfigTabId) => `${baseId}-panel-${t}`;

  const open = (next: AppConfigTabId, focus = false) => {
    setTab(next);
    // Next keeps useSearchParams in step with the native history API.
    window.history.replaceState(null, "", appConfigTabHref(next));
    if (focus) tabRefs.current[next]?.focus();
  };

  const live = config.maintenance.enabled;

  return (
    <div className="grid gap-4 lg:grid-cols-[248px_minmax(0,1fr)]">
      <label className="grid gap-2 sm:hidden">
        <span className="text-sm font-medium text-[var(--admin-text)]">
          Bölüm
        </span>
        <Select
          value={tab}
          onChange={(e) => open(e.target.value as AppConfigTabId)}
        >
          {APP_CONFIG_TABS.map((t) => (
            <option key={t.id} value={t.id}>
              {t.id === "version" && live ? `${t.label} (bakımda)` : t.label}
            </option>
          ))}
        </Select>
      </label>

      <div
        role="tablist"
        aria-label="Uygulama ayarları bölümleri"
        className="hidden flex-row flex-wrap gap-1 sm:flex lg:flex-col"
        onKeyDown={(e) => {
          const next = tabAfterKey(tab, e.key);
          if (!next) return;
          e.preventDefault();
          open(next, true);
        }}
      >
        {APP_CONFIG_TABS.map((t) => {
          const selected = tab === t.id;
          return (
            <button
              key={t.id}
              ref={(el) => {
                if (el) tabRefs.current[t.id] = el;
              }}
              id={tabId(t.id)}
              type="button"
              role="tab"
              aria-selected={selected}
              aria-controls={panelId(t.id)}
              tabIndex={selected ? 0 : -1}
              onClick={() => open(t.id)}
              className={cx(
                "inline-flex min-h-[44px] min-w-0 items-center justify-between gap-2 rounded-xl px-3 py-2 text-left text-sm whitespace-nowrap transition-colors lg:whitespace-normal",
                selected
                  ? "bg-[var(--admin-primary)] font-medium text-white"
                  : "border border-[var(--admin-border)] bg-[var(--admin-surface)] text-[var(--admin-text-soft)] hover:border-[var(--admin-primary)] hover:text-[var(--admin-primary)]",
              )}
            >
              <span>{t.label}</span>
              {t.id === "version" && live ? (
                <Badge tone="danger" dot>
                  Bakımda
                </Badge>
              ) : null}
            </button>
          );
        })}
      </div>

      {/* Hidden, not unmounted.
          Every field in these nine forms is uncontrolled (`defaultValue` off
          `config`), so tearing a tab out of the DOM threw away whatever had
          been typed into it and rebuilt it from the saved document on the way
          back - a 280-character bakım duyurusu lost to a glance at the
          courier fee, with no warning and no undo. `hidden` keeps the nodes
          and their values alive; the forms stay independent, so each Kaydet
          still submits only its own section. */}
      <div className="min-w-0">
        {APP_CONFIG_TABS.map((t) => (
          <Pane
            key={t.id}
            id={panelId(t.id)}
            labelledBy={tabId(t.id)}
            show={tab === t.id}
          >
            {TAB_BODY[t.id](config)}
          </Pane>
        ))}
      </div>
    </div>
  );
}

const TAB_BODY: Record<AppConfigTabId, (config: MobileAppConfig) => ReactNode> =
  {
    version: (config) => <VersionTab config={config} />,
    ordering: (config) => <OrderingTab config={config} />,
    loyalty: (config) => <LoyaltyTab config={config} />,
    karaoke: (config) => <KaraokeTab config={config} />,
    reminders: (config) => <RemindersTab config={config} />,
    cards: (config) => <CampaignCardsTab config={config} />,
    happy: (config) => <HappyHourTab config={config} />,
    venue: (config) => <VenueTab config={config} />,
    store: (config) => <StoreTab config={config} />,
  };

/**
 * One tab's panel. `hidden` rather than a conditional render - see the note
 * at the tab list. The attribute also takes the panel out of the
 * accessibility tree and out of tab order, so a screen reader and the Tab key
 * see exactly the section on screen.
 */
function Pane({
  id,
  labelledBy,
  show,
  children,
}: {
  id: string;
  labelledBy: string;
  show: boolean;
  children: ReactNode;
}) {
  return (
    <div id={id} role="tabpanel" aria-labelledby={labelledBy} hidden={!show}>
      {children}
    </div>
  );
}

// ─── 1. Sürüm ve bakım ────────────────────────────────────────────────────

function VersionTab({ config }: { config: MobileAppConfig }) {
  const form = useAppConfigForm(saveVersionAction);
  const m = config.maintenance;
  return (
    <ConfigForm form={form}>
      <Section
        title="Sürüm ve bakım"
        description="Uygulama açılışta bu iki kapıyı kontrol eder: sürümü küçükse zorunlu güncelleme ekranı, bakım açıksa tam ekran bakım kartı gösterir. Bakımı açmak ve sürümü yükseltmek kaydetmeden önce onay ister."
      >
        <div className="grid gap-5">
          <ConfigField
            name="minSupportedAppVersion"
            label="En düşük desteklenen sürüm"
            hint={`x.y.z biçiminde (şu an ${config.minSupportedAppVersion}). Bu sürümden eski uygulamalar mağazaya yönlendirilir; boş bırakılamaz.`}
          >
            <TextInput
              name="minSupportedAppVersion"
              defaultValue={config.minSupportedAppVersion}
              placeholder="1.0.0"
              // A decimal pad shows the region's separator (",") on a
              // Turkish iPhone, which cannot type "1.2.0".
              inputMode="text"
              autoComplete="off"
              autoCapitalize="off"
              spellCheck={false}
              style={NUMERIC_STYLE}
              required
            />
          </ConfigField>
          <Field
            as="fieldset"
            label="Bakım modu"
            hint="İşaretleyip kaydedince uygulamanın bütün ekranları kapanır; kaydetmeden önce bir kez daha sorulur."
          >
            <Checkbox
              name="maintenanceEnabled"
              label="Uygulamayı bakıma al"
              defaultChecked={m.enabled}
            />
          </Field>
          <div className="grid gap-5 sm:grid-cols-[1fr_2fr]">
            <ConfigField
              name="maintenanceTitle"
              label="Bakım başlığı"
              hint={`En fazla ${L.maintenanceTitleMax} karakter.`}
            >
              <TextInput
                name="maintenanceTitle"
                defaultValue={m.title}
                maxLength={L.maintenanceTitleMax}
                required
              />
            </ConfigField>
            <ConfigField
              name="maintenanceMessage"
              label="Bakım mesajı"
              hint={`En fazla ${L.maintenanceMessageMax} karakter. Bakım kapalıyken de saklanır.`}
            >
              <Textarea
                name="maintenanceMessage"
                defaultValue={m.message}
                maxLength={L.maintenanceMessageMax}
                rows={3}
                required
              />
            </ConfigField>
          </div>
        </div>
        <SaveBar form={form} />
      </Section>
    </ConfigForm>
  );
}

// ─── 2. Sipariş ───────────────────────────────────────────────────────────

function OrderingTab({ config }: { config: MobileAppConfig }) {
  const form = useAppConfigForm(saveOrderingAction);
  const o = config.ordering;
  return (
    <ConfigForm form={form}>
      <Section
        title="Sipariş"
        description="Kafe siparişi kapalıyken uygulamada “Sepete ekle” pasifleşir, sunucu da siparişi reddeder. Kanallar tek tek kapatılabilir."
      >
        <Field as="fieldset" label="Kanallar">
          <div className="grid gap-1">
            <Checkbox
              name="cafeEnabled"
              label="Uygulamadan kafe siparişi açık"
              defaultChecked={o.cafeEnabled}
            />
            <Checkbox
              name="deliveryEnabled"
              label="Kurye ile teslimat açık"
              defaultChecked={o.deliveryEnabled}
            />
            <Checkbox
              name="pickupEnabled"
              label="Gel-al açık"
              defaultChecked={o.pickupEnabled}
            />
            <Checkbox
              name="tableEnabled"
              label="Masaya sipariş açık (masadaki QR ile)"
              defaultChecked={o.tableEnabled}
            />
          </div>
        </Field>
        <div className="mt-5 grid gap-5 sm:grid-cols-2">
          <ConfigField
            name="etaMin"
            label="Kurye süresi - alt sınır (dk)"
            hint={`${L.courierEtaMin}-${L.courierEtaMax} dakika.`}
          >
            <TextInput
              name="etaMin"
              type="number"
              min={L.courierEtaMin}
              max={L.courierEtaMax}
              inputMode="numeric"
              defaultValue={String(o.courierEtaMinutes[0])}
              required
            />
          </ConfigField>
          <ConfigField
            name="etaMax"
            label="Kurye süresi - üst sınır (dk)"
            hint="Uygulama “25-35 dk” biçiminde gösterir."
          >
            <TextInput
              name="etaMax"
              type="number"
              min={L.courierEtaMin}
              max={L.courierEtaMax}
              inputMode="numeric"
              defaultValue={String(o.courierEtaMinutes[1])}
              required
            />
          </ConfigField>
        </div>
        <div className="mt-5">
          <ConfigField
            name="closedMessage"
            label="Sipariş kapalı mesajı"
            hint={`Kafe siparişi kapalıyken sepette görünür. En fazla ${L.closedMessageMax} karakter.`}
          >
            <Textarea
              name="closedMessage"
              defaultValue={o.closedMessage}
              maxLength={L.closedMessageMax}
              rows={2}
              required
            />
          </ConfigField>
        </div>
        <SaveBar form={form} />
      </Section>
    </ConfigForm>
  );
}

// ─── 3. Sadakat ───────────────────────────────────────────────────────────

function LoyaltyTab({ config }: { config: MobileAppConfig }) {
  const form = useAppConfigForm(saveLoyaltyAction);
  const l = config.loyalty;
  return (
    <ConfigForm form={form}>
      <Section
        title="Sadakat"
        description="Damga kartı: hedefe ulaşan üyeye ödül kuponu yazılır. Kupon değeri ve süresi kasanın işi; uygulama yalnız ödülün adını gösterir."
      >
        <div className="grid gap-5 sm:grid-cols-2">
          <ConfigField
            name="stampTarget"
            label="Damga hedefi"
            hint={`${L.stampTargetMin}-${L.stampTargetMax}. Ödeme yapılmış uygulama kafe siparişi 140 TL'den itibaren başlayan her 320 TL için +1 damga (kurye ücreti sayılmaz).`}
          >
            <TextInput
              name="stampTarget"
              type="number"
              min={L.stampTargetMin}
              max={L.stampTargetMax}
              inputMode="numeric"
              defaultValue={String(l.stampTarget)}
              required
            />
          </ConfigField>
          <ConfigField
            name="rewardTitle"
            label="Ödül adı"
            hint={`En fazla ${L.rewardTitleMax} karakter.`}
          >
            <TextInput
              name="rewardTitle"
              defaultValue={l.rewardTitle}
              maxLength={L.rewardTitleMax}
              required
            />
          </ConfigField>
          <ConfigField
            name="rewardValue"
            label="Ödül değeri (₺)"
            hint={`Kuponun düşeceği tutar. En fazla ${L.rewardValueMinorMax / 100} ₺.`}
          >
            <TextInput
              name="rewardValue"
              inputMode="decimal"
              defaultValue={(l.rewardValueMinor / 100).toFixed(2)}
              required
            />
          </ConfigField>
          <ConfigField
            name="rewardTtlDays"
            label="Kupon geçerlilik süresi (gün)"
            hint={`${L.rewardTtlDaysMin}-${L.rewardTtlDaysMax} gün.`}
          >
            <TextInput
              name="rewardTtlDays"
              type="number"
              min={L.rewardTtlDaysMin}
              max={L.rewardTtlDaysMax}
              inputMode="numeric"
              defaultValue={String(l.rewardTtlDays)}
              required
            />
          </ConfigField>
        </div>
        <SaveBar form={form} />
      </Section>
    </ConfigForm>
  );
}

// ─── 4. Karaoke kuralları ─────────────────────────────────────────────────

function KaraokeTab({ config }: { config: MobileAppConfig }) {
  const form = useAppConfigForm(saveKaraokeRulesAction);
  const k = config.karaoke;
  return (
    <ConfigForm form={form}>
      <Section
        title="Karaoke kuralları"
        // Ayarlar is the owner's page (roles.ts `settings`); a manager
        // sent there by name was sent to a door that does not open.
        description="Burası rezervasyon saat aralığı, süre sınırı ve RUBY indirimi. Saatlik ücret ve oda kapasitesini sahip, Ayarlar → Karaoke'den belirler."
      >
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          <ConfigField
            name="firstHour"
            label="İlk saat"
            hint="0-23. Rezervasyon başlayabilecek en erken saat."
          >
            <TextInput
              name="firstHour"
              type="number"
              min={0}
              max={23}
              inputMode="numeric"
              defaultValue={String(k.firstHour)}
              required
            />
          </ConfigField>
          <ConfigField
            name="closeHour"
            label="Kapanış saati"
            hint="1-24; ilk saatten sonra olmalı. 24 = gece yarısı."
          >
            <TextInput
              name="closeHour"
              type="number"
              min={1}
              max={24}
              inputMode="numeric"
              defaultValue={String(k.closeHour)}
              required
            />
          </ConfigField>
          <ConfigField
            name="maxHours"
            label="En fazla saat"
            hint={`Bir rezervasyonda 1-${L.karaokeMaxHoursMax} saat.`}
          >
            <TextInput
              name="maxHours"
              type="number"
              min={1}
              max={L.karaokeMaxHoursMax}
              inputMode="numeric"
              defaultValue={String(k.maxHours)}
              required
            />
          </ConfigField>
          <ConfigField
            name="bookingWindowDays"
            label="Rezervasyon penceresi (gün)"
            hint={`Bugünden itibaren kaç gün ileriye rezervasyon alınır (1-${L.bookingWindowDaysMax}).`}
          >
            <TextInput
              name="bookingWindowDays"
              type="number"
              min={1}
              max={L.bookingWindowDaysMax}
              inputMode="numeric"
              defaultValue={String(k.bookingWindowDays)}
              required
            />
          </ConfigField>
          <ConfigField
            name="oroDiscountPct"
            label="RUBY indirimi (%)"
            hint="RUBY üyelere saatlik ücret üzerinden; sunucuda uygulanır."
          >
            <TextInput
              name="oroDiscountPct"
              type="number"
              min={0}
              max={100}
              inputMode="numeric"
              defaultValue={String(k.oroDiscountPct)}
              required
            />
          </ConfigField>
        </div>
        <SaveBar form={form} />
      </Section>
    </ConfigForm>
  );
}

// ─── 5. Hatırlatmalar ─────────────────────────────────────────────────────

const EMPTY_REMINDER: MobileAppReminder = {
  id: "",
  hour: 10,
  minute: 0,
  title: "",
  body: "",
};

function RemindersTab({ config }: { config: MobileAppConfig }) {
  const form = useAppConfigForm(saveRemindersAction);
  const r = config.reminders;
  // Four fixed rows; a row with nothing written in it is unused.
  const rows = Array.from(
    { length: L.reminderItemsMax },
    (_, i) => r.items[i] ?? EMPTY_REMINDER,
  );
  return (
    <ConfigForm form={form}>
      <Section
        title="Hatırlatmalar"
        description="Uygulamanın yerel hatırlatma bildirimleri (sunucu göndermez; telefon kendi planlar). Bir hatırlatma bir davettir, reklam değil: fiyat, indirim ve aciliyet dili (₺, %, indirim, son, kaçırma, hemen) kabul edilmez."
      >
        <Checkbox
          name="remindersEnabled"
          label="Hatırlatmalar açık (kapalıysa uygulama anahtarı gizler ve planlananları iptal eder)"
          defaultChecked={r.enabled}
        />
        <div className="mt-4 grid gap-4">
          {rows.map((item, i) => (
            <fieldset
              key={i}
              className="grid min-w-0 gap-3 rounded-xl border border-[var(--admin-border)] p-3 sm:p-4"
            >
              <legend className="px-1 text-sm font-semibold text-[var(--admin-text)]">
                Hatırlatma {i + 1}
              </legend>
              <div className="grid gap-3 sm:grid-cols-[1fr_96px_96px]">
                <ConfigField
                  name={`reminder-${i}-id`}
                  label="Kimlik"
                  hint="Telefonun bu hatırlatmayı tanıdığı kısa ad: küçük harf, rakam, tire. Kimlik, başlık ve metin boşsa satır kullanılmaz."
                >
                  <TextInput
                    name={`reminder-${i}-id`}
                    defaultValue={item.id}
                    maxLength={24}
                    // Escaped hyphen: browsers compile `pattern` with the v
                    // flag, where a bare "-" at the end of a class is a
                    // syntax error and the whole attribute was ignored.
                    pattern="[a-z0-9\-]{1,24}"
                    autoCapitalize="off"
                    spellCheck={false}
                    placeholder="sabah"
                  />
                </ConfigField>
                <ConfigField
                  name={`reminder-${i}-hour`}
                  label="Saat"
                  hint={`${L.reminderHourMin}-${L.reminderHourMax}; gece hatırlatması yok.`}
                >
                  <TextInput
                    name={`reminder-${i}-hour`}
                    type="number"
                    min={L.reminderHourMin}
                    max={L.reminderHourMax}
                    inputMode="numeric"
                    defaultValue={String(item.hour)}
                  />
                </ConfigField>
                <ConfigField name={`reminder-${i}-minute`} label="Dakika">
                  <TextInput
                    name={`reminder-${i}-minute`}
                    type="number"
                    min={0}
                    max={59}
                    inputMode="numeric"
                    defaultValue={String(item.minute)}
                  />
                </ConfigField>
              </div>
              <ConfigField
                name={`reminder-${i}-title`}
                label="Başlık"
                hint={`En fazla ${L.reminderTitleMax} karakter.`}
              >
                <TextInput
                  name={`reminder-${i}-title`}
                  defaultValue={item.title}
                  maxLength={L.reminderTitleMax}
                />
              </ConfigField>
              <ConfigField
                name={`reminder-${i}-body`}
                label="Metin"
                hint={`En fazla ${L.reminderBodyMax} karakter.`}
              >
                <Textarea
                  name={`reminder-${i}-body`}
                  defaultValue={item.body}
                  maxLength={L.reminderBodyMax}
                  rows={2}
                />
              </ConfigField>
            </fieldset>
          ))}
        </div>
        <SaveBar form={form} />
      </Section>
    </ConfigForm>
  );
}

// ─── 6. Kampanya kartları ─────────────────────────────────────────────────

function CampaignCardsTab({ config }: { config: MobileAppConfig }) {
  const form = useAppConfigForm(saveCampaignCardsAction);
  const c = config.campaignCards;
  return (
    <ConfigForm form={form}>
      <Section
        title="Kampanya kartları"
        description="Uygulamanın Kampanyalar ekranındaki sabit kartlar. Kapatılan kart ekranda görünmez; içerik değişmez."
      >
        <div className="grid gap-1">
          <Checkbox
            name="cardLoyalty"
            label="SADAKAT kartı (damga kartı anlatımı)"
            defaultChecked={c.loyalty}
          />
          <Checkbox
            name="cardInvite"
            label="DAVET kartı (arkadaşını getir)"
            defaultChecked={c.invite}
          />
          {/*
            Kept, and labelled for what it is. The current app builds no
            longer draw the card this flag switched, so the switch changes
            nothing on their screens; the field still travels in
            `bootstrap.app.campaignCards` for back-compat, and an older build
            in someone's pocket still reads it.
          */}
          <Checkbox
            name="cardSubscription"
            label="ABONELİK kartı (yalnız eski uygulama sürümleri gösterir)"
            defaultChecked={c.subscription}
          />
        </div>
        <SaveBar form={form} />
      </Section>
    </ConfigForm>
  );
}

// ─── 6b. Mutlu saatler ────────────────────────────────────────────────────

const HAPPY_DAY_LABELS: Record<string, string> = {
  weekday: "Hafta içi",
  weekend: "Hafta sonu",
  everyday: "Her gün",
};

/**
 * The happy hour, and the switch that decides whether the app mentions it.
 *
 * The warning is the point of the section. Nothing in the order's pricing
 * applies this discount - the counter does, by hand - so an operator who
 * turns it on is promising that the till will honour what the app shows.
 * While it is off, the bootstrap publishes nothing and no card is drawn.
 */
function HappyHourTab({ config }: { config: MobileAppConfig }) {
  const form = useAppConfigForm(saveHappyHourAction);
  const h = config.happyHour;
  return (
    <ConfigForm form={form}>
      <Section
        title="Mutlu saatler"
        description="Uygulamanın Ana Sayfa ve Kampanyalar ekranlarındaki mutlu saat kartı. İndirim tüm içeceklerde geçerlidir - kahve/tatlı ayrımı yoktur."
      >
        <p className={cx("rounded-xl p-3 text-sm", TONE_SOFT.warning)}>
          İndirim sipariş fiyatlamasına <strong>yansımaz</strong>; kasada elle
          uygulanır. Bu yüzden kart yalnız aşağıdaki kutu işaretliyken
          gösterilir - işaretlemek, kasanın bu indirimi uygulayacağı anlamına
          gelir.
        </p>
        <div className="mt-3">
          <Checkbox
            name="happyEnabled"
            label="Mutlu saat kartını uygulamada göster"
            defaultChecked={h.enabled}
          />
        </div>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          <ConfigField name="happyDays" label="Günler">
            <Select name="happyDays" defaultValue={h.days}>
              {L.happyHourDays.map((d) => (
                <option key={d} value={d}>
                  {HAPPY_DAY_LABELS[d] ?? d}
                </option>
              ))}
            </Select>
          </ConfigField>
          <ConfigField
            name="happyPct"
            label="İndirim oranı (%)"
            hint={`${L.happyHourPctMin}-${L.happyHourPctMax} arası`}
          >
            <TextInput
              name="happyPct"
              type="number"
              min={L.happyHourPctMin}
              max={L.happyHourPctMax}
              inputMode="numeric"
              defaultValue={h.pct}
            />
          </ConfigField>
          <ConfigField name="happyFrom" label="Başlangıç (SS:DD)">
            <TextInput
              name="happyFrom"
              defaultValue={h.from}
              inputMode="numeric"
              placeholder="14:00"
              style={NUMERIC_STYLE}
            />
          </ConfigField>
          <ConfigField name="happyTo" label="Bitiş (SS:DD)">
            <TextInput
              name="happyTo"
              defaultValue={h.to}
              inputMode="numeric"
              placeholder="17:00"
              style={NUMERIC_STYLE}
            />
          </ConfigField>
        </div>
        <SaveBar form={form} />
      </Section>
    </ConfigForm>
  );
}

// ─── 7. Köşk bilgileri ────────────────────────────────────────────────────

function VenueTab({ config }: { config: MobileAppConfig }) {
  const form = useAppConfigForm(saveVenueAction);
  const v = config.venue;
  return (
    <ConfigForm form={form}>
      <Section
        title="Köşk bilgileri"
        description="Burası uygulamanın Ziyaret ekranındaki kısa ad, yer tarifi ve harita sorgusu. Adres, telefon ve çalışma saatleri Ayarlar'dan gelir; onları sahip değiştirir."
      >
        <div className="grid gap-5">
          <ConfigField
            name="shortName"
            label="Kısa ad"
            hint={`Uygulama başlıklarında. En fazla ${L.venueShortNameMax} karakter.`}
          >
            <TextInput
              name="shortName"
              defaultValue={v.shortName}
              maxLength={L.venueShortNameMax}
              required
            />
          </ConfigField>
          <ConfigField
            name="landmark"
            label="Yer tarifi"
            hint={`Adresin altında. En fazla ${L.venueLandmarkMax} karakter.`}
          >
            <TextInput
              name="landmark"
              defaultValue={v.landmark}
              maxLength={L.venueLandmarkMax}
              required
            />
          </ConfigField>
          <ConfigField
            name="mapsQuery"
            label="Harita sorgusu"
            hint={`“Yol tarifi al” bu metni harita uygulamasına gönderir. En fazla ${L.venueMapsQueryMax} karakter.`}
          >
            <TextInput
              name="mapsQuery"
              defaultValue={v.mapsQuery}
              maxLength={L.venueMapsQueryMax}
              required
            />
          </ConfigField>
        </div>
        <SaveBar form={form} />
      </Section>
    </ConfigForm>
  );
}

// ─── 8. Mağaza ve bağlantılar ─────────────────────────────────────────────

function StoreTab({ config }: { config: MobileAppConfig }) {
  const form = useAppConfigForm(saveStoreAction);
  const st = config.store;
  return (
    <ConfigForm form={form}>
      <Section
        title="Mağaza ve derin bağlantılar"
        description="Uygulamanın iki mağazadaki adresi ve laffogato.net bağlantılarının tarayıcı yerine uygulamada açılması için gereken kimlikler. Hepsi buradan değişir - uygulamaya yeni sürüm çıkmasına gerek yok."
      >
        <div className="grid gap-5">
          <ConfigField
            name="appStoreUrl"
            label="App Store adresi"
            hint="Zorunlu güncelleme ekranındaki düğme buraya gider. Liste yayına girene kadar boş bırak: boşken düğme hiç gösterilmez, hiçbir yere gitmeyen bir düğme gösterilmez."
          >
            <TextInput
              name="appStoreUrl"
              type="url"
              defaultValue={st.appStoreUrl}
              maxLength={L.storeUrlMax}
              placeholder="https://apps.apple.com/tr/app/…"
            />
          </ConfigField>
          <ConfigField
            name="playStoreUrl"
            label="Google Play adresi"
            hint="Android'de aynı düğme buraya gider."
          >
            <TextInput
              name="playStoreUrl"
              type="url"
              defaultValue={st.playStoreUrl}
              maxLength={L.storeUrlMax}
              placeholder="https://play.google.com/store/apps/details?id=…"
            />
          </ConfigField>
          <ConfigField
            name="bundleId"
            label="Paket adı"
            hint="iOS bundle identifier ve Android application id - ikisi de aynı. App Store Connect ve Play Console'da yazan değer."
          >
            <TextInput
              name="bundleId"
              defaultValue={st.bundleId}
              autoCapitalize="off"
              spellCheck={false}
              placeholder="com.laffogato.app"
            />
          </ConfigField>
          <ConfigField
            name="appleTeamId"
            label="Apple Team ID"
            hint="Apple Developer hesabının 10 karakterlik kimliği (Membership sayfasında). Bunu ve paket adını girdiğinde site /.well-known/apple-app-site-association belgesini yayımlar ve laffogato.net bağlantıları iPhone'da uygulamada açılır."
          >
            <TextInput
              name="appleTeamId"
              defaultValue={st.appleTeamId}
              maxLength={10}
              autoCapitalize="characters"
              spellCheck={false}
              placeholder="ABCDE12345"
              // A real monospace face (--mono is Poppins), so an ID and the
              // fingerprints below can be checked character by character.
              style={NUMERIC_STYLE}
            />
          </ConfigField>
          <ConfigField
            name="androidSha256"
            label="Android imza parmak izleri (SHA-256)"
            hint="Her satıra bir tane. İKİSİ de gerekir: yüklediğin imza anahtarı ve Play'in kendi imzaladığı anahtar (Play Console → Test ve yayın → Uygulama bütünlüğü). Yalnız biri girilirse kurulumların yarısında bağlantılar tarayıcıda açılır."
          >
            <Textarea
              name="androidSha256"
              rows={4}
              defaultValue={st.androidSha256.join("\n")}
              spellCheck={false}
              placeholder="AA:BB:CC:…:99"
              style={NUMERIC_STYLE}
            />
          </ConfigField>
        </div>
        <SaveBar form={form} />
      </Section>
    </ConfigForm>
  );
}
