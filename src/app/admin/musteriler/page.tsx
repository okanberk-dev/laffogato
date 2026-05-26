import Link from "next/link";

import {
  Card,
  PageHeader,
  formatDateTime,
  formatTRY,
} from "@/components/admin/forms";
import { requireRole } from "@/lib/admin/auth";
import { listCustomers } from "@/lib/admin/store";

export const metadata = { title: "Admin · Müşteriler" };
export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ q?: string; sort?: SortKey }>;
}

type SortKey = "recent" | "value" | "orders" | "name";

const SORT_LABEL: Record<SortKey, string> = {
  recent: "Son sipariş tarihi",
  value: "Lifetime value",
  orders: "Sipariş sayısı",
  name: "Ad (A→Z)",
};

export default async function CustomersPage({ searchParams }: PageProps) {
  await requireRole("customers");
  const sp = await searchParams;
  const q = (sp.q ?? "").trim().toLowerCase();
  const sort: SortKey = (sp.sort ?? "recent") as SortKey;

  const all = await listCustomers();
  let list = all;
  if (q) {
    list = list.filter(
      (c) =>
        c.email.includes(q) ||
        c.name.toLowerCase().includes(q) ||
        c.phone.toLowerCase().includes(q),
    );
  }
  list = [...list].sort((a, b) => {
    if (sort === "value") return b.lifetimeValueMinor - a.lifetimeValueMinor;
    if (sort === "orders") return b.orderCount - a.orderCount;
    if (sort === "name") return a.name.localeCompare(b.name, "tr");
    return b.lastOrderAt.localeCompare(a.lastOrderAt);
  });

  const totalValue = all.reduce((s, c) => s + c.lifetimeValueMinor, 0);
  const totalRefunded = all.reduce((s, c) => s + c.refundedMinor, 0);
  const totalOrders = all.reduce((s, c) => s + c.orderCount, 0);

  return (
    <main className="mx-auto max-w-7xl px-6 py-10">
      <PageHeader
        eyebrow="Pazarlama · CRM lite"
        title="Müşteriler"
        description="Misafir siparişlerden e-postaya göre çıkarılan müşteri profilleri. Auth bağlandığında gerçek hesaplarla birleşecek."
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-4">
        <Stat label="Müşteri" value={String(all.length)} />
        <Stat label="Toplam sipariş" value={String(totalOrders)} />
        <Stat label="Lifetime value" value={formatTRY(totalValue)} mono />
        <Stat
          label="İade toplam"
          value={formatTRY(totalRefunded)}
          mono
          tone={totalRefunded > 0 ? "warn" : undefined}
        />
      </div>

      <Card className="mb-4">
        <form className="flex flex-wrap items-end gap-3">
          <label className="flex-1 min-w-[240px] grid gap-1">
            <span
              className="text-[10px] uppercase tracking-[0.22em] text-neutral-500"
              style={{ fontFamily: "var(--mono), monospace" }}
            >
              Ara
            </span>
            <input
              type="text"
              name="q"
              defaultValue={q}
              placeholder="E-posta, ad veya telefon"
              className="rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm focus:border-neutral-900 focus:bg-white focus:outline-none"
            />
          </label>
          <label className="grid gap-1">
            <span
              className="text-[10px] uppercase tracking-[0.22em] text-neutral-500"
              style={{ fontFamily: "var(--mono), monospace" }}
            >
              Sırala
            </span>
            <select
              name="sort"
              defaultValue={sort}
              className="rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm focus:border-neutral-900 focus:bg-white focus:outline-none"
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
            className="rounded-full bg-neutral-900 px-4 py-2 text-xs font-medium text-white hover:bg-neutral-800"
          >
            Uygula
          </button>
          <Link
            href="/admin/musteriler"
            className="rounded-full border border-neutral-200 px-4 py-2 text-xs text-neutral-700 hover:border-neutral-900 hover:text-neutral-900"
          >
            Sıfırla
          </Link>
        </form>
      </Card>

      <Card>
        {list.length === 0 ? (
          <p className="text-sm text-neutral-500">
            {q
              ? "Bu filtreyle müşteri bulunamadı."
              : "Henüz misafir e-postası içeren sipariş yok."}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr
                  className="border-b border-neutral-200 text-left text-[10px] uppercase tracking-[0.22em] text-neutral-500"
                  style={{ fontFamily: "var(--mono), monospace" }}
                >
                  <th className="py-3 pr-3">Müşteri</th>
                  <th className="pr-3">İletişim</th>
                  <th className="pr-3 text-right">Sipariş</th>
                  <th className="pr-3 text-right">Lifetime value</th>
                  <th className="pr-3 text-right">İade</th>
                  <th className="pr-3">Son sipariş</th>
                  <th className="text-right">—</th>
                </tr>
              </thead>
              <tbody>
                {list.map((c) => (
                  <tr
                    key={c.email}
                    className="border-b border-neutral-100 last:border-b-0 align-top"
                  >
                    <td className="py-3 pr-3">
                      <div className="font-medium text-neutral-900">
                        {c.name || "—"}
                      </div>
                      <div
                        className="text-[10px] uppercase tracking-[0.18em] text-neutral-500"
                        style={{ fontFamily: "var(--mono), monospace" }}
                      >
                        İlk: {formatDateTime(c.firstOrderAt)}
                      </div>
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
                      className={`pr-3 text-right ${
                        c.refundedMinor > 0 ? "text-rose-700" : "text-neutral-400"
                      }`}
                      style={{ fontFamily: "var(--mono), monospace" }}
                    >
                      {c.refundedMinor > 0
                        ? `−${formatTRY(c.refundedMinor)}`
                        : "—"}
                    </td>
                    <td
                      className="pr-3 text-xs text-neutral-500"
                      style={{ fontFamily: "var(--mono), monospace" }}
                    >
                      {formatDateTime(c.lastOrderAt)}
                    </td>
                    <td className="text-right">
                      <Link
                        href={`/admin/musteriler/${encodeURIComponent(c.email)}`}
                        className="inline-flex items-center justify-center rounded-full border border-neutral-200 px-3 py-1.5 text-xs text-neutral-700 hover:border-neutral-900 hover:text-neutral-900"
                      >
                        Geçmiş →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </main>
  );
}

function Stat({
  label,
  value,
  mono,
  tone,
}: {
  label: string;
  value: string;
  mono?: boolean;
  tone?: "warn";
}) {
  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
      <div
        className="text-[10px] uppercase tracking-[0.22em] text-neutral-500"
        style={{ fontFamily: "var(--mono), monospace" }}
      >
        {label}
      </div>
      <div
        className={`mt-1 text-xl ${tone === "warn" ? "text-rose-700" : "text-neutral-900"}`}
        style={mono ? { fontFamily: "var(--mono), monospace" } : undefined}
      >
        {value}
      </div>
    </div>
  );
}
