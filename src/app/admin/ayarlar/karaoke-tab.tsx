"use client";

import { useActionState } from "react";

import { Checkbox, Field, TextInput } from "@/components/admin/forms";
import type { AdminSettings } from "@/lib/admin/store";

import { saveKaraokeAction } from "./karaoke-actions";
import { initial, SaveBar, Section } from "./settings-ui";

export function KaraokeTab({ settings }: { settings: AdminSettings }) {
  const [state, action, pending] = useActionState(saveKaraokeAction, initial);
  return (
    <form action={action}>
      <Section title="Karaoke">
        <div className="grid gap-5 sm:grid-cols-2">
          <Field
            label="Saatlik ücret (₺)"
            hint="Uygulamadaki rezervasyon ekranında gösterilir; RUBY üyelere indirim sunucuda uygulanır."
          >
            <TextInput
              name="karaokeHourly"
              inputMode="decimal"
              defaultValue={(settings.karaokeHourlyMinor / 100).toFixed(2)}
              required
            />
          </Field>
          <Field
            label="Kapasite (kişi)"
            hint="Bir rezervasyonda kabul edilen en fazla misafir sayısı."
          >
            <TextInput
              name="karaokeCapacity"
              inputMode="numeric"
              defaultValue={String(settings.karaokeCapacity)}
              required
            />
          </Field>
          <Field
            label="Talep bildirimi e-postası"
            hint="Uygulamadan ya da web'den gelen her yeni rezervasyon talebi bu adrese düşer. Boş bırakılırsa genel iletişim adresine gider."
          >
            <TextInput
              name="karaokeNotifyEmail"
              type="email"
              defaultValue={settings.karaokeNotifyEmail}
              placeholder={settings.email}
            />
          </Field>
        </div>
        <Checkbox
          name="karaokePrepay"
          defaultChecked={settings.karaokePrepay}
          label="Online ön ödeme: rezervasyon ödenince kendiliğinden kesinleşir; ödenmemiş rezervasyon onaylanmaz (üyeliksiz rezervasyon da bununla açılır). Kapatırsan web'de ve uygulamada eski akış döner: talep, köşkte ödeme, elle onay."
        />
        <SaveBar state={state} pending={pending} />
      </Section>
    </form>
  );
}
