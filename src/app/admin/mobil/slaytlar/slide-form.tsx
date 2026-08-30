"use client";

import {
  Card,
  Checkbox,
  Field,
  PrimaryButton,
  Select,
  Textarea,
  TextInput,
} from "@/components/admin/forms";
import {
  APP_SLIDE_ROUTE_LABELS,
  APP_SLIDE_ROUTES,
  APP_SLIDE_TONE_LABELS,
  APP_SLIDE_TONES,
  type AppSlideTone,
} from "@/lib/admin/app-content-schema";

export interface AppSlideDefaults {
  eyebrow?: string;
  title?: string;
  body?: string;
  ctaLabel?: string;
  ctaRoute?: string;
  tone?: AppSlideTone;
  sortOrder?: number;
  isActive?: boolean;
  startsAt?: string;
  endsAt?: string;
}

/**
 * Hero slide editor for the mobile app's home carousel.
 *
 * Two things differ from the website's hero editor, and both are deliberate:
 *
 * 1. There is no free-text link field. A slide points at a route KEY chosen
 *    from a fixed list; the app resolves it through its own allow-list. CMS
 *    text must never be able to steer native navigation.
 * 2. There is no image upload. A slide is painted in one of the brand grounds,
 *    which keeps every slide legible, on-palette and near-zero in bytes.
 *    Photography arrives with the image pipeline, not before.
 */
export function AppSlideForm({
  action,
  defaults,
  submitLabel,
}: {
  action: (formData: FormData) => void;
  defaults?: AppSlideDefaults;
  submitLabel: string;
}) {
  return (
    <form action={action} className="grid gap-4">
      <Card>
        <div className="grid gap-4">
          <Field
            label="Üst etiket"
            hint="Başlığın üstündeki küçük yazı, örn. EVİN İMZASI. Büyük harfle yaz — uygulama otomatik büyütmez (Türkçe'de i → İ bozulur)."
          >
            <TextInput
              name="eyebrow"
              defaultValue={defaults?.eyebrow ?? ""}
              maxLength={32}
              placeholder="EVİN İMZASI"
            />
          </Field>

          <Field label="Başlık" hint="En fazla 80 karakter.">
            <TextInput
              name="title"
              defaultValue={defaults?.title ?? ""}
              maxLength={80}
              required
              placeholder="L'Affogato"
            />
          </Field>

          <Field
            label="Metin"
            hint="En fazla 240 karakter. İki satırda okunabilecek kadar kısa tut."
          >
            <Textarea
              name="body"
              defaultValue={defaults?.body ?? ""}
              maxLength={240}
              rows={3}
            />
          </Field>
        </div>
      </Card>

      <Card>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Zemin rengi"
            hint="Bordo ve marka yeşili yan yana bulanıklaşır — sıralamada aralarına açık bir slayt koy."
          >
            <Select name="tone" defaultValue={defaults?.tone ?? "paper"}>
              {APP_SLIDE_TONES.map((tone) => (
                <option key={tone} value={tone}>
                  {APP_SLIDE_TONE_LABELS[tone]}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Sıra" hint="Küçük sayı önce gösterilir.">
            <TextInput
              name="sortOrder"
              type="number"
              min={0}
              defaultValue={String(defaults?.sortOrder ?? 0)}
            />
          </Field>

          <Field
            label="Buton yazısı"
            hint="Boş bırakırsan slayt tıklanamaz olur."
          >
            <TextInput
              name="ctaLabel"
              defaultValue={defaults?.ctaLabel ?? ""}
              maxLength={32}
              placeholder="Menüde gör"
            />
          </Field>

          <Field
            label="Buton hedefi"
            hint="Yalnızca listedeki ekranlar seçilebilir; serbest bağlantı kabul edilmez."
          >
            <Select name="ctaRoute" defaultValue={defaults?.ctaRoute ?? ""}>
              {APP_SLIDE_ROUTES.map((route) => (
                <option key={route} value={route}>
                  {APP_SLIDE_ROUTE_LABELS[route]}
                </option>
              ))}
            </Select>
          </Field>
        </div>
      </Card>

      <Card>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Başlangıç"
            hint="Boş bırakırsan hemen yayında olur. Biçim: 2026-09-01T00:00:00Z"
          >
            <TextInput
              name="startsAt"
              defaultValue={defaults?.startsAt ?? ""}
              placeholder="2026-09-01T00:00:00Z"
            />
          </Field>
          <Field label="Bitiş" hint="Boş bırakırsan süresiz yayında kalır.">
            <TextInput
              name="endsAt"
              defaultValue={defaults?.endsAt ?? ""}
              placeholder="2026-10-01T00:00:00Z"
            />
          </Field>
        </div>
        <div className="mt-4">
          <Checkbox
            name="isActive"
            label="Yayında"
            defaultChecked={defaults?.isActive ?? true}
          />
        </div>
      </Card>

      <div>
        <PrimaryButton type="submit">{submitLabel}</PrimaryButton>
      </div>
    </form>
  );
}
