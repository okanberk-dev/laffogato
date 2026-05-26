import { AccountShell, AccountCard } from "@/components/uye/account-shell";
import { requireCustomer } from "@/lib/customer/auth";

import { ProfileForm } from "../profile-form";

export const metadata = { title: "Bilgilerim · L'Affogato" };
export const dynamic = "force-dynamic";

export default async function BilgilerimPage() {
  const customer = await requireCustomer();
  return (
    <AccountShell customer={customer} active="bilgilerim">
      <AccountCard title="Bilgilerim" hint="Ad, telefon ve doğum günü">
        <ProfileForm
          defaultName={customer.name}
          defaultPhone={customer.phone}
          defaultBirthday={customer.birthday}
          email={customer.email}
        />
      </AccountCard>
    </AccountShell>
  );
}
