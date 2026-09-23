/**
 * One line the operator could not see before: whether this deployment holds
 * the Supabase service-role key.
 *
 * Without it the site keeps working, and that is exactly the problem - two
 * promises quietly stop being kept and nothing says so. A password reset here
 * leaves the old password opening the app, and a closed account's sign-in
 * record stays in Supabase. The only place to check was the Vercel dashboard,
 * which neither the panel nor the audit tooling can read.
 *
 * Presence only. The page is handed a boolean; the key itself never reaches
 * this component, the page, or the browser.
 */
export function IdentityKeyStatus({ hasKey }: { hasKey: boolean }) {
  return (
    <p
      data-testid="supabase-service-role-status"
      className={`mb-4 rounded-md border px-3 py-2 text-xs ${
        hasKey
          ? "border-emerald-200 bg-emerald-50 text-emerald-800"
          : "border-rose-200 bg-rose-50 text-rose-800"
      }`}
    >
      <strong>Supabase servis anahtarı: {hasKey ? "tanımlı" : "tanımlı değil"}</strong>
      {hasKey ? (
        <>
          {" "}
          - sitede sıfırlanan şifre uygulamaya da yazılır, hesabını kapatan
          üyenin bağlı giriş kaydı Supabase&apos;den silinir. Anahtarın değeri
          burada gösterilmez.
        </>
      ) : (
        <>
          {" "}
          - sitede sıfırlanan şifre uygulamada eski hâliyle çalışmaya devam
          eder ve hesabını kapatan üyenin giriş kaydı (e-posta ve kayıt
          bilgileri) Supabase&apos;de kalır. Vercel → Environment
          Variables&apos;a <code>SUPABASE_SERVICE_ROLE_KEY</code> ekleyip
          yeniden dağıt.
        </>
      )}
    </p>
  );
}
