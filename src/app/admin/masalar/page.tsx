import Link from "next/link";

import { Card, GhostButton, PageHeader } from "@/components/admin/forms";
import { requireRole } from "@/lib/admin/auth";
import { tableQrSvg } from "@/lib/admin/cafe-table-qr";
import { tableUrl } from "@/lib/admin/cafe-tables-core";
import { listCafeTables, type CafeTable } from "@/lib/admin/cafe-tables";

import { rotateCafeTableCodeAction, setCafeTableActiveAction } from "./actions";
import { CopyTableLink, RotateTableCodeForm } from "./table-row-actions";

export const metadata = { title: "Admin · Masalar" };
export const dynamic = "force-dynamic";

const linkButton =
  "inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl border border-[var(--admin-border-strong)] bg-[var(--admin-surface)] px-4 py-2 text-xs text-[var(--admin-text-soft)] transition-colors hover:border-[var(--admin-primary)] hover:text-[var(--admin-primary)]";

function TableRow({ table, svg }: { table: CafeTable; svg: string }) {
  const url = tableUrl(table.code);
  return (
    <Card>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
        {/* The SVG is the qrcode library's output for our own URL - no user
            text reaches it (the code is server-drawn base32). */}
        <div
          className={`h-28 w-28 shrink-0 rounded-xl border border-[var(--admin-border)] bg-white p-1 [&_svg]:h-full [&_svg]:w-full ${table.isActive ? "" : "opacity-40"}`}
          aria-label={`${table.name} QR kodu`}
          role="img"
          dangerouslySetInnerHTML={{ __html: svg }}
        />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-base font-medium text-[var(--admin-text)]">
              {table.name}
            </h2>
            <span
              className={`rounded-full px-2.5 py-0.5 text-[10px] tracking-[0.18em] uppercase ${
                table.isActive
                  ? "bg-emerald-50 text-emerald-700"
                  : "bg-neutral-100 text-neutral-600"
              }`}
            >
              {table.isActive ? "Aktif" : "Pasif"}
            </span>
          </div>
          <p className="mt-1 text-xs break-all text-[var(--admin-text-mute)]">
            {url}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <CopyTableLink url={url} />
            <a className={linkButton} href={`/admin/masalar/${table.id}/qr`}>
              SVG indir
            </a>
            <Link
              className={linkButton}
              href={`/admin/masalar/${table.id}/duzenle`}
            >
              Düzenle
            </Link>
            <form action={setCafeTableActiveAction}>
              <input type="hidden" name="id" value={table.id} />
              <input
                type="hidden"
                name="isActive"
                value={table.isActive ? "false" : "true"}
              />
              <GhostButton type="submit" className="text-xs">
                {table.isActive ? "Pasifleştir" : "Etkinleştir"}
              </GhostButton>
            </form>
            <RotateTableCodeForm
              id={table.id}
              action={rotateCafeTableCodeAction}
            />
          </div>
        </div>
      </div>
    </Card>
  );
}

export default async function CafeTablesPage() {
  await requireRole("tables");
  const tables = await listCafeTables();
  const svgs = await Promise.all(tables.map((t) => tableQrSvg(t.code)));
  const active = tables.filter((t) => t.isActive).length;

  return (
    <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-10">
      <PageHeader
        eyebrow="Satış · Masalar"
        title="Masalar · QR"
        description="Her masanın QR'ı menüyü açar; uygulaması olan misafir siparişini o masaya verir. Ödeme her zaman sipariş verilirken uygulamada alınır."
        action={
          <div className="flex flex-wrap gap-2">
            <Link className={linkButton} href="/admin/masalar/yazdir">
              Yazdır ({active})
            </Link>
            <Link
              className="inline-flex min-h-[44px] items-center justify-center rounded-xl bg-[var(--admin-primary)] px-5 py-2.5 text-sm font-medium text-white hover:bg-[var(--admin-primary-hover)]"
              href="/admin/masalar/yeni"
            >
              + Yeni masa
            </Link>
          </div>
        }
      />
      {tables.length === 0 ? (
        <Card>
          <p className="text-sm text-[var(--admin-text-soft)]">
            Henüz masa yok. İlk masayı ekle, kartını yazdır ve masaya koy.
          </p>
        </Card>
      ) : (
        <div className="grid gap-3">
          {tables.map((t, i) => (
            <TableRow key={t.id} table={t} svg={svgs[i]} />
          ))}
        </div>
      )}
    </main>
  );
}
