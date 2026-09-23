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
    <main
      className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-16"
      style={{ background: "var(--bg-warm)" }}
    >
      <p
        className="text-xs tracking-[0.2em] uppercase"
        style={{ color: "var(--ink-mute)" }}
      >
        L&apos;Affogato
      </p>
      <h1
        className="mt-3 text-3xl font-semibold"
        style={{ color: "var(--ink)" }}
      >
        Ödeme geçemedi
      </h1>
      <p
        className="mt-4 text-base leading-7"
        style={{ color: "var(--ink-soft)" }}
      >
        Kartından çekim yapılmadı; siparişin ödeme bekliyor. Uygulamaya dönüp
        yeniden deneyebilirsin.
      </p>
      {/* The house green, not the accent: globals.css states the rule ("the
          primary action is the house green … never the button a page is built
          around"), and this is a payment-failure screen - the worst page on
          which to paint the way OUT in the same red as the problem. `.btn`
          carries the radius, so no Tailwind `rounded-full` either. */}
      <a href={href} className="btn btn-primary" style={{ marginTop: 32 }}>
        Uygulamaya dön
      </a>
      {safeId ? (
        <p className="mt-6 text-xs" style={{ color: "var(--ink-mute)" }}>
          Sipariş referansı: {safeId}
        </p>
      ) : null}
    </main>
  );
}
