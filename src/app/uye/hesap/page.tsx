import Link from "next/link";

import {
  AccountShell,
  AccountStat,
  AccountCard,
  EmptyState,
} from "@/components/uye/account-shell";
import { VerifyNotice } from "@/components/customer/verify-notice";
import { customerOrdersByEmail, listPromos } from "@/lib/admin/store";
import { requireCustomer } from "@/lib/customer/auth";
import { isDbUnreachable } from "@/lib/db/health";
import { getLoyalty } from "@/lib/mobile/loyalty";
import type { LoyaltyView } from "@/lib/mobile/loyalty-core";

import { formatTRY, STATUS_LABEL } from "./shared";

export const metadata = { title: "Hesabım · L'Affogato" };
export const dynamic = "force-dynamic";

export default async function HesapPage() {
  const customer = await requireCustomer();
  const [orders, promos] = await Promise.all([
    customerOrdersByEmail(customer.email),
    listPromos(),
  ]);

  // The stamp card, with the reader's own stamps on it. The home page shows
  // the programme; this is the only page that knows who is looking. A failure
  // here must not take the dashboard down with it — the member still needs
  // their orders and addresses.
  let loyalty: LoyaltyView | null = null;
  try {
    loyalty = await getLoyalty(customer.email);
  } catch (err) {
    if (!isDbUnreachable(err)) {
      console.error("[uye/hesap] getLoyalty", err);
    }
  }

  const totalSpent = orders
    .filter((o) =>
      ["paid", "preparing", "shipped", "completed"].includes(o.status),
    )
    .reduce((sum, o) => sum + o.totalMinor, 0);
  const inFlight = orders.filter((o) =>
    ["pending_payment", "paid", "preparing", "shipped"].includes(o.status),
  ).length;
  const completed = orders.filter((o) => o.status === "completed").length;
  const usablePromos = promos.filter(
    (p) =>
      p.isActive &&
      (p.usageLimit === 0 || p.usageCount < p.usageLimit) &&
      (!p.expiresAt || new Date(p.expiresAt) > new Date()),
  );

  const recentOrders = orders.slice(0, 3);

  return (
    <AccountShell customer={customer} active="dashboard">
      {!customer.emailVerified && (
        <div style={{ marginBottom: 24 }}>
          <VerifyNotice email={customer.email} />
        </div>
      )}
      <div className="account-stat-grid">
        <AccountStat label="Toplam sipariş" value={orders.length} />
        <AccountStat
          label="Aktif sipariş"
          value={inFlight}
          hint="Henüz tamamlanmamış"
        />
        <AccountStat
          label="Tamamlanan"
          value={completed}
          hint="Teslim alındı"
        />
        <AccountStat
          label="Toplam harcama"
          value={formatTRY(totalSpent)}
          hint={`${customer.wishlist.length} favori · ${customer.addresses.length} adres`}
        />
      </div>

      {loyalty && (
        <div className="loyalty-card account-loyalty">
          <div className="loyalty-card-head">
            <span className="eyebrow on-dark">
              L’Af Ödüller · uygulama ile tek hesap
            </span>
            <span className="loyalty-tier">{loyalty.tierLabel}</span>
          </div>
          <div className="stamp-grid">
            {Array.from({ length: loyalty.stampTarget }, (_, i) => {
              const filled = i < loyalty.stamps;
              const reward = i === loyalty.stampTarget - 1;
              return (
                <div
                  key={i}
                  className={`stamp ${filled ? "filled" : ""} ${reward && !filled ? "reward" : ""}`}
                >
                  {filled ? "✓" : reward ? "★" : ""}
                </div>
              );
            })}
          </div>
          <div className="loyalty-headline">
            {loyalty.rewardsReady > 0
              ? `Ücretsiz içeceğin hazır${loyalty.rewardsReady > 1 ? ` — ${loyalty.rewardsReady} adet` : ""}.`
              : `${loyalty.stampTarget - loyalty.stamps} damga kaldı — sonraki içecek bizden.`}
          </div>
          <p className="account-loyalty-note">
            Web’den ya da uygulamadan verilen her sipariş bir damga. Damgan,
            kuponların ve seviyen iki tarafta da aynı.
          </p>
        </div>
      )}

      <AccountCard
        title="Son siparişler"
        action={
          orders.length > 0 ? (
            <Link
              href="/uye/hesap/siparislerim"
              className="btn btn-ghost btn-sm"
            >
              Tümünü gör →
            </Link>
          ) : null
        }
      >
        {recentOrders.length === 0 ? (
          <EmptyState
            title="Henüz siparişin yok"
            hint="Mağazadan bir affogato seç, ilk sipariş senin olsun."
            cta={
              <Link href="/#shop" className="btn btn-primary btn-sm">
                Mağazaya git →
              </Link>
            }
          />
        ) : (
          <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
            {recentOrders.map((o) => (
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
                    <span>
                      {new Intl.DateTimeFormat("tr-TR", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      }).format(new Date(o.createdAt))}
                    </span>
                    <span>{formatTRY(o.totalMinor)}</span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </AccountCard>

      <AccountCard
        title="Kullanılabilir promosyonlar"
        hint="Sepet sayfasında kodu uygula"
      >
        {usablePromos.length === 0 ? (
          <p style={{ margin: 0, color: "var(--ink-soft)", fontSize: 14 }}>
            Şu an aktif bir promosyon kodu yok.
          </p>
        ) : (
          <div>
            {usablePromos.slice(0, 3).map((p) => (
              <div key={p.id} className="account-promo-card">
                <div className="account-promo-code">{p.code}</div>
                <div className="account-promo-meta">
                  <span
                    style={{
                      fontFamily: "var(--serif-display)",
                      fontSize: 16,
                      color: "var(--ink)",
                    }}
                  >
                    {p.kind === "pct"
                      ? `%${p.value} indirim`
                      : `${formatTRY(p.value)} indirim`}
                  </span>
                  {p.minSubtotalMinor > 0 && (
                    <span>{formatTRY(p.minSubtotalMinor)}+ sepete</span>
                  )}
                  {p.expiresAt && (
                    <span>
                      {new Intl.DateTimeFormat("tr-TR", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      }).format(new Date(p.expiresAt))}{" "}
                      bitiyor
                    </span>
                  )}
                </div>
              </div>
            ))}
            {usablePromos.length > 3 && (
              <Link
                href="/uye/hesap/promosyonlar"
                className="btn btn-ghost btn-sm"
                style={{ marginTop: 12 }}
              >
                Tümünü gör ({usablePromos.length}) →
              </Link>
            )}
          </div>
        )}
      </AccountCard>
    </AccountShell>
  );
}
