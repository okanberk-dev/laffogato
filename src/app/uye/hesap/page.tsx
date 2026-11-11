import Link from "next/link";

import {
  AccountShell,
  AccountStat,
  AccountCard,
  EmptyState,
} from "@/components/uye/account-shell";
import { VerifyNotice } from "@/components/customer/verify-notice";
import { DeletionRequestNotice } from "@/components/uye/deletion-request-notice";
import { AppStoreLinks } from "@/components/laffogato/app-links";
import { listPromos } from "@/lib/admin/store";
import { memberOrders } from "@/lib/customer/member-orders";
import { requireCustomer } from "@/lib/customer/auth";
import { getDeletionRequest } from "@/lib/customer/deletion-request";
import {
  deletionDayLabel,
  deletionDeadline,
  type DeletionRequest,
} from "@/lib/customer/deletion-request-core";
import { isDbUnreachable } from "@/lib/db/health";
import { getLoyalty } from "@/lib/mobile/loyalty";
import type { LoyaltyView } from "@/lib/mobile/loyalty-core";

import { formatTRY, STATUS_LABEL } from "./shared";

export const metadata = { title: "Hesabım · L'Affogato" };
export const dynamic = "force-dynamic";

export default async function HesapPage() {
  const customer = await requireCustomer();
  const [orders, promos] = await Promise.all([
    memberOrders(customer),
    listPromos(),
  ]);

  // The stamp card, with the reader's own stamps on it. The home page shows
  // the programme; this is the only page that knows who is looking. A failure
  // here must not take the dashboard down with it - the member still needs
  // their orders and addresses.
  let loyalty: LoyaltyView | null = null;
  /**
   * `stamps` is the balance MODULO the card size, so a member holding a full
   * card reads 0 - computeStampBalance returns {stamps: 0, rewardsReady: 1}
   * for exactly six of six. Drawing that literally gave them an empty card
   * under the words "your free drink is ready".
   */
  try {
    loyalty = await getLoyalty(customer.email);
  } catch (err) {
    if (!isDbUnreachable(err)) {
      console.error("[uye/hesap] getLoyalty", err);
    }
  }

  // An open web deletion request (/uye/hesap/sil), so the member sees it
  // here too and can take it back. Like the stamp card, an unreadable one
  // does not take the dashboard down.
  let deletion: DeletionRequest | null = null;
  try {
    deletion = await getDeletionRequest(customer.email);
  } catch (err) {
    if (!isDbUnreachable(err)) {
      console.error("[uye/hesap] getDeletionRequest", err);
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

  const filledStamps = loyalty
    ? loyalty.rewardsReady > 0
      ? loyalty.stampTarget
      : loyalty.stamps
    : 0;

  return (
    <AccountShell customer={customer} active="dashboard">
      {deletion && (
        <div style={{ marginBottom: 24 }}>
          <DeletionRequestNotice
            requestedOn={deletionDayLabel(deletion.requestedAt)}
            deadline={deletionDayLabel(deletionDeadline(deletion.requestedAt))}
            showLink
          />
        </div>
      )}
      {!customer.emailVerified && (
        <div style={{ marginBottom: 24 }}>
          <VerifyNotice email={customer.email} />
        </div>
      )}
      {/* A brand-new member's dashboard was four zeroes and an empty list -
          an accurate but discouraging first screen, and the one people land
          on straight after signing up. Until there is a first order, the
          space goes to what they can actually do next. */}
      {orders.length === 0 ? (
        <div className="account-firstrun">
          <div className="account-firstrun-copy">
            <div className="eyebrow">Hoş geldin</div>
            <h2 className="h3" style={{ marginTop: 10 }}>
              Hesabın hazır, buradan başlayabilirsin
            </h2>
            <p>
              Siparişlerin, damgaların ve adreslerin burada toplanır - web’de ve
              uygulamada aynı hesapla.
            </p>
          </div>
          <div className="account-firstrun-actions">
            <Link href="/menu" className="account-firstrun-action">
              <span className="account-firstrun-action-t">Menüye bak</span>
              <span className="account-firstrun-action-d">
                Barda bugün ne var
              </span>
            </Link>
            <Link href="/magaza" className="account-firstrun-action">
              <span className="account-firstrun-action-t">
                Mağazadan sipariş
              </span>
              <span className="account-firstrun-action-d">
                Çekirdek, hediye seti, ekipman
              </span>
            </Link>
            <Link href="/karaoke" className="account-firstrun-action">
              <span className="account-firstrun-action-t">
                Karaoke rezervasyonu
              </span>
              <span className="account-firstrun-action-d">
                Köşkün üst katı · 8 kişiye kadar
              </span>
            </Link>
            <Link
              href="/uye/hesap/adreslerim/yeni"
              className="account-firstrun-action"
            >
              <span className="account-firstrun-action-t">Adres ekle</span>
              <span className="account-firstrun-action-d">
                Ödemede tek tıkla dolsun
              </span>
            </Link>
          </div>
        </div>
      ) : (
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
      )}

      {loyalty && (
        <div className="stamp-card">
          <div className="stamp-card-head">
            <span className="eyebrow muted">Damga kartı</span>
            <span className="stamp-card-count">
              {filledStamps}/{loyalty.stampTarget}
            </span>
          </div>
          <div className="stamp-grid stamp-grid-light">
            {Array.from({ length: loyalty.stampTarget }, (_, i) => {
              const filled = i < filledStamps;
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
          <div
            className="stamp-progress"
            role="progressbar"
            aria-valuenow={loyalty.stamps}
            aria-valuemin={0}
            aria-valuemax={loyalty.stampTarget}
            aria-label="Damga ilerlemesi"
          >
            <div
              style={{
                width: `${Math.round((filledStamps / loyalty.stampTarget) * 100)}%`,
              }}
            />
          </div>
          <div className="stamp-card-headline">
            {loyalty.rewardsReady > 0
              ? `Ücretsiz içeceğin hazır${loyalty.rewardsReady > 1 ? ` - ${loyalty.rewardsReady} adet` : ""}`
              : `${loyalty.stampTarget - loyalty.stamps} damga kaldı - sonraki içecek bizden`}
          </div>
          <p className="stamp-card-note">
            L&apos;AF 0-11 · PEARL 12+ · RUBY 36+ sipariş. Seviyen şu an{" "}
            <strong>{loyalty.tierLabel}</strong>. Uygulamadan verilen 140 TL ve
            üzeri kafe siparişi, başlayan her 320 TL için bir damga; damgan,
            kuponların ve seviyen iki tarafta da aynı.
          </p>
        </div>
      )}

      {/* Single membership across both surfaces - the prototype's account
          screen makes this its own block, and it is the only place the site
          tells a member the app exists. */}
      <div className="account-app-block" data-ground="dark">
        <div className="account-app-copy">
          <div className="account-app-kicker">Tek üyelik</div>
          <div className="account-app-title">
            Aynı hesapla uygulamada devam et
          </div>
          <p>
            Damgan, kuponların ve adreslerin uygulamada birebir aynı. Uygulama
            üzerinden verdiğin kafe siparişleri de bu karta işler.
          </p>
          <AppStoreLinks tone="dark" className="account-app-links" />
        </div>
        {/* The app's home screen as a whole small device, on an uplift
            disc - the home page's stage in miniature. */}
        <div className="account-app-stage" aria-hidden="true">
          <div className="app-phone">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/brand/app-screen-home.webp"
              alt=""
              width={600}
              height={1300}
              loading="lazy"
              decoding="async"
            />
          </div>
        </div>
      </div>

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
            art="spot-siparis"
            title="Henüz siparişin yok"
            hint="Mağazadan bir affogato seç, ilk sipariş senin olsun."
            cta={
              <Link href="/magaza" className="btn btn-primary btn-sm">
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
                        timeZone: "Europe/Istanbul",
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
                      fontFamily: "var(--display)",
                      fontWeight: 700,
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
                        timeZone: "Europe/Istanbul",
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
