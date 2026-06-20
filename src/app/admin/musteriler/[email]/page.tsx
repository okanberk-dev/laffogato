import Link from "next/link";
import { notFound } from "next/navigation";

import { CustomerActions } from "@/components/admin/customer-actions";
import { CustomerCoupons } from "@/components/admin/customer-coupons";
import {
  Card,
  PageHeader,
  formatDateTime,
  formatTRY,
} from "@/components/admin/forms";
import { requireRole } from "@/lib/admin/auth";
import {
  customerOrdersByEmail,
  listProducts,
  type AdminOrderStatus,
} from "@/lib/admin/store";
import { adminListCustomerCoupons } from "@/lib/customer/coupons";
import { getAdminCustomerByEmail } from "@/lib/customer/store";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ email: string }>;
}

const STATUS_LABEL: Record<AdminOrderStatus, string> = {
  pending_payment: "Ödeme bekleniyor",
  paid: "Ödendi",
  preparing: "Hazırlanıyor",
  shipped: "Kargoda",
  completed: "Tamamlandı",
  cancelled: "İptal",
  refunded: "İade",
};

const STATUS_TONE: Record<AdminOrderStatus, string> = {
  pending_payment: "bg-amber-50 text-amber-700",
  paid: "bg-blue-50 text-blue-700",
  preparing: "bg-purple-50 text-purple-700",
  shipped: "bg-indigo-50 text-indigo-700",
  completed: "bg-green-50 text-green-700",
  cancelled: "bg-neutral-100 text-neutral-500",
  refunded: "bg-rose-50 text-rose-700",
};

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
  await requireRole("customers");
  const { email: raw } = await params;
  const email = decodeURIComponent(raw);

  const [member, orders, coupons] = await Promise.all([
    getAdminCustomerByEmail(email),
    customerOrdersByEmail(email),
    adminListCustomerCoupons(email),
  ]);

  // Neither a member account nor any order for this e-mail → 404.
  if (!member && orders.length === 0) notFound();

  const totalSpent = orders.reduce((s, o) => s + o.totalMinor, 0);
  const totalRefunded = orders.reduce(
    (s, o) => s + o.refunds.reduce((r, x) => r + x.amountMinor, 0),
    0,
  );

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
        <Stat label="Sipariş" value={String(orders.length)} />
        <Stat label="Lifetime value" value={formatTRY(totalSpent)} />
        <Stat
          label="İade"
          value={totalRefunded > 0 ? `−${formatTRY(totalRefunded)}` : "—"}
          tone={totalRefunded > 0 ? "warn" : undefined}
        />
        <Stat
          label="Durum"
          value={
            member ? (member.isActive ? "Aktif üye" : "Pasif üye") : "Misafir"
          }
          small
        />
      </div>

      {member ? (
        <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
          <div className="grid gap-4">
            <Card>
              <SectionTitle>Profil</SectionTitle>
              <div className="grid gap-2 text-sm">
                <KV k="Ad">{member.name || "—"}</KV>
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
                <KV k="Telefon">{member.phone || "—"}</KV>
                <KV k="Doğum">{member.birthday || "—"}</KV>
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
            />
            <CustomerCoupons email={member.email} coupons={coupons} />
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
            </Card>
          </aside>
        </div>
      ) : (
        <Card className="mb-4">
          <p className="text-sm text-neutral-500">
            Bu e-postaya bağlı kayıtlı bir üye hesabı yok — yalnızca misafir
            siparişleri var.
          </p>
        </Card>
      )}

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
                  <th className="text-right">—</th>
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
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-[10px] tracking-[0.18em] uppercase ${STATUS_TONE[o.status]}`}
                        >
                          {STATUS_LABEL[o.status]}
                        </span>
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
