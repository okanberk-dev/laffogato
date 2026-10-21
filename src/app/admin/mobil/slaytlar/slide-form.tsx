"use client";

import { GuardedActionForm } from "@/components/admin/guarded-action-form";
import {
  Card,
  Checkbox,
  Field,
  Select,
  Textarea,
  TextInput,
} from "@/components/admin/forms";
import type { ModalAction } from "@/components/admin/ui";
import { DateTimeField } from "@/components/admin/ui/date-time-field";
import {
  APP_SLIDE_ROUTE_LABELS,
  APP_SLIDE_ROUTES,
  APP_SLIDE_TONE_LABELS,
  APP_SLIDE_TONES,
  type AppSlideTone,
} from "@/lib/admin/app-content-schema";
import { toDateTimeLocalInput } from "@/lib/admin/publish-window";

import { FieldRow, FormActions } from "../app-content-ui";

export interface AppSlideDefaults {
  eyebrow?: string;
  title?: string;
  body?: string;
  ctaLabel?: string;
  ctaRoute?: string;
  tone?: AppSlideTone;
  image?: string;
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
 * 2. There is no image UPLOAD. A slide is painted in one of the brand grounds
 *    and may carry an optional https image URL on top - the same rule as a
 *    post: a URL the phone fetches and caches, never a data: blob stored in
 *    the row and paid for on every home-screen load. The tone stays
 *    mandatory so a slide whose image fails to load is still a legible,
 *    on-palette card rather than a blank rectangle.
 *
 * Posted through ActionForm: a refusal shows under its field and keeps
 * what was typed, and a second press before the answer creates nothing.
 */
export function AppSlideForm({
  action,
  defaults,
  submitLabel,
}: {
  action: ModalAction;
  defaults?: AppSlideDefaults;
  submitLabel: string;
}) {
  return (
    <GuardedActionForm action={action} className="grid gap-4">
      <Card>
        <div className="grid gap-4">
          <Field
            label="Üst etiket"
            hint="Başlığın üstündeki küçük yazı, örn. EVİN İMZASI. Büyük harfle yaz - uygulama otomatik büyütmez (Türkçe'de i → İ bozulur)."
          >
            <TextInput
              name="eyebrow"
              defaultValue={defaults?.eyebrow ?? ""}
              maxLength={32}
              placeholder="EVİN İMZASI"
            />
          </Field>

          <FieldRow name="title">
            <Field label="Başlık" hint="En fazla 80 karakter.">
              <TextInput
                name="title"
                defaultValue={defaults?.title ?? ""}
                maxLength={80}
                required
                placeholder="L'Affogato"
              />
            </Field>
          </FieldRow>

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
        <div className="grid gap-4">
          <Field
            label="Görsel adresi (https, isteğe bağlı)"
            hint="https ile başlayan tam adres. Boş bırakırsan slayt yalnız zemin rengiyle çizilir; başka bir şey yazılırsa boş kaydedilir. Görsel yüklenemezse zemin rengi görünür."
          >
            <TextInput
              name="image"
              type="url"
              defaultValue={defaults?.image ?? ""}
              maxLength={2048}
              placeholder="https://…/slayt.webp"
            />
          </Field>
        </div>
      </Card>

      <Card>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Zemin rengi"
            hint="Bordo ve marka yeşili yan yana bulanıklaşır - sıralamada aralarına açık bir slayt koy."
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
          <FieldRow name="startsAt">
            <Field
              label="Başlangıç"
              hint="Boşsa hemen yayında. Saat İstanbul saatidir."
            >
              <DateTimeField
                name="startsAt"
                aria-label="Başlangıç tarihi ve saati"
                defaultValue={toDateTimeLocalInput(defaults?.startsAt ?? "")}
              />
            </Field>
          </FieldRow>
          <FieldRow name="endsAt">
            <Field label="Bitiş" hint="Boşsa süresiz yayında kalır.">
              <DateTimeField
                name="endsAt"
                aria-label="Bitiş tarihi ve saati"
                defaultValue={toDateTimeLocalInput(defaults?.endsAt ?? "")}
              />
            </Field>
          </FieldRow>
        </div>
        <div className="mt-4">
          <Checkbox
            name="isActive"
            label="Yayında"
            defaultChecked={defaults?.isActive ?? true}
          />
        </div>
      </Card>

      <FormActions submitLabel={submitLabel} backHref="/admin/mobil/slaytlar" />
    </GuardedActionForm>
  );
}
