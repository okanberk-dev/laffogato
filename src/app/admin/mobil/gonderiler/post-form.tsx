"use client";

import Link from "next/link";
import { useState } from "react";

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
import { defaultEmailMembers } from "@/lib/admin/post-mail-default";
import { toDateTimeLocalInput } from "@/lib/admin/publish-window";

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
  /** Set once the post's campaign e-mail exists; the checkbox then stays off. */
  emailCampaignId?: string;
}

function isAppPostKind(value: string): value is AppPostKind {
  return (APP_POST_KINDS as string[]).includes(value);
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
 * The "e-posta" box is the automatic campaign mail (docs/EMAIL-RESEND.md §7):
 * on by default only when a campaign post is being created; off on every
 * edit (`defaultEmailMembers` says why) and locked off once the post has had
 * its mail — the mark on the post is what actually prevents a second send;
 * the box just says so. Ticked, the submit asks once more: it is a
 * commercial send to the whole member base.
 *
 * Constants come from app-content-schema, never from the store: importing them
 * from the store would pull `server-only` and `pg` into the browser bundle and
 * fail the build.
 */
export function AppPostForm({
  action,
  defaults,
  mode,
  submitLabel,
}: {
  action: (formData: FormData) => void;
  defaults?: AppPostDefaults;
  /** Create starts the box ticked for a campaign; edit never does. */
  mode: "create" | "edit";
  submitLabel: string;
}) {
  const alreadyMailed = Boolean(defaults?.emailCampaignId);
  const [kind, setKind] = useState<AppPostKind>(defaults?.kind ?? "campaign");
  // null = the operator has not touched the box; it then follows the default.
  const [emailChoice, setEmailChoice] = useState<boolean | null>(null);
  const emailMembers = alreadyMailed
    ? false
    : (emailChoice ?? defaultEmailMembers({ mode, kind, alreadyMailed }));

  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (
          emailMembers &&
          !confirm(
            "Kaydedilince, gönderi yayındaysa pazarlama izni olan TÜM üyelere bir kez kampanya e-postası gidecek. Bu işlem geri alınamaz. Devam edilsin mi?",
          )
        ) {
          e.preventDefault();
        }
      }}
      className="grid gap-4"
    >
      <Card>
        <div className="grid gap-4">
          <Field label="Tür" hint="Kartın üstünde küçük etiket olarak görünür.">
            <Select
              name="kind"
              value={kind}
              onChange={(e) => {
                if (isAppPostKind(e.target.value)) setKind(e.target.value);
              }}
            >
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

          <Field
            label="Bağlantı yazısı"
            hint="Örn. Detaylar. Boşsa buton görünmez."
          >
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
            hint="Boşsa hemen yayına girer. Saat İstanbul saatidir."
          >
            <TextInput
              type="datetime-local"
              name="startsAt"
              defaultValue={toDateTimeLocalInput(defaults?.startsAt ?? "")}
            />
          </Field>

          <Field
            label="Bitiş"
            hint="Boşsa süresiz kalır. Tarih geçince kart kendiliğinden düşer."
          >
            <TextInput
              type="datetime-local"
              name="endsAt"
              defaultValue={toDateTimeLocalInput(defaults?.endsAt ?? "")}
            />
          </Field>
        </div>
      </Card>

      <Card>
        <Field
          label="Üyelere e-posta"
          hint={
            alreadyMailed
              ? undefined
              : `Kaydedildiğinde gönderi yayındaysa ve yayın penceresi açıksa, pazarlama izni olan üyelere bir kez “Duyuru” şablonuyla gider; sonraki kayıtlar yeniden göndermez. İleri tarihli gönderiler yayına girdiğinde otomatik mail çıkmaz — yayına girince “Kampanya e-postası” sayfasından gönder.${
                  mode === "edit"
                    ? " Düzenlemede kutu kapalı başlar: bu gönderi için e-posta istiyorsan bilerek işaretle."
                    : ""
                }`
          }
        >
          <Checkbox
            name="emailMembers"
            label={
              mode === "edit"
                ? "Bu kayıtla pazarlama izni olan üyelere bir kez e-posta gönder"
                : "Yayınlanınca pazarlama izni olan üyelere e-posta gönder"
            }
            checked={emailMembers}
            disabled={alreadyMailed}
            onChange={(e) => setEmailChoice(e.target.checked)}
          />
        </Field>
        {alreadyMailed && (
          <p className="text-xs text-[var(--admin-text-mute)]">
            Bu gönderi için kampanya e-postası zaten oluşturuldu; sonraki
            kayıtlar yeniden göndermez.{" "}
            <Link
              href={`/admin/bulten/kampanya/${defaults?.emailCampaignId}`}
              className="underline"
            >
              Kampanyayı aç
            </Link>
          </p>
        )}
      </Card>

      <div>
        <PrimaryButton type="submit">{submitLabel}</PrimaryButton>
      </div>
    </form>
  );
}
