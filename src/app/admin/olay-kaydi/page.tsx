import Link from "next/link";

import { Card, PageHeader, formatDateTime } from "@/components/admin/forms";
import {
  listAuditLogs,
  type AuditAction,
  type AuditEntity,
} from "@/lib/admin/audit";
import { requireRole } from "@/lib/admin/auth";

export const metadata = { title: "Admin · Olay Kaydı" };
export const dynamic = "force-dynamic";

const ENTITY_LABEL: Record<AuditEntity, string> = {
  product: "Ürün",
  menu_item: "Menü",
  category: "Kategori",
  shop_hero_slide: "Mağaza Hero",
  order: "Sipariş",
  order_item: "Sipariş kalemi",
  promo: "Promosyon",
  settings: "Ayar",
  stock: "Stok",
  auth: "Giriş",
  "2fa": "2FA",
};

const ACTION_LABEL: Record<AuditAction, string> = {
  create: "Oluşturma",
  update: "Güncelleme",
  delete: "Silme",
  bulk_update: "Toplu güncelleme",
  bulk_delete: "Toplu silme",
  transition: "Durum geçişi",
  refund: "İade",
  note: "Not",
  login_success: "Giriş başarılı",
  login_fail: "Giriş başarısız",
  logout: "Çıkış",
  "2fa_enable": "2FA aktif",
  "2fa_disable": "2FA kapatma",
};

const ACTION_TONE: Record<AuditAction, string> = {
  create: "bg-emerald-50 text-emerald-700",
  update: "bg-blue-50 text-blue-700",
  delete: "bg-red-50 text-red-700",
  bulk_update: "bg-blue-50 text-blue-700",
  bulk_delete: "bg-red-50 text-red-700",
  transition: "bg-purple-50 text-purple-700",
  refund: "bg-rose-50 text-rose-700",
  note: "bg-neutral-100 text-neutral-700",
  login_success: "bg-emerald-50 text-emerald-700",
  login_fail: "bg-amber-50 text-amber-700",
  logout: "bg-neutral-100 text-neutral-500",
  "2fa_enable": "bg-emerald-50 text-emerald-700",
  "2fa_disable": "bg-amber-50 text-amber-700",
};

interface PageProps {
  searchParams: Promise<{
    actor?: string;
    entity?: AuditEntity;
    action?: AuditAction;
  }>;
}

export default async function AuditLogPage({ searchParams }: PageProps) {
  await requireRole("audit");
  const sp = await searchParams;
  const rows = await listAuditLogs({
    actor: sp.actor || undefined,
    entity: sp.entity,
    action: sp.action,
    limit: 500,
  });

  return (
    <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-10">
      <PageHeader
        eyebrow="Denetim"
        title="Olay Kaydı"
        description="Admin mutasyonlarının değiştirilemez tarihçesi. Yalnız okuma — kim, neyi, ne zaman değiştirdi."
      />

      <Card className="mb-4">
        <form className="grid gap-3 sm:grid-cols-2 sm:items-end md:grid-cols-[1fr_1fr_1fr_auto_auto]">
          <label className="grid gap-1">
            <span
              className="text-[10px] uppercase tracking-[0.22em] text-neutral-500"
              style={{ fontFamily: "var(--mono), monospace" }}
            >
              Aktör
            </span>
            <input
              type="text"
              name="actor"
              defaultValue={sp.actor ?? ""}
              placeholder="ali@…"
              className="w-full rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2.5 text-base focus:border-neutral-900 focus:bg-white focus:outline-none sm:text-sm"
            />
          </label>
          <label className="grid gap-1">
            <span
              className="text-[10px] uppercase tracking-[0.22em] text-neutral-500"
              style={{ fontFamily: "var(--mono), monospace" }}
            >
              Entite
            </span>
            <select
              name="entity"
              defaultValue={sp.entity ?? ""}
              className="w-full rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2.5 text-base focus:border-neutral-900 focus:bg-white focus:outline-none sm:text-sm"
            >
              <option value="">Tümü</option>
              {(Object.keys(ENTITY_LABEL) as AuditEntity[]).map((e) => (
                <option key={e} value={e}>
                  {ENTITY_LABEL[e]}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1">
            <span
              className="text-[10px] uppercase tracking-[0.22em] text-neutral-500"
              style={{ fontFamily: "var(--mono), monospace" }}
            >
              Aksiyon
            </span>
            <select
              name="action"
              defaultValue={sp.action ?? ""}
              className="w-full rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2.5 text-base focus:border-neutral-900 focus:bg-white focus:outline-none sm:text-sm"
            >
              <option value="">Tümü</option>
              {(Object.keys(ACTION_LABEL) as AuditAction[]).map((a) => (
                <option key={a} value={a}>
                  {ACTION_LABEL[a]}
                </option>
              ))}
            </select>
          </label>
          <button
            type="submit"
            className="inline-flex min-h-[44px] items-center justify-center rounded-full bg-neutral-900 px-4 text-sm font-medium text-white hover:bg-neutral-800"
          >
            Uygula
          </button>
          <Link
            href="/admin/olay-kaydi"
            className="inline-flex min-h-[44px] items-center justify-center rounded-full border border-neutral-200 px-4 text-sm text-neutral-700 hover:border-neutral-900 hover:text-neutral-900"
          >
            Sıfırla
          </Link>
        </form>
      </Card>

      <Card>
        {rows.length === 0 ? (
          <p className="text-sm text-neutral-500">
            Henüz olay yok. Bir ürün oluştur veya bir sipariş durumu güncelle —
            burada görünecek.
          </p>
        ) : (
          <>
          {/* Mobile cards */}
          <ul className="flex flex-col gap-3 md:hidden">
            {rows.map((r) => (
              <li key={r.id} className="rounded-lg border border-neutral-200 p-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-sm text-neutral-900">
                      <span className="font-medium">{ENTITY_LABEL[r.entity]}</span>
                      {r.entityId && (
                        <span
                          className="ml-2 text-[10px] text-neutral-500"
                          style={{ fontFamily: "var(--mono), monospace" }}
                        >
                          {r.entityId}
                        </span>
                      )}
                    </div>
                    <div
                      className="mt-0.5 text-[10px] text-neutral-500"
                      style={{ fontFamily: "var(--mono), monospace" }}
                    >
                      {formatDateTime(r.createdAt)} · {r.actor}
                    </div>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] uppercase tracking-[0.18em] ${ACTION_TONE[r.action]}`}
                  >
                    {ACTION_LABEL[r.action]}
                  </span>
                </div>
                {Object.keys(r.payload).length > 0 && (
                  <details className="mt-2">
                    <summary className="cursor-pointer text-[11px] text-neutral-500 hover:text-neutral-900">
                      Payload göster
                    </summary>
                    <code
                      className="mt-2 block break-all rounded bg-neutral-50 p-2"
                      style={{
                        fontFamily: "var(--mono), monospace",
                        fontSize: 11,
                      }}
                    >
                      {JSON.stringify(r.payload)}
                    </code>
                  </details>
                )}
              </li>
            ))}
          </ul>

          {/* Desktop table */}
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full text-sm">
              <thead>
                <tr
                  className="border-b border-neutral-200 text-left text-[10px] uppercase tracking-[0.22em] text-neutral-500"
                  style={{ fontFamily: "var(--mono), monospace" }}
                >
                  <th className="py-3 pr-3">Zaman</th>
                  <th className="pr-3">Aktör</th>
                  <th className="pr-3">Aksiyon</th>
                  <th className="pr-3">Entite</th>
                  <th className="pr-3">ID</th>
                  <th>Payload</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr
                    key={r.id}
                    className="border-b border-neutral-100 last:border-b-0 align-top"
                  >
                    <td
                      className="py-3 pr-3 text-xs text-neutral-500 whitespace-nowrap"
                      style={{ fontFamily: "var(--mono), monospace" }}
                    >
                      {formatDateTime(r.createdAt)}
                    </td>
                    <td
                      className="pr-3 text-xs text-neutral-700"
                      style={{ fontFamily: "var(--mono), monospace" }}
                    >
                      {r.actor}
                    </td>
                    <td className="pr-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] uppercase tracking-[0.18em] ${ACTION_TONE[r.action]}`}
                      >
                        {ACTION_LABEL[r.action]}
                      </span>
                    </td>
                    <td className="pr-3 text-neutral-800">
                      {ENTITY_LABEL[r.entity]}
                    </td>
                    <td
                      className="pr-3 text-xs text-neutral-500"
                      style={{ fontFamily: "var(--mono), monospace" }}
                    >
                      {r.entityId || "—"}
                    </td>
                    <td className="text-xs text-neutral-600">
                      {Object.keys(r.payload).length === 0 ? (
                        <span className="text-neutral-400">—</span>
                      ) : (
                        <code
                          className="break-all"
                          style={{
                            fontFamily: "var(--mono), monospace",
                            fontSize: 11,
                          }}
                        >
                          {JSON.stringify(r.payload)}
                        </code>
                      )}
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
