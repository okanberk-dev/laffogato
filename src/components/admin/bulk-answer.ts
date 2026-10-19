"use client";

import { PANEL_ACTION_FAILED } from "./action-form";
import { withPanelCatch } from "./ui/submit";

/** What the catalog lists' bulk actions answer (urunler and menu actions). */
export interface BulkAnswerState {
  error?: string;
  ok?: { op: string; updated: number };
}

/**
 * The products' and menu's bulk bar run through this: the answer is a
 * toast beside the bar, and a throw (a database timeout, a failed check)
 * becomes "Bir hata oldu…" in place instead of the panel's error screen,
 * which dropped the selection and the page (admin audit CAT-17). redirect()
 * and notFound() still run (withPanelCatch). Pure enough to test: the
 * action and the toast are passed in.
 */
export function bulkAnswer<S extends BulkAnswerState>(
  action: (prev: S, formData: FormData) => Promise<S>,
  {
    tell,
    describe,
    onOk,
  }: {
    tell: (message: string, tone?: "danger") => void;
    /** The success sentence, e.g. "Pasif yapıldı: 3 ürün güncellendi." */
    describe: (ok: NonNullable<S["ok"]>) => string;
    onOk?: (ok: NonNullable<S["ok"]>) => void;
  },
): (prev: S, formData: FormData) => Promise<S> {
  const run = withPanelCatch<S>(
    action,
    (prev) => ({ ...prev, ok: undefined, error: PANEL_ACTION_FAILED }) as S,
  );
  return async (prev, formData) => {
    const next = await run(prev, formData);
    if (next.ok) {
      tell(describe(next.ok as NonNullable<S["ok"]>));
      onOk?.(next.ok as NonNullable<S["ok"]>);
    } else if (next.error) {
      tell(next.error, "danger");
    }
    return next;
  };
}
