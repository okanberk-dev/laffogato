import Link from "next/link";

import {
  Card,
  PageHeader,
  formatDateTime,
  formatTRY,
} from "@/components/admin/forms";
import { requireRole } from "@/lib/admin/auth";
import { listCustomers } from "@/lib/admin/store";
import { listAllCustomers } from "@/lib/customer/store";

export const metadata = { title: "Admin · Müşteriler" };
export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ q?: string; sort?: SortKey; filter?: FilterKey }>;
}

type SortKey = "recent" | "value" | "orders" | "name";
type FilterKey = "all" | "members" | "guests";

const SORT_LABEL: Record<SortKey, string> = {
  recent: "Son hareket",
  value: "Lifetime value",
  orders: "Sipariş sayısı",
  name: "Ad (A→Z)",
};

const FILTER_LABEL: Record<FilterKey, string> = {
  all: "Hepsi",
  members: "Üyeler",
  guests: "Misafirler",
};

interface CustomerRow {
  email: string;
  name: string;
  phone: string;
  isMember: boolean;
  isActive: boolean;
  emailVerified: boolean;
  memberSince: string;
  orderCount: number;
  lifetimeValueMinor: number;
  refundedMinor: number;
  lastOrderAt: string;
  /** Sort key: last order date, else member-since. */
  lastActivity: string;
}

export default async function CustomersPage({ searchParams }: PageProps) {
  await requireRole("customers");
  const sp = await searchParams;
  const q = (sp.q ?? "").trim().toLowerCase();
  const sort: SortKey = (sp.sort ?? "recent") as SortKey;
  const filter: FilterKey = (sp.filter ?? "all") as FilterKey;

  const [members, summaries] = await Promise.all([
    listAllCustomers(),
    listCustomers(),
  ]);

  // Merge member accounts with order-derived CRM summaries, keyed by e-mail.
  const byEmail = new Map<string, CustomerRow>();
  for (const m of members) {
    const key = m.email.toLowerCase();
    byEmail.set(key, {
      email: m.email,
      name: m.name,
      phone: m.phone,
      isMember: true,
      isActive: m.isActive,
      emailVerified: m.emailVerified,
      memberSince: m.createdAt,
      orderCount: 0,
      lifetimeValueMinor: 0,
      refundedMinor: 0,
      lastOrderAt: "",
      lastActivity: m.createdAt,
    });
  }
  for (const s of summaries) {
    const key = s.email.toLowerCase();
    const existing = byEmail.get(key);
    if (existing) {
      existing.orderCount = s.orderCount;
      existing.lifetimeValueMinor = s.lifetimeValueMinor;
      existing.refundedMinor = s.refundedMinor;
      existing.lastOrderAt = s.lastOrderAt;
      existing.lastActivity = s.lastOrderAt || existing.memberSince;
      if (!existing.name) existing.name = s.name;
      if (!existing.phone) existing.phone = s.phone;
    } else {
      byEmail.set(key, {
        email: s.email,
        name: s.name,
        phone: s.phone,
        isMember: false,
        isActive: true,
        emailVerified: false,
        memberSince: "",
        orderCount: s.orderCount,
        lifetimeValueMinor: s.lifetimeValueMinor,
        refundedMinor: s.refundedMinor,
        lastOrderAt: s.lastOrderAt,
        lastActivity: s.lastOrderAt,
      });
    }
  }

  let list = Array.from(byEmail.values());
  if (filter === "members") list = list.filter((c) => c.isMember);
  else if (filter === "guests") list = list.filter((c) => !c.isMember);
  if (q) {
    list = list.filter(
      (c) =>
        c.email.toLowerCase().includes(q) ||
        c.name.toLowerCase().includes(q) ||
        c.phone.toLowerCase().includes(q),
    );
  }
  list.sort((a, b) => {
    if (sort === "value") return b.lifetimeValueMinor - a.lifetimeValueMinor;
    if (sort === "orders") return b.orderCount - a.orderCount;
    if (sort === "name") return a.name.localeCompare(b.name, "tr");
    return b.lastActivity.localeCompare(a.lastActivity);
  });

  const memberCount = members.length;
  const totalValue = list.reduce((s, c) => s + c.lifetimeValueMinor, 0);
  const totalOrders = list.reduce((s, c) => s + c.orderCount, 0);

  return (
    <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-10">
      <PageHeader
        eyebrow="Pazarlama · CRM"
        title="Müşteriler"
        description="Kayıtlı üye hesapları ile misafir siparişlerinden çıkarılan profiller bir arada. Sipariş sayısı ve lifetime value Raporlar'la aynı kuralla hesaplanır: ödemesi beklenen ve iptal edilen siparişler sayılmaz."
      />

      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Üye hesap" value={String(memberCount)} />
        <Stat label="Toplam müşteri" value={String(list.length)} />
        <Stat label="Toplam sipariş" value={String(totalOrders)} />
        <Stat label="Lifetime value" value={formatTRY(totalValue)} mono />
      </div>

      <Card className="mb-4">
        <form className="grid gap-3 sm:grid-cols-[1fr_auto_auto_auto_auto] sm:items-end">
          <label className="grid gap-1">
            <span
              className="text-[10px] tracking-[0.22em] text-neutral-500 uppercase"
              style={{ fontFamily: "var(--mono), monospace" }}
            >
              Ara
            </span>
            <input
              type="text"
              name="q"
              defaultValue={q}
              placeholder="E-posta, ad veya telefon"
              className="w-full rounded-md border border-[var(--admin-border)] bg-neutral-50 px-3 py-2.5 text-base focus:border-[var(--admin-primary)] focus:bg-white focus:outline-none sm:text-sm"
            />
          </label>
          <label className="grid gap-1">
            <span
              className="text-[10px] tracking-[0.22em] text-neutral-500 uppercase"
              style={{ fontFamily: "var(--mono), monospace" }}
            >
              Tür
            </span>
            <select
              name="filter"
              defaultValue={filter}
              className="w-full rounded-md border border-[var(--admin-border)] bg-neutral-50 px-3 py-2.5 text-base focus:border-[var(--admin-primary)] focus:bg-white focus:outline-none sm:text-sm"
            >
              {(Object.keys(FILTER_LABEL) as FilterKey[]).map((f) => (
                <option key={f} value={f}>
                  {FILTER_LABEL[f]}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1">
            <span
              className="text-[10px] tracking-[0.22em] text-neutral-500 uppercase"
              style={{ fontFamily: "var(--mono), monospace" }}
            >
              Sırala
            </span>
            <select
              name="sort"
              defaultValue={sort}
              className="w-full rounded-md border border-[var(--admin-border)] bg-neutral-50 px-3 py-2.5 text-base focus:border-[var(--admin-primary)] focus:bg-white focus:outline-none sm:text-sm"
            >
              {(Object.keys(SORT_LABEL) as SortKey[]).map((s) => (
                <option key={s} value={s}>
                  {SORT_LABEL[s]}
                </option>
              ))}
            </select>
          </label>
          <button
            type="submit"
            className="inline-flex min-h-[44px] items-center justify-center rounded-xl bg-[var(--admin-primary)] px-4 text-sm font-medium text-white hover:bg-[var(--admin-primary-hover)]"
          >
            Uygula
          </button>
          <Link
            href="/admin/musteriler"
            className="inline-flex min-h-[44px] items-center justify-center rounded-full border border-[var(--admin-border)] px-4 text-sm text-neutral-700 hover:border-[var(--admin-primary)] hover:text-[var(--admin-primary)]"
          >
            Sıfırla
          </Link>
        </form>
      </Card>

      <Card>
        {list.length === 0 ? (
          <p className="text-sm text-neutral-500">
            {q || filter !== "all"
              ? "Bu filtreyle müşteri bulunamadı."
              : "Henüz üye hesabı ya da sipariş yok."}
          </p>
        ) : (
          <>
            {/* Mobile cards */}
            <ul className="flex flex-col gap-3 md:hidden">
              {list.map((c) => (
                <li
                  key={c.email}
                  className="rounded-lg border border-[var(--admin-border)] p-3"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-neutral-900">
                          {c.name || "-"}
                        </span>
                        <Badges row={c} />
                      </div>
                      <div className="truncate text-xs text-neutral-700">
                        {c.email}
                      </div>
                      {c.phone && (
                        <div className="text-xs text-neutral-500">
                          {c.phone}
                        </div>
                      )}
                    </div>
                    <div className="shrink-0 text-right">
                      <div
                        className="text-sm text-neutral-900"
                        style={{ fontFamily: "var(--mono), monospace" }}
                      >
                        {formatTRY(c.lifetimeValueMinor)}
                      </div>
                      <div
                        className="text-[10px] text-neutral-500"
                        style={{ fontFamily: "var(--mono), monospace" }}
                      >
                        {c.orderCount} sipariş
                      </div>
                    </div>
                  </div>
                  <Link
                    href={`/admin/musteriler/${encodeURIComponent(c.email)}`}
                    className="mt-3 inline-flex min-h-[40px] w-full items-center justify-center rounded-full border border-[var(--admin-border)] px-3 text-xs text-neutral-700 hover:border-[var(--admin-primary)] hover:text-[var(--admin-primary)]"
                  >
                    Detay →
                  </Link>
                </li>
              ))}
            </ul>

            {/* Desktop table */}
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full text-sm">
                <thead>
                  <tr
                    className="border-b border-[var(--admin-border)] text-left text-[10px] tracking-[0.22em] text-neutral-500 uppercase"
                    style={{ fontFamily: "var(--mono), monospace" }}
                  >
                    <th className="py-3 pr-3">Müşteri</th>
                    <th className="pr-3">İletişim</th>
                    <th className="pr-3 text-right">Sipariş</th>
                    <th className="pr-3 text-right">Lifetime value</th>
                    <th className="pr-3">Son hareket</th>
                    <th className="text-right">-</th>
                  </tr>
                </thead>
                <tbody>
                  {list.map((c) => (
                    <tr
                      key={c.email}
                      className="border-b border-neutral-100 align-top last:border-b-0"
                    >
                      <td className="py-3 pr-3">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-neutral-900">
                            {c.name || "-"}
                          </span>
                          <Badges row={c} />
                        </div>
                        {c.isMember && c.memberSince && (
                          <div
                            className="text-[10px] tracking-[0.18em] text-neutral-500 uppercase"
                            style={{ fontFamily: "var(--mono), monospace" }}
                          >
                            Üyelik: {formatDateTime(c.memberSince)}
                          </div>
                        )}
                      </td>
                      <td className="pr-3 text-xs text-neutral-700">
                        <div>{c.email}</div>
                        {c.phone && (
                          <div className="text-neutral-500">{c.phone}</div>
                        )}
                      </td>
                      <td
                        className="pr-3 text-right text-neutral-900"
                        style={{ fontFamily: "var(--mono), monospace" }}
                      >
                        {c.orderCount}
                      </td>
                      <td
                        className="pr-3 text-right text-neutral-900"
                        style={{ fontFamily: "var(--mono), monospace" }}
                      >
                        {formatTRY(c.lifetimeValueMinor)}
                      </td>
                      <td
                        className="pr-3 text-xs text-neutral-500"
                        style={{ fontFamily: "var(--mono), monospace" }}
                      >
                        {c.lastOrderAt
                          ? formatDateTime(c.lastOrderAt)
                          : c.memberSince
                            ? "Sipariş yok"
                            : "-"}
                      </td>
                      <td className="text-right">
                        <Link
                          href={`/admin/musteriler/${encodeURIComponent(c.email)}`}
                          className="inline-flex items-center justify-center rounded-full border border-[var(--admin-border)] px-3 py-1.5 text-xs text-neutral-700 hover:border-[var(--admin-primary)] hover:text-[var(--admin-primary)]"
                        >
                          Detay →
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </Card>
    </main>
  );
}

function Badges({ row }: { row: CustomerRow }) {
  return (
    <span className="flex flex-wrap items-center gap-1">
      {row.isMember ? (
        <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[9px] tracking-[0.16em] text-blue-700 uppercase">
          Üye
        </span>
      ) : (
        <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[9px] tracking-[0.16em] text-neutral-500 uppercase">
          Misafir
        </span>
      )}
      {row.isMember && !row.isActive && (
        <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[9px] tracking-[0.16em] text-amber-700 uppercase">
          Pasif
        </span>
      )}
      {row.isMember && row.emailVerified && row.isActive && (
        <span className="rounded-full bg-green-50 px-2 py-0.5 text-[9px] tracking-[0.16em] text-green-700 uppercase">
          ✓ Doğrulanmış
        </span>
      )}
      {row.isMember && !row.emailVerified && (
        <span className="rounded-full bg-orange-50 px-2 py-0.5 text-[9px] tracking-[0.16em] text-orange-700 uppercase">
          Doğrulanmamış
        </span>
      )}
    </span>
  );
}

function Stat({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
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
        className="mt-1 text-xl text-neutral-900"
        style={mono ? { fontFamily: "var(--mono), monospace" } : undefined}
      >
        {value}
      </div>
    </div>
  );
}
