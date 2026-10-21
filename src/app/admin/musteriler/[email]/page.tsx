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
import {
  BUTTON,
  Badge,
  DataTable,
  EmptyState,
  KeyValueGrid,
  ListSearchButton,
  NUMERIC_STYLE,
  OrderStatusBadge,
} from "@/components/admin/ui";
import { EYEBROW, MONO_STYLE } from "@/components/admin/ui/styles";
import { cx } from "@/components/laffogato/cx";
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
import { formatIsoDate } from "@/lib/admin/list-params";
import { ORDER_LIST_PATH } from "@/lib/admin/order-filters";
import { canAccess } from "@/lib/admin/roles";
import {
  customerLifetime,
  customerLifetimeOrders,
  customerOrdersByEmail,
  getSettings,
  listProducts,
  type AdminOrder,
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

// No address in the title (decision D14): on a shared till PC the browser's
// tabs and history listed customers' e-mails. The path still carries it
// until the page moves to an opaque id.
export const metadata = { title: "Admin · Müşteri" };

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

/** How many orders the history lists; the rest are on the order list. */
const ORDERS_SHOWN = 20;

/**
 * An address, a long name: allowed to break anywhere, so it wraps inside a
 * phone's column instead of widening the page (admin audit PEO-03).
 */
const WRAP = "[overflow-wrap:anywhere]";

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

/** The address of a customer's page. */
function customerHref(email: string): string {
  return `/admin/musteriler/${encodeURIComponent(email)}`;
}

export default async function CustomerDetailPage({ params }: PageProps) {
  const session = await requireRole("customers");
  const { email: raw } = await params;
  const email = decodeURIComponent(raw);

  const [
    member,
    orders,
    lifetimeRows,
    coupons,
    loyalty,
    stamps,
    invites,
    karaoke,
    settings,
  ] = await Promise.all([
    getAdminCustomerByEmail(email),
    // The newest few with every column for the table; the tiles count the
    // whole history from three columns (ORD-30).
    customerOrdersByEmail(email, ORDERS_SHOWN),
    customerLifetimeOrders(email),
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
  if (!member && lifetimeRows.length === 0 && karaoke.length === 0) notFound();

  // Same rule as Müşteriler and Raporlar: an abandoned checkout and a
  // cancelled order are not money the customer spent.
  const lifetime = customerLifetime(lifetimeRows);
  const orderTotal = lifetimeRows.length;
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
      {/* A guest without a name is titled by the address: it wraps. */}
      <div className="[&_h1]:[overflow-wrap:anywhere] [&_header_p]:[overflow-wrap:anywhere]">
        <PageHeader
          eyebrow={member ? "Üye hesabı" : "Misafir müşteri"}
          title={displayName}
          description={`${email}${member?.phone ? ` · ${member.phone}` : ""}`}
          action={
            <div className="flex flex-wrap gap-2">
              {member && (
                <Link
                  href={`${customerHref(email)}/duzenle`}
                  className={BUTTON.primary}
                >
                  Düzenle
                </Link>
              )}
              <Link href="/admin/musteriler" className={BUTTON.ghost}>
                ← Tüm müşteriler
              </Link>
            </div>
          }
        />
      </div>

      <div className="mb-4 grid grid-cols-2 gap-3 xl:grid-cols-4">
        {/* Paid orders only; the history below lists every attempt
            (PEO-26). */}
        <Stat label="Ödenen sipariş" value={String(lifetime.orderCount)} />
        <Stat
          label="Toplam harcama"
          value={formatTRY(lifetime.lifetimeValueMinor)}
        />
        <Stat
          label="İade"
          value={
            lifetime.refundedMinor > 0
              ? `−${formatTRY(lifetime.refundedMinor)}`
              : "-"
          }
          tone={lifetime.refundedMinor > 0 ? "danger" : undefined}
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
        // minmax(0, …) tracks: a long address must not set the column's
        // width (PEO-03: the page was wider than a 390 px phone). Two
        // columns from xl: beside the sidebar at lg the side column was
        // 232 px, too narrow for its forms.
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <div className="grid grid-cols-1 content-start gap-4">
            <Card>
              <SectionTitle>Profil</SectionTitle>
              <KeyValueGrid
                items={[
                  { label: "Ad", value: member.name },
                  {
                    label: "E-posta",
                    full: true,
                    value: (
                      <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <span className={WRAP}>{member.email}</span>
                        {member.emailVerified ? (
                          <Badge tone="success">Doğrulanmış</Badge>
                        ) : (
                          <Badge tone="accent">Doğrulanmamış</Badge>
                        )}
                      </span>
                    ),
                  },
                  { label: "Telefon", value: member.phone },
                  {
                    label: "Doğum günü",
                    value: member.birthday
                      ? formatIsoDate(member.birthday)
                      : "",
                  },
                  { label: "Üyelik", value: formatDateTime(member.createdAt) },
                  Boolean(member.verifiedAt) && {
                    label: "Doğrulama",
                    value: formatDateTime(member.verifiedAt),
                  },
                ]}
              />
            </Card>

            <Card>
              <SectionTitle>Adresler ({member.addresses.length})</SectionTitle>
              {member.addresses.length === 0 ? (
                <p className="text-sm text-[var(--admin-text-soft)]">
                  Kayıtlı adres yok.
                </p>
              ) : (
                <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {member.addresses.map((a) => (
                    <li
                      key={a.id}
                      className="min-w-0 rounded-xl border border-[var(--admin-border)] p-3 text-sm"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium text-[var(--admin-text)]">
                          {a.label || "Adres"}
                        </span>
                        {a.isDefault && (
                          <Badge tone="primary">Varsayılan</Badge>
                        )}
                      </div>
                      <div className={`mt-1 text-[var(--admin-text)] ${WRAP}`}>
                        {a.recipientName}
                        {a.phone ? ` · ${a.phone}` : ""}
                      </div>
                      <div className={`text-[var(--admin-text-soft)] ${WRAP}`}>
                        {a.line1}
                        {a.line2 ? `, ${a.line2}` : ""}
                      </div>
                      <div className="text-[var(--admin-text-soft)]">
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
                <p className="text-sm text-[var(--admin-text-soft)]">
                  Favori ürün yok.
                </p>
              ) : (
                <ul className="flex flex-wrap gap-2">
                  {wishlistNames.map((name, i) => (
                    <li
                      key={i}
                      className="rounded-full border border-[var(--admin-border)] bg-[var(--admin-surface-2)] px-3 py-1 text-xs text-[var(--admin-text)]"
                    >
                      {name}
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>

          <aside className="grid grid-cols-1 content-start gap-4">
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
              <KeyValueGrid
                columns={1}
                items={[
                  {
                    label: "Davet kodu",
                    value: invites.inviteCode,
                    mono: true,
                  },
                  {
                    label: "Davet eden",
                    value: invites.invitedBy ? (
                      <Link
                        href={customerHref(invites.invitedBy)}
                        className={`text-[var(--admin-primary)] underline underline-offset-4 ${WRAP}`}
                      >
                        {invites.invitedBy}
                      </Link>
                    ) : null,
                  },
                  {
                    label: "Ödüllenen",
                    value: `${invites.rewardedCount}/${invites.rewardCap}${
                      invites.capReached ? " · sınır doldu" : ""
                    }`,
                  },
                ]}
              />
              {invites.invitees.length === 0 ? (
                <p className="mt-3 text-sm text-[var(--admin-text-soft)]">
                  Bu üyenin kodunu henüz kimse kullanmadı.
                </p>
              ) : (
                <ul className="mt-3 grid gap-2 border-t border-[var(--admin-border)] pt-3">
                  {invites.invitees.map((i) => (
                    <li key={i.id} className="min-w-0 text-xs">
                      <Link
                        href={customerHref(i.inviteeEmail)}
                        className={`block text-[var(--admin-text)] underline underline-offset-4 ${WRAP}`}
                      >
                        {i.inviteeEmail}
                      </Link>
                      <span className="text-[var(--admin-text-soft)]">
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
                    <li
                      key={key}
                      className="flex items-center justify-between gap-2"
                    >
                      <span className="text-[var(--admin-text)]">
                        {PREF_LABEL[key]}
                      </span>
                      <Badge tone={on ? "success" : "neutral"}>
                        {on ? "Açık" : "Kapalı"}
                      </Badge>
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
          <p className="text-sm text-[var(--admin-text-soft)]">
            Bu e-postaya bağlı kayıtlı bir üye hesabı yok - yalnızca misafir
            siparişleri ya da rezervasyonları var.
          </p>
        </Card>
      )}

      <Card className="mt-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <SectionTitle className="mb-0">
            Karaoke rezervasyonları ({bookings.length})
          </SectionTitle>
          <Link href={KARAOKE_PANEL_PATH} className={BUTTON.link}>
            Karaoke ekranı →
          </Link>
        </div>
        {bookings.length === 0 ? (
          <EmptyState title="Bu e-postayla yapılmış karaoke rezervasyonu yok." />
        ) : (
          <ul className="grid gap-2">
            {bookingViews.map((v) => {
              const r = v.r;
              return (
                <li key={r.id}>
                  {/* The whole row opens the booking's own page. */}
                  <Link
                    href={karaokeDetailHref(r.id)}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[var(--admin-border)] p-3 text-sm hover:border-[var(--admin-primary)]"
                  >
                    <span className="block min-w-0">
                      <span className="block font-medium text-[var(--admin-text)]">
                        {v.day} · {v.time}
                      </span>
                      <span className="block text-xs text-[var(--admin-text-soft)]">
                        {r.guests} kişi · {formatTRY(r.totalMinor)}
                        {v.money !== "none" && (r.paidMinor ?? 0) > 0
                          ? ` · ödenen ${formatTRY(r.paidMinor ?? 0)}`
                          : ""}
                        <span className="ml-2" style={NUMERIC_STYLE}>
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
          <p className="mt-2 text-xs text-[var(--admin-text-soft)]">
            En yeni {KARAOKE_SHOWN} rezervasyon gösteriliyor.
          </p>
        ) : null}
      </Card>

      <section aria-labelledby="siparis-gecmisi" className="mt-6">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
          <div className="min-w-0">
            <h2 id="siparis-gecmisi" className={EYEBROW} style={MONO_STYLE}>
              Sipariş geçmişi
            </h2>
            {/* Every attempt and how many of them were paid: the tile
                above counts the paid ones only (PEO-26). */}
            <p className="mt-1 text-sm text-[var(--admin-text-soft)]">
              {orderTotal} sipariş · {lifetime.orderCount} ödenen
              {orderTotal > ORDERS_SHOWN
                ? ` · en yeni ${ORDERS_SHOWN} tanesi aşağıda`
                : ""}
            </p>
          </div>
          {orderTotal > ORDERS_SHOWN ? (
            // The address goes in the post's body, not in `?q=`.
            <ListSearchButton
              href={ORDER_LIST_PATH}
              terms={{ q: email }}
              className={BUTTON.ghost}
            >
              Tümünü gör
            </ListSearchButton>
          ) : null}
        </div>
        <DataTable
          caption="Sipariş geçmişi"
          rows={orders}
          rowKey={(o) => o.id}
          rowHref={(o) => `/admin/siparisler/${encodeURIComponent(o.id)}`}
          empty={<EmptyState title="Bu müşterinin henüz siparişi yok." />}
          columns={[
            {
              key: "no",
              header: "Sipariş",
              cell: (o) => <span style={NUMERIC_STYLE}>#{o.orderNo}</span>,
            },
            {
              key: "tarih",
              header: "Tarih",
              cell: (o) => (
                <span className="text-xs whitespace-nowrap" style={MONO_STYLE}>
                  {formatDateTime(o.createdAt)}
                </span>
              ),
            },
            {
              key: "durum",
              header: "Durum",
              cell: (o) => <OrderStatusBadge order={o} />,
            },
            {
              key: "kalemler",
              header: "Kalemler",
              cell: (o) => (
                <span className="text-xs text-[var(--admin-text-soft)]">
                  {o.items
                    .map((it) => `${it.productName} × ${it.qty}`)
                    .join(" · ")}
                </span>
              ),
            },
            {
              key: "tutar",
              header: "Tutar",
              align: "right",
              cell: (o) => <OrderAmount order={o} />,
            },
          ]}
        />
      </section>
    </main>
  );
}

/** The order's total, and what went back of it. */
function OrderAmount({ order }: { order: AdminOrder }) {
  const refunded = order.refunds.reduce((s, r) => s + r.amountMinor, 0);
  return (
    <span className="whitespace-nowrap" style={NUMERIC_STYLE}>
      {formatTRY(order.totalMinor)}
      {refunded > 0 && (
        <span className="block text-xs text-[var(--admin-danger-ink)]">
          −{formatTRY(refunded)} iade
        </span>
      )}
    </span>
  );
}

function SectionTitle({
  children,
  className = "mb-3",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <h2 className={`${EYEBROW} ${className}`} style={MONO_STYLE}>
      {children}
    </h2>
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
  tone?: "danger";
  small?: boolean;
}) {
  return (
    <div className="min-w-0 rounded-3xl bg-[var(--admin-panel)] p-4">
      <div className={EYEBROW} style={MONO_STYLE}>
        {label}
      </div>
      {/* A figure in the numeric face, a word ("Aktif üye") in the
          panel's own. */}
      <div
        className={cx(
          "mt-1",
          small ? "text-sm" : "text-base sm:text-xl",
          tone === "danger"
            ? "text-[var(--admin-danger-ink)]"
            : "text-[var(--admin-text)]",
        )}
        style={small ? undefined : NUMERIC_STYLE}
      >
        {value}
      </div>
    </div>
  );
}
