"use client";

import { useEffect, useRef, type MouseEvent } from "react";

import type { CheckoutDocument } from "./checkout-documents";
import { OrderFactsTable, type OrderFacts } from "./checkout-preinfo";

/**
 * The Ön Bilgilendirme Formu or the Mesafeli Satış Sözleşmesi, opened from
 * the payment step without leaving it (ASK-OTH-2 (1) c): the card typed
 * below stays where it is. The panel starts with "Bu siparişin bilgileri",
 * this order's facts, then the document's full text.
 *
 * A native modal <dialog>, like the panel's drawer: the page behind is
 * inert, focus moves in and comes back to the link, Esc closes it, and the
 * page behind does not scroll. A link with a modifier key still opens the
 * document's own page in a new tab (checkout.tsx decides that).
 */
export function CheckoutDocPanel({
  doc,
  facts,
  onClose,
}: {
  /** The document to show; null keeps the panel closed. */
  doc: CheckoutDocument | null;
  /** Filled only while a document is open. */
  facts: OrderFacts | null;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const downOnBackdrop = useRef(false);
  const open = doc !== null;

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    else if (!open && dialog.open) dialog.close();
    if (!open) return;
    const root = document.documentElement;
    const before = root.style.overflow;
    root.style.overflow = "hidden";
    return () => {
      root.style.overflow = before;
    };
  }, [open]);

  // A press that starts and ends on the backdrop closes the panel; a text
  // selection dragged out of it does not.
  const onMouseDown = (e: MouseEvent<HTMLDialogElement>) => {
    downOnBackdrop.current = e.target === e.currentTarget;
  };
  const onClick = (e: MouseEvent<HTMLDialogElement>) => {
    if (downOnBackdrop.current && e.target === e.currentTarget) {
      e.currentTarget.close();
    }
    downOnBackdrop.current = false;
  };

  return (
    <dialog
      ref={ref}
      className="co-docpanel"
      aria-labelledby="co-docpanel-title"
      onClose={onClose}
      onMouseDown={onMouseDown}
      onClick={onClick}
    >
      {doc ? (
        <div className="co-docpanel-inner">
          <header className="co-docpanel-head">
            <div className="co-docpanel-heading">
              <h2 className="co-docpanel-title" id="co-docpanel-title">
                {doc.title}
              </h2>
              <p className="co-docpanel-meta">
                Son güncelleme: {doc.updatedAt}
              </p>
            </div>
            <button
              type="button"
              className="co-docpanel-close"
              aria-label="Belgeyi kapat"
              onClick={() => ref.current?.close()}
            >
              <span aria-hidden="true">×</span>
            </button>
          </header>
          <div className="co-docpanel-body">
            {facts ? <OrderFactsTable facts={facts} /> : null}
            {doc.body}
            <p className="co-docpanel-foot">
              <a href={`/hukuk/${doc.slug}`} target="_blank" rel="noopener">
                Belgeyi yeni sekmede aç
              </a>
            </p>
          </div>
          <div className="co-docpanel-actions">
            <button
              type="button"
              className="btn btn-primary co-docpanel-done"
              onClick={() => ref.current?.close()}
            >
              Ödemeye dön
            </button>
          </div>
        </div>
      ) : null}
    </dialog>
  );
}
