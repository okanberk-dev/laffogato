import Link from "next/link";
import { redirect } from "next/navigation";

import { DegradedAuthNotice } from "@/components/customer/degraded-auth-notice";
import { LafMark } from "@/components/laffogato/brand-mark";
import { RegisterForm } from "./register-form";
import { getActiveCustomer } from "@/lib/customer/auth";

export const metadata = { title: "Üye ol · L'Affogato" };
export const dynamic = "force-dynamic";

export default async function KayitPage() {
  const active = await getActiveCustomer();
  if (active) redirect("/uye/hesap");

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
