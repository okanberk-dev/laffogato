"use client";

import { adjustStockAction } from "@/app/admin/stok-hareketleri/actions";
import type { StockAdjustOption } from "@/lib/admin/stock-moves-panel";

import {
  ActionForm,
  FormFieldError,
  FormMessage,
  SubmitButton,
} from "./action-form";
import { Field, Select, TextInput } from "./forms";
import {
  QUICK_LOOK_ACTION_ROW,
  QuickLookActionBody,
} from "./ui/quick-look-parts";

/**
 * "Stok güncelle" in a product's quick look: the Stok page's correction
 * (adjustStockAction: ± a whole number and a note for the trail), for this
 * product only, folded in its action row until asked for. A product with
 * variants is corrected one variant at a time, as on the Stok page. The
 * answer is a toast; the drawer's stock and its moves are drawn again with
 * the list (the action revalidates /admin/urunler).
 *
 * It is told the product's id, name and its variants' stock, nothing else
 * (toStockAdjustOption, admin audit CAT-07).
 */
export function QuickStockForm({ product }: { product: StockAdjustOption }) {
  const hasVariants = product.variants.length > 0;
  return (
    <li>
      <details className="group rounded-lg bg-[var(--admin-surface)]">
        <summary
          className={`${QUICK_LOOK_ACTION_ROW} cursor-pointer list-none select-none [&::-webkit-details-marker]:hidden`}
        >
          <QuickLookActionBody
            icon="stock"
            hue="amber"
            title="Stok güncelle"
            description="Sayım, hasar ya da gelen mal."
            disclosure
          />
        </summary>
        <ActionForm
          action={adjustStockAction}
          resetOnSuccess
          className="grid gap-3 px-3 pt-1 pb-3"
        >
          {hasVariants ? (
            <div className="grid gap-1.5">
              <Field label="Varyant">
                <Select name="productId" defaultValue="" required>
                  <option value="" disabled>
                    Varyant seç…
                  </option>
                  {product.variants.map((v) => (
                    <option key={v.id} value={`${product.id}#${v.id}`}>
                      {v.name || "Adsız"} · stok {v.stock}
                      {v.isActive ? "" : " · pasif"}
                    </option>
                  ))}
                </Select>
              </Field>
              <FormFieldError name="productId" />
            </div>
          ) : (
            <input type="hidden" name="productId" value={product.id} />
          )}
          <div className="grid gap-3 sm:grid-cols-[7rem_minmax(0,1fr)]">
            <div className="grid content-start gap-1.5">
              <Field label="Değişiklik (±)">
                <TextInput
                  name="delta"
                  type="text"
                  placeholder="+12"
                  autoComplete="off"
                  autoCorrect="off"
                  spellCheck={false}
                  enterKeyHint="next"
                  maxLength={12}
                  required
                />
              </Field>
              <FormFieldError name="delta" />
            </div>
            <div className="grid content-start gap-1.5">
              <Field label="Not (zorunlu)">
                <TextInput
                  name="note"
                  type="text"
                  placeholder="Sayım fazlası · Hasar · Tedarikçi"
                  autoComplete="off"
                  enterKeyHint="done"
                  maxLength={200}
                  required
                />
              </Field>
              <FormFieldError name="note" />
            </div>
          </div>
          <FormMessage />
          <div className="flex justify-end">
            <SubmitButton pendingLabel="Güncelleniyor…">
              Stoğu güncelle
            </SubmitButton>
          </div>
        </ActionForm>
      </details>
    </li>
  );
}
