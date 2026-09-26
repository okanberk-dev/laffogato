import Link from "next/link";
import { redirect } from "next/navigation";

import { DegradedAuthNotice } from "@/components/customer/degraded-auth-notice";
import { LafMark } from "@/components/laffogato/brand-mark";
import { LoginForm } from "./login-form";
import { getActiveCustomer } from "@/lib/customer/auth";
import { sameSitePath } from "@/lib/http/same-site-path";

export const metadata = { title: "Giriş yap · L'Affogato" };
export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ dogrulandi?: string; next?: string }>;
}

export default async function GirisPage({ searchParams }: PageProps) {
  // `?next=` is how /odeme and /karaoke send a signed-out visitor here; it
  // rides the form to `loginAction`, which follows it only if it is a path
  // on this site.
  const { dogrulandi, next: rawNext } = await searchParams;
  const next = sameSitePath(rawNext) ?? undefined;
  const active = await getActiveCustomer();
  if (active) redirect(next ?? "/uye/hesap");
  // `?dogrulandi=1` is where Supabase's confirmation mail lands
  // (`supabaseEmailRedirectUrl`). It was being produced and never read, so a
  // member who had just confirmed their address arrived at a plain login form
  // with nothing saying the link had worked - and the obvious next move,
  // clicking the link again, spends a token that is already spent and answers
  // "expired".
  const justVerified = dogrulandi === "1";

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-head">
          <Link href="/" className="auth-back">
            ← Anasayfa
          </Link>
          <LafMark tone="duo" />
        </div>
        <DegradedAuthNotice />
        {justVerified && (
          <p role="status" className="auth-note auth-note--status">
            E-posta adresin doğrulandı. Şifrenle giriş yapabilirsin.
          </p>
        )}
        <h1 className="auth-title">
          Giriş <span className="script">yap</span>
        </h1>
        <p className="auth-lede">
          Hesabınla giriş yap; sipariş geçmişini gör, bilgileri saniyede doldur.
        </p>
        <LoginForm next={next} />
        <div className="auth-foot">
          <Link href="/uye/sifremi-unuttum" className="auth-link">
            Şifreni mi unuttun?
          </Link>
          <span>
            Hesabın yok mu?{" "}
            <Link href="/uye/kayit" className="auth-link">
              Üye ol
            </Link>
          </span>
        </div>
      </div>
    </div>
  );
}
