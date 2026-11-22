import {
  AccountBack,
  AccountCard,
  AccountShell,
} from "@/components/uye/account-shell";
import { requireCustomer } from "@/lib/customer/auth";

import { createAddressAction } from "../../../actions";
import { AddressForm } from "../address-form";

export const metadata = { title: "Yeni adres · L'Affogato" };
export const dynamic = "force-dynamic";

export default async function YeniAdresPage() {
  const customer = await requireCustomer();
  return (
    <AccountShell customer={customer} active="adreslerim">
      <AccountBack href="/uye/hesap/adreslerim" label="Adreslerim" />
      <AccountCard
        title="Yeni adres"
        hint="Teslimat için yeni bir adres ekle"
        layout="split"
      >
        <AddressForm action={createAddressAction} submitLabel="Adresi kaydet" />
      </AccountCard>
    </AccountShell>
  );
}
