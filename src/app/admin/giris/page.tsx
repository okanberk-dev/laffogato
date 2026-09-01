import { redirect } from "next/navigation";

import { getAdminSession } from "@/lib/admin/auth";

import { LoginForm } from "./login-form";

export const metadata = { title: "Admin Girişi" };

interface PageProps {
  searchParams: Promise<{ next?: string }>;
}

export default async function AdminLoginPage({ searchParams }: PageProps) {
  const session = await getAdminSession();
  const { next } = await searchParams;

  if (session) {
    redirect(next && next.startsWith("/admin") ? next : "/admin");
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-6 py-16">
      <div className="w-full rounded-2xl border border-[var(--admin-border)] bg-white p-10 shadow-sm">
        <div className="mb-8 text-center">
          <span
            className="brand-mark mx-auto"
            role="img"
            aria-label="L’Affogato"
            style={{ height: 54, color: "var(--brand)" }}
          />
          <div
            className="mt-2 text-xs tracking-[0.24em] text-neutral-500 uppercase"
            style={{ fontFamily: "var(--mono), monospace" }}
          >
            Admin · Tuzla
          </div>
        </div>

        <LoginForm next={next} />

        {/* Bu sayfa kimlik doğrulaması olmadan açılıyor; burada yönetici
            e-postasını yazmak, brute-force için gereken iki bilgiden birini
            hediye etmek demekti. */}
        <p className="mt-8 text-center text-xs text-neutral-400">
          Şifreni unuttuysan, ortam değişkenlerine erişimi olan yöneticiyle
          iletişime geç.
        </p>
      </div>
    </main>
  );
}
