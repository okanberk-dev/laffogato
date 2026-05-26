"use client";

import { useActionState, useEffect, useRef } from "react";

import {
  adjustStockAction,
  type AdjustStockState,
} from "@/app/admin/stok-hareketleri/actions";
import type { AdminProduct } from "@/lib/admin/store";

import { Card, Field, PrimaryButton, Select, TextInput, Textarea } from "./forms";

const initial: AdjustStockState = {};

export function StockAdjustForm({ products }: { products: AdminProduct[] }) {
  const [state, formAction, pending] = useActionState(adjustStockAction, initial);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.ok) formRef.current?.reset();
  }, [state.ok]);

  return (
    <Card>
      <h2
        className="mb-4 text-[10px] uppercase tracking-[0.22em] text-neutral-500"
        style={{ fontFamily: "var(--mono), monospace" }}
      >
        Manuel stok düzeltmesi
      </h2>
      <form ref={formRef} action={formAction} className="grid gap-4 md:grid-cols-[2fr_1fr_2fr_auto] md:items-end">
        <Field label="Ürün">
          <Select name="productId" defaultValue="" required>
            <option value="" disabled>
              Ürün seç…
            </option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} · stok {p.stock}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Değişiklik (±)" hint="Örn. +12, −3">
          <TextInput
            name="delta"
            inputMode="numeric"
            pattern="-?\d+"
            placeholder="+12"
            required
          />
        </Field>
        <Field label="Not (zorunlu)" hint="Denetim için kısa açıklama.">
          <Textarea
            name="note"
            rows={1}
            placeholder="Sayım fazlası · Hasar · Tedarikçi iadesi…"
            required
          />
        </Field>
        <PrimaryButton type="submit" disabled={pending}>
          {pending ? "Kaydediliyor…" : "Düzelt"}
        </PrimaryButton>
      </form>
      {state.error && (
        <div className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.error}
        </div>
      )}
      {state.ok && (
        <div className="mt-3 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          <strong>{state.ok.productName}</strong> · {state.ok.delta > 0 ? "+" : ""}
          {state.ok.delta} ⇒ yeni stok: <strong>{state.ok.stockAfter}</strong>
        </div>
      )}
    </Card>
  );
}
