import Link from "next/link";
import { notFound } from "next/navigation";

import { AccountShell, AccountCard } from "@/components/uye/account-shell";
import { requireCustomer } from "@/lib/customer/auth";

import {
  updateAddressAction,
  type AddressFormState,
} from "../../../../actions";
import { AddressForm } from "../../address-form";

export const metadata = { title: "Adresi düzenle · L'Affogato" };
export const dynamic = "force-dynamic";

export default async function DuzenleAdresPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const customer = await requireCustomer();
  const address = customer.addresses.find((a) => a.id === id);
  if (!address) notFound();

  const boundAction = async (prev: AddressFormState, formData: FormData) =>
    updateAddressAction(id, prev, formData);

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
      <AccountCard
        title={address.label || "Adres"}
        hint={address.isDefault ? "Varsayılan adres" : undefined}
      >
        <AddressForm
          defaults={address}
          action={boundAction}
          submitLabel="Değişiklikleri kaydet"
        />
      </AccountCard>
    </AccountShell>
  );
}
