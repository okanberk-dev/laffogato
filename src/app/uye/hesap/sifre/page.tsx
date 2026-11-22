import Link from "@/components/link";
import { AccountShell, AccountCard } from "@/components/uye/account-shell";
import { requireCustomer } from "@/lib/customer/auth";
import { getSiteSettings } from "@/lib/seo/site-data";

import { PasswordForm } from "./password-form";

export const metadata = { title: "Şifre · L'Affogato" };
export const dynamic = "force-dynamic";

export default async function SifrePage() {
  const customer = await requireCustomer();
  // A member who opened the account with Google has no password anywhere:
  // the form asks for the current one and can only answer "hatalı". The
  // way in is the reset mail, which writes the new password to the site
  // and to Supabase alike (docs/AUTH-BRIDGE.md §7). Said only while the
  // Google door is open, so nobody reads about a door they never saw.
  const googleOpen = (await getSiteSettings()).mobileApp.signIn.google;
  return (
    <AccountShell customer={customer} active="sifre">
      <AccountCard
        title="Şifre"
        hint="Hesabını güvende tutmak için düzenli olarak güncelle"
        layout="split"
      >
        <PasswordForm />
        {googleOpen && (
          <p className="account-msg" data-tone="info">
            Üyeliğini Google hesabınla açtıysan henüz bir şifren yok: önce{" "}
            <Link href="/uye/sifremi-unuttum" className="auth-link">
              Şifremi unuttum
            </Link>{" "}
            ile e-postana gelen bağlantıdan bir şifre belirle; sonra burada
            değiştirebilirsin.
          </p>
        )}
      </AccountCard>
    </AccountShell>
  );
}
