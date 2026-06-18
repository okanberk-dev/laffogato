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
    <main
      style={{
        minHeight: "70vh",
        display: "grid",
        placeItems: "center",
        padding: "48px 20px",
        background: "var(--bg, #FAF6EE)",
      }}
    >
      <div
        style={{
          maxWidth: 460,
          textAlign: "center",
          background: "#fff",
          borderRadius: 18,
          padding: "40px 32px",
          border: "1px solid rgba(20,16,11,0.08)",
        }}
      >
        <div
          style={{
            width: 56,
            height: 56,
            margin: "0 auto 20px",
            borderRadius: "50%",
            display: "grid",
            placeItems: "center",
            background: ok ? "#E7F2EA" : "#FBE9E7",
            color: ok ? "#2F7A52" : "#B5402F",
            fontSize: 26,
          }}
        >
          {ok ? "✓" : "!"}
        </div>
        <h1 style={{ fontFamily: "var(--serif)", fontStyle: "italic", fontSize: 28, marginBottom: 12 }}>
          {ok ? "E-postan doğrulandı" : "Doğrulanamadı"}
        </h1>
        <p style={{ color: "rgba(20,16,11,0.7)", lineHeight: 1.6, fontSize: 15, marginBottom: 28 }}>
          {ok
            ? "Hesabın artık aktif. Giriş yapıp siparişini tamamlayabilirsin."
            : ("error" in result ? result.error : "Bağlantı geçersiz.") +
              " Hesabına giriş yapıp yeni bir doğrulama bağlantısı isteyebilirsin."}
        </p>
        <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
          <Link href="/uye/giris" className="btn btn-primary btn-sm">
            Giriş yap
          </Link>
          {ok && (
            <Link href="/odeme" className="btn btn-ghost btn-sm">
              Ödemeye dön
            </Link>
          )}
        </div>
      </div>
    </main>
  );
}
