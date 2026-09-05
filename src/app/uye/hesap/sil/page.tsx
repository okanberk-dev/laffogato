import Link from "next/link";

import { AccountShell, AccountCard } from "@/components/uye/account-shell";
import { requireCustomer } from "@/lib/customer/auth";

import { DeleteAccountForm } from "./delete-account-form";

export const metadata = { title: "Hesabı sil · L'Affogato" };
export const dynamic = "force-dynamic";

export default async function HesapSilPage() {
  const customer = await requireCustomer();
  return (
    <AccountShell customer={customer} active="sil">
      <AccountCard title="Hesabı sil" hint="Bu işlem geri alınamaz">
        <p style={{ margin: "0 0 12px", maxWidth: 560 }}>
          Hesabını kapattığında adın, telefonun, adres defterin, favori listen
          ve bildirim tercihlerin silinir; siparişlerin ise adın yerine anonim
          bir kayıtla, yasal saklama süresi boyunca kalır. Biriken damgaların ve
          kullanılmamış kuponların sona erer.
        </p>
        <p style={{ margin: "0 0 20px", maxWidth: 560 }}>
          Nelerin silindiğini, nelerin anonimleştirildiğini ve nelerin
          saklandığını{" "}
          <Link href="/hukuk/hesap-silme">hesap silme prosedürü</Link>{" "}
          sayfasında adım adım yazdık.
        </p>
        <DeleteAccountForm email={customer.email} />
      </AccountCard>
    </AccountShell>
  );
}
