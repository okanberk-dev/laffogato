import { redirect } from "next/navigation";

import { AuthCard } from "@/components/admin/auth-card";
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
    <AuthCard
      title="Tekrar hoş geldin"
      description="Panele girmek için e-posta adresini ve şifreni yaz."
      // Bu sayfa kimlik doğrulaması olmadan açılıyor; burada yönetici
      // e-postasını yazmak, brute-force için gereken iki bilgiden birini
      // hediye etmek demekti. Panel parolasını sahip Kullanıcılar
      // sayfasından sıfırlar; ortam değişkeni hesabı yalnız acil durum
      // girişidir.
      foot="Şifreni unuttuysan işletme sahibinden sıfırlamasını iste."
    >
      <LoginForm next={next} />
    </AuthCard>
  );
}
