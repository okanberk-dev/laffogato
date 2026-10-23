"use client";

import { useActionState, useRef, useState } from "react";

import type { PromoActionState } from "@/app/admin/promosyon/actions";
import type { AdminPromo } from "@/lib/admin/store";
import { toDateTimeLocalInput } from "@/lib/admin/publish-window";

import {
  PANEL_ACTION_FAILED,
  useHandPost,
  withPanelCatch,
} from "./action-form";
import { FieldErrorText, useFieldErrors } from "./form-feedback";
import { Checkbox, Field, Select, TextInput } from "./forms";
import { useUnsavedGuard } from "./ui/unsaved-guard";
import { DateTimeField } from "./ui/date-time-field";
import {
  formText,
  SummaryRows,
  useWizard,
  WizardFrame,
  type WizardStep,
} from "./ui/wizard";

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
  /** "wizard" for a new code (steps and a summary), "page" for an edit. */
  mode?: "wizard" | "page";
}

const STEP_FIELDS = [
  { id: 1, fields: ["code", "kind", "valuePct", "valueFixed"] },
  { id: 2, fields: ["minSubtotal", "usageLimit", "expiresAt", "isActive"] },
  { id: 3, fields: [] },
] as const;

/**
 * New and edit promo code. Posted by hand (useHandPost): a refused save
 * used to reset the form, so "Bu kod zaten kullanılıyor." put the value back
 * to 10, the limit to 0 (unlimited), the expiry to never and the code back
 * on, and only the empty code field showed it.
 *
 * A new code is a wizard (ui/wizard.tsx): the code and its discount, its
 * rules, a summary of what the customer gets. An edit is one page.
 */
export function PromoForm({
  promo,
  action,
  submitLabel,
  expired = false,
  mode = "page",
}: Props) {
  const formRef = useRef<HTMLFormElement>(null);
  const wizard = useWizard({
    steps: STEP_FIELDS,
    formRef,
    enabled: mode === "wizard",
    validate: (id, form): Record<string, string> => {
      if (id !== 1) return {};
      const kindNow = (form.elements.namedItem("kind") as HTMLSelectElement)
        ?.value;
      const pct = (form.elements.namedItem("valuePct") as HTMLInputElement)
        ?.value;
      if (kindNow === "pct" && !/^(100|[1-9]\d?)$/.test((pct ?? "").trim())) {
        return { valuePct: "Yüzde 1-100 arası tam sayı olmalı." };
      }
      return {};
    },
  });
  const save = withPanelCatch(action, (prev: PromoActionState) => ({
    ...prev,
    error: PANEL_ACTION_FAILED,
  }));
  const [state, formAction, pending] = useActionState(
    async (prev: PromoActionState, formData: FormData) => {
      const next = await save(prev, formData);
      wizard.openErrors(next.fieldErrors);
      return next;
    },
    initial,
  );
  const post = useHandPost(formAction, pending, {
    beforeSubmit: wizard.beforeSubmit,
  });
  // A save redirects to the list; a refusal stays and stays guarded.
  useUnsavedGuard(formRef);
  const errorId = useFieldErrors(formRef, state);
  const [kind, setKind] = useState<"pct" | "fixed">(promo?.kind ?? "pct");

  const fe = (k: string) => state.fieldErrors?.[k] ?? wizard.clientErrors[k];
  const err = (k: string) => <FieldErrorText id={errorId(k)} message={fe(k)} />;

  const discount = (values: FormData | null) => {
    if (formText(values, "kind") === "fixed") {
      return `${formText(values, "valueFixed") || "-"} TL indirim`;
    }
    return `%${formText(values, "valuePct") || "-"} indirim`;
  };
  const money = (v: string) => (v && !/^0+([.,]0+)?$/.test(v) ? `${v} TL` : "");

  const steps: WizardStep[] = [
    {
      id: 1,
      title: "Kod ve indirim",
      fields: STEP_FIELDS[0].fields,
      body: (
        <div className="grid gap-5">
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
                onChange={(e) => {
                  setKind(e.target.value as "pct" | "fixed");
                  wizard.clearError("valuePct");
                }}
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
                    onChange={() => wizard.clearError("valuePct")}
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
        </div>
      ),
    },
    {
      id: 2,
      title: "Kurallar",
      fields: STEP_FIELDS[1].fields,
      body: (
        <div className="grid gap-5">
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
                label="Son geçerlilik (isteğe bağlı)"
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
                    promo?.expiresAt
                      ? toDateTimeLocalInput(promo.expiresAt)
                      : ""
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
        </div>
      ),
    },
    {
      id: 3,
      title: "Özet",
      summary: true,
      body: (values) => (
        <div className="grid gap-5">
          <SummaryRows
            wizard={wizard}
            rows={[
              {
                label: "Kod",
                // As the store saves it (normalizeCode): "indirim 10" is
                // INDIRIM10, the code a customer types.
                value: formText(values, "code")
                  .trim()
                  .toUpperCase()
                  .replace(/\s+/g, ""),
                step: 1,
              },
              { label: "İndirim", value: discount(values), step: 1 },
              {
                label: "Minimum sepet",
                value: money(formText(values, "minSubtotal")) || "Yok",
                step: 2,
              },
              {
                label: "Kullanım limiti",
                value:
                  Number(formText(values, "usageLimit") || 0) > 0
                    ? `${formText(values, "usageLimit")} sipariş`
                    : "Sınırsız",
                step: 2,
              },
              {
                label: "Son geçerlilik",
                value:
                  formText(values, "expiresAt").replace("T", " ") || "Süresiz",
                step: 2,
              },
              {
                label: "Durum",
                value: values?.get("isActive") ? "Aktif" : "Pasif",
                step: 2,
              },
            ]}
          />
          <p className="rounded-lg bg-[var(--admin-surface-2)] px-3.5 py-3 text-sm text-[var(--admin-text-soft)]">
            Kod kaydedilince {'"'}Aktif{'"'} ise müşteri sepette hemen
            kullanabilir. Kodun benzersizliği ve tutar sınırları kaydederken
            denetlenir.
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
      noValidate={wizard.enabled}
      className="grid gap-5 [&>*]:min-w-0"
    >
      <WizardFrame
        wizard={wizard}
        steps={steps}
        serverErrors={state.fieldErrors}
        formError={state.error}
        cancelHref="/admin/promosyon"
        submitLabel={submitLabel}
        pendingLabel="Kaydediliyor…"
        pending={pending}
        label="Promosyon kodu adımları"
      />
    </form>
  );
}
