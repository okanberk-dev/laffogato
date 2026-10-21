"use client";

import { ActionForm } from "@/components/admin/action-form";
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
  APP_ANNOUNCEMENT_KIND_LABELS,
  APP_ANNOUNCEMENT_KINDS,
  type AppAnnouncementKind,
} from "@/lib/admin/app-content-schema";
import { toDateTimeLocalInput } from "@/lib/admin/publish-window";

import { FieldRow, FormActions } from "../app-content-ui";

export interface AppAnnouncementDefaults {
  kind?: AppAnnouncementKind;
  title?: string;
  body?: string;
  sortOrder?: number;
  isActive?: boolean;
  startsAt?: string;
  endsAt?: string;
}

/**
 * Announcements carry no action by design: they say the thing and get out of
 * the way. Anything that needs a tap belongs in a slide, which has room for a
 * call to action and a ground to sit on.
 *
 * Posted through ActionForm: a refusal shows under its field and keeps
 * what was typed, and a second press before the answer creates nothing.
 */
export function AppAnnouncementForm({
  action,
  defaults,
  submitLabel,
}: {
  action: ModalAction;
  defaults?: AppAnnouncementDefaults;
  submitLabel: string;
}) {
  return (
    <ActionForm action={action} className="grid gap-4">
      <Card>
        <div className="grid gap-4">
          <Field
            label="Tür"
            hint="Uygulamada rozet olarak görünür: BİLGİ · YENİ · SAATLER."
          >
            <Select name="kind" defaultValue={defaults?.kind ?? "info"}>
              {APP_ANNOUNCEMENT_KINDS.map((kind) => (
                <option key={kind} value={kind}>
                  {APP_ANNOUNCEMENT_KIND_LABELS[kind]}
                </option>
              ))}
            </Select>
          </Field>

          <FieldRow name="title">
            <Field
              label="Başlık"
              hint="En fazla 80 karakter. Tek satırda okunsun."
            >
              <TextInput
                name="title"
                defaultValue={defaults?.title ?? ""}
                maxLength={80}
                required
                placeholder="Hafta sonu 24:00'e kadar"
              />
            </Field>
          </FieldRow>

          <Field label="Metin" hint="En fazla 200 karakter.">
            <Textarea
              name="body"
              defaultValue={defaults?.body ?? ""}
              maxLength={200}
              rows={3}
            />
          </Field>

          <Field label="Sıra" hint="Küçük sayı önce gösterilir.">
            <TextInput
              name="sortOrder"
              type="number"
              min={0}
              defaultValue={String(defaults?.sortOrder ?? 0)}
            />
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

      <FormActions
        submitLabel={submitLabel}
        backHref="/admin/mobil/duyurular"
      />
    </ActionForm>
  );
}
