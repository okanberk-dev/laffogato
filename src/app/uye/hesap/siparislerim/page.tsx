import Link from "next/link";

import {
  AccountShell,
  AccountCard,
  EmptyState,
} from "@/components/uye/account-shell";
import { customerOrdersByEmail } from "@/lib/admin/store";
import { requireCustomer } from "@/lib/customer/auth";

import { formatTRY, STATUS_LABEL, formatDate } from "../shared";

export const metadata = { title: "Siparişlerim · L'Affogato" };
export const dynamic = "force-dynamic";

export default async function SiparislerimPage() {
  const customer = await requireCustomer();
  const orders = await customerOrdersByEmail(customer.email);

  return (
    <AccountShell customer={customer} active="siparislerim">
      <AccountCard
        title="Siparişlerim"
        hint={`${orders.length} sipariş kayıtlı`}
      >
        {orders.length === 0 ? (
          <EmptyState
            title="Henüz siparişin yok"
            hint="Bir affogato seç, hemen başlayalım."
            cta={
              <Link href="/#shop" className="btn btn-primary btn-sm">
                Mağazaya git →
              </Link>
            }
          />
        ) : (
          <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
            {orders.map((o) => (
              <li key={o.id}>
                <Link
                  href={`/uye/hesap/siparislerim/${o.orderNo}`}
                  className="account-order-card"
                  style={{ textDecoration: "none", color: "inherit" }}
                >
                  <div className="account-order-head">
                    <span className="account-order-no">#{o.orderNo}</span>
                    <span className="status-chip" data-tone={o.status}>
                      {STATUS_LABEL[o.status] ?? o.status}
                    </span>
                  </div>
                  <div style={{ fontSize: 14, color: "var(--ink-soft)" }}>
                    {o.items
                      .map((it) => `${it.qty}× ${it.productName}`)
                      .join(", ")}
                  </div>
                  <div className="account-order-meta">
                    <span>{formatDate(o.createdAt)}</span>
                    <span>{formatTRY(o.totalMinor)}</span>
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
