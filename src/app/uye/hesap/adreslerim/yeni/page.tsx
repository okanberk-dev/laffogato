import Link from "next/link";

import { AccountShell, AccountCard } from "@/components/uye/account-shell";
import { requireCustomer } from "@/lib/customer/auth";

import { createAddressAction } from "../../../actions";
import { AddressForm } from "../address-form";

export const metadata = { title: "Yeni adres · L'Affogato" };
export const dynamic = "force-dynamic";

export default async function YeniAdresPage() {
  const customer = await requireCustomer();
  return (
    <AccountShell customer={customer} active="adreslerim">
      <div style={{ marginBottom: 14 }}>
        <Link
          href="/uye/hesap/adreslerim"
          className="eyebrow"
          style={{ display: "inline-block" }}
        >
          ← Adreslerim
        </Link>
      </div>
      <AccountCard title="Yeni adres" hint="Teslimat için yeni bir adres ekle">
        <AddressForm action={createAddressAction} submitLabel="Adresi kaydet" />
      </AccountCard>
    </AccountShell>
  );
}
