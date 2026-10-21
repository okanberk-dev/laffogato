"use client";

import Link from "next/link";
import { useActionState, useRef, useState } from "react";

import type { PromoActionState } from "@/app/admin/promosyon/actions";
import type { AdminPromo } from "@/lib/admin/store";
import { toDateTimeLocalInput } from "@/lib/admin/publish-window";

import {
  PANEL_ACTION_FAILED,
  useHandPost,
  withPanelCatch,
} from "./action-form";
import { FieldErrorText, FormError, useFieldErrors } from "./form-feedback";
import {
  Card,
  Checkbox,
  Field,
  PrimaryButton,
  Select,
  TextInput,
} from "./forms";
import { BUTTON } from "./ui";
import { DateTimeField } from "./ui/date-time-field";

const initial: PromoActionState = {};

interface Props {
  promo?: AdminPromo;
  action: (
    prev: PromoActionState,
    formData: FormData,
  ) => Promise<PromoActionState>;
  submitLabel: string;
  /** The edited code's expiry has passed (the edit page reads the clock). */
  expired?: boolean;
}

/**
 * New and edit promo code. Posted by hand (useHandPost): a refused save
 * used to reset the form, so "Bu kod zaten kullanılıyor." put the value back
 * to 10, the limit to 0 (unlimited), the expiry to never and the code back
 * on, and only the empty code field showed it.
 */
export function PromoForm({
  promo,
  action,
  submitLabel,
  expired = false,
}: Props) {
  const [state, formAction, pending] = useActionState(
    withPanelCatch(action, (prev) => ({ ...prev, error: PANEL_ACTION_FAILED })),
    initial,
  );
  const post = useHandPost(formAction, pending);
  const formRef = useRef<HTMLFormElement>(null);
  const errorId = useFieldErrors(formRef, state);
  const [kind, setKind] = useState<"pct" | "fixed">(promo?.kind ?? "pct");

  const fe = (k: string) => state.fieldErrors?.[k];
  const err = (k: string) => <FieldErrorText id={errorId(k)} message={fe(k)} />;

  return (
    <form
      ref={formRef}
      action={post.action}
      onSubmit={post.onSubmit}
      className="grid gap-5"
    >
      <Card className="grid gap-5">
        <div className="grid gap-1.5">
          <Field
            label="Kod"
            hint="Müşterinin sepete gireceği kod. Büyük harfe çevrilir."
          >
            <TextInput
              name="code"
              defaultValue={promo?.code ?? ""}
              placeholder="SUMMER25"
              required
            />
          </Field>
          {err("code")}
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="İndirim tipi">
            <Select
              name="kind"
              value={kind}
              onChange={(e) => setKind(e.target.value as "pct" | "fixed")}
            >
              <option value="pct">% Yüzde</option>
              <option value="fixed">Sabit tutar (₺)</option>
            </Select>
          </Field>
          {kind === "pct" ? (
            <div className="grid gap-1.5">
              <Field label="Yüzde" hint="1-100 arası tam sayı.">
                <TextInput
                  name="valuePct"
                  inputMode="numeric"
                  defaultValue={
                    promo && promo.kind === "pct" ? String(promo.value) : "10"
                  }
                  required
                />
              </Field>
              {err("valuePct")}
            </div>
          ) : (
            <div className="grid gap-1.5">
              <Field label="Tutar (₺)" hint="En fazla 2.000 TL.">
                <TextInput
                  name="valueFixed"
                  inputMode="decimal"
                  defaultValue={
                    promo && promo.kind === "fixed"
                      ? (promo.value / 100).toFixed(2)
                      : "50,00"
                  }
                  required
                />
              </Field>
              {err("valueFixed")}
            </div>
          )}
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <div className="grid gap-1.5">
            <Field
              label="Minimum sepet (₺)"
              hint="0 = limit yok. Sepet bu tutarın altındaysa kod uygulanmaz."
            >
              <TextInput
                name="minSubtotal"
                inputMode="decimal"
                defaultValue={
                  promo ? (promo.minSubtotalMinor / 100).toFixed(2) : "0,00"
                }
              />
            </Field>
            {err("minSubtotal")}
          </div>
          <div className="grid gap-1.5">
            <Field
              label="Kullanım limiti"
              hint="0 = sınırsız, en fazla 1.000.000. Tüketim her başarılı siparişte 1 artar."
            >
              <TextInput
                name="usageLimit"
                type="number"
                min={0}
                defaultValue={String(promo?.usageLimit ?? 0)}
              />
            </Field>
            {err("usageLimit")}
          </div>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <div className="grid gap-1.5">
            <Field
              label="Son geçerlilik (opsiyonel)"
              hint={
                // An expired code keeps its date through an edit; a blank
                // would bring it back with no end, so say so here.
                expired
                  ? "Süresi doldu, kod sepette kabul edilmez. Tarihe dokunmazsan öyle kalır; ileri bir tarih ya da boş (süresiz) kodu yeniden açar."
                  : "Boş = süresiz. Geçmiş bir tarih kabul edilmez."
              }
            >
              <DateTimeField
                name="expiresAt"
                aria-label="Son geçerlilik tarihi ve saati"
                // The Istanbul wall clock of the stored UTC instant.
                defaultValue={
                  promo?.expiresAt ? toDateTimeLocalInput(promo.expiresAt) : ""
                }
              />
            </Field>
            {err("expiresAt")}
          </div>
          {/* A fieldset, not a label: Field's label around the Checkbox's own
              label nested one label in another. */}
          <Field label="Durum" as="fieldset">
            <Checkbox
              name="isActive"
              label="Aktif (müşteri kullanabilir)"
              defaultChecked={promo?.isActive ?? true}
            />
          </Field>
        </div>

        <FormError message={state.error} />
      </Card>

      <Card className="flex flex-wrap items-center justify-between gap-3">
        {/* One link styled as a button, not a button inside a link (two tab
            stops for one control). */}
        <Link href="/admin/promosyon" className={BUTTON.ghost}>
          Vazgeç
        </Link>
        <PrimaryButton type="submit" disabled={pending}>
          {pending ? "Kaydediliyor…" : submitLabel}
        </PrimaryButton>
      </Card>
    </form>
  );
}
