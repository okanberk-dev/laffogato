import Link from "next/link";

import { DegradedAuthNotice } from "@/components/customer/degraded-auth-notice";

import { ResetPasswordForm } from "./reset-form";

export const metadata = {
  title: "Yeni şifre belirle · L'Affogato",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ token?: string }>;
}

export default async function SifreSifirlaPage({ searchParams }: PageProps) {
  const { token } = await searchParams;

  return (
    <main className="auth-page">
      <div className="auth-card">
        <Link href="/uye/giris" className="eyebrow auth-back">
          ← Giriş
        </Link>
        <DegradedAuthNotice />
        <h1 className="h1 auth-title">
          Yeni <span className="script">şifre.</span>
        </h1>
        {token ? (
          <>
            <p className="auth-lede">
              En az 8 karakter. Kaydettiğin anda hesabına giriş yapılır.
            </p>
            <ResetPasswordForm token={token} />
          </>
        ) : (
          <>
            <p className="auth-lede">
              Bu sayfaya e-postandaki bağlantıyla gelmen gerekiyor. Bağlantı
              eksik ya da bozuksa yeni bir tane isteyebilirsin.
            </p>
            <Link
              href="/uye/sifremi-unuttum"
              className="btn btn-primary btn-lg"
            >
              Yeni bağlantı iste
            </Link>
          </>
        )}
      </div>
    </main>
  );
}
