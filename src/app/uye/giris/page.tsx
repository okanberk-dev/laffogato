import { redirect } from "next/navigation";

import { DegradedAuthNotice } from "@/components/customer/degraded-auth-notice";
import { LafMark } from "@/components/laffogato/brand-mark";
import Link from "@/components/link";
import { AuthOr, GoogleSignInLink } from "@/components/uye/google-sign-in";
import { LoginForm } from "./login-form";
import { getActiveCustomer } from "@/lib/customer/auth";
import { googleNotice } from "@/lib/customer/google-sign-in-core";
import { sameSitePath } from "@/lib/http/same-site-path";
import { getSiteSettings } from "@/lib/seo/site-data";

export const metadata = { title: "Giriş yap · L'Affogato" };
export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{
    dogrulandi?: string;
    next?: string;
    google?: string;
  }>;
}

export default async function GirisPage({ searchParams }: PageProps) {
  // `?next=` is how /odeme and /karaoke send a signed-out visitor here; it
  // rides the form to `loginAction`, which follows it only if it is a path
  // on this site.
  const { dogrulandi, next: rawNext, google } = await searchParams;
  const next = sameSitePath(rawNext) ?? undefined;
  const active = await getActiveCustomer();
  if (active) redirect(next ?? "/uye/hesap");
  // "Google ile devam et" while the panel switch is on (Mobil → Ayarlar →
  // Giriş yöntemleri), and the line the Google return sent back with, if
  // the flow ended without a sign-in (docs/AUTH-BRIDGE.md §7).
  const googleOpen = (await getSiteSettings()).mobileApp.signIn.google;
  const googleLine = googleNotice(google);
  // `?dogrulandi=1` is where Supabase's confirmation mail lands
  // (`supabaseEmailRedirectUrl`). It was being produced and never read, so a
  // member who had just confirmed their address arrived at a plain login form
  // with nothing saying the link had worked - and the obvious next move,
  // clicking the link again, spends a token that is already spent and answers
  // "expired".
  const justVerified = dogrulandi === "1";

  return (
    <div className="auth-page">
      {/* The reference's log-in panel, one column on the band: the title,
          the Google door and its "ya da" rule (when the switch is on), the
          one quiet line over the fields, the 350px button, and under it
          the small question with its answer (the reference's "What about
          a password?"), here the way to an account. */}
      <section className="auth-card" aria-labelledby="auth-title">
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
        {googleLine && (
          <p role="alert" className="auth-alert auth-note--status">
            {googleLine}
          </p>
        )}
        <h1 id="auth-title" className="auth-title">
          Tekrar hoş geldin
        </h1>
        {googleOpen && (
          <>
            <GoogleSignInLink next={next} />
            <AuthOr />
          </>
        )}
        <p className="auth-lede">
          Hesabınla giriş yap; sipariş geçmişini gör, bilgileri saniyede doldur.
        </p>
        <LoginForm next={next} />
        <div className="auth-foot">
          <Link href="/uye/sifremi-unuttum" className="auth-link">
            Şifreni mi unuttun?
          </Link>
        </div>

        <section className="auth-join" aria-labelledby="auth-join-title">
          <h2 id="auth-join-title" className="auth-join-title">
            Henüz üye değil misin?
          </h2>
          <p className="auth-join-lede">
            Ücretsiz üye ol; uygulamada ve sitede aynı hesapla devam et.
          </p>
          <ul className="auth-join-perks">
            <li>
              <span className="auth-join-stamp" aria-hidden="true" />
              Uygulamadan verdiğin kafe siparişlerinde damga topla
            </li>
            <li>
              <span className="auth-join-stamp" aria-hidden="true" />
              Damgaların ücretsiz içecek kuponuna dönüşsün
            </li>
            <li>
              <span className="auth-join-stamp" aria-hidden="true" />
              Siparişlerin ve adreslerin tek yerde dursun
            </li>
          </ul>
          <Link href="/uye/kayit" className="btn btn-ghost btn-wide">
            Üye ol
          </Link>
        </section>
      </section>
    </div>
  );
}
