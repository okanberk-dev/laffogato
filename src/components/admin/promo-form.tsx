"use client";

import Link from "next/link";
import { useActionState, useState } from "react";

import type { PromoActionState } from "@/app/admin/promosyon/actions";
import type { AdminPromo } from "@/lib/admin/store";

import {
  Card,
  Checkbox,
  Field,
  GhostButton,
  PrimaryButton,
  Select,
  TextInput,
} from "./forms";

const initial: PromoActionState = {};

interface Props {
  promo?: AdminPromo;
  action: (
    prev: PromoActionState,
    formData: FormData,
  ) => Promise<PromoActionState>;
  submitLabel: string;
}

export function PromoForm({ promo, action, submitLabel }: Props) {
  const [state, formAction, pending] = useActionState(action, initial);
  const [kind, setKind] = useState<"pct" | "fixed">(promo?.kind ?? "pct");

  const fe = (k: string) => state.fieldErrors?.[k];

  return (
    <form action={formAction} className="grid gap-5">
      <Card className="grid gap-5">
        <Field
          label="Kod"
          hint={
            fe("code") ??
            "Müşterinin sepete gireceği kod. Büyük harfe çevrilir."
          }
        >
          <TextInput
            name="code"
            defaultValue={promo?.code ?? ""}
            placeholder="SUMMER25"
            required
            aria-invalid={Boolean(fe("code"))}
          />
        </Field>

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
            <Field
              label="Yüzde"
              hint={fe("valuePct") ?? "1–100 arası tam sayı."}
            >
              <TextInput
                name="valuePct"
                inputMode="numeric"
                defaultValue={
                  promo && promo.kind === "pct" ? String(promo.value) : "10"
                }
                required
              />
            </Field>
          ) : (
            <Field label="Tutar (₺)" hint={fe("valueFixed")}>
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
          )}
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
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
          <Field
            label="Kullanım limiti"
            hint="0 = sınırsız. Tüketim her başarılı siparişte 1 artar."
          >
            <TextInput
              name="usageLimit"
              type="number"
              min={0}
              defaultValue={String(promo?.usageLimit ?? 0)}
            />
          </Field>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <Field
            label="Son geçerlilik (opsiyonel)"
            hint={fe("expiresAt") ?? "Boş = süresiz."}
          >
            <TextInput
              name="expiresAt"
              type="datetime-local"
              defaultValue={
                promo?.expiresAt ? promo.expiresAt.slice(0, 16) : ""
              }
            />
          </Field>
          <Field label="Durum">
            <Checkbox
              name="isActive"
              label="Aktif (müşteri kullanabilir)"
              defaultChecked={promo?.isActive ?? true}
            />
          </Field>
        </div>

        {state.error && (
          <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {state.error}
          </div>
        )}
      </Card>

      <Card className="flex flex-wrap items-center justify-between gap-3">
        <Link href="/admin/promosyon">
          <GhostButton type="button">Vazgeç</GhostButton>
        </Link>
        <PrimaryButton type="submit" disabled={pending}>
          {pending ? "Kaydediliyor…" : submitLabel}
        </PrimaryButton>
      </Card>
    </form>
  );
}
