"use client";

import { useEffect } from "react";

/**
 * The checkout's own error boundary: a render error on /odeme (or a page
 * under it) shows what happened and a way on, never a white page around the
 * payment step (operator, 16 Eki 2026). It renders inside the checkout's
 * chrome (layout.tsx), and every link is a full page load: "Tekrar dene"
 * loads the page afresh, under its own policy, rather than re-rendering a
 * segment that has just failed.
 *
 * Nothing about the order or the card is shown or logged here - the
 * message and the digest only.
 */
export default function CheckoutError({
  error,
}: {
  error: Error & { digest?: string };
}) {
  useEffect(() => {
    console.error("[odeme-error]", error.message, error.digest);
  }, [error]);

  return (
    <div className="checkout-page">
      <div className="checkout-page-wrap">
        <div className="checkout-gate" role="alert">
          <h1 className="checkout-gate-title">Sayfa şu an açılamadı</h1>
          <p className="checkout-gate-lede">
            Ödeme sayfasını gösterirken bir aksaklık oldu; kartından para
            çekilmedi. Sepetin duruyor, sayfayı yeniden açıp devam edebilirsin.
          </p>
          <div className="checkout-gate-actions">
            <a href="/odeme" className="btn btn-primary">
              Tekrar dene
            </a>
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- a full page load on purpose: the checkout document keeps its own policy (checkout-chrome.tsx) */}
            <a href="/magaza" className="btn btn-ghost">
              Mağazaya dön
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
