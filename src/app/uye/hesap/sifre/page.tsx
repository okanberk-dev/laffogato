import { AccountShell, AccountCard } from "@/components/uye/account-shell";
import { requireCustomer } from "@/lib/customer/auth";

import { PasswordForm } from "./password-form";

export const metadata = { title: "Şifre · L'Affogato" };
export const dynamic = "force-dynamic";

export default async function SifrePage() {
  const customer = await requireCustomer();
  return (
    <AccountShell customer={customer} active="sifre">
      <AccountCard
        title="Şifre"
        hint="Hesabını güvende tutmak için düzenli olarak güncelle"
      >
        <PasswordForm />
      </AccountCard>
    </AccountShell>
  );
}
