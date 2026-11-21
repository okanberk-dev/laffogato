import { redirect } from "next/navigation";

import { getAdminSession } from "@/lib/admin/auth";
import { adminNextPath } from "@/lib/admin/next-path";
import { landingPathFor } from "@/lib/admin/roles";

import { LoginForm } from "./login-form";

export const metadata = { title: "Admin Girişi" };

interface PageProps {
  searchParams: Promise<{ next?: string }>;
}

export default async function AdminLoginPage({ searchParams }: PageProps) {
  const session = await getAdminSession();
  const next = adminNextPath((await searchParams).next) ?? undefined;

  if (session) {
    redirect(next ?? landingPathFor(session.role));
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-4 py-10 sm:px-6 sm:py-16">
      <div className="w-full rounded-xl border border-[var(--admin-card-border)] bg-[var(--admin-surface)] p-6 sm:p-8">
        {/* The page's name for a screen reader; the mark says it to the eye. */}
        <h1 className="sr-only">Panele giriş</h1>
        <div className="mb-8 text-center">
          <span
            className="brand-mark mx-auto"
            role="img"
            aria-label="L’Affogato"
            style={{ height: 54, color: "var(--brand)" }}
          />
          <div
            className="mt-2 text-xs tracking-[0.24em] text-[var(--admin-text-mute)] uppercase"
            style={{ fontFamily: "var(--mono), monospace" }}
          >
            Admin · Tuzla
          </div>
        </div>

        <LoginForm next={next} />

        {/* Bu sayfa kimlik doğrulaması olmadan açılıyor; burada yönetici
            e-postasını yazmak, brute-force için gereken iki bilgiden birini
            hediye etmek demekti. Panel parolasını sahip Kullanıcılar
            sayfasından sıfırlar; ortam değişkeni hesabı yalnız acil durum
            girişidir. */}
        <p className="mt-8 text-center text-xs text-[var(--admin-text-soft)]">
          Şifreni unuttuysan işletme sahibinden sıfırlamasını iste.
        </p>
      </div>
    </main>
  );
}
