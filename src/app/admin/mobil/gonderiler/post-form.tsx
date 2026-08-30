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
  APP_POST_KIND_LABELS,
  APP_POST_KINDS,
  type AppPostKind,
} from "@/lib/admin/app-content-schema";

export interface AppPostDefaults {
  kind?: AppPostKind;
  title?: string;
  body?: string;
  image?: string;
  linkUrl?: string;
  linkLabel?: string;
  sortOrder?: number;
  isActive?: boolean;
  startsAt?: string;
  endsAt?: string;
}

/**
 * Editor for the app's home post strip — campaigns, collaborations, events.
 *
 * Unlike the hero slide editor this one HAS a picture and HAS an outward link,
 * because that is what a collaboration post is. Both are constrained:
 *
 * 1. The image is a URL, not an upload. The app fetches and caches it, so a
 *    4 MB data: URL in a database row would be paid for on every phone, every
 *    time the home screen loads.
 * 2. The link must be https. The store re-checks this with `new URL` on save,
 *    so a `javascript:` or `data:` destination is stored as empty rather than
 *    reaching a phone — this is the one field where panel text becomes
 *    somewhere a customer's browser goes.
 *
 * Constants come from app-content-schema, never from the store: importing them
 * from the store would pull `server-only` and `pg` into the browser bundle and
 * fail the build.
 */
export function AppPostForm({
  action,
  defaults,
  submitLabel,
}: {
  action: (formData: FormData) => void;
  defaults?: AppPostDefaults;
  submitLabel: string;
}) {
  return (
    <form action={action} className="grid gap-4">
      <Card>
        <div className="grid gap-4">
          <Field label="Tür" hint="Kartın üstünde küçük etiket olarak görünür.">
            <Select name="kind" defaultValue={defaults?.kind ?? "campaign"}>
              {APP_POST_KINDS.map((k) => (
                <option key={k} value={k}>
                  {APP_POST_KIND_LABELS[k]}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Başlık" hint="En fazla 80 karakter.">
            <TextInput
              name="title"
              defaultValue={defaults?.title ?? ""}
              maxLength={80}
              required
              placeholder="Sabah ritüeli"
            />
          </Field>

          <Field
            label="Metin"
            hint="En fazla 280 karakter. Kartta üç satır görünür, gerisi kırpılır."
          >
            <Textarea
              name="body"
              defaultValue={defaults?.body ?? ""}
              maxLength={280}
              rows={3}
            />
          </Field>
        </div>
      </Card>

      <Card>
        <div className="grid gap-4">
          <Field
            label="Görsel adresi"
            hint="https ile başlayan tam adres. Boş bırakırsan kart marka zemininde çizilir — bozuk bir görsel yerine kasıtlı bir panel görünür."
          >
            <TextInput
              name="image"
              type="url"
              defaultValue={defaults?.image ?? ""}
              maxLength={2048}
              placeholder="https://…/kampanya.webp"
            />
          </Field>

          <Field
            label="Bağlantı adresi"
            hint="İsteğe bağlı. Yalnızca https kabul edilir; başka bir şey yazılırsa boş kaydedilir. Uygulama bunu uygulama içi tarayıcıda açar."
          >
            <TextInput
              name="linkUrl"
              type="url"
              defaultValue={defaults?.linkUrl ?? ""}
              maxLength={2048}
              placeholder="https://instagram.com/…"
            />
          </Field>

          <Field label="Bağlantı yazısı" hint="Örn. Detaylar. Boşsa buton görünmez.">
            <TextInput
              name="linkLabel"
              defaultValue={defaults?.linkLabel ?? ""}
              maxLength={32}
              placeholder="Detaylar"
            />
          </Field>
        </div>
      </Card>

      <Card>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Sıra" hint="Küçük olan önce görünür.">
            <TextInput
              name="sortOrder"
              type="number"
              min={0}
              defaultValue={String(defaults?.sortOrder ?? 0)}
            />
          </Field>

          <Field label="Yayında">
            <Checkbox
              name="isActive"
              label="Uygulamada görünsün"
              defaultChecked={defaults?.isActive ?? true}
            />
          </Field>

          <Field
            label="Başlangıç"
            hint="Boş bırakırsan hemen yayına girer. Biçim: 2026-09-01T09:00"
          >
            <TextInput
              name="startsAt"
              defaultValue={defaults?.startsAt ?? ""}
              maxLength={40}
              placeholder="2026-09-01T09:00"
            />
          </Field>

          <Field
            label="Bitiş"
            hint="Boş bırakırsan süresiz kalır. Tarih geçince kart kendiliğinden düşer."
          >
            <TextInput
              name="endsAt"
              defaultValue={defaults?.endsAt ?? ""}
              maxLength={40}
              placeholder="2026-09-30T23:59"
            />
          </Field>
        </div>
      </Card>

      <div>
        <PrimaryButton type="submit">{submitLabel}</PrimaryButton>
      </div>
    </form>
  );
}
