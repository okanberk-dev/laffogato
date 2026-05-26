import Link from "next/link";
import { redirect } from "next/navigation";

import { LoginForm } from "./login-form";
import { getActiveCustomer } from "@/lib/customer/auth";

export const metadata = { title: "Giriş yap · L'Affogato" };
export const dynamic = "force-dynamic";

export default async function GirisPage() {
  const active = await getActiveCustomer();
  if (active) redirect("/uye/hesap");

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
        <Link href="/" className="eyebrow" style={{ display: "inline-block", marginBottom: 18 }}>
          ← Anasayfa
        </Link>
        <h1
          className="h-1"
          style={{
            marginTop: 4,
            marginBottom: 64,
            fontSize: "clamp(32px, 5vw, 44px)",
          }}
        >
          Giriş <span className="script">yap.</span>
        </h1>
        <p style={{ color: "var(--ink-soft)", fontSize: 14, lineHeight: 1.6, marginTop: 0, marginBottom: 28 }}>
          Hesabınla giriş yap; sipariş geçmişini gör, bilgileri saniyede doldur.
        </p>
        <LoginForm />
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
          Hesabın yok mu?{" "}
          <Link href="/uye/kayit" style={{ color: "var(--gold-deep)", textDecoration: "underline", textUnderlineOffset: 3 }}>
            Üye ol
          </Link>
        </div>
      </div>
    </main>
  );
}
