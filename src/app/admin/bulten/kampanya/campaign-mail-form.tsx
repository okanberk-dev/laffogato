"use client";

import { useActionState, useRef, useState } from "react";

import {
  PANEL_ACTION_FAILED,
  useHandPost,
  withPanelCatch,
} from "@/components/admin/action-form";
import { FormError, FormSuccess } from "@/components/admin/form-feedback";
import { DateTimeField } from "@/components/admin/ui/date-time-field";
import {
  Card,
  Field,
  PrimaryButton,
  Select,
  Textarea,
  TextInput,
} from "@/components/admin/forms";
import {
  savedAnswer,
  useUnsavedGuard,
} from "@/components/admin/ui/unsaved-guard";
import {
  SummaryRows,
  useWizard,
  WizardFrame,
  type WizardStep,
} from "@/components/admin/ui/wizard";
import {
  CAMPAIGN_MAIL_APP_LINKS_MISSING,
  CAMPAIGN_MAIL_AUDIENCE_LABELS,
  CAMPAIGN_MAIL_GROUPS,
  CAMPAIGN_MAIL_TEMPLATE_LABELS,
  CAMPAIGN_MAIL_TEMPLATES,
  campaignMailAudienceFor,
  campaignMailAudiencesFor,
  campaignMailHasFields,
  campaignMailTemplateAvailable,
  isCampaignMailAudience,
  isCampaignMailTemplate,
  type CampaignMailField,
} from "@/lib/admin/campaign-mail-schema";
import type { CampaignAudience } from "@/lib/email/campaigns";
import type { CampaignTemplateName } from "@/lib/email/send";

import type { CampaignMailState } from "./actions";

export interface CampaignMailDefaults {
  template?: CampaignTemplateName;
  audience?: CampaignAudience;
  fields?: Record<string, string>;
  /**
   * `YYYY-AA-GGTSS:DD` in Istanbul wall time - what a `datetime-local` input
   * reads and writes. The server turns it into an instant; the page turns the
   * stored instant back into one of these (`scheduledAtInputValue`).
   */
  scheduledAt?: string;
}

const initial: CampaignMailState = {};

/**
 * The campaign composer. One form, eight layouts: the template select decides
 * which `[ALAN]` inputs are shown, and the values are kept in state rather
 * than in the DOM so switching template does not lose what was typed into a
 * field the next template also has (a title, a button label).
 *
 * Constants come from campaign-mail-schema, never from the e-mail modules:
 * those start with `server-only` and reach the database, and importing them
 * from a client component fails the build.
 *
 * `appLinksReady` is the page's `hasAppLinks()`: read on the server at
 * request time, so the app announcement opens up the moment both store URLs
 * are set, without trusting what a client bundle was built with.
 */
export function CampaignMailForm({
  action,
  defaults,
  submitLabel,
  appLinksReady = false,
  mode = "page",
}: {
  action: (
    prev: CampaignMailState,
    formData: FormData,
  ) => Promise<CampaignMailState>;
  defaults?: CampaignMailDefaults;
  submitLabel: string;
  appLinksReady?: boolean;
  /**
   * "wizard" for a new campaign (layout and audience, content, summary;
   * ui/wizard.tsx), "page" for a draft being edited.
   */
  mode?: "wizard" | "page";
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [template, setTemplate] = useState<CampaignTemplateName>(
    defaults?.template ?? "kampanya-duyuru",
  );
  const contentFields = CAMPAIGN_MAIL_GROUPS[template].flatMap((g) =>
    g.fields.map((f) => f.key),
  );
  const wizard = useWizard({
    steps: [
      { id: 1, fields: ["template", "audience", "scheduledAt"] },
      { id: 2, fields: contentFields },
      { id: 3, fields: [] },
    ],
    formRef,
    enabled: mode === "wizard",
  });
  // Posted by hand, and a throw is an answer: the old `<form action>` sent a
  // second click while the first was still saving, and a database hiccup
  // replaced the whole composer with the error page.
  const save = withPanelCatch(action, () => ({ error: PANEL_ACTION_FAILED }));
  // Its answers carry one message (no field errors): it stays above the
  // buttons, on the step the operator is on.
  const [state, formAction, pending] = useActionState(save, initial);
  const post = useHandPost(formAction, pending, {
    beforeSubmit: wizard.beforeSubmit,
  });
  // Leaving the composer with edits not saved asks (a link, the palette, a
  // reload). "Taslağı kaydet" answers in place, and what it posted is then
  // the saved state; "Taslağı oluştur" redirects, and the page is gone.
  useUnsavedGuard(formRef, { saved: savedAnswer(state) });
  // Clamped to what the template allows: a draft stored before the gate
  // must open editable, not locked on a value the server refuses.
  const [audience, setAudience] = useState<CampaignAudience>(() =>
    campaignMailAudienceFor(
      defaults?.template ?? "kampanya-duyuru",
      defaults?.audience,
    ),
  );
  const [values, setValues] = useState<Record<string, string>>(
    defaults?.fields ?? {},
  );
  const [scheduledAt, setScheduledAt] = useState(defaults?.scheduledAt ?? "");

  const setValue = (key: string, value: string) =>
    setValues((prev) => ({ ...prev, [key]: value }));

  // The audiences this template may go to; a kampanya-* layout tells the
  // reader it is members-only, so members is all it is offered.
  const audiences = campaignMailAudiencesFor(template);
  const membersOnly = audiences.length === 1;

  const settingsFields = (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Şablon"
          hint="Yerleşimi seçer; alanlar seçime göre değişir."
        >
          <Select
            name="template"
            value={template}
            onChange={(e) => {
              const next = e.target.value;
              if (!isCampaignMailTemplate(next)) return;
              setTemplate(next);
              setAudience(campaignMailAudienceFor(next, audience));
            }}
          >
            {CAMPAIGN_MAIL_TEMPLATES.map((t) => {
              const available = campaignMailTemplateAvailable(t, appLinksReady);
              return (
                // A stored draft keeps its own template selectable, so the
                // select never shows a value it cannot hold.
                <option
                  key={t}
                  value={t}
                  disabled={!available && t !== template}
                >
                  {CAMPAIGN_MAIL_TEMPLATE_LABELS[t]}
                  {available ? "" : " (mağaza bağlantıları bekleniyor)"}
                </option>
              );
            })}
          </Select>
          {!campaignMailTemplateAvailable(template, appLinksReady) && (
            <p className="mt-2 text-xs text-[var(--admin-warning)]">
              {CAMPAIGN_MAIL_APP_LINKS_MISSING}
            </p>
          )}
        </Field>

        <Field
          label="Kitle"
          hint={
            membersOnly
              ? "Bu şablon “Yalnız L'Affogato üyelerine özel” der; pazarlama tercihi ve 6563 onayı olan üyelere gider. Bülten abonelerine “Bülten” şablonunu kullan."
              : "Üyelerden yalnız bülten tercihi açık ve bülten onayı kayıtlı olanlar alır."
          }
        >
          <Select
            name="audience"
            value={audience}
            disabled={membersOnly}
            onChange={(e) => {
              if (isCampaignMailAudience(e.target.value)) {
                setAudience(e.target.value);
              }
            }}
          >
            {audiences.map((a) => (
              <option key={a} value={a}>
                {CAMPAIGN_MAIL_AUDIENCE_LABELS[a]}
              </option>
            ))}
          </Select>
          {membersOnly && (
            // A disabled select is not submitted; the value travels here.
            <input type="hidden" name="audience" value={audience} />
          )}
        </Field>
      </div>

      <div className="mt-4">
        <Field
          label="Gönderim zamanı"
          hint="Boş bırakırsan kampanya yalnız “Gönder”e bastığında çıkar. Bir tarih-saat yazarsan zamanı geldikten sonraki ilk görev turu onu kendisi kuyruğa alır: bu genelde birkaç saat içindedir, tam o dakikada değil. Belli bir sabah çıkması gerekiyorsa (Anneler Günü, yılbaşı, 14 Şubat) saati birkaç saat öne kur; panelin başında olmana gerek kalmaz. Saat İstanbul saatidir; bir taslak kaydedildiği andan itibaren geçerlidir."
        >
          <DateTimeField
            name="scheduledAt"
            aria-label="Gönderim tarihi ve saati"
            value={scheduledAt}
            onChange={setScheduledAt}
          />
        </Field>
        {scheduledAt && (
          <p className="mt-2 text-xs text-[var(--admin-warning)]">
            Zamanı geldikten sonra birkaç saat içinde kampanya{" "}
            <strong>kendiliğinden</strong> gider; içeriğin tamam olduğundan emin
            ol. Vazgeçersen bu alanı boşaltıp taslağı yeniden kaydet.
          </p>
        )}
      </div>
    </>
  );
  const content = (
    <>
      {!campaignMailHasFields(template) && (
        <Card>
          <h3 className="mb-1 text-sm font-semibold text-[var(--admin-text)]">
            Sabit metin
          </h3>
          <p className="text-xs text-[var(--admin-text-mute)]">
            Bu şablonun doldurulacak alanı yok: konu, metin ve mağaza
            bağlantıları şablondan, damga hedefi mobil uygulama ayarlarından
            gelir. Taslağı kaydettikten sonra önizlemeden kontrol et.
          </p>
        </Card>
      )}

      {CAMPAIGN_MAIL_GROUPS[template].map((group) => (
        <Card key={`${template}:${group.title}`}>
          <h3 className="mb-1 text-sm font-semibold text-[var(--admin-text)]">
            {group.title}
          </h3>
          {group.hint && (
            <p className="mb-4 text-xs text-[var(--admin-text-mute)]">
              {group.hint}
            </p>
          )}
          <div className="mt-3 grid gap-4">
            {group.fields.map((f) => (
              <FieldInput
                key={f.key}
                field={f}
                value={values[f.key] ?? ""}
                onChange={(v) => setValue(f.key, v)}
              />
            ))}
          </div>
        </Card>
      ))}
    </>
  );

  if (wizard.enabled) {
    const filled = contentFields.filter((k) => (values[k] ?? "").trim());
    const missing = CAMPAIGN_MAIL_GROUPS[template]
      .flatMap((g) => g.fields)
      .filter((f) => f.required && !(values[f.key] ?? "").trim())
      .map((f) => f.label);
    const steps: WizardStep[] = [
      {
        id: 1,
        title: "Şablon ve kitle",
        fields: ["template", "audience", "scheduledAt"],
        body: <div className="grid gap-4">{settingsFields}</div>,
      },
      {
        id: 2,
        title: "İçerik",
        fields: contentFields,
        body: (
          <div className="grid gap-4 [&_.rounded-3xl]:bg-[var(--admin-surface)]">
            {content}
            <p className="text-xs text-[var(--admin-text-mute)]">
              * işaretli alanlar bu şablonda zorunludur; eksik kalırsa
              &ldquo;Gönder&rdquo; alanın adıyla reddeder.
            </p>
          </div>
        ),
      },
      {
        id: 3,
        title: "Özet",
        summary: true,
        body: (
          <div className="grid gap-5">
            <SummaryRows
              wizard={wizard}
              rows={[
                {
                  label: "Şablon",
                  value: CAMPAIGN_MAIL_TEMPLATE_LABELS[template],
                  step: 1,
                },
                {
                  label: "Kitle",
                  value: CAMPAIGN_MAIL_AUDIENCE_LABELS[audience],
                  step: 1,
                },
                {
                  label: "Gönderim zamanı",
                  value: scheduledAt
                    ? `${scheduledAt.replace("T", " ")} (İstanbul), kendiliğinden`
                    : "Elle: taslağın sayfasında “Gönder”",
                  step: 1,
                },
                {
                  label: "Doldurulan alan",
                  value: campaignMailHasFields(template)
                    ? `${filled.length} / ${contentFields.length}`
                    : "Şablonun sabit metni",
                  step: 2,
                },
                {
                  label: "Eksik zorunlu alan",
                  value: missing.length ? missing.join(", ") : "Yok",
                  step: 2,
                },
              ]}
            />
            <p className="rounded-xl bg-[var(--admin-surface-2)] px-3.5 py-3 text-sm text-[var(--admin-text-soft)]">
              Taslak olarak kaydedilir; hiçbir şey gönderilmez. Önizleme, test
              gönderimi ve asıl gönderim taslağın kendi sayfasındadır. Ticari
              e-posta yalnız İYS&apos;de onayı görünen adrese gider.
            </p>
          </div>
        ),
      },
    ];
    return (
      <form
        ref={formRef}
        action={post.action}
        onSubmit={post.onSubmit}
        onKeyDown={wizard.onKeyDown}
        noValidate
        className="grid gap-4 [&>*]:min-w-0"
      >
        <WizardFrame
          wizard={wizard}
          steps={steps}
          formError={state.error}
          cancelHref="/admin/bulten/kampanya"
          submitLabel={submitLabel}
          pendingLabel="Kaydediliyor…"
          pending={pending}
          label="Yeni kampanya adımları"
        />
      </form>
    );
  }

  return (
    <form
      ref={formRef}
      action={post.action}
      onSubmit={post.onSubmit}
      className="grid gap-4"
    >
      <Card>{settingsFields}</Card>

      {content}

      <p className="text-xs text-[var(--admin-text-mute)]">
        * işaretli alanlar bu şablonda zorunludur; eksik kalırsa
        &ldquo;Gönder&rdquo; alanın adıyla reddeder.
      </p>

      {/* The save bar has a ground of its own (admin audit PEO-12), as the
          site-text form's: without one, the fields scrolled visibly under
          the button and the answer pill, a quarter of a phone screen. The
          answer is a block with its role, not a pill. Above the phone's
          bottom bar (--admin-bottom-inset, layout.tsx), not under it. */}
      <div
        data-sticky-save-bar
        className="sticky bottom-[calc(1rem+var(--admin-bottom-inset,0px))] z-10 flex flex-col gap-3 rounded-2xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-3 shadow-[0_8px_24px_rgba(28,25,23,0.14)] sm:flex-row sm:items-center"
      >
        <div className="shrink-0">
          <PrimaryButton type="submit" disabled={pending}>
            {pending ? "Kaydediliyor…" : submitLabel}
          </PrimaryButton>
        </div>
        {/* Beside the button from sm up, so the bar stays one row tall. */}
        <div className="min-w-0 flex-1 empty:hidden">
          <FormError message={state.error} />
          <FormSuccess message={state.error ? undefined : state.message} />
        </div>
      </div>
    </form>
  );
}

/**
 * No browser `required`: the star in the label says what "Gönder" will
 * insist on, but a half-written draft must still save (the footnote and
 * `parseDraft` promise so). The render at "Gönder" is the gate, and it
 * names the field. The one exception is the title, which even a draft
 * needs (campaigns.ts `fieldsShape`): the wizard stops on its step instead
 * of sending a draft the server refuses.
 */
const DRAFT_REQUIRED: ReadonlySet<string> = new Set(["KAMPANYA_BASLIK"]);

function FieldInput({
  field,
  value,
  onChange,
}: {
  field: CampaignMailField;
  value: string;
  onChange: (value: string) => void;
}) {
  const label = field.required ? `${field.label} *` : field.label;
  if (field.kind === "textarea") {
    return (
      <Field label={label} hint={field.hint}>
        <Textarea
          name={field.key}
          required={DRAFT_REQUIRED.has(field.key)}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          maxLength={field.max}
          rows={4}
          placeholder={field.placeholder}
        />
      </Field>
    );
  }
  return (
    <Field label={label} hint={field.hint}>
      <TextInput
        name={field.key}
        type={field.kind === "url" ? "url" : "text"}
        required={DRAFT_REQUIRED.has(field.key)}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        maxLength={field.max}
        placeholder={field.placeholder}
      />
    </Field>
  );
}
