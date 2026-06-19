import Link from "next/link";
import { redirect } from "next/navigation";

import { RegisterForm } from "./register-form";
import { getActiveCustomer } from "@/lib/customer/auth";

export const metadata = { title: "Üye ol · L'Affogato" };
export const dynamic = "force-dynamic";

export default async function KayitPage() {
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
          maxWidth: 480,
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
        <h1
          className="h1"
          style={{
            marginTop: 4,
            marginBottom: 48,
            fontSize: "clamp(32px, 5vw, 44px)",
          }}
        >
          Üye <span className="script">ol.</span>
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
          Sipariş geçmişini takip et, tekrar siparişlerde formu hızlı doldur,
          özel kampanyalardan haberdar ol.
        </p>
        <RegisterForm />
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
          Hesabın var mı?{" "}
          <Link
            href="/uye/giris"
            style={{
              color: "var(--gold-deep)",
              textDecoration: "underline",
              textUnderlineOffset: 3,
            }}
          >
            Giriş yap
          </Link>
        </div>
      </div>
    </main>
  );
}
