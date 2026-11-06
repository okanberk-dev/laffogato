import { LafMark } from "@/components/laffogato/brand-mark";
import { PaymentsArt } from "@/components/laffogato/payments-art";
import {
  appKaraokeDeepLink,
  appOrderDeepLink,
  isSafeOrderId,
} from "@/lib/mobile/deep-link";
import { isKaraokeRef } from "@/lib/mobile/karaoke-ref";

export const metadata = {
  title: "Ödeme geçemedi",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ orderId?: string }>;
}

/**
 * Where the virtual POS sends an app checkout that did not go through
 * (docs/API-MOBILE.md §3, `failureUrl`). The customer is inside an in-app
 * browser; the one thing this page has to do is hand them back to the app,
 * which shows the order and offers to try again.
 */
export default async function AppPaymentFailedPage({
  searchParams,
}: PageProps) {
  const { orderId } = await searchParams;
  const safeId = orderId && isSafeOrderId(orderId) ? orderId : "";
  // A karaoke booking returns to the app's karaoke screen, never its order
  // screen (docs/API-MOBILE.md §7).
  const karaoke = isKaraokeRef(safeId);
  const href = !safeId
    ? "laffogato://"
    : karaoke
      ? appKaraokeDeepLink(safeId, "failed")
      : appOrderDeepLink(safeId, "failed");

  return (
    <main className="auth-page auth-page--full">
      <div className="auth-card auth-card--center">
        <LafMark tone="duo" height={40} label="L'Affogato" />
        <PaymentsArt className="app-fail-art" />
        <span
          className="auth-badge auth-badge--fail app-fail-badge"
          aria-hidden="true"
        >
          !
        </span>
        <h1 className="auth-title">Ödeme geçemedi</h1>
        <p className="auth-lede">
          {karaoke
            ? "Kartından çekim yapılmadı; rezervasyonun ödenmediği için kesinleşmedi. Uygulamaya dönüp yeniden deneyebilirsin."
            : "Kartından çekim yapılmadı; siparişin ödeme bekliyor. Uygulamaya dönüp yeniden deneyebilirsin."}
        </p>
        {/* The house green, not the accent: this is a payment-failure screen -
            the worst page on which to paint the way OUT in the same red as
            the problem. */}
        <a href={href} className="btn btn-primary btn-lg auth-submit">
          Uygulamaya dön
        </a>
        {safeId ? (
          <p className="app-fail-ref">
            {karaoke ? "Rezervasyon" : "Sipariş"} referansı: {safeId}
          </p>
        ) : null}
      </div>
    </main>
  );
}
