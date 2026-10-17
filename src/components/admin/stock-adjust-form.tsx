"use client";

import { adjustStockAction } from "@/app/admin/stok-hareketleri/actions";
import type { AdminProduct } from "@/lib/admin/store";

import {
  ActionForm,
  FormFieldError,
  FormMessage,
  SubmitButton,
} from "./action-form";
import { Card, Field, Select, TextInput, Textarea } from "./forms";

/**
 * The manual stock correction. The amount is a plain text field: a numeric
 * keyboard on iOS has no minus key, so a negative correction could not be
 * typed on a phone. The server reads "+12", "-3" and "−3" alike
 * (lib/admin/stock-delta.ts) and answers under each field; the new stock
 * comes back as a toast and the form empties.
 *
 * A product with variants is corrected one variant at a time (admin audit
 * CAT-14): it is listed as a group of its variants, each posting
 * "productId#variantId", and its total follows them.
 */
export function StockAdjustForm({ products }: { products: AdminProduct[] }) {
  return (
    <Card>
      <h2
        className="mb-4 text-[10px] tracking-[0.22em] text-neutral-500 uppercase"
        style={{ fontFamily: "var(--mono), monospace" }}
      >
        Manuel stok düzeltmesi
      </h2>
      <ActionForm
        action={adjustStockAction}
        resetOnSuccess
        className="grid gap-4 md:grid-cols-[2fr_1fr_2fr_auto] md:items-start"
      >
        <div className="grid content-start gap-1.5">
          <Field label="Ürün">
            <Select name="productId" defaultValue="" required>
              <option value="" disabled>
                Ürün seç…
              </option>
              {products.map((p) =>
                p.variants.length > 0 ? (
                  <optgroup key={p.id} label={`${p.name} · toplam ${p.stock}`}>
                    {p.variants.map((v) => (
                      // The product's name too: a closed select shows the
                      // option alone, and "250 g" is on more than one bag.
                      <option key={v.id} value={`${p.id}#${v.id}`}>
                        {p.name} · {v.name} · stok {v.stock}
                        {v.isActive ? "" : " · pasif"}
                      </option>
                    ))}
                  </optgroup>
                ) : (
                  <option key={p.id} value={p.id}>
                    {p.name} · stok {p.stock}
                  </option>
                ),
              )}
            </Select>
          </Field>
          <FormFieldError name="productId" />
        </div>
        <div className="grid content-start gap-1.5">
          <Field label="Değişiklik (±)" hint="Ekle: +12 · düş: -3. Tam sayı.">
            <TextInput
              name="delta"
              type="text"
              placeholder="+12"
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              enterKeyHint="done"
              maxLength={12}
              required
            />
          </Field>
          <FormFieldError name="delta" />
        </div>
        <div className="grid content-start gap-1.5">
          <Field label="Not (zorunlu)" hint="Denetim için kısa açıklama.">
            <Textarea
              name="note"
              rows={1}
              placeholder="Sayım fazlası · Hasar · Tedarikçi iadesi…"
              required
            />
          </Field>
          <FormFieldError name="note" />
        </div>
        <div className="grid gap-2 md:pt-6">
          <SubmitButton>Düzelt</SubmitButton>
        </div>
        <div className="md:col-span-4">
          <FormMessage />
        </div>
      </ActionForm>
    </Card>
  );
}
