import { LafMark } from "@/components/laffogato/brand-mark";
import { appOrderDeepLink, isSafeOrderId } from "@/lib/mobile/deep-link";

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
  const href = safeId ? appOrderDeepLink(safeId, "failed") : "laffogato://";

  return (
    <main className="auth-page auth-page--full">
      <div className="auth-card auth-card--center">
        <LafMark tone="duo" height={40} label="L'Affogato" />
        <span
          className="auth-badge auth-badge--fail app-fail-badge"
          aria-hidden="true"
        >
          !
        </span>
        <h1 className="auth-title">Ödeme geçemedi</h1>
        <p className="auth-lede">
          Kartından çekim yapılmadı; siparişin ödeme bekliyor. Uygulamaya dönüp
          yeniden deneyebilirsin.
        </p>
        {/* The house green, not the accent: this is a payment-failure screen -
            the worst page on which to paint the way OUT in the same red as
            the problem. */}
        <a href={href} className="btn btn-primary btn-lg auth-submit">
          Uygulamaya dön
        </a>
        {safeId ? (
          <p className="app-fail-ref">Sipariş referansı: {safeId}</p>
        ) : null}
      </div>
    </main>
  );
}
