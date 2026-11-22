"use client";

import {
  ActionForm,
  FormFieldError,
  FormMessage,
  SubmitButton,
} from "@/components/admin/action-form";
import { Field, TextInput } from "@/components/admin/forms";
import { ImageUpload } from "@/components/admin/image-upload";
import { ActionModal } from "@/components/admin/ui";
import type { SiteImageSlot } from "@/lib/admin/site-images-core";

import { resetSiteImageAction, saveSiteImageAction } from "./actions";

/**
 * One slot: what the site shows now, where, and a new picture and its alt
 * text. "Varsayılana dön" only when the panel has an upload for it.
 */
export function SiteImageCard({
  slot,
  current,
  uploaded,
  alt,
}: {
  slot: SiteImageSlot;
  /** What the site shows now (an upload's path or the bundled photo). */
  current: string;
  /** The stored upload's served path, for the uploader's preview; "" = none. */
  uploaded: string;
  /** The panel's alt text; "" = the slot's own. */
  alt: string;
}) {
  return (
    <div className="grid gap-4 rounded-2xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4 sm:grid-cols-[200px_minmax(0,1fr)]">
      <div className="grid content-start gap-2">
        <div className="aspect-[4/3] overflow-hidden rounded-xl bg-[var(--admin-panel)]">
          {current ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={current}
              alt=""
              className="h-full w-full object-cover"
              loading="lazy"
            />
          ) : (
            <div className="grid h-full place-items-center text-xs text-[var(--admin-text-mute)]">
              Fotoğraf yok
            </div>
          )}
        </div>
        <p className="text-xs text-[var(--admin-text-mute)]">
          {uploaded ? "Panelden yüklenen" : "Sitenin kendi fotoğrafı"} ·{" "}
          {slot.ratio}
        </p>
      </div>
      <div className="grid content-start gap-3">
        <div>
          <h3 className="text-sm font-semibold text-[var(--admin-text)]">
            {slot.label}
          </h3>
          <p className="text-xs text-[var(--admin-text-mute)]">{slot.where}</p>
        </div>
        <ActionForm action={saveSiteImageAction} className="grid gap-3">
          <input type="hidden" name="key" value={slot.key} />
          <Field
            label="Yeni fotoğraf"
            hint="Seçtiğin fotoğraf kaydedince sitede bu alanın yerine geçer. Fotoğrafı kaldırıp kaydedersen site kendi fotoğrafına döner."
          >
            <ImageUpload
              name="image"
              max={1}
              initial={uploaded ? [uploaded] : []}
            />
          </Field>
          <FormFieldError name="image" />
          <Field
            label="Açıklama (ekran okuyucu için)"
            hint={
              slot.alt
                ? `Boş bırakırsan: "${slot.alt}"`
                : "Süs fotoğrafıysa boş bırak."
            }
          >
            <TextInput name="alt" defaultValue={alt} maxLength={160} />
          </Field>
          <FormMessage />
          <div className="flex flex-wrap items-center gap-2">
            <SubmitButton>Kaydet</SubmitButton>
            {uploaded ? (
              <ActionModal
                action={resetSiteImageAction}
                title="Sitenin kendi fotoğrafına dön"
                description={`"${slot.label}" alanındaki yüklenen fotoğraf kaldırılır; site kendi fotoğrafını gösterir.`}
                trigger="Varsayılana dön"
                triggerVariant="ghost"
                submitLabel="Dön"
                hidden={{ key: slot.key }}
                size="sm"
              />
            ) : null}
          </div>
        </ActionForm>
      </div>
    </div>
  );
}
