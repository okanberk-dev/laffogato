import {
  AccountShell,
  AccountCard,
  EmptyState,
} from "@/components/uye/account-shell";
import { listPromos } from "@/lib/admin/store";
import { requireCustomer } from "@/lib/customer/auth";
import {
  couponStatus,
  listCustomerCoupons,
  maybeGrantBirthdayCoupon,
  type CustomerCoupon,
} from "@/lib/customer/coupons";

import { formatTRY } from "../shared";

export const metadata = { title: "Promosyonlar · L'Affogato" };
export const dynamic = "force-dynamic";

function formatShortDate(iso: string): string {
  return new Intl.DateTimeFormat("tr-TR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "Europe/Istanbul",
  }).format(new Date(iso));
}

function discountLabel(kind: string, value: number): string {
  return kind === "pct" ? `%${value} indirim` : `${formatTRY(value)} indirim`;
}

function CouponCard({
  coupon,
  nowMs,
}: {
  coupon: CustomerCoupon;
  /** The page's one reading of the clock, so every card and the section
      split above them agree on which coupons are still active. */
  nowMs: number;
}) {
  const status = couponStatus(coupon, nowMs);
  const muted = status !== "active";
  const badge =
    status === "redeemed"
      ? {
          text: "Kullanıldı",
          bg: "rgba(120,120,120,0.12)",
          fg: "var(--ink-mute)",
        }
      : status === "expired"
        ? {
            text: "Süresi doldu",
            bg: "rgba(120,120,120,0.12)",
            fg: "var(--ink-mute)",
          }
        : status === "inactive"
          ? {
              text: "Pasif",
              bg: "rgba(120,120,120,0.12)",
              fg: "var(--ink-mute)",
            }
          : {
              text: "Kullanıma hazır",
              bg: "rgba(70,150,90,0.14)",
              fg: "#2f7d4f",
            };

  return (
    <div
      className="account-promo-card"
      style={muted ? { opacity: 0.6 } : undefined}
    >
      <div className="account-promo-code">{coupon.code}</div>
      <div className="account-promo-meta">
        {coupon.title && (
          <span
            style={{
              fontFamily: "var(--serif-display)",
              fontSize: 18,
              color: "var(--ink)",
            }}
          >
            {coupon.title}
          </span>
        )}
        <span>{discountLabel(coupon.kind, coupon.value)}</span>
        {coupon.minSubtotalMinor > 0 && (
          <span>{formatTRY(coupon.minSubtotalMinor)}+ sepete</span>
        )}
        {coupon.expiresAt && status === "active" && (
          <span>{formatShortDate(coupon.expiresAt)} tarihine kadar</span>
        )}
        <span
          style={{
            alignSelf: "flex-start",
            borderRadius: 999,
            padding: "3px 10px",
            fontSize: 12,
            fontWeight: 600,
            background: badge.bg,
            color: badge.fg,
          }}
        >
          {badge.text}
        </span>
      </div>
    </div>
  );
}

export default async function PromosyonlarPage() {
  const customer = await requireCustomer();

  // Lazy birthday gift: granted at most once a year, only during the member's
  // birthday month. Best-effort - never blocks the page.
  try {
    await maybeGrantBirthdayCoupon(customer.email, customer.birthday);
  } catch (err) {
    console.error("[coupons] birthday grant failed", err);
  }

  const [coupons, all] = await Promise.all([
    listCustomerCoupons(customer.email),
    listPromos(),
  ]);

  const now = new Date();
  const nowMs = now.getTime();
  const activeCoupons = coupons.filter(
    (c) => couponStatus(c, nowMs) === "active",
  );
  const pastCoupons = coupons.filter(
    (c) => couponStatus(c, nowMs) !== "active",
  );

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
        title="Sana özel kuponlar"
        hint="Yalnızca senin hesabına tanımlı, tek kullanımlık. Sepet ekranında kodu uygula"
      >
        {activeCoupons.length === 0 ? (
          <EmptyState
            title="Şu an kullanılabilir kuponun yok"
            hint="Hoş geldin, doğum günü ve kampanya kuponların burada görünür."
          />
        ) : (
          <div>
            {activeCoupons.map((c) => (
              <CouponCard key={c.id} coupon={c} nowMs={nowMs} />
            ))}
          </div>
        )}
      </AccountCard>

      <AccountCard
        title="Kullanılabilir kodlar"
        hint="Herkese açık kampanya kodları - sepet ekranında uygula"
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
                    {discountLabel(p.kind, p.value)}
                  </span>
                  {p.minSubtotalMinor > 0 && (
                    <span>{formatTRY(p.minSubtotalMinor)}+ sepete</span>
                  )}
                  {p.expiresAt && (
                    <span>
                      {formatShortDate(p.expiresAt)} tarihinde sona erer
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

      {pastCoupons.length > 0 && (
        <AccountCard
          title="Geçmiş kuponların"
          hint="Kullanılan veya süresi dolan"
        >
          <div>
            {pastCoupons.slice(0, 8).map((c) => (
              <CouponCard key={c.id} coupon={c} nowMs={nowMs} />
            ))}
          </div>
        </AccountCard>
      )}

      {expired.length > 0 && (
        <AccountCard title="Sona eren kodlar" hint="Geçmiş kampanyalar">
          <div style={{ opacity: 0.55 }}>
            {expired.slice(0, 5).map((p) => (
              <div key={p.id} className="account-promo-card">
                <div className="account-promo-code">{p.code}</div>
                <div className="account-promo-meta">
                  <span
                    style={{ fontFamily: "var(--serif-display)", fontSize: 16 }}
                  >
                    {discountLabel(p.kind, p.value)}
                  </span>
                  <span>
                    {formatShortDate(p.expiresAt)} tarihinde sona erdi
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
