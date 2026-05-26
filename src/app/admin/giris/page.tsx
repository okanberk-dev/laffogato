export const metadata = { title: "Admin Girişi" };

export default function AdminLoginPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md items-center px-6 py-16">
      <div className="w-full rounded-lg border border-neutral-200 p-8 shadow-sm">
        <h1 className="text-2xl font-semibold">Admin Girişi</h1>
        <p className="mt-2 text-sm text-neutral-600">
          E-posta ve şifre ile giriş. 2FA tanımlı hesaplar için TOTP kodu
          istenir. Form alanları auth entegrasyonu yapılınca eklenecek.
        </p>
      </div>
    </main>
  );
}
