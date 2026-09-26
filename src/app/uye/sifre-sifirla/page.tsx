import Link from "next/link";

import { DegradedAuthNotice } from "@/components/customer/degraded-auth-notice";
import { LafMark } from "@/components/laffogato/brand-mark";

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
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-head">
          <Link href="/uye/giris" className="auth-back">
            ← Giriş
          </Link>
          <LafMark tone="duo" />
        </div>
        <DegradedAuthNotice />
        <h1 className="auth-title">
          Yeni <span className="script">şifre</span>
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
              className="btn btn-primary btn-lg auth-submit"
            >
              Yeni bağlantı iste
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
