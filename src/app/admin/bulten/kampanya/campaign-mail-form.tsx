"use client";

import { useActionState, useState } from "react";

import {
  Card,
  Field,
  PrimaryButton,
  Select,
  Textarea,
  TextInput,
} from "@/components/admin/forms";
import {
  CAMPAIGN_MAIL_AUDIENCE_LABELS,
  CAMPAIGN_MAIL_GROUPS,
  CAMPAIGN_MAIL_TEMPLATE_LABELS,
  CAMPAIGN_MAIL_TEMPLATES,
  campaignMailAudienceFor,
  campaignMailAudiencesFor,
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
 */
export function CampaignMailForm({
  action,
  defaults,
  submitLabel,
}: {
  action: (
    prev: CampaignMailState,
    formData: FormData,
  ) => Promise<CampaignMailState>;
  defaults?: CampaignMailDefaults;
  submitLabel: string;
}) {
  const [state, formAction, pending] = useActionState(action, initial);
  const [template, setTemplate] = useState<CampaignTemplateName>(
    defaults?.template ?? "kampanya-duyuru",
  );
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

  const setValue = (key: string, value: string) =>
    setValues((prev) => ({ ...prev, [key]: value }));

  // The audiences this template may go to; a kampanya-* layout tells the
  // reader it is members-only, so members is all it is offered.
  const audiences = campaignMailAudiencesFor(template);
  const membersOnly = audiences.length === 1;

  return (
    <form action={formAction} className="grid gap-4">
      <Card>
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
              {CAMPAIGN_MAIL_TEMPLATES.map((t) => (
                <option key={t} value={t}>
                  {CAMPAIGN_MAIL_TEMPLATE_LABELS[t]}
                </option>
              ))}
            </Select>
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
      </Card>

      {CAMPAIGN_MAIL_GROUPS[template].map((group) => (
        <Card key={`${template}:${group.title}`}>
          <h3 className="mb-1 text-sm font-medium tracking-widest text-neutral-500 uppercase">
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

      <div className="sticky bottom-4 flex flex-wrap items-center gap-3">
        <PrimaryButton type="submit" disabled={pending}>
          {pending ? "Kaydediliyor…" : submitLabel}
        </PrimaryButton>
        {state.message && (
          <span className="rounded-full bg-emerald-50 px-3 py-1 text-sm text-emerald-700">
            {state.message}
          </span>
        )}
        {state.error && (
          <span className="rounded-full bg-red-50 px-3 py-1 text-sm text-red-700">
            {state.error}
          </span>
        )}
        <span className="text-xs text-[var(--admin-text-mute)]">
          * işaretli alanlar bu şablonda zorunludur; eksik kalırsa
          &ldquo;Gönder&rdquo; alanın adıyla reddeder.
        </span>
      </div>
    </form>
  );
}

/**
 * No browser `required`: the star in the label says what "Gönder" will
 * insist on, but a half-written draft must still save (the footnote and
 * `parseDraft` promise so). The render at "Gönder" is the gate, and it
 * names the field.
 */
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
        value={value}
        onChange={(e) => onChange(e.target.value)}
        maxLength={field.max}
        placeholder={field.placeholder}
      />
    </Field>
  );
}
