import Link from "next/link";

import { unsubscribeByToken } from "@/lib/newsletter/store";

export const metadata = {
  title: "Bülten aboneliğinden çık · L'Affogato",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ token?: string }>;
}

/**
 * One-click unsubscribe.
 *
 * No login, no form, no typing the address back in: 6563 requires withdrawal
 * to be free and at least as easy as consent was to give. The link in every
 * message carries the token and this page spends it on arrival.
 */
export default async function BultenCikisPage({ searchParams }: PageProps) {
  const { token } = await searchParams;

  let email: string | null = null;
  let failed = false;
  if (token) {
    try {
      email = await unsubscribeByToken(token);
    } catch {
      failed = true;
    }
  }

  const heading = email
    ? "Çıkış tamamlandı."
    : failed
      ? "Şu an işlenemedi."
      : "Bağlantı geçersiz.";

  return (
    <main className="auth-page">
      <div className="auth-card">
        <Link href="/" className="eyebrow auth-back">
          ← Anasayfa
        </Link>
        <h1 className="h1 auth-title">
          Bülten <span className="script">aboneliği.</span>
        </h1>

        {email ? (
          <p className="auth-lede">
            <strong>{email}</strong> adresine artık pazarlama e-postası
            göndermeyeceğiz. Sipariş ve kargo bildirimleri bundan etkilenmez —
            onlar aboneliğe değil, siparişine bağlıdır.
          </p>
        ) : failed ? (
          <p className="auth-lede">
            {heading} Birazdan tekrar dener misin? Sorun sürerse{" "}
            <a href="mailto:info@nextgenlab.com.tr">info@nextgenlab.com.tr</a>{" "}
            adresine yaz, listeden elle çıkaralım.
          </p>
        ) : (
          <p className="auth-lede">
            Bu bağlantı ya daha önce kullanılmış ya da eksik. Zaten çıkmış
            olabilirsin. Emin değilsen{" "}
            <a href="mailto:info@nextgenlab.com.tr">info@nextgenlab.com.tr</a>{" "}
            adresine yaz.
          </p>
        )}

        <Link href="/" className="btn btn-primary btn-lg">
          Anasayfaya dön
        </Link>
      </div>
    </main>
  );
}
