import { redirect } from "next/navigation";

import { DegradedAuthNotice } from "@/components/customer/degraded-auth-notice";
import { LafMark } from "@/components/laffogato/brand-mark";
import Link from "@/components/link";
import { AuthOr, GoogleSignInLink } from "@/components/uye/google-sign-in";
import { RegisterForm } from "./register-form";
import { getActiveCustomer } from "@/lib/customer/auth";
import { getSiteSettings } from "@/lib/seo/site-data";

export const metadata = { title: "Üye ol · L'Affogato" };
export const dynamic = "force-dynamic";

export default async function KayitPage() {
  const active = await getActiveCustomer();
  if (active) redirect("/uye/hesap");
  // Google first on this page: a new member who has a Google account is
  // two taps from an account, and the agreement's tick waits on the
  // consent page (/uye/google/onay) instead of here.
  const googleOpen = (await getSiteSettings()).mobileApp.signIn.google;

  return (
    <div className="auth-page">
      <div className="auth-card auth-card--wide">
        <div className="auth-head">
          <Link href="/" className="auth-back">
            ← Anasayfa
          </Link>
          <LafMark tone="duo" />
        </div>
        <DegradedAuthNotice />
        <h1 className="auth-title">
          Üye <span className="script">ol</span>
        </h1>
        <p className="auth-lede">
          Sipariş geçmişini takip et, tekrar siparişlerde formu hızlı doldur,
          özel kampanyalardan haberdar ol.
        </p>
        {googleOpen && (
          <>
            <GoogleSignInLink label="Google ile üye ol" />
            <AuthOr label="ya da e-postayla" />
          </>
        )}
        <RegisterForm />
        <div className="auth-foot">
          <span>
            Hesabın var mı?{" "}
            <Link href="/uye/giris" className="auth-link">
              Giriş yap
            </Link>
          </span>
        </div>
      </div>
    </div>
  );
}
