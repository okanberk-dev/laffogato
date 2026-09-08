"use client";

import { useActionState, useState, type ReactNode } from "react";

import {
  Card,
  Checkbox,
  Field,
  PrimaryButton,
  Textarea,
  TextInput,
} from "@/components/admin/forms";
import {
  APP_CONFIG_LIMITS as L,
  type MobileAppConfig,
  type MobileAppReminder,
} from "@/lib/mobile/app-config";

import {
  saveCampaignCardsAction,
  saveKaraokeRulesAction,
  saveLoyaltyAction,
  saveOrderingAction,
  saveRemindersAction,
  saveStoreAction,
  saveVenueAction,
  saveVersionAction,
  type AppConfigState,
} from "./actions";

/**
 * Eight independent forms, one per section of `settings."mobileApp"`, laid
 * out like Ayarlar: each saves only its own section (the action merges it
 * onto the live document), so an operator can tune the courier ETA without
 * re-submitting the reminders. `@/lib/mobile/app-config` is safe to import
 * here — it has no "server-only" and no database.
 */

const initial: AppConfigState = {};

const TABS = [
  { id: "version", label: "Sürüm ve bakım" },
  { id: "ordering", label: "Sipariş" },
  { id: "loyalty", label: "Sadakat" },
  { id: "karaoke", label: "Karaoke kuralları" },
  { id: "reminders", label: "Hatırlatmalar" },
  { id: "cards", label: "Kampanya kartları" },
  { id: "venue", label: "Köşk bilgileri" },
  { id: "store", label: "Mağaza ve bağlantılar" },
] as const;

type TabId = (typeof TABS)[number]["id"];

export function AppConfigForm({ config }: { config: MobileAppConfig }) {
  const [tab, setTab] = useState<TabId>("version");

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

      <div>
        {tab === "version" && <VersionTab config={config} />}
        {tab === "ordering" && <OrderingTab config={config} />}
        {tab === "loyalty" && <LoyaltyTab config={config} />}
        {tab === "karaoke" && <KaraokeTab config={config} />}
        {tab === "reminders" && <RemindersTab config={config} />}
        {tab === "cards" && <CampaignCardsTab config={config} />}
        {tab === "venue" && <VenueTab config={config} />}
        {tab === "store" && <StoreTab config={config} />}
      </div>
    </div>
  );
}

function SaveBar({
  state,
  pending,
}: {
  state: AppConfigState;
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
            Yalnız bu bölüm kaydedilir. Uygulama açılışta okur; en geç 5
            dakikada yayılır.
          </span>
        )}
      </span>
      <PrimaryButton type="submit" disabled={pending}>
        {pending ? "Kaydediliyor…" : "Kaydet"}
      </PrimaryButton>
    </div>
  );
}

function Section({
  title,
  intro,
  children,
}: {
  title: string;
  intro?: string;
  children: ReactNode;
}) {
  return (
    <Card>
      <h2
        className="mb-1 text-xl"
        style={{
          fontFamily: "var(--serif), 'Playfair Display', serif",
          fontStyle: "italic",
          fontWeight: 500,
        }}
      >
        {title}
      </h2>
      {intro && (
        <p className="mb-4 text-sm text-[var(--admin-text-soft)]">{intro}</p>
      )}
      {!intro && <div className="mb-3" />}
      {children}
    </Card>
  );
}

// ─── 1. Sürüm ve bakım ────────────────────────────────────────────────────

function VersionTab({ config }: { config: MobileAppConfig }) {
  const [state, action, pending] = useActionState(saveVersionAction, initial);
  const m = config.maintenance;
  return (
    <form action={action}>
      <Section
        title="Sürüm ve bakım"
        intro="Uygulama açılışta bu iki kapıyı kontrol eder: sürümü küçükse zorunlu güncelleme ekranı, bakım açıksa tam ekran bakım kartı gösterir."
      >
        <div className="grid gap-5">
          <Field
            label="En düşük desteklenen sürüm"
            hint="x.y.z biçiminde. Bu sürümden eski uygulamalar mağazaya yönlendirilir; boş bırakılamaz."
          >
            <TextInput
              name="minSupportedAppVersion"
              defaultValue={config.minSupportedAppVersion}
              placeholder="1.0.0"
              inputMode="decimal"
              required
            />
          </Field>
          <Field label="Bakım modu">
            <Checkbox
              name="maintenanceEnabled"
              label="Uygulamayı bakıma al (tüm ekranlar kapanır)"
              defaultChecked={m.enabled}
            />
          </Field>
          <div className="grid gap-5 sm:grid-cols-[1fr_2fr]">
            <Field
              label="Bakım başlığı"
              hint={`En fazla ${L.maintenanceTitleMax} karakter.`}
            >
              <TextInput
                name="maintenanceTitle"
                defaultValue={m.title}
                maxLength={L.maintenanceTitleMax}
                required
              />
            </Field>
            <Field
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
            </Field>
          </div>
        </div>
        <SaveBar state={state} pending={pending} />
      </Section>
    </form>
  );
}

// ─── 2. Sipariş ───────────────────────────────────────────────────────────

function OrderingTab({ config }: { config: MobileAppConfig }) {
  const [state, action, pending] = useActionState(saveOrderingAction, initial);
  const o = config.ordering;
  return (
    <form action={action}>
      <Section
        title="Sipariş"
        intro="Kafe siparişi kapalıyken uygulamada “Sepete ekle” pasifleşir, sunucu da siparişi reddeder. Kanallar tek tek kapatılabilir."
      >
        <div className="grid gap-2">
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
        </div>
        <div className="mt-5 grid gap-5 sm:grid-cols-2">
          <Field
            label="Kurye süresi — alt sınır (dk)"
            hint={`${L.courierEtaMin}–${L.courierEtaMax} dakika.`}
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
          </Field>
          <Field
            label="Kurye süresi — üst sınır (dk)"
            hint="Uygulama “25–35 dk” biçiminde gösterir."
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
          </Field>
        </div>
        <div className="mt-5">
          <Field
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
          </Field>
        </div>
        <SaveBar state={state} pending={pending} />
      </Section>
    </form>
  );
}

// ─── 3. Sadakat ───────────────────────────────────────────────────────────

function LoyaltyTab({ config }: { config: MobileAppConfig }) {
  const [state, action, pending] = useActionState(saveLoyaltyAction, initial);
  const l = config.loyalty;
  return (
    <form action={action}>
      <Section
        title="Sadakat"
        intro="Damga kartı: hedefe ulaşan üyeye ödül kuponu yazılır. Kupon değeri ve süresi kasanın işi; uygulama yalnız ödülün adını gösterir."
      >
        <div className="grid gap-5 sm:grid-cols-2">
          <Field
            label="Damga hedefi"
            hint={`${L.stampTargetMin}–${L.stampTargetMax}. Ödeme yapılmış her kafe siparişi +1 damga.`}
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
          </Field>
          <Field
            label="Ödül adı"
            hint={`En fazla ${L.rewardTitleMax} karakter.`}
          >
            <TextInput
              name="rewardTitle"
              defaultValue={l.rewardTitle}
              maxLength={L.rewardTitleMax}
              required
            />
          </Field>
          <Field
            label="Ödül değeri (₺)"
            hint={`Kuponun düşeceği tutar. En fazla ${L.rewardValueMinorMax / 100} ₺.`}
          >
            <TextInput
              name="rewardValue"
              inputMode="decimal"
              defaultValue={(l.rewardValueMinor / 100).toFixed(2)}
              required
            />
          </Field>
          <Field
            label="Kupon geçerlilik süresi (gün)"
            hint={`${L.rewardTtlDaysMin}–${L.rewardTtlDaysMax} gün.`}
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
          </Field>
        </div>
        <SaveBar state={state} pending={pending} />
      </Section>
    </form>
  );
}

// ─── 4. Karaoke kuralları ─────────────────────────────────────────────────

function KaraokeTab({ config }: { config: MobileAppConfig }) {
  const [state, action, pending] = useActionState(
    saveKaraokeRulesAction,
    initial,
  );
  const k = config.karaoke;
  return (
    <form action={action}>
      <Section
        title="Karaoke kuralları"
        intro="Saatlik ücret ve kapasite Ayarlar → Karaoke'de; burası rezervasyon saat aralığı, süre sınırı ve ORO indirimi."
      >
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          <Field
            label="İlk saat"
            hint="0–23. Rezervasyon başlayabilecek en erken saat."
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
          </Field>
          <Field
            label="Kapanış saati"
            hint="1–24; ilk saatten sonra olmalı. 24 = gece yarısı."
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
          </Field>
          <Field
            label="En fazla saat"
            hint={`Bir rezervasyonda 1–${L.karaokeMaxHoursMax} saat.`}
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
          </Field>
          <Field
            label="Rezervasyon penceresi (gün)"
            hint={`Bugünden itibaren kaç gün ileriye rezervasyon alınır (1–${L.bookingWindowDaysMax}).`}
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
          </Field>
          <Field
            label="ORO indirimi (%)"
            hint="ORO üyelere saatlik ücret üzerinden; sunucuda uygulanır."
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
          </Field>
        </div>
        <SaveBar state={state} pending={pending} />
      </Section>
    </form>
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
  const [state, action, pending] = useActionState(saveRemindersAction, initial);
  const r = config.reminders;
  // Four fixed rows; a blank id means the row is unused.
  const rows = Array.from(
    { length: L.reminderItemsMax },
    (_, i) => r.items[i] ?? EMPTY_REMINDER,
  );
  return (
    <form action={action}>
      <Section
        title="Hatırlatmalar"
        intro="Uygulamanın yerel bildirimleri (sunucu göndermez; telefon kendi planlar). Bir hatırlatma bir davettir, reklam değil: fiyat, indirim ve aciliyet dili (₺, %, indirim, son, kaçırma, hemen) kabul edilmez."
      >
        <Checkbox
          name="remindersEnabled"
          label="Hatırlatmalar açık (kapalıysa uygulama anahtarı gizler ve planlananları iptal eder)"
          defaultChecked={r.enabled}
        />
        <div className="mt-4 grid gap-4">
          {rows.map((item, i) => (
            <div
              key={i}
              className="grid gap-3 rounded-xl border border-[var(--admin-border)] p-3 sm:p-4"
            >
              <div
                className="text-[10px] tracking-[0.22em] text-[var(--admin-text-mute)] uppercase"
                style={{ fontFamily: "var(--mono), monospace" }}
              >
                Hatırlatma {i + 1}
              </div>
              <div className="grid gap-3 sm:grid-cols-[1fr_90px_90px]">
                <Field
                  label="Kimlik"
                  hint="Küçük harf, rakam, tire. Boş bırakılırsa satır kullanılmaz."
                >
                  <TextInput
                    name={`reminder-${i}-id`}
                    defaultValue={item.id}
                    maxLength={24}
                    pattern="[a-z0-9-]{1,24}"
                    placeholder="morning"
                  />
                </Field>
                <Field label="Saat">
                  <TextInput
                    name={`reminder-${i}-hour`}
                    type="number"
                    min={0}
                    max={23}
                    inputMode="numeric"
                    defaultValue={String(item.hour)}
                  />
                </Field>
                <Field label="Dakika">
                  <TextInput
                    name={`reminder-${i}-minute`}
                    type="number"
                    min={0}
                    max={59}
                    inputMode="numeric"
                    defaultValue={String(item.minute)}
                  />
                </Field>
              </div>
              <Field
                label="Başlık"
                hint={`En fazla ${L.reminderTitleMax} karakter.`}
              >
                <TextInput
                  name={`reminder-${i}-title`}
                  defaultValue={item.title}
                  maxLength={L.reminderTitleMax}
                />
              </Field>
              <Field
                label="Metin"
                hint={`En fazla ${L.reminderBodyMax} karakter.`}
              >
                <Textarea
                  name={`reminder-${i}-body`}
                  defaultValue={item.body}
                  maxLength={L.reminderBodyMax}
                  rows={2}
                />
              </Field>
            </div>
          ))}
        </div>
        <SaveBar state={state} pending={pending} />
      </Section>
    </form>
  );
}

// ─── 6. Kampanya kartları ─────────────────────────────────────────────────

function CampaignCardsTab({ config }: { config: MobileAppConfig }) {
  const [state, action, pending] = useActionState(
    saveCampaignCardsAction,
    initial,
  );
  const c = config.campaignCards;
  return (
    <form action={action}>
      <Section
        title="Kampanya kartları"
        intro="Uygulamanın Kampanyalar ekranındaki sabit kartlar. Kapatılan kart ekranda görünmez; içerik değişmez."
      >
        <div className="grid gap-2">
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
            Kept, and labelled for what it is. Karar 20 removed the card the
            app drew for this flag, so the switch changes nothing on any
            screen; the field still travels in `bootstrap.app.campaignCards`
            for back-compat, and an older build in someone's pocket still
            reads it. Silently offering an operator a switch that does
            nothing is the part that had to stop.
          */}
          <Checkbox
            name="cardSubscription"
            label="ABONELİK kartı - şu an hiçbir ekranda çizilmiyor (karar 20)"
            defaultChecked={c.subscription}
          />
        </div>
        <SaveBar state={state} pending={pending} />
      </Section>
    </form>
  );
}

// ─── 7. Köşk bilgileri ────────────────────────────────────────────────────

function VenueTab({ config }: { config: MobileAppConfig }) {
  const [state, action, pending] = useActionState(saveVenueAction, initial);
  const v = config.venue;
  return (
    <form action={action}>
      <Section
        title="Köşk bilgileri"
        intro="Adres, telefon ve çalışma saatleri Ayarlar'dan gelir; burası uygulamanın Ziyaret ekranındaki kısa ad, yer tarifi ve harita sorgusu."
      >
        <div className="grid gap-5">
          <Field
            label="Kısa ad"
            hint={`Uygulama başlıklarında. En fazla ${L.venueShortNameMax} karakter.`}
          >
            <TextInput
              name="shortName"
              defaultValue={v.shortName}
              maxLength={L.venueShortNameMax}
              required
            />
          </Field>
          <Field
            label="Yer tarifi"
            hint={`Adresin altında. En fazla ${L.venueLandmarkMax} karakter.`}
          >
            <TextInput
              name="landmark"
              defaultValue={v.landmark}
              maxLength={L.venueLandmarkMax}
              required
            />
          </Field>
          <Field
            label="Harita sorgusu"
            hint={`“Yol tarifi al” bu metni harita uygulamasına gönderir. En fazla ${L.venueMapsQueryMax} karakter.`}
          >
            <TextInput
              name="mapsQuery"
              defaultValue={v.mapsQuery}
              maxLength={L.venueMapsQueryMax}
              required
            />
          </Field>
        </div>
        <SaveBar state={state} pending={pending} />
      </Section>
    </form>
  );
}

// ─── 8. Mağaza ve bağlantılar ─────────────────────────────────────────────

function StoreTab({ config }: { config: MobileAppConfig }) {
  const [state, action, pending] = useActionState(saveStoreAction, initial);
  const st = config.store;
  return (
    <form action={action}>
      <Section
        title="Mağaza ve derin bağlantılar"
        intro="Uygulamanın iki mağazadaki adresi ve laffogato.net bağlantılarının tarayıcı yerine uygulamada açılması için gereken kimlikler. Hepsi buradan değişir - uygulamaya yeni sürüm çıkmasına gerek yok."
      >
        <div className="grid gap-5">
          <Field
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
          </Field>
          <Field
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
          </Field>
          <Field
            label="Paket adı"
            hint="iOS bundle identifier ve Android application id - ikisi de aynı. App Store Connect ve Play Console'da yazan değer."
          >
            <TextInput
              name="bundleId"
              defaultValue={st.bundleId}
              placeholder="com.laffogato.app"
            />
          </Field>
          <Field
            label="Apple Team ID"
            hint="Apple Developer hesabının 10 karakterlik kimliği (Membership sayfasında). Bunu ve paket adını girdiğinde site /.well-known/apple-app-site-association belgesini yayımlar ve laffogato.net bağlantıları iPhone'da uygulamada açılır."
          >
            <TextInput
              name="appleTeamId"
              defaultValue={st.appleTeamId}
              maxLength={10}
              placeholder="ABCDE12345"
              style={{ fontFamily: "var(--mono), monospace" }}
            />
          </Field>
          <Field
            label="Android imza parmak izleri (SHA-256)"
            hint="Her satıra bir tane. İKİSİ de gerekir: yüklediğin imza anahtarı ve Play'in kendi imzaladığı anahtar (Play Console → Test ve yayın → Uygulama bütünlüğü). Yalnız biri girilirse kurulumların yarısında bağlantılar tarayıcıda açılır."
          >
            <Textarea
              name="androidSha256"
              rows={4}
              defaultValue={st.androidSha256.join("\n")}
              placeholder="AA:BB:CC:…:99"
              style={{ fontFamily: "var(--mono), monospace" }}
            />
          </Field>
        </div>
        <SaveBar state={state} pending={pending} />
      </Section>
    </form>
  );
}
