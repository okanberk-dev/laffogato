import { AccountShell, AccountCard, EmptyState } from "@/components/uye/account-shell";
import { listPromos } from "@/lib/admin/store";
import { requireCustomer } from "@/lib/customer/auth";

import { formatTRY } from "../shared";

export const metadata = { title: "Promosyonlar · L'Affogato" };
export const dynamic = "force-dynamic";

export default async function PromosyonlarPage() {
  const customer = await requireCustomer();
  const all = await listPromos();
  const now = new Date();
  const usable = all.filter(
    (p) =>
      p.isActive &&
      (p.usageLimit === 0 || p.usageCount < p.usageLimit) &&
      (!p.expiresAt || new Date(p.expiresAt) > now),
  );
  const expired = all.filter(
    (p) => p.expiresAt && new Date(p.expiresAt) <= now,
  );

  return (
    <AccountShell customer={customer} active="promosyonlar">
      <AccountCard
        title="Kullanılabilir kodlar"
        hint="Sepet ekranında kodu uygula, indirim otomatik düşer"
      >
        {usable.length === 0 ? (
          <EmptyState
            title="Şu an aktif promosyon yok"
            hint="Yeni kampanyalardan haberdar olmak için bildirim tercihlerinde 'Kampanya & yeni ürün' seçeneğini açabilirsin."
          />
        ) : (
          <div>
            {usable.map((p) => (
              <div key={p.id} className="account-promo-card">
                <div className="account-promo-code">{p.code}</div>
                <div className="account-promo-meta">
                  <span
                    style={{
                      fontFamily: "var(--serif-display)",
                      fontSize: 18,
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
                      tarihinde sona erer
                    </span>
                  )}
                  {p.usageLimit > 0 && (
                    <span>
                      {p.usageLimit - p.usageCount} kullanım hakkı kaldı
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </AccountCard>

      {expired.length > 0 && (
        <AccountCard title="Sona eren kodlar" hint="Geçmiş kampanyalar">
          <div style={{ opacity: 0.55 }}>
            {expired.slice(0, 5).map((p) => (
              <div key={p.id} className="account-promo-card">
                <div className="account-promo-code">{p.code}</div>
                <div className="account-promo-meta">
                  <span style={{ fontFamily: "var(--serif-display)", fontSize: 16 }}>
                    {p.kind === "pct"
                      ? `%${p.value} indirim`
                      : `${formatTRY(p.value)} indirim`}
                  </span>
                  <span>
                    {new Intl.DateTimeFormat("tr-TR", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                    }).format(new Date(p.expiresAt))}{" "}
                    tarihinde sona erdi
                  </span>
                </div>
              </div>
            ))}
          </div>
        </AccountCard>
      )}
    </AccountShell>
  );
}
