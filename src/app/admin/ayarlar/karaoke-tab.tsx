"use client";

import { Checkbox, TextInput } from "@/components/admin/forms";
import { Section } from "@/components/admin/ui";
import type { AdminSettings } from "@/lib/admin/store";

import { saveKaraokeAction } from "./karaoke-actions";
import {
  SaveBar,
  SettingsField,
  SettingsTabForm,
  useSettingsForm,
} from "./settings-ui";

export function KaraokeTab({ settings }: { settings: AdminSettings }) {
  const form = useSettingsForm(saveKaraokeAction, { tab: "karaoke" });
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
            hint="Uygulamadan ya da web'den gelen her yeni rezervasyon talebi bu adrese düşer. Boş bırakılırsa genel iletişim adresine gider."
          >
            <TextInput
              name="karaokeNotifyEmail"
              type="email"
              defaultValue={settings.karaokeNotifyEmail}
              placeholder={settings.email}
            />
          </SettingsField>
        </div>
        <Checkbox
          name="karaokePrepay"
          defaultChecked={settings.karaokePrepay}
          label="Online ön ödeme: rezervasyon ödenince kendiliğinden kesinleşir; ödenmemiş rezervasyon onaylanmaz (üyeliksiz rezervasyon da bununla açılır). Kapatırsan web'de ve uygulamada eski akış döner: talep, köşkte ödeme, elle onay."
        />
        <SaveBar form={form} />
      </Section>
    </SettingsTabForm>
  );
}
