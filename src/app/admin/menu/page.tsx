import Link from "next/link";

import {
  Card,
  DangerButton,
  PageHeader,
  formatTRY,
} from "@/components/admin/forms";
import {
  listMenuItems,
  MENU_CATEGORY_KEYS,
  MENU_CATEGORY_LABELS,
  type MenuCategoryKey,
} from "@/lib/admin/store";

import { deleteMenuItemAction } from "./actions";

export const metadata = { title: "Admin · Kafe Menüsü" };
export const dynamic = "force-dynamic";

export default async function AdminMenuPage() {
  const all = await listMenuItems();
  const byCategory: Record<MenuCategoryKey, typeof all> = {
    affogato: [],
    matcha: [],
    espresso: [],
    cold: [],
    gelato: [],
  };
  for (const it of all) {
    byCategory[it.categoryKey].push(it);
  }

  return (
    <main className="mx-auto max-w-7xl px-6 py-10">
      <PageHeader
        eyebrow="Bar · Il menù"
        title="Kafe Menüsü"
        description="Her gün servis ettiğiniz affogato, matcha, espresso, soğuk içecek ve gelato kalemleri. Burada düzenlersen anında /menu sayfasında görünür."
        action={
          <Link
            href="/admin/menu/yeni"
            className="inline-flex items-center justify-center gap-2 rounded-full bg-neutral-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-neutral-800"
          >
            + Yeni menü kalemi
          </Link>
        }
      />

      <div className="flex flex-col gap-6">
        {MENU_CATEGORY_KEYS.map((key) => {
          const items = byCategory[key];
          return (
            <Card key={key}>
              <div className="mb-4 flex flex-wrap items-end justify-between gap-3 border-b border-neutral-100 pb-3">
                <div>
                  <div
                    className="text-[10px] uppercase tracking-[0.22em] text-neutral-500"
                    style={{ fontFamily: "var(--mono), monospace" }}
                  >
                    {items.length} kalem
                  </div>
                  <h2
                    className="text-2xl"
                    style={{
                      fontFamily: "var(--serif), 'Playfair Display', serif",
                      fontStyle: "italic",
                      fontWeight: 500,
                    }}
                  >
                    {MENU_CATEGORY_LABELS[key]}
                  </h2>
                </div>
                <Link
                  href={`/admin/menu/yeni?cat=${key}`}
                  className="text-xs text-neutral-700 underline-offset-4 hover:text-neutral-900 hover:underline"
                >
                  + Bu kategoriye ekle
                </Link>
              </div>

              {items.length === 0 ? (
                <p className="text-sm text-neutral-500">Bu kategoride kalem yok.</p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr
                      className="text-left text-[10px] uppercase tracking-[0.22em] text-neutral-500"
                      style={{ fontFamily: "var(--mono), monospace" }}
                    >
                      <th className="py-2 pr-3">Sıra</th>
                      <th className="pr-3">Kalem</th>
                      <th className="pr-3">Etiket</th>
                      <th className="pr-3 text-right">Fiyat</th>
                      <th className="pr-3">Durum</th>
                      <th className="text-right">İşlem</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((it) => (
                      <tr
                        key={it.id}
                        className="border-t border-neutral-100"
                      >
                        <td
                          className="py-3 pr-3 text-neutral-500"
                          style={{ fontFamily: "var(--mono), monospace" }}
                        >
                          {String(it.sortOrder).padStart(2, "0")}
                        </td>
                        <td className="pr-3">
                          <div className="font-medium text-neutral-900">
                            {it.name}
                          </div>
                          <div className="line-clamp-1 max-w-md text-xs text-neutral-500">
                            {it.desc}
                          </div>
                        </td>
                        <td className="pr-3">
                          {it.tags.length === 0 ? (
                            <span className="text-xs text-neutral-400">—</span>
                          ) : (
                            <div className="flex flex-wrap gap-1">
                              {it.tags.map((t) => (
                                <span
                                  key={t}
                                  className="rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] uppercase tracking-[0.16em] text-neutral-600"
                                >
                                  {t}
                                </span>
                              ))}
                            </div>
                          )}
                        </td>
                        <td
                          className="pr-3 text-right"
                          style={{ fontFamily: "var(--mono), monospace" }}
                        >
                          {formatTRY(it.priceMinor)}
                        </td>
                        <td className="pr-3">
                          {it.isActive ? (
                            <span className="rounded-full bg-green-50 px-2 py-0.5 text-[10px] uppercase tracking-[0.18em] text-green-700">
                              Aktif
                            </span>
                          ) : (
                            <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] uppercase tracking-[0.18em] text-neutral-500">
                              Gizli
                            </span>
                          )}
                        </td>
                        <td className="text-right">
                          <div className="flex justify-end gap-2">
                            <Link
                              href={`/admin/menu/${it.id}/duzenle`}
                              className="inline-flex items-center justify-center rounded-full border border-neutral-200 px-3 py-1.5 text-xs text-neutral-700 hover:border-neutral-900 hover:text-neutral-900"
                            >
                              Düzenle
                            </Link>
                            <form action={deleteMenuItemAction}>
                              <input type="hidden" name="id" value={it.id} />
                              <DangerButton type="submit" className="text-xs">
                                Sil
                              </DangerButton>
                            </form>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </Card>
          );
        })}
      </div>
    </main>
  );
}
