import Link from "next/link";

import {
  Card,
  DangerButton,
  PageHeader,
  formatDateTime,
  formatTRY,
} from "@/components/admin/forms";
import { requireRole } from "@/lib/admin/auth";
import { listPromos } from "@/lib/admin/store";

import { deletePromoAction } from "./actions";

export const metadata = { title: "Admin · Promosyon Kodları" };
export const dynamic = "force-dynamic";

function discountLabel(p: { kind: "pct" | "fixed"; value: number }): string {
  return p.kind === "pct" ? `%${p.value}` : `−${formatTRY(p.value)}`;
}

export default async function PromoCodesPage() {
  await requireRole("promos");
  const promos = await listPromos();

  return (
    <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-10">
      <PageHeader
        eyebrow="Pazarlama"
        title="Promosyon Kodları"
        description="Sepette uygulanan indirim kodları. Yüzde veya sabit tutar, minimum sepet, kullanım limiti ve son geçerlilik desteklenir."
        action={
          <Link
            href="/admin/promosyon/yeni"
            className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-full bg-[var(--admin-primary)] px-5 py-2.5 text-sm font-medium text-white hover:bg-[var(--admin-primary-hover)] sm:w-auto"
          >
            + Yeni kod
          </Link>
        }
      />

      <Card>
        {promos.length === 0 ? (
          <p className="text-sm text-neutral-500">
            Henüz promosyon kodu yok. "+ Yeni kod" ile ekle.
          </p>
        ) : (
          <>
            {/* Mobile cards */}
            <ul className="flex flex-col gap-3 md:hidden">
              {promos.map((p) => {
                const expired =
                  p.expiresAt && new Date(p.expiresAt).getTime() < Date.now();
                const exhausted =
                  p.usageLimit > 0 && p.usageCount >= p.usageLimit;
                return (
                  <li
                    key={p.id}
                    className="rounded-lg border border-[var(--admin-border)] p-3"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div
                          className="font-medium text-neutral-900"
                          style={{ fontFamily: "var(--mono), monospace" }}
                        >
                          {p.code}
                        </div>
                        <div
                          className="mt-1 text-sm text-neutral-700"
                          style={{ fontFamily: "var(--mono), monospace" }}
                        >
                          {discountLabel(p)}
                          {p.minSubtotalMinor > 0 && (
                            <span className="text-neutral-500">
                              {" "}
                              · min {formatTRY(p.minSubtotalMinor)}
                            </span>
                          )}
                        </div>
                      </div>
                      {!p.isActive ? (
                        <span className="shrink-0 rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] tracking-[0.18em] text-neutral-500 uppercase">
                          Pasif
                        </span>
                      ) : expired ? (
                        <span className="shrink-0 rounded-full bg-red-50 px-2 py-0.5 text-[10px] tracking-[0.18em] text-red-700 uppercase">
                          Süresi dolmuş
                        </span>
                      ) : exhausted ? (
                        <span className="shrink-0 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] tracking-[0.18em] text-amber-700 uppercase">
                          Limit doldu
                        </span>
                      ) : (
                        <span className="shrink-0 rounded-full bg-green-50 px-2 py-0.5 text-[10px] tracking-[0.18em] text-green-700 uppercase">
                          Aktif
                        </span>
                      )}
                    </div>
                    <div
                      className="mt-2 text-[10px] text-neutral-500"
                      style={{ fontFamily: "var(--mono), monospace" }}
                    >
                      {p.usageCount}
                      {p.usageLimit > 0 ? `/${p.usageLimit}` : ""} kullanım ·{" "}
                      {p.expiresAt ? formatDateTime(p.expiresAt) : "süresiz"}
                    </div>
                    <div className="mt-3 flex gap-2">
                      <Link
                        href={`/admin/promosyon/${p.id}/duzenle`}
                        className="inline-flex min-h-[40px] flex-1 items-center justify-center rounded-full border border-[var(--admin-border)] px-3 text-xs text-neutral-700 hover:border-[var(--admin-primary)] hover:text-[var(--admin-primary)]"
                      >
                        Düzenle
                      </Link>
                      <form action={deletePromoAction}>
                        <input type="hidden" name="id" value={p.id} />
                        <DangerButton type="submit" className="text-xs">
                          Sil
                        </DangerButton>
                      </form>
                    </div>
                  </li>
                );
              })}
            </ul>

            {/* Desktop table */}
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full text-sm">
                <thead>
                  <tr
                    className="border-b border-[var(--admin-border)] text-left text-[10px] tracking-[0.22em] text-neutral-500 uppercase"
                    style={{ fontFamily: "var(--mono), monospace" }}
                  >
                    <th className="py-3 pr-3">Kod</th>
                    <th className="pr-3">İndirim</th>
                    <th className="pr-3 text-right">Min. sepet</th>
                    <th className="pr-3 text-right">Kullanım</th>
                    <th className="pr-3">Geçerlilik</th>
                    <th className="pr-3">Durum</th>
                    <th className="text-right">İşlem</th>
                  </tr>
                </thead>
                <tbody>
                  {promos.map((p) => {
                    const expired =
                      p.expiresAt &&
                      new Date(p.expiresAt).getTime() < Date.now();
                    const exhausted =
                      p.usageLimit > 0 && p.usageCount >= p.usageLimit;
                    return (
                      <tr
                        key={p.id}
                        className="border-b border-neutral-100 last:border-b-0"
                      >
                        <td
                          className="py-3 pr-3 font-medium text-neutral-900"
                          style={{ fontFamily: "var(--mono), monospace" }}
                        >
                          {p.code}
                        </td>
                        <td
                          className="pr-3"
                          style={{ fontFamily: "var(--mono), monospace" }}
                        >
                          {discountLabel(p)}
                        </td>
                        <td
                          className="pr-3 text-right text-neutral-700"
                          style={{ fontFamily: "var(--mono), monospace" }}
                        >
                          {p.minSubtotalMinor > 0
                            ? formatTRY(p.minSubtotalMinor)
                            : "—"}
                        </td>
                        <td
                          className="pr-3 text-right text-neutral-700"
                          style={{ fontFamily: "var(--mono), monospace" }}
                        >
                          {p.usageCount}
                          {p.usageLimit > 0 ? `/${p.usageLimit}` : ""}
                        </td>
                        <td
                          className="pr-3 text-xs text-neutral-600"
                          style={{ fontFamily: "var(--mono), monospace" }}
                        >
                          {p.expiresAt
                            ? formatDateTime(p.expiresAt)
                            : "Süresiz"}
                        </td>
                        <td className="pr-3">
                          {!p.isActive ? (
                            <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] tracking-[0.18em] text-neutral-500 uppercase">
                              Pasif
                            </span>
                          ) : expired ? (
                            <span className="rounded-full bg-red-50 px-2 py-0.5 text-[10px] tracking-[0.18em] text-red-700 uppercase">
                              Süresi dolmuş
                            </span>
                          ) : exhausted ? (
                            <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] tracking-[0.18em] text-amber-700 uppercase">
                              Limit doldu
                            </span>
                          ) : (
                            <span className="rounded-full bg-green-50 px-2 py-0.5 text-[10px] tracking-[0.18em] text-green-700 uppercase">
                              Aktif
                            </span>
                          )}
                        </td>
                        <td className="text-right">
                          <div className="flex justify-end gap-2">
                            <Link
                              href={`/admin/promosyon/${p.id}/duzenle`}
                              className="inline-flex items-center justify-center rounded-full border border-[var(--admin-border)] px-3 py-1.5 text-xs text-neutral-700 hover:border-[var(--admin-primary)] hover:text-[var(--admin-primary)]"
                            >
                              Düzenle
                            </Link>
                            <form action={deletePromoAction}>
                              <input type="hidden" name="id" value={p.id} />
                              <DangerButton type="submit" className="text-xs">
                                Sil
                              </DangerButton>
                            </form>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </Card>
    </main>
  );
}
