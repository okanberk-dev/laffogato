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
      <a
        href={href}
        className="mt-8 inline-flex items-center justify-center rounded-full px-6 py-3 text-sm font-semibold"
        style={{ background: "var(--accent)", color: "var(--bg)" }}
      >
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
