import { StatusRow } from "./system-status";

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
 * this component, the page, or the browser. The fix is a deploy setting, so
 * it is worded as something to pass to the developer. A row of Sistem
 * durumu (./system-status.tsx), which opens by itself when the key is
 * missing.
 */
export function IdentityKeyStatus({ hasKey }: { hasKey: boolean }) {
  return (
    <StatusRow
      tone={hasKey ? "success" : "danger"}
      testId="supabase-service-role-status"
    >
      <strong className="font-medium text-[var(--admin-text)]">
        Supabase servis anahtarı: {hasKey ? "tanımlı" : "tanımlı değil"}
      </strong>
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
          - sitede sıfırlanan şifre uygulamada eski hâliyle çalışmaya devam eder
          ve hesabını kapatan üyenin giriş kaydı (e-posta ve kayıt bilgileri)
          Supabase&apos;de kalır. Geliştiriciye ilet: Vercel&apos;de{" "}
          <code>SUPABASE_SECRET_KEY</code> (Supabase&apos;in yeni gizli
          anahtarı; eski <code>SUPABASE_SERVICE_ROLE_KEY</code> da okunur ama
          2026 sonunda kalkıyor) tanımlanıp site yeniden yayına alınmalı.
        </>
      )}
    </StatusRow>
  );
}
