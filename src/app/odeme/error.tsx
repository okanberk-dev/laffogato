"use client";

import { useEffect } from "react";

/**
 * The error boundary of every page under /odeme EXCEPT the checkout itself
 * (that one has its own in `(checkout)/error.tsx`): the success page, the
 * app's failure page, the return.
 *
 * It must say nothing about money. A customer who lands here from
 * `/odeme/basarili` has paid, and a database blip while that page renders
 * must not tell them "kartından para çekilmedi" or send them back to the
 * checkout. So: what happened to the page, a retry of THIS page, and the
 * places an order's status can be read.
 */
export default function OdemeError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[odeme-page-error]", error.message, error.digest);
  }, [error]);

  return (
    <div className="checkout-page">
      <div className="checkout-page-wrap">
        <div className="checkout-gate" role="alert">
          <h1 className="checkout-gate-title">Sayfa şu an açılamadı</h1>
          <p className="checkout-gate-lede">
            Bu sayfayı gösterirken bir aksaklık oldu. Birkaç saniye sonra
            yeniden dene; siparişinin durumunu Siparişlerim sayfasından da
            görebilirsin.
          </p>
          <div className="checkout-gate-actions">
            <button type="button" onClick={reset} className="btn btn-primary">
              Tekrar dene
            </button>
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- a full page load on purpose */}
            <a href="/uye/hesap/siparislerim" className="btn btn-ghost">
              Siparişlerim
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
