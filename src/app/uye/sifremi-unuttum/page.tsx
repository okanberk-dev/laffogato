import Link from "next/link";
import { redirect } from "next/navigation";

import { DegradedAuthNotice } from "@/components/customer/degraded-auth-notice";
import { LafMark } from "@/components/laffogato/brand-mark";
import { getActiveCustomer } from "@/lib/customer/auth";

import { ForgotPasswordForm } from "./forgot-form";

export const metadata = {
  title: "Şifremi unuttum · L'Affogato",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

export default async function SifremiUnuttumPage() {
  const active = await getActiveCustomer();
  if (active) redirect("/uye/hesap/sifre");

  return (
    <main className="auth-page">
      <div className="auth-card">
        <div className="auth-head">
          <Link href="/uye/giris" className="auth-back">
            ← Giriş
          </Link>
          <LafMark tone="duo" />
        </div>
        <DegradedAuthNotice />
        <h1 className="auth-title">
          Şifremi <span className="script">unuttum.</span>
        </h1>
        <p className="auth-lede">
          Hesabının e-posta adresini yaz; yeni şifre belirlemen için bir
          bağlantı gönderelim. Bağlantı 1 saat geçerlidir.
        </p>
        <ForgotPasswordForm />
      </div>
    </main>
  );
}
