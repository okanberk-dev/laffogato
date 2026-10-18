import Link from "next/link";
import { notFound } from "next/navigation";

import { CustomerActions } from "@/components/admin/customer-actions";
import { CustomerCoupons } from "@/components/admin/customer-coupons";
import { CustomerDeletionRequest } from "@/components/admin/customer-deletion-request";
import { CustomerStamps } from "@/components/admin/customer-stamps";
import {
  Card,
  PageHeader,
  formatDateTime,
  formatTRY,
} from "@/components/admin/forms";
import { Badge, OrderStatusBadge } from "@/components/admin/ui/badge";
import { requireRole } from "@/lib/admin/auth";
import { getAdminInviteTree } from "@/lib/admin/invites";
import {
  listReleasedHolds,
  type KaraokeReleasedHolds,
} from "@/lib/admin/karaoke-audit";
import {
  KARAOKE_PANEL_PATH,
  karaokeDetailHref,
  karaokeRowViews,
  moneyOf,
} from "@/lib/admin/karaoke-panel";
import { canAccess } from "@/lib/admin/roles";
import {
  customerLifetime,
  customerOrdersByEmail,
  getSettings,
  listProducts,
} from "@/lib/admin/store";
import { adminListCustomerCoupons } from "@/lib/customer/coupons";
import { paidKaraokeAtRequest } from "@/lib/customer/deletion-request-core";
import { getAdminCustomerByEmail } from "@/lib/customer/store";
import { listByAddress, type KaraokeReservation } from "@/lib/mobile/karaoke";
import { getLoyalty, listStamps } from "@/lib/mobile/loyalty";
import { istanbulClock } from "@/lib/mobile/venue";

export const dynamic = "force-dynamic";
// "Hesabı sil" runs here and closes the account the member's way (deleteMe):
// it may ask the POS to refund each future paid karaoke booking and to drop
// the saved cards, each call bounded. The mobile DELETE /me allows 15 s.
export const maxDuration = 30;

interface PageProps {
  params: Promise<{ email: string }>;
}

/** `invites.status` in the member's own words. */
const INVITE_STATUS_LABEL: Record<string, string> = {
  pending: "Bekliyor",
  joined: "Katıldı",
  rewarded: "Ödüllendi",
};

/** How many bookings the card lists; the rest are on the karaoke page. */
const KARAOKE_SHOWN = 20;

/**
 * Which of these released holds a panel user let go, and which were let go
 * without the POS's answer: the karaoke page's own read, so a booking here
 * says what it says there (never "not paid" for an unanswered one, rule 29).
 * A failed read leaves them as lapsed, as the karaoke page does.
 */
async function releasedHolds(
  rows: readonly KaraokeReservation[],
): Promise<KaraokeReleasedHolds> {
  const released = rows
    .filter((r) => r.status === "cancelled" && moneyOf(r) === "expired")
    .map((r) => r.id);
  if (released.length === 0) {
    return { staff: new Set(), unverified: new Set() };
  }
  try {
    return await listReleasedHolds(released);
  } catch (err) {
    console.error("[admin/musteriler] iptal kayıtları okunamadı", err);
    return { staff: new Set(), unverified: new Set() };
  }
}

const PREF_LABEL: Record<string, string> = {
  orderUpdates: "Sipariş güncellemeleri",
  marketing: "Kampanya / pazarlama",
  newsletter: "Bülten",
};

export async function generateMetadata({ params }: PageProps) {
  const { email } = await params;
  return { title: `Admin · Müşteri ${decodeURIComponent(email)}` };
}

export default async function CustomerDetailPage({ params }: PageProps) {
  const session = await requireRole("customers");
  const { email: raw } = await params;
  const email = decodeURIComponent(raw);

  const [member, orders, coupons, loyalty, stamps, invites, karaoke, settings] =
    await Promise.all([
      getAdminCustomerByEmail(email),
      customerOrdersByEmail(email),
      adminListCustomerCoupons(email),
      getLoyalty(email),
      listStamps(email),
      getAdminInviteTree(email),
      // Every booking under the address, guest ones included (flagged): the
      // operator answering this person's call needs the whole picture.
      listByAddress(email),
      getSettings(),
    ]);

  // Neither a member account, an order nor a booking for this e-mail → 404.
  if (!member && orders.length === 0 && karaoke.length === 0) notFound();

  // Same rule as Müşteriler and Raporlar: an abandoned checkout and a
  // cancelled order are not money the customer spent.
  const lifetime = customerLifetime(orders);
  const bookings = [...karaoke].sort(
    (a, b) => b.date.localeCompare(a.date) || b.startHour - a.startHour,
  );
  // Badges from the karaoke panel's own row view, so a booking reads the
  // same here as on its page.
  const shown = bookings.slice(0, KARAOKE_SHOWN);
  const now = new Date();
  const released = await releasedHolds(shown);
  const bookingViews = karaokeRowViews(shown, {
    today: istanbulClock(now).date,
    now,
    prepay: settings.karaokePrepay,
    canRefund: canAccess("refunds", session.role),
    staffReleased: released.staff,
    unverified: released.unverified,
  });

  // Resolve wishlist product names (best-effort).
  let wishlistNames: string[] = [];
  if (member && member.wishlist.length > 0) {
    const products = await listProducts();
    const byId = new Map(products.map((p) => [p.id, p.name]));
    wishlistNames = member.wishlist.map((id) => byId.get(id) ?? id);
  }

  const displayName = member?.name || orders[0]?.customerName || email;

  return (
    <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-10">
      <PageHeader
        eyebrow={member ? "Üye hesabı" : "Misafir müşteri"}
        title={displayName}
        description={`${email}${member?.phone ? ` · ${member.phone}` : ""}`}
        action={
          <div className="flex flex-wrap gap-2">
            {member && (
              <Link
                href={`/admin/musteriler/${encodeURIComponent(email)}/duzenle`}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-[var(--admin-primary)] px-4 py-2 text-xs font-medium text-white hover:bg-[var(--admin-primary-hover)]"
              >
                Düzenle
              </Link>
            )}
            <Link
              href="/admin/musteriler"
              className="inline-flex items-center justify-center gap-2 rounded-full border border-[var(--admin-border)] px-4 py-2 text-xs text-neutral-700 hover:border-[var(--admin-primary)] hover:text-[var(--admin-primary)]"
            >
              ← Tüm müşteriler
            </Link>
          </div>
        }
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-4">
        <Stat label="Sipariş" value={String(lifetime.orderCount)} />
        <Stat
          label="Lifetime value"
          value={formatTRY(lifetime.lifetimeValueMinor)}
        />
        <Stat
          label="İade"
          value={
            lifetime.refundedMinor > 0
              ? `−${formatTRY(lifetime.refundedMinor)}`
              : "-"
          }
          tone={lifetime.refundedMinor > 0 ? "warn" : undefined}
        />
        <Stat
          label="Durum"
          value={
            member
              ? member.deletionRequest
                ? "Silme talebi"
                : member.isActive
                  ? "Aktif üye"
                  : "Pasif üye"
              : "Misafir"
          }
          small
        />
      </div>

      {member?.deletionRequest && (
        <CustomerDeletionRequest
          email={member.email}
          request={member.deletionRequest}
          // Every booking under the address, so the card can race the
          // start of each paid one (guest rows are dropped there).
          karaoke={paidKaraokeAtRequest(
            karaoke,
            member.deletionRequest.requestedAt,
            now,
          )}
          now={now}
        />
      )}

      {member ? (
        <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
          <div className="grid gap-4">
            <Card>
              <SectionTitle>Profil</SectionTitle>
              <div className="grid gap-2 text-sm">
                <KV k="Ad">{member.name || "-"}</KV>
                <KV k="E-posta">
                  <span className="inline-flex items-center gap-2">
                    {member.email}
                    {member.emailVerified ? (
                      <span className="rounded-full bg-green-50 px-2 py-0.5 text-[10px] tracking-[0.16em] text-green-700 uppercase">
                        ✓ Doğrulanmış
                      </span>
                    ) : (
                      <span className="rounded-full bg-orange-50 px-2 py-0.5 text-[10px] tracking-[0.16em] text-orange-700 uppercase">
                        Doğrulanmamış
                      </span>
                    )}
                  </span>
                </KV>
                <KV k="Telefon">{member.phone || "-"}</KV>
                <KV k="Doğum">{member.birthday || "-"}</KV>
                <KV k="Üyelik">{formatDateTime(member.createdAt)}</KV>
                {member.verifiedAt && (
                  <KV k="Doğrulama">{formatDateTime(member.verifiedAt)}</KV>
                )}
              </div>
            </Card>

            <Card>
              <SectionTitle>Adresler ({member.addresses.length})</SectionTitle>
              {member.addresses.length === 0 ? (
                <p className="text-sm text-neutral-400">Kayıtlı adres yok.</p>
              ) : (
                <ul className="grid gap-3 sm:grid-cols-2">
                  {member.addresses.map((a) => (
                    <li
                      key={a.id}
                      className="rounded-lg border border-[var(--admin-border)] p-3 text-sm"
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-neutral-900">
                          {a.label || "Adres"}
                        </span>
                        {a.isDefault && (
                          <span className="rounded-full bg-[var(--admin-primary)] px-2 py-0.5 text-[9px] tracking-[0.16em] text-white uppercase">
                            Varsayılan
                          </span>
                        )}
                      </div>
                      <div className="mt-1 text-neutral-700">
                        {a.recipientName}
                        {a.phone ? ` · ${a.phone}` : ""}
                      </div>
                      <div className="text-neutral-600">
                        {a.line1}
                        {a.line2 ? `, ${a.line2}` : ""}
                      </div>
                      <div className="text-neutral-500">
                        {[a.district, a.city, a.zip]
                          .filter(Boolean)
                          .join(" · ")}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            <Card>
              <SectionTitle>Favoriler ({wishlistNames.length})</SectionTitle>
              {wishlistNames.length === 0 ? (
                <p className="text-sm text-neutral-400">Favori ürün yok.</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {wishlistNames.map((name, i) => (
                    <span
                      key={i}
                      className="rounded-full border border-[var(--admin-border)] bg-neutral-50 px-3 py-1 text-xs text-neutral-700"
                    >
                      {name}
                    </span>
                  ))}
                </div>
              )}
            </Card>
          </div>

          <aside className="grid gap-4">
            <CustomerActions
              email={member.email}
              isActive={member.isActive}
              emailVerified={member.emailVerified}
              deletionRequested={member.deletionRequest !== null}
            />
            <CustomerStamps
              email={member.email}
              loyalty={loyalty}
              history={stamps}
              canReverse
            />
            <CustomerCoupons email={member.email} coupons={coupons} />
            {/* The referral programme was invisible in the panel: nobody could
                see who invited whom, why an invite was stuck on "bekliyor", or
                that a member had already hit the reward cap. */}
            <Card>
              <SectionTitle>Davetler ({invites.invitees.length})</SectionTitle>
              <ul className="grid gap-2 text-sm">
                <KV k="Davet kodu">{invites.inviteCode || "-"}</KV>
                <KV k="Davet eden">
                  {invites.invitedBy ? (
                    <Link
                      href={`/admin/musteriler/${encodeURIComponent(invites.invitedBy)}`}
                      className="underline"
                    >
                      {invites.invitedBy}
                    </Link>
                  ) : (
                    "-"
                  )}
                </KV>
                <KV k="Ödüllenen">
                  {invites.rewardedCount}/{invites.rewardCap}
                  {invites.capReached ? " · sınır doldu" : ""}
                </KV>
              </ul>
              {invites.invitees.length === 0 ? (
                <p className="mt-3 text-sm text-neutral-400">
                  Bu üyenin kodunu henüz kimse kullanmadı.
                </p>
              ) : (
                <ul className="mt-3 grid gap-1.5">
                  {invites.invitees.map((i) => (
                    <li
                      key={i.id}
                      className="flex items-center justify-between gap-2 text-xs"
                    >
                      <Link
                        href={`/admin/musteriler/${encodeURIComponent(i.inviteeEmail)}`}
                        className="min-w-0 truncate text-neutral-700 underline"
                      >
                        {i.inviteeEmail}
                      </Link>
                      <span className="shrink-0 text-neutral-400">
                        {INVITE_STATUS_LABEL[i.status] ?? i.status} ·{" "}
                        {formatDateTime(i.rewardedAt || i.createdAt)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
            <Card>
              <SectionTitle>Bildirim tercihleri</SectionTitle>
              <ul className="grid gap-2 text-sm">
                {(
                  Object.keys(PREF_LABEL) as Array<keyof typeof PREF_LABEL>
                ).map((key) => {
                  const on = (
                    member.notificationPrefs as unknown as Record<
                      string,
                      boolean
                    >
                  )[key];
                  return (
                    <li key={key} className="flex items-center justify-between">
                      <span className="text-neutral-700">
                        {PREF_LABEL[key]}
                      </span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] tracking-[0.16em] uppercase ${
                          on
                            ? "bg-green-50 text-green-700"
                            : "bg-neutral-100 text-neutral-500"
                        }`}
                      >
                        {on ? "Açık" : "Kapalı"}
                      </span>
                    </li>
                  );
                })}
              </ul>
              {/* The date the campaign e-mails need besides the switch; the
                  panel can only clear it, never set it. */}
              <p className="mt-3 text-xs text-[var(--admin-text-soft)]">
                Ticari ileti izni:{" "}
                {member.marketingConsentAt
                  ? formatDateTime(member.marketingConsentAt)
                  : "tarih kaydı yok"}
              </p>
            </Card>
          </aside>
        </div>
      ) : (
        <Card className="mb-4">
          <p className="text-sm text-neutral-500">
            Bu e-postaya bağlı kayıtlı bir üye hesabı yok - yalnızca misafir
            siparişleri ya da rezervasyonları var.
          </p>
        </Card>
      )}

      <Card className="mt-4">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <SectionTitle>
            Karaoke rezervasyonları ({bookings.length})
          </SectionTitle>
          <Link
            href={KARAOKE_PANEL_PATH}
            className="text-xs text-[var(--admin-primary)] underline-offset-4 hover:underline"
          >
            Karaoke ekranı →
          </Link>
        </div>
        {bookings.length === 0 ? (
          <p className="text-sm text-neutral-400">
            Bu e-postayla yapılmış karaoke rezervasyonu yok.
          </p>
        ) : (
          <ul className="grid gap-2">
            {bookingViews.map((v) => {
              const r = v.r;
              return (
                <li key={r.id}>
                  {/* The whole row opens the booking's own page. */}
                  <Link
                    href={karaokeDetailHref(r.id)}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[var(--admin-border)] p-3 text-sm hover:border-[var(--admin-primary)]"
                  >
                    <span className="block min-w-0">
                      <span className="block font-medium text-neutral-900">
                        {v.day} · {v.time}
                      </span>
                      <span className="block text-xs text-neutral-500">
                        {r.guests} kişi · {formatTRY(r.totalMinor)}
                        {v.money !== "none" && (r.paidMinor ?? 0) > 0
                          ? ` · ödenen ${formatTRY(r.paidMinor ?? 0)}`
                          : ""}
                        <span
                          className="ml-2"
                          style={{ fontFamily: "var(--mono), monospace" }}
                        >
                          {r.id}
                        </span>
                      </span>
                    </span>
                    <span className="flex flex-wrap items-center gap-1.5">
                      {r.guest ? <Badge>Üyeliksiz</Badge> : null}
                      <Badge tone={v.statusTone}>{v.statusLabel}</Badge>
                      <Badge tone={v.paymentTone}>{v.paymentLabel}</Badge>
                      {v.attention.includes("refund_owed") ? (
                        <Badge tone="danger">İade borcu</Badge>
                      ) : null}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
        {bookings.length > KARAOKE_SHOWN ? (
          <p className="mt-2 text-xs text-neutral-500">
            En yeni {KARAOKE_SHOWN} rezervasyon gösteriliyor.
          </p>
        ) : null}
      </Card>

      <Card className="mt-4">
        <SectionTitle>Sipariş geçmişi ({orders.length})</SectionTitle>
        {orders.length === 0 ? (
          <p className="text-sm text-neutral-400">
            Bu müşterinin henüz siparişi yok.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr
                  className="border-b border-[var(--admin-border)] text-left text-[10px] tracking-[0.22em] text-neutral-500 uppercase"
                  style={{ fontFamily: "var(--mono), monospace" }}
                >
                  <th className="py-3 pr-3">Sipariş</th>
                  <th className="pr-3">Tarih</th>
                  <th className="pr-3">Durum</th>
                  <th className="pr-3">Kalemler</th>
                  <th className="pr-3 text-right">Tutar</th>
                  <th className="text-right">-</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => {
                  const refundedHere = o.refunds.reduce(
                    (s, r) => s + r.amountMinor,
                    0,
                  );
                  return (
                    <tr
                      key={o.id}
                      className="border-b border-neutral-100 align-top last:border-b-0"
                    >
                      <td
                        className="py-3 pr-3 font-medium text-neutral-900"
                        style={{ fontFamily: "var(--mono), monospace" }}
                      >
                        #{o.orderNo}
                      </td>
                      <td
                        className="pr-3 text-xs text-neutral-500"
                        style={{ fontFamily: "var(--mono), monospace" }}
                      >
                        {formatDateTime(o.createdAt)}
                      </td>
                      <td className="pr-3">
                        <OrderStatusBadge order={o} />
                      </td>
                      <td className="pr-3 text-xs text-neutral-700">
                        {o.items
                          .map((it) => `${it.productName} × ${it.qty}`)
                          .join(" · ")}
                      </td>
                      <td
                        className="pr-3 text-right text-neutral-900"
                        style={{ fontFamily: "var(--mono), monospace" }}
                      >
                        {formatTRY(o.totalMinor)}
                        {refundedHere > 0 && (
                          <div className="text-[10px] text-rose-600">
                            −{formatTRY(refundedHere)} iade
                          </div>
                        )}
                      </td>
                      <td className="text-right">
                        <Link
                          href={`/admin/siparisler/${o.id}`}
                          className="inline-flex items-center justify-center rounded-full border border-[var(--admin-border)] px-3 py-1.5 text-xs text-neutral-700 hover:border-[var(--admin-primary)] hover:text-[var(--admin-primary)]"
                        >
                          Detay →
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </main>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2
      className="mb-3 text-[10px] tracking-[0.22em] text-neutral-500 uppercase"
      style={{ fontFamily: "var(--mono), monospace" }}
    >
      {children}
    </h2>
  );
}

function KV({ k, children }: { k: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[90px_1fr] gap-2">
      <span
        className="text-[10px] tracking-[0.22em] text-neutral-500 uppercase"
        style={{ fontFamily: "var(--mono), monospace" }}
      >
        {k}
      </span>
      <span className="text-neutral-800">{children}</span>
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
  small,
}: {
  label: string;
  value: string;
  tone?: "warn";
  small?: boolean;
}) {
  return (
    <div className="rounded-xl border border-[var(--admin-border)] bg-white p-4 shadow-sm">
      <div
        className="text-[10px] tracking-[0.22em] text-neutral-500 uppercase"
        style={{ fontFamily: "var(--mono), monospace" }}
      >
        {label}
      </div>
      <div
        className={`mt-1 ${small ? "text-sm" : "text-xl"} ${
          tone === "warn" ? "text-rose-700" : "text-neutral-900"
        }`}
        style={{ fontFamily: "var(--mono), monospace" }}
      >
        {value}
      </div>
    </div>
  );
}
