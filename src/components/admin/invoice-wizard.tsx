"use client";

import Link from "next/link";
import { useActionState, useId, useRef, useState } from "react";

import { createOrderInvoiceAction } from "@/app/admin/faturalar/actions";
import { runPanelAction } from "@/components/admin/action-form";
import {
  Card,
  Field,
  GhostButton,
  PrimaryButton,
  Textarea,
  TextInput,
  formatTRY,
} from "@/components/admin/forms";
import { BUTTON } from "@/components/admin/ui/styles";
import { useHandPost } from "@/components/admin/ui/submit";
import type { ActionResult } from "@/lib/admin/action-result";
import { PROVINCES, provinceOf } from "@/lib/invoice/address-core";
import type { InvoiceLine } from "@/lib/invoice/invoice-core";
import { cleanTaxOffice, isValidVkn } from "@/lib/invoice/vkn";
import type { KdvRow } from "@/lib/utils/kdv";

import { InvoiceLinesTable, InvoiceTotals } from "./invoice-lines";

/**
 * The order's invoice wizard (`/admin/siparisler/[id]/fatura`, docs/EARSIV.md
 * "Siparişten fatura"): who the invoice is cut to, the billing address, the
 * lines as they go to Paraşüt, and a summary that says what happens next.
 * Every step is in the one form (the later ones hidden), checked before
 * "Sonraki adım" and again before the post; the server checks it all again
 * (createOrderInvoiceAction). Posted by hand, so a refusal keeps what was
 * typed.
 */

export interface InvoiceWizardProps {
  orderId: string;
  orderNo: number;
  orderHref: string;
  mode: "draft" | "live";
  /** A draft is already in Paraşüt: it is rebuilt for the new buyer. */
  rebuild: boolean;
  consumerName: string;
  orderEmail: string;
  initial: {
    buyerKind: "consumer" | "company";
    buyerTitle: string;
    buyerTaxNumber: string;
    buyerTaxOffice: string;
    buyerEmail: string;
    city: string;
    district: string;
    address: string;
  };
  /** The site could not read a province and district out of the order. */
  addressUnread: boolean;
  lines: InvoiceLine[];
  kdvRows: KdvRow[];
  totalMinor: number;
}

type StepId = 1 | 2 | 3 | 4;

const STEPS: ReadonlyArray<{ id: StepId; title: string }> = [
  { id: 1, title: "Alıcı" },
  { id: 2, title: "Fatura adresi" },
  { id: 3, title: "Satırlar" },
  { id: 4, title: "Özet" },
];

/** The step each posted field is on, for a refusal from the server. */
const FIELD_STEP: Record<string, StepId> = {
  buyerKind: 1,
  buyerTitle: 1,
  buyerTaxNumber: 1,
  buyerTaxOffice: 1,
  buyerEmail: 1,
  city: 2,
  district: 2,
  address: 2,
};

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Values = InvoiceWizardProps["initial"];

/** The client's copy of the server's rules, per step; key → message. */
function stepErrors(step: StepId, v: Values): Record<string, string> {
  const out: Record<string, string> = {};
  if (step === 1) {
    if (v.buyerKind === "company") {
      if (v.buyerTitle.trim().length < 3)
        out.buyerTitle =
          "Şirketin ticaret unvanını vergi levhasındaki gibi yaz.";
      if (!isValidVkn(v.buyerTaxNumber.replace(/\s+/g, "")))
        out.buyerTaxNumber =
          "VKN 10 haneli ve geçerli olmalı (vergi levhasından bak).";
      if (cleanTaxOffice(v.buyerTaxOffice).length < 2)
        out.buyerTaxOffice = "Vergi dairesini yaz (örneğin Tuzla).";
    }
    const email = v.buyerEmail.trim();
    if (email && !EMAIL.test(email))
      out.buyerEmail = "Geçerli bir e-posta gir ya da boş bırak.";
  }
  if (step === 2) {
    if (!provinceOf(v.city)) out.city = "İl, 81 ilden biri olmalı.";
    if (v.district.trim().length < 2) out.district = "İlçeyi yaz.";
  }
  return out;
}

export function InvoiceWizard(props: InvoiceWizardProps) {
  const {
    orderId,
    orderNo,
    orderHref,
    mode,
    rebuild,
    consumerName,
    orderEmail,
    lines,
    kdvRows,
    totalMinor,
  } = props;
  const baseId = useId();
  const formRef = useRef<HTMLFormElement>(null);
  const [step, setStep] = useState<StepId>(1);
  const [v, setV] = useState<Values>(props.initial);
  const [clientErrors, setClientErrors] = useState<Record<string, string>>({});
  const [state, formAction, pending] = useActionState<
    ActionResult | null,
    FormData
  >(async (prev, formData) => {
    const result = await runPanelAction(
      createOrderInvoiceAction,
      prev,
      formData,
    );
    // A refusal from the server: open the step of its first field.
    if (result && !result.ok) {
      const first = Object.keys(result.fieldErrors ?? {})
        .map((k) => FIELD_STEP[k])
        .filter(Boolean)
        .sort()[0];
      if (first) setStep(first);
    }
    return result;
  }, null);
  const serverErrors =
    state && !state.ok
      ? (state.fieldErrors ?? {})
      : ({} as Record<string, string>);
  const errors = { ...serverErrors, ...clientErrors };
  const company = v.buyerKind === "company";

  const set = (key: keyof Values) => (value: string) => {
    setV((prev) => ({ ...prev, [key]: value }));
    setClientErrors((prev) => {
      if (!(key in prev)) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const focusField = (key: string) => {
    requestAnimationFrame(() => {
      const el = formRef.current?.querySelector<HTMLElement>(`[name="${key}"]`);
      el?.focus();
    });
  };

  /** "Sonraki adım": only once this step's fields are fine. */
  const goNext = () => {
    const found = stepErrors(step, v);
    setClientErrors(found);
    const [first] = Object.keys(found);
    if (first) {
      focusField(first);
      return;
    }
    setStep((s) => Math.min(4, s + 1) as StepId);
  };

  const beforeSubmit = () => {
    for (const s of [1, 2] as StepId[]) {
      const found = stepErrors(s, v);
      const [first] = Object.keys(found);
      if (first) {
        setClientErrors(found);
        setStep(s);
        focusField(first);
        return false;
      }
    }
    return true;
  };

  const errorFor = (key: string) =>
    errors[key] ? (
      <p
        id={`${baseId}-err-${key}`}
        role="alert"
        className="text-xs text-[var(--admin-danger-ink)]"
      >
        {errors[key]}
      </p>
    ) : null;
  const describedBy = (key: string) =>
    errors[key] ? `${baseId}-err-${key}` : undefined;

  const submitLabel = rebuild
    ? "Taslağı yeniden oluştur"
    : mode === "live"
      ? "Faturayı kes"
      : "Taslağı oluştur";
  const docLabel = company
    ? "e-Fatura (şirket GİB'de e-Fatura kullanıcısıysa) ya da e-Arşiv"
    : "e-Arşiv fatura";
  const address = [
    v.address.trim(),
    v.district.trim(),
    provinceOf(v.city) ?? v.city.trim(),
  ]
    .filter(Boolean)
    .join(", ");

  // Posted by hand: a refusal keeps what was typed (ui/submit.ts).
  const post = useHandPost(formAction, pending, { beforeSubmit });

  return (
    <form
      ref={formRef}
      action={post.action}
      onSubmit={post.onSubmit}
      noValidate
      // min-w-0: a grid item is as wide as its content by default, and the
      // step chips (scrolling on their own) pushed the page past a phone.
      className="grid gap-5 [&>*]:min-w-0"
    >
      <input type="hidden" name="orderId" value={orderId} />
      <input type="hidden" name="buyerKind" value={v.buyerKind} />

      <Card>
        <ol className="-mx-1 flex [scrollbar-width:none] items-center gap-2 overflow-x-auto px-1 [&::-webkit-scrollbar]:hidden">
          {STEPS.map((s) => {
            const current = step === s.id;
            const flagged = Object.entries(errors).some(
              ([k]) => FIELD_STEP[k] === s.id,
            );
            return (
              <li key={s.id} className="shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    // Forward only through checked steps.
                    if (s.id > step) {
                      for (let i = step; i < s.id; i += 1) {
                        const found = stepErrors(i as StepId, v);
                        if (Object.keys(found).length > 0) {
                          setClientErrors(found);
                          setStep(i as StepId);
                          focusField(Object.keys(found)[0]);
                          return;
                        }
                      }
                    }
                    setStep(s.id);
                  }}
                  aria-current={current ? "step" : undefined}
                  aria-label={`${s.id}. ${s.title}${flagged ? ": düzeltilecek alan var" : ""}`}
                  className={`flex min-h-[44px] items-center gap-2 rounded-full px-3 py-2 text-xs transition-colors ${
                    current
                      ? "bg-[var(--admin-primary)] text-white"
                      : flagged
                        ? "border border-[var(--admin-danger)] text-[var(--admin-danger-ink)]"
                        : step > s.id
                          ? "bg-[var(--admin-surface-2)] text-[var(--admin-text-soft)]"
                          : "border border-[var(--admin-border)] text-[var(--admin-text-soft)]"
                  }`}
                >
                  <span
                    aria-hidden="true"
                    className="inline-grid h-5 w-5 place-items-center rounded-full text-[10px]"
                    style={{
                      background:
                        step >= s.id ? "rgba(255,255,255,0.15)" : "transparent",
                      border: step >= s.id ? "none" : "1px solid currentColor",
                    }}
                  >
                    {flagged ? "!" : s.id}
                  </span>
                  <span className="whitespace-nowrap">{s.title}</span>
                </button>
              </li>
            );
          })}
        </ol>
      </Card>

      {/* 1. Alıcı */}
      <div hidden={step !== 1}>
        <Card>
          <div className="grid gap-5">
            <fieldset className="grid gap-3">
              <legend className="mb-2 text-sm font-medium text-[var(--admin-text)]">
                Fatura kime kesilecek?
              </legend>
              <div className="grid gap-3 sm:grid-cols-2">
                {(
                  [
                    {
                      value: "consumer",
                      title: "Bireysel",
                      text: `Nihai tüketici: ${consumerName || "siparişteki ad"}. TCKN yerine 11111111111 yazılır (telefon ve TCKN Paraşüt'e gitmez).`,
                    },
                    {
                      value: "company",
                      title: "Kurumsal",
                      text: "Şirket adına: ticaret unvanı, 10 haneli VKN ve vergi dairesi. GİB'de e-Fatura kullanıcısıysa e-Fatura, değilse e-Arşiv kesilir.",
                    },
                  ] as const
                ).map((o) => {
                  const on = v.buyerKind === o.value;
                  return (
                    <label
                      key={o.value}
                      className={`flex min-h-[44px] cursor-pointer flex-col gap-1 rounded-2xl border p-4 text-sm transition-colors ${
                        on
                          ? "border-[var(--admin-primary)] bg-[var(--admin-surface)] ring-2 ring-[var(--admin-accent)]/25"
                          : "border-[var(--admin-border)] bg-[var(--admin-surface)] hover:border-[var(--admin-border-strong)]"
                      }`}
                    >
                      <span className="flex items-center gap-2 font-medium text-[var(--admin-text)]">
                        <input
                          type="radio"
                          name="buyerKindChoice"
                          value={o.value}
                          checked={on}
                          onChange={() => set("buyerKind")(o.value)}
                          aria-label={o.title}
                          aria-describedby={`${baseId}-kind-${o.value}`}
                          className="h-4 w-4 accent-[var(--admin-primary)]"
                        />
                        {o.title}
                      </span>
                      <span
                        id={`${baseId}-kind-${o.value}`}
                        className="text-[var(--admin-text-soft)]"
                      >
                        {o.text}
                      </span>
                    </label>
                  );
                })}
              </div>
            </fieldset>

            {company ? (
              <div className="grid gap-4">
                <div className="grid gap-1.5">
                  <Field
                    label="Ticaret unvanı"
                    hint="Vergi levhasındaki gibi, kısaltmasıyla (A.Ş., Ltd. Şti.)."
                  >
                    <TextInput
                      name="buyerTitle"
                      value={v.buyerTitle}
                      onChange={(e) => set("buyerTitle")(e.target.value)}
                      maxLength={200}
                      autoComplete="organization"
                      aria-invalid={Boolean(errors.buyerTitle) || undefined}
                      aria-describedby={describedBy("buyerTitle")}
                    />
                  </Field>
                  {errorFor("buyerTitle")}
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="grid gap-1.5">
                    <Field
                      label="VKN"
                      hint="10 hane. Şahıs şirketinin TCKN'si burada alınmaz: o fatura Paraşüt'te elle kesilir."
                    >
                      <TextInput
                        name="buyerTaxNumber"
                        value={v.buyerTaxNumber}
                        onChange={(e) =>
                          set("buyerTaxNumber")(
                            e.target.value.replace(/[^\d]/g, "").slice(0, 10),
                          )
                        }
                        inputMode="numeric"
                        autoComplete="off"
                        maxLength={10}
                        aria-invalid={
                          Boolean(errors.buyerTaxNumber) || undefined
                        }
                        aria-describedby={describedBy("buyerTaxNumber")}
                      />
                    </Field>
                    {errorFor("buyerTaxNumber")}
                  </div>
                  <div className="grid gap-1.5">
                    <Field label="Vergi dairesi" hint="Örneğin Tuzla.">
                      <TextInput
                        name="buyerTaxOffice"
                        value={v.buyerTaxOffice}
                        onChange={(e) => set("buyerTaxOffice")(e.target.value)}
                        maxLength={100}
                        autoComplete="off"
                        aria-invalid={
                          Boolean(errors.buyerTaxOffice) || undefined
                        }
                        aria-describedby={describedBy("buyerTaxOffice")}
                      />
                    </Field>
                    {errorFor("buyerTaxOffice")}
                  </div>
                </div>
              </div>
            ) : (
              <>
                <input type="hidden" name="buyerTitle" value="" />
                <input type="hidden" name="buyerTaxNumber" value="" />
                <input type="hidden" name="buyerTaxOffice" value="" />
              </>
            )}

            <div className="grid gap-1.5">
              <Field
                label="Fatura e-postası (isteğe bağlı)"
                hint={
                  company
                    ? `e-Arşiv kesilirse PDF buraya gider. Boş bırakırsan siparişteki adrese (${orderEmail || "yok"}). e-Fatura GİB üzerinden şirketin kutusuna gider.`
                    : `PDF buraya gider. Boş bırakırsan siparişteki adrese (${orderEmail || "yok"}).`
                }
              >
                <TextInput
                  name="buyerEmail"
                  type="email"
                  value={v.buyerEmail}
                  onChange={(e) => set("buyerEmail")(e.target.value)}
                  maxLength={254}
                  autoComplete="email"
                  aria-invalid={Boolean(errors.buyerEmail) || undefined}
                  aria-describedby={describedBy("buyerEmail")}
                />
              </Field>
              {errorFor("buyerEmail")}
            </div>
          </div>
        </Card>
      </div>

      {/* 2. Fatura adresi */}
      <div hidden={step !== 2}>
        <Card>
          <div className="grid gap-4">
            {props.addressUnread ? (
              <p className="rounded-xl bg-[var(--admin-warning-soft)] px-3.5 py-2.5 text-sm text-[var(--admin-text)]">
                Siparişteki adresten il ve ilçe okunamadı: aşağıya yaz.
              </p>
            ) : (
              <p className="text-sm text-[var(--admin-text-soft)]">
                {company
                  ? "Şirketin vergi levhasındaki adresi yaz."
                  : "Siparişten okunan adres. Gerekirse düzelt."}
              </p>
            )}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-1.5">
                <Field label="İl">
                  <TextInput
                    name="city"
                    value={v.city}
                    onChange={(e) => set("city")(e.target.value)}
                    list={`${baseId}-provinces`}
                    maxLength={40}
                    autoComplete="address-level1"
                    aria-invalid={Boolean(errors.city) || undefined}
                    aria-describedby={describedBy("city")}
                  />
                </Field>
                <datalist id={`${baseId}-provinces`}>
                  {PROVINCES.map((p) => (
                    <option key={p} value={p} />
                  ))}
                </datalist>
                {errorFor("city")}
              </div>
              <div className="grid gap-1.5">
                <Field label="İlçe">
                  <TextInput
                    name="district"
                    value={v.district}
                    onChange={(e) => set("district")(e.target.value)}
                    maxLength={60}
                    autoComplete="address-level2"
                    aria-invalid={Boolean(errors.district) || undefined}
                    aria-describedby={describedBy("district")}
                  />
                </Field>
                {errorFor("district")}
              </div>
            </div>
            <div className="grid gap-1.5">
              <Field
                label="Adres"
                hint="Mahalle, cadde, numara. Telefon numarası yazma: faturada telefon yer almaz."
              >
                <Textarea
                  name="address"
                  value={v.address}
                  onChange={(e) => set("address")(e.target.value)}
                  maxLength={500}
                  rows={3}
                  autoComplete="street-address"
                  aria-invalid={Boolean(errors.address) || undefined}
                  aria-describedby={describedBy("address")}
                />
              </Field>
              {errorFor("address")}
            </div>
          </div>
        </Card>
      </div>

      {/* 3. Satırlar */}
      <div hidden={step !== 3}>
        <Card>
          <div className="grid gap-3 text-sm">
            <p className="text-[var(--admin-text-soft)]">
              Satırlar siparişten gelir: satış anındaki KDV oranıyla, indirim
              satırlara dağıtılmış, kargo ya da kurye ayrı kalem. Burada
              değişmez; gerekirse taslağı Paraşüt&apos;te düzelt.
            </p>
            <InvoiceLinesTable lines={lines} />
            <InvoiceTotals kdvRows={kdvRows} totalMinor={totalMinor} />
          </div>
        </Card>
      </div>

      {/* 4. Özet */}
      <div hidden={step !== 4}>
        <Card>
          <dl className="grid gap-3 text-sm sm:grid-cols-[minmax(0,10rem)_1fr]">
            <SummaryRow k="Sipariş" v={`#${orderNo}`} />
            <SummaryRow
              k="Alıcı"
              v={company ? v.buyerTitle.trim() || "-" : consumerName || "-"}
            />
            <SummaryRow
              k="Vergi"
              v={
                company
                  ? `VKN ${v.buyerTaxNumber} · ${cleanTaxOffice(v.buyerTaxOffice)} V.D.`
                  : "TCKN 11111111111 (nihai tüketici)"
              }
            />
            <SummaryRow k="Fatura adresi" v={address || "-"} />
            <SummaryRow
              k="PDF e-postası"
              v={
                v.buyerEmail.trim() ||
                orderEmail ||
                "Yok: PDF'i panelden indirip ilet"
              }
            />
            <SummaryRow k="Belge" v={docLabel} />
            <SummaryRow k="Tutar (KDV dahil)" v={formatTRY(totalMinor)} />
          </dl>
          <p className="mt-5 rounded-xl bg-[var(--admin-surface-2)] px-3.5 py-3 text-sm text-[var(--admin-text-soft)]">
            {mode === "live"
              ? "Fatura bugünün tarihiyle hemen kesilir ve gönderilir. Kesilen fatura yalnız Paraşüt'ten iptal edilir."
              : rebuild
                ? 'Paraşüt\'teki taslak silinir ve bu alıcıyla bugünün tarihiyle yeniden hazırlanır. Sipariş sayfasındaki kartta satır satır görürsün; doğruysa "Faturayı kesinleştir".'
                : 'Paraşüt\'te taslak hazırlanır, henüz kesilmez. Sipariş sayfasındaki kartta satır satır görürsün; doğruysa "Faturayı kesinleştir".'}
          </p>
        </Card>
      </div>

      {state && !state.ok ? (
        <div
          role="alert"
          className="rounded-xl bg-[var(--admin-danger-soft)] px-3.5 py-2.5 text-sm text-[var(--admin-danger-ink)]"
        >
          {state.error}
        </div>
      ) : null}

      <Card className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex gap-2">
          <GhostButton
            type="button"
            onClick={() => setStep((s) => Math.max(1, s - 1) as StepId)}
            disabled={step === 1}
          >
            Geri
          </GhostButton>
          {step < 4 ? (
            <PrimaryButton type="button" onClick={goNext}>
              Sonraki adım
            </PrimaryButton>
          ) : null}
        </div>
        <div className="flex gap-2">
          <Link href={orderHref} className={BUTTON.ghost}>
            Vazgeç
          </Link>
          {step === 4 ? (
            <PrimaryButton type="submit" disabled={pending}>
              {pending ? "Paraşüt'e gönderiliyor…" : submitLabel}
            </PrimaryButton>
          ) : null}
        </div>
      </Card>
    </form>
  );
}

function SummaryRow({ k, v }: { k: string; v: string }) {
  return (
    <>
      <dt className="text-[var(--admin-text-soft)]">{k}</dt>
      <dd className="break-words text-[var(--admin-text)]">{v}</dd>
    </>
  );
}
