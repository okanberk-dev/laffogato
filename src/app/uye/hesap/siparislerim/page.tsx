import Link from "@/components/link";
import {
  AccountShell,
  AccountCard,
  EmptyState,
} from "@/components/uye/account-shell";
import { requireCustomer } from "@/lib/customer/auth";
import { memberOrders } from "@/lib/customer/member-orders";

import { formatTRY, STATUS_LABEL, formatDate } from "../shared";

export const metadata = { title: "Siparişlerim · L'Affogato" };
export const dynamic = "force-dynamic";

export default async function SiparislerimPage() {
  const customer = await requireCustomer();
  const orders = await memberOrders(customer);

  return (
    <AccountShell customer={customer} active="siparislerim">
      <AccountCard
        title="Siparişlerim"
        hint={`${orders.length} sipariş kayıtlı`}
      >
        {orders.length === 0 ? (
          <EmptyState
            title={
              customer.emailVerified
                ? "Henüz siparişin yok"
                : "Siparişlerin e-posta doğrulamasından sonra görünür"
            }
            hint={
              customer.emailVerified
                ? "Bir affogato seç, hemen başlayalım."
                : "Hesabım sayfasından doğrulama bağlantısını yeniden gönderebilirsin."
            }
            cta={
              <Link href="/magaza" className="btn btn-primary btn-sm">
                Mağazaya git
              </Link>
            }
          />
        ) : (
          <ul className="account-order-list">
            {orders.map((o) => (
              <li key={o.id}>
                <Link
                  href={`/uye/hesap/siparislerim/${o.orderNo}`}
                  className="account-order-card"
                >
                  <div className="account-order-head">
                    <span className="account-order-no">#{o.orderNo}</span>
                    <span className="status-chip" data-tone={o.status}>
                      {STATUS_LABEL[o.status] ?? o.status}
                    </span>
                  </div>
                  <div className="account-order-items">
                    {o.items
                      .map((it) => `${it.qty}× ${it.productName}`)
                      .join(", ")}
                  </div>
                  <div className="account-order-meta">
                    <span>{formatDate(o.createdAt)}</span>
                    <span className="account-order-total">
                      {formatTRY(o.totalMinor)}
                    </span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </AccountCard>
    </AccountShell>
  );
}
