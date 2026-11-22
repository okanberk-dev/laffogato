"use client";

import { adjustStockAction } from "@/app/admin/stok-hareketleri/actions";
import type { ComboboxOption } from "@/lib/admin/option-filter";
import type { StockAdjustOption } from "@/lib/admin/stock-moves-panel";

import {
  ActionForm,
  FormFieldError,
  FormMessage,
  SubmitButton,
} from "./action-form";
import { Field, TextInput, Textarea } from "./forms";
import { ComboboxField } from "./ui/combobox-field";
import { AdminIcon } from "./ui/icons";
import { openFromMd } from "./ui/open-from-md";
import { CARD_TITLE } from "./ui/styles";

/**
 * The picker's options: a product with variants is a group of them (its
 * name and total as the heading), each posting "productId#variantId". The
 * product's name is in each variant's text too: a closed picker shows the
 * option alone, and "250 g" is on more than one bag.
 */
export function stockOptions(
  products: readonly StockAdjustOption[],
): ComboboxOption[] {
  return products.flatMap((p) =>
    p.variants.length > 0
      ? p.variants.map((v) => ({
          value: `${p.id}#${v.id}`,
          label: `${p.name} · ${v.name} · stok ${v.stock}${v.isActive ? "" : " · pasif"}`,
          group: `${p.name} · toplam ${p.stock}`,
        }))
      : [{ value: p.id, label: `${p.name} · stok ${p.stock}` }],
  );
}

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
 *
 * It is told a product's name, stock and variants' stock, nothing else
 * (toStockAdjustOption): this is a client component on a page Personel
 * opens, and it used to receive whole product rows, cost and photos
 * included (admin audit CAT-07).
 */
export function StockAdjustForm({
  products,
}: {
  products: readonly StockAdjustOption[];
}) {
  return (
    // A white card with an outline, not the stone panel the filter bar
    // under it is drawn on: two grey forms one above the other read as
    // one. On a phone it folds behind its title (the moves are what the
    // page is opened for); from md up it is always open (openFromMd).
    <section className="rounded-xl border border-[var(--admin-card-border)] bg-[var(--admin-surface)] p-4 sm:p-6">
      <details ref={openFromMd} className="group md:details-content:contents">
        <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 select-none md:hidden pointer-fine:min-h-9 [&::-webkit-details-marker]:hidden">
          <span className={CARD_TITLE}>Stok düzelt</span>
          <AdminIcon
            name="chevron"
            size={16}
            className="shrink-0 text-[var(--admin-text-mute)] transition-transform group-open:rotate-180 motion-reduce:transition-none"
          />
        </summary>
        <h2 className={`mb-4 hidden md:block ${CARD_TITLE}`}>Stok düzelt</h2>
        <ActionForm
          action={adjustStockAction}
          resetOnSuccess
          className="mt-3 grid gap-4 md:mt-0 md:grid-cols-[2fr_1fr_2fr_auto] md:items-start"
        >
          <div className="grid content-start gap-1.5">
            <Field label="Ürün">
              <ComboboxField
                name="productId"
                label="Ürün"
                defaultValue=""
                required
                placeholder="Ürün seç…"
                placeholderDisabled
                options={stockOptions(products)}
              />
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
      </details>
    </section>
  );
}
