import Link from "next/link";

import { verifyCustomerEmail } from "@/lib/customer/store";

export const metadata = { title: "E-posta doğrulama · L'Affogato" };
export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ token?: string }>;
}

export default async function VerifyPage({ searchParams }: PageProps) {
  const { token } = await searchParams;
  const result = token
    ? await verifyCustomerEmail(token)
    : ({ ok: false, error: "Doğrulama bağlantısı eksik." } as const);

  const ok = result.ok;

  return (
    <main className="auth-page">
      <div className="auth-card auth-card--center">
        <span
          className={`auth-badge ${ok ? "auth-badge--ok" : "auth-badge--fail"}`}
          aria-hidden="true"
        >
          {ok ? "✓" : "!"}
        </span>
        <h1 className="auth-title">
          {ok ? "E-postan doğrulandı" : "Doğrulanamadı"}
        </h1>
        <p className="auth-lede">
          {ok
            ? "Hesabın artık aktif. Giriş yapıp siparişini tamamlayabilirsin."
            : ("error" in result ? result.error : "Bağlantı geçersiz.") +
              " Hesabına giriş yapıp yeni bir doğrulama bağlantısı isteyebilirsin."}
        </p>
        <div className="auth-actions">
          <Link href="/uye/giris" className="btn btn-primary">
            Giriş yap
          </Link>
          {ok && (
            <Link href="/odeme" className="btn btn-ghost">
              Ödemeye dön
            </Link>
          )}
        </div>
      </div>
    </main>
  );
}
