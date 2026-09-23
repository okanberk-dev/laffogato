import Link from "next/link";
import { redirect } from "next/navigation";

import { DegradedAuthNotice } from "@/components/customer/degraded-auth-notice";
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
    <main
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        padding: "clamp(40px, 8vw, 80px) var(--gutter)",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 440,
          background: "#FFF",
          padding: "clamp(28px, 5vw, 44px)",
          borderRadius: "var(--r-lg)",
          boxShadow: "var(--shadow-md)",
          border: "1px solid var(--ink-line)",
        }}
      >
        <Link
          href="/"
          className="eyebrow"
          style={{ display: "inline-block", marginBottom: 18 }}
        >
          ← Anasayfa
        </Link>
        <DegradedAuthNotice />
        {justVerified && (
          <p
            role="status"
            style={{
              margin: "0 0 18px",
              padding: "12px 14px",
              borderRadius: "var(--r-btn)",
              border: "1px solid var(--hero-green)",
              background: "var(--hero-tile)",
              color: "var(--hero-green)",
              fontSize: 14,
              lineHeight: 1.5,
            }}
          >
            E-posta adresin doğrulandı. Şifrenle giriş yapabilirsin.
          </p>
        )}
        <h1
          className="h1"
          style={{
            marginTop: 4,
            marginBottom: 64,
            fontSize: "clamp(32px, 5vw, 44px)",
          }}
        >
          Giriş <span className="script">yap.</span>
        </h1>
        <p
          style={{
            color: "var(--ink-soft)",
            fontSize: 14,
            lineHeight: 1.6,
            marginTop: 0,
            marginBottom: 28,
          }}
        >
          Hesabınla giriş yap; sipariş geçmişini gör, bilgileri saniyede doldur.
        </p>
        <LoginForm next={next} />
        <div
          style={{
            marginTop: 22,
            paddingTop: 18,
            borderTop: "1px solid var(--ink-line)",
            fontSize: 13,
            color: "var(--ink-soft)",
            textAlign: "center",
          }}
        >
          <div style={{ marginBottom: 10 }}>
            <Link
              href="/uye/sifremi-unuttum"
              style={{
                color: "var(--gold-deep)",
                textDecoration: "underline",
                textUnderlineOffset: 3,
              }}
            >
              Şifreni mi unuttun?
            </Link>
          </div>
          Hesabın yok mu?{" "}
          <Link
            href="/uye/kayit"
            style={{
              color: "var(--gold-deep)",
              textDecoration: "underline",
              textUnderlineOffset: 3,
            }}
          >
            Üye ol
          </Link>
        </div>
      </div>
    </main>
  );
}
