"use client";

import { useState } from "react";

import { GuardedActionForm } from "@/components/admin/guarded-action-form";
import { WizardAutoSummary } from "@/components/admin/ui/wizard";
import { WizardActionForm } from "@/components/admin/wizard-action-form";
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
import Link from "@/components/link";
import {
  APP_POST_KIND_LABELS,
  APP_POST_KINDS,
  type AppPostKind,
} from "@/lib/admin/app-content-schema";
import { defaultEmailMembers } from "@/lib/admin/post-mail-default";
import { toDateTimeLocalInput } from "@/lib/admin/publish-window";

import { FieldRow, FormActions } from "../app-content-ui";
import { ConfirmDialog } from "../confirm-dialog";
import { createMailGate, postMailConfirm } from "./post-mail-confirm";

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
 * Editor for the app's home post strip - campaigns, collaborations, events.
 *
 * Unlike the hero slide editor this one HAS a picture and HAS an outward link,
 * because that is what a collaboration post is. Both are constrained:
 *
 * 1. The image is a URL, not an upload. The app fetches and caches it, so a
 *    4 MB data: URL in a database row would be paid for on every phone, every
 *    time the home screen loads.
 * 2. The link must be https. The store re-checks this with `new URL` on save,
 *    so a `javascript:` or `data:` destination is stored as empty rather than
 *    reaching a phone - this is the one field where panel text becomes
 *    somewhere a customer's browser goes.
 *
 * The "e-posta" box is the automatic campaign mail (docs/EMAIL-RESEND.md §7):
 * on by default only when a campaign post is being created; off on every
 * edit (`defaultEmailMembers` says why) and locked off once the post has had
 * its mail - the mark on the post is what actually prevents a second send;
 * the box just says so. Ticked, the submit asks first in a dialog that
 * names how many members it reaches, with the number typed back: it is a
 * commercial send to the whole member base, the same step as "Gönder" on
 * the Kampanya e-postası page (decision D15). Without the `newsletter` role
 * (`canEmail`, decision D27) the box is off and says why; the action checks
 * the role again.
 *
 * Posted through ActionForm: a refusal shows under its field and keeps what
 * was typed, and a second press before the answer creates no second post
 * (and no second confirm). The box and "Yayında" are fieldsets: inside a
 * Field's label, a tap on the long hint switched the member mail off.
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
  canEmail = true,
  recipientCount = null,
}: {
  action: ModalAction;
  defaults?: AppPostDefaults;
  /** Create starts the box ticked for a campaign; edit never does. */
  mode: "create" | "edit";
  submitLabel: string;
  /** The signed-in role may send commercial mail (`newsletter`). */
  canEmail?: boolean;
  /**
   * Members with marketing consent now, for the mail dialog (the count the
   * enqueue reads); null when it could not be counted.
   */
  recipientCount?: number | null;
}) {
  const alreadyMailed = Boolean(defaults?.emailCampaignId);
  const [kind, setKind] = useState<AppPostKind>(defaults?.kind ?? "campaign");
  // null = the operator has not touched the box; it then follows the default.
  const [emailChoice, setEmailChoice] = useState<boolean | null>(null);
  const emailMembers =
    alreadyMailed || !canEmail
      ? false
      : (emailChoice ?? defaultEmailMembers({ mode, kind, alreadyMailed }));
  const [gate] = useState(createMailGate);
  const [asking, setAsking] = useState(false);

  const gateCheck = () => {
    if (gate.allows(emailMembers)) return true;
    setAsking(true);
    return false;
  };
  const contentFields = (
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

      <FieldRow name="title">
        <Field label="Başlık" hint="En fazla 80 karakter.">
          <TextInput
            name="title"
            defaultValue={defaults?.title ?? ""}
            maxLength={80}
            required
            placeholder="Sabah ritüeli"
          />
        </Field>
      </FieldRow>

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
  );
  const mediaFields = (
    <div className="grid gap-4">
      <Field
        label="Görsel adresi"
        hint="https ile başlayan tam adres. Boş bırakırsan kart marka zemininde çizilir - bozuk bir görsel yerine kasıtlı bir panel görünür."
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
  );
  const publishFields = (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field label="Sıra" hint="Küçük olan önce görünür.">
        <TextInput
          name="sortOrder"
          type="number"
          min={0}
          defaultValue={String(defaults?.sortOrder ?? 0)}
        />
      </Field>

      <Field as="fieldset" label="Yayında">
        <Checkbox
          name="isActive"
          label="Uygulamada görünsün"
          defaultChecked={defaults?.isActive ?? true}
        />
      </Field>

      <FieldRow name="startsAt">
        <Field
          label="Başlangıç"
          hint="Boşsa hemen yayına girer. Saat İstanbul saatidir."
        >
          <DateTimeField
            name="startsAt"
            aria-label="Başlangıç tarihi ve saati"
            defaultValue={toDateTimeLocalInput(defaults?.startsAt ?? "")}
          />
        </Field>
      </FieldRow>

      <FieldRow name="endsAt">
        <Field
          label="Bitiş"
          hint="Boşsa süresiz kalır. Tarih geçince kart kendiliğinden düşer."
        >
          <DateTimeField
            name="endsAt"
            aria-label="Bitiş tarihi ve saati"
            defaultValue={toDateTimeLocalInput(defaults?.endsAt ?? "")}
          />
        </Field>
      </FieldRow>
    </div>
  );
  const mailField = (
    <>
      <Field
        as="fieldset"
        label="Üyelere e-posta"
        hint={
          alreadyMailed
            ? undefined
            : !canEmail
              ? "Kampanya e-postası göndermek Bülten yetkisi ister (sahip ya da yönetici); gönderi e-postasız kaydedilir."
              : `Kaydedildiğinde gönderi yayındaysa ve yayın penceresi açıksa, pazarlama izni olan üyelere bir kez “Duyuru” şablonuyla gider; sonraki kayıtlar yeniden göndermez. İleri tarihli gönderiler yayına girdiğinde otomatik mail çıkmaz - yayına girince “Kampanya e-postası” sayfasından gönder.${
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
          disabled={alreadyMailed || !canEmail}
          onChange={(e) => setEmailChoice(e.target.checked)}
        />
      </Field>
      {alreadyMailed && (
        <p className="text-xs text-[var(--admin-text-mute)]">
          Bu gönderi için kampanya e-postası zaten oluşturuldu; sonraki kayıtlar
          yeniden göndermez.{" "}
          <Link
            href={`/admin/bulten/kampanya/${defaults?.emailCampaignId}`}
            className="underline"
          >
            Kampanyayı aç
          </Link>
        </p>
      )}
    </>
  );
  const confirm = (
    <>
      {asking ? (
        <ConfirmDialog
          ask={postMailConfirm(recipientCount)}
          onCancel={() => setAsking(false)}
          onConfirm={(form) => {
            setAsking(false);
            if (!form.reportValidity()) return;
            // The yes lets exactly this post through (createMailGate).
            gate.open();
            form.requestSubmit();
          }}
        />
      ) : null}
    </>
  );

  if (mode === "create") {
    return (
      <WizardActionForm
        action={action}
        beforeSubmit={gateCheck}
        className="grid gap-4"
        label="Yeni gönderi adımları"
        cancelHref="/admin/mobil/gonderiler"
        submitLabel={submitLabel}
        steps={[
          {
            id: 1,
            title: "İçerik",
            fields: ["kind", "title", "body"],
            body: contentFields,
          },
          {
            id: 2,
            title: "Görsel ve bağlantı",
            fields: ["image", "linkUrl", "linkLabel"],
            body: mediaFields,
          },
          {
            id: 3,
            title: "Yayın",
            fields: ["sortOrder", "isActive", "startsAt", "endsAt"],
            body: publishFields,
          },
          {
            id: 4,
            title: "Özet",
            summary: true,
            fields: ["emailMembers"],
            body: (
              <div className="grid gap-5">
                <WizardAutoSummary note="Bağlantı ve görsel adresi kaydederken yeniden denetlenir: https olmayan bağlantı boş kaydedilir." />
                <div className="border-t border-[var(--admin-border)] pt-5">
                  {mailField}
                </div>
              </div>
            ),
          },
        ]}
      >
        {confirm}
      </WizardActionForm>
    );
  }

  return (
    <GuardedActionForm
      action={action}
      beforeSubmit={gateCheck}
      className="grid gap-4"
    >
      <Card>{contentFields}</Card>
      <Card>{mediaFields}</Card>
      <Card>{publishFields}</Card>
      <Card>{mailField}</Card>
      <FormActions
        submitLabel={submitLabel}
        backHref="/admin/mobil/gonderiler"
      />
      {confirm}
    </GuardedActionForm>
  );
}
