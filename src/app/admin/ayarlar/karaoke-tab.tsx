"use client";

import { useState } from "react";

import { Checkbox, TextInput } from "@/components/admin/forms";
import { Section } from "@/components/admin/ui";
import { TONE_SOFT } from "@/components/admin/ui/tone";
import { cx } from "@/components/laffogato/cx";
import type { AdminSettings } from "@/lib/admin/store";
import {
  KARAOKE_FREE_CANCEL_HOURS_MAX,
  karaokeCancellationRules,
  karaokeCancelPolicyOf,
  karaokeCancelPolicyRefusal,
  karaokePolicyLockReason,
} from "@/lib/mobile/karaoke-time";

import { saveKaraokeAction } from "./karaoke-actions";
import {
  SaveBar,
  SettingsField,
  SettingsTabForm,
  useSettingsForm,
} from "./settings-ui";

/** A box's digits as the number the preview uses; null while unreadable. */
function wholeOrNull(raw: string): number | null {
  return /^\d{1,3}$/.test(raw.trim()) ? Number(raw.trim()) : null;
}

export function KaraokeTab({ settings }: { settings: AdminSettings }) {
  const form = useSettingsForm(saveKaraokeAction, { tab: "karaoke" });
  const saved = karaokeCancelPolicyOf({
    freeCancelHours: settings.karaokeFreeCancelHours,
    lateRefundPercent: settings.karaokeLateRefundPercent,
  });
  // The two boxes drive the live preview of what a customer will read. They
  // stay uncontrolled (defaultValue): the tab's unsaved-changes check reads
  // each control's default, which a controlled input would keep rewriting.
  const [hours, setHours] = useState(String(saved.freeCancelHours));
  const [percent, setPercent] = useState(String(saved.lateRefundPercent));
  const policy = {
    freeCancelHours: wholeOrNull(hours),
    lateRefundPercent: wholeOrNull(percent),
  };
  const readable =
    policy.freeCancelHours !== null && policy.lateRefundPercent !== null
      ? {
          freeCancelHours: policy.freeCancelHours,
          lateRefundPercent: policy.lateRefundPercent,
        }
      : null;
  const refusal = readable ? karaokeCancelPolicyRefusal(readable) : null;
  const preview =
    readable && !refusal ? karaokeCancellationRules(readable) : null;
  const locked = karaokePolicyLockReason(
    settings.mobileApp?.minSupportedAppVersion ?? "0.0.0",
  );

  return (
    <SettingsTabForm form={form}>
      <Section title="Karaoke">
        <div className="grid gap-5 sm:grid-cols-2">
          <SettingsField
            name="karaokeHourly"
            label="Saatlik ücret (₺)"
            hint="Uygulamadaki rezervasyon ekranında gösterilir; RUBY üyelere indirim sunucuda uygulanır."
          >
            <TextInput
              name="karaokeHourly"
              inputMode="decimal"
              defaultValue={(settings.karaokeHourlyMinor / 100).toFixed(2)}
              required
            />
          </SettingsField>
          <SettingsField
            name="karaokeCapacity"
            label="Kapasite (kişi)"
            hint="Bir rezervasyonda kabul edilen en fazla misafir sayısı (1 ile 50 arası)."
          >
            <TextInput
              name="karaokeCapacity"
              type="number"
              inputMode="numeric"
              min={1}
              max={50}
              step={1}
              defaultValue={String(settings.karaokeCapacity)}
              required
            />
          </SettingsField>
          <SettingsField
            name="karaokeNotifyEmail"
            label="Talep bildirimi e-postası"
            hint="Uygulamadan ya da web'den gelen her yeni rezervasyon talebi bu adrese düşer. Boş bırakılırsa genel iletişim adresine gider. Şirketin kendi alan adındaki kutu olsun: Gmail gibi yurt dışındaki kişisel bir kutu, misafir bilgisini yurt dışına taşır (KVKK m.9)."
          >
            <TextInput
              name="karaokeNotifyEmail"
              type="email"
              defaultValue={settings.karaokeNotifyEmail}
              placeholder={settings.email}
            />
          </SettingsField>
        </div>
        {/* Always ticked and enabled: switching prepayment off is refused
            (MSG_PREPAY_LOCKED), and a disabled box would not be posted, so
            every save would be. A stored off (older data) is written on
            with the next save. */}
        <Checkbox
          name="karaokePrepay"
          defaultChecked
          label="Online ön ödeme: rezervasyon ödenince kendiliğinden kesinleşir; ödenmemiş rezervasyon onaylanmaz (üyeliksiz rezervasyon da bununla açılır). Kapatılamaz: ödemesiz talepte ön bilgilendirme ve sözleşme onayı alınmıyor."
        />
      </Section>

      <Section
        title="İptal ve iade kuralı"
        description="Üyenin kendi yaptığı iptal için. Rezervasyon saatinden önceki ücretsiz iptal süresinde ödemenin tamamı iade edilir; rezervasyona gelinmediğinde iade yapılmaz. Köşk iptal ederse her zaman tamamı iade edilir."
      >
        {/* The section body has no gap of its own: the note, the preview and
            the lock box would sit on the last hint. */}
        <div className="grid gap-4">
          <div className="grid gap-5 sm:grid-cols-2">
            <SettingsField
              name="karaokeFreeCancelHours"
              label="Ücretsiz iptal (saat)"
              hint={`Rezervasyon saatine bundan fazla varken yapılan iptalde tamamı iade edilir. 0 ile ${KARAOKE_FREE_CANCEL_HOURS_MAX} arası; 0: rezervasyon saati gelene kadar ücretsiz iptal.`}
            >
              <TextInput
                name="karaokeFreeCancelHours"
                type="number"
                inputMode="numeric"
                min={0}
                max={KARAOKE_FREE_CANCEL_HOURS_MAX}
                step={1}
                defaultValue={String(saved.freeCancelHours)}
                onChange={(e) => setHours(e.currentTarget.value)}
                required
              />
            </SettingsField>
            <SettingsField
              name="karaokeLateRefundPercent"
              label="Geç iptalde iade (%)"
              hint="Süre geçtikten sonra, rezervasyon saatinden önce yapılan iptalde ödemenin ne kadarı iade edilir: 0 ile 100 arası. 0: geç iptal kabul edilmez."
            >
              <TextInput
                name="karaokeLateRefundPercent"
                type="number"
                inputMode="numeric"
                min={0}
                max={100}
                step={1}
                defaultValue={String(saved.lateRefundPercent)}
                onChange={(e) => setPercent(e.currentTarget.value)}
                required
              />
            </SettingsField>
          </div>
          <p className="text-sm text-[var(--admin-text-soft)]">
            Değişiklik yalnız bundan sonra yapılan rezervasyonlara uygulanır.
          </p>
          <div
            aria-live="polite"
            className="grid gap-2 rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface-2)] px-4 py-3 text-sm"
          >
            <span className="text-xs font-medium text-[var(--admin-text-mute)]">
              Müşterinin ödemeden önce okuyacağı kural
            </span>
            {preview ? (
              <>
                <p className="text-[var(--admin-text)]">{preview.refundRule}</p>
                <p className="text-[var(--admin-text)]">{preview.lateRule}</p>
              </>
            ) : (
              <p className="text-[var(--admin-text-soft)]">
                {refusal?.message ??
                  "Önizleme için iki kutuya da tam sayı yaz."}
              </p>
            )}
          </div>
          {locked ? (
            <p
              role="status"
              className={cx("rounded-lg px-4 py-3 text-sm", TONE_SOFT.warning)}
            >
              {locked}
            </p>
          ) : null}
          {/* A share of 1..99 % is never sent to the POS (karar D9). */}
          {readable &&
          !refusal &&
          readable.lateRefundPercent > 0 &&
          readable.lateRefundPercent < 100 ? (
            <p className="text-sm text-[var(--admin-text-soft)]">
              Kısmi iade POS&apos;a otomatik gönderilemiyor: geç iptalde
              rezervasyon iptal olur, iade edilecek tutar panelde ve e-postayla
              sana bildirilir; tutarı PayNkolay panelinden iade edip &quot;Elle
              iade edildi&quot; ile kaydedersin. Geç iptal edilen saat başka bir
              misafire satılırsa o saat için misafirde kalan tutar da aynı yolla
              iade edilir; panel bunu kendisi hesaplar ve sana yazar.
            </p>
          ) : null}
        </div>
        <SaveBar form={form} />
      </Section>
    </SettingsTabForm>
  );
}
