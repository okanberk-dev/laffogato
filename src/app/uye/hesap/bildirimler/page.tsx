import { AccountShell, AccountCard } from "@/components/uye/account-shell";
import { requireCustomer } from "@/lib/customer/auth";

import { NotificationsForm } from "./notifications-form";

export const metadata = { title: "Bildirim tercihleri · L'Affogato" };
export const dynamic = "force-dynamic";

export default async function BildirimlerPage() {
  const customer = await requireCustomer();
  return (
    <AccountShell customer={customer} active="bildirimler">
      <AccountCard
        title="Bildirim tercihleri"
        hint="Hangi bildirimleri almak istediğini seç"
        layout="split"
      >
        <NotificationsForm defaults={customer.notificationPrefs} />
      </AccountCard>
    </AccountShell>
  );
}
