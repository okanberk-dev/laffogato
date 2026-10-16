import Link from "next/link";

import { PageHeader } from "@/components/admin/forms";
import { requireRole } from "@/lib/admin/auth";
import { tableQrSvg } from "@/lib/admin/cafe-table-qr";
import { listCafeTables } from "@/lib/admin/cafe-tables";

import { PrintButton } from "./print-button";

export const metadata = { title: "Admin · Masa kartları" };
export const dynamic = "force-dynamic";

/*
 * The global print rule (globals.css, `@media print`) hides everything but
 * `[data-print-receipt]` and pins that element to the page's top-left corner.
 * The sheet carries the attribute, so the sidebar and the header disappear on
 * paper; the scoped rules below let it run across several pages and keep a
 * card from being split between two.
 */
const PRINT_CSS = `
@page { size: A4; margin: 12mm; }
.qr-sheet { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 16px; }
.qr-card { break-inside: avoid; page-break-inside: avoid; border: 1px solid #d9d2c7; border-radius: 16px; padding: 18px; text-align: center; background: #fff; color: #201c17; }
.qr-card-code { width: 100%; max-width: 220px; margin: 0 auto; }
.qr-card-code svg { width: 100%; height: auto; display: block; }
.qr-card-name { margin-top: 10px; font-size: 22px; font-weight: 700; }
.qr-card-line { margin-top: 4px; font-size: 13px; color: #5f594e; }
@media print {
  [data-print-receipt].qr-sheet { position: absolute; inset: 0 auto auto 0; width: 100%; padding: 0; display: grid !important; grid-template-columns: repeat(2, 1fr); gap: 10mm; }
  .qr-card { border-color: #999; }
}
`;

export default async function PrintCafeTablesPage() {
  await requireRole("tables");
  const tables = (await listCafeTables()).filter((t) => t.isActive);
  const svgs = await Promise.all(tables.map((t) => tableQrSvg(t.code)));

  return (
    <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-10">
      <style>{PRINT_CSS}</style>
      <PageHeader
        eyebrow="Satış · Masalar"
        title="Masa kartları"
        description="Aktif her masa için bir kart. Yazdır, kes, masaya koy. Kodu yenilenen masanın kartını yeniden yazdır."
        action={
          <div className="flex flex-wrap gap-2">
            <Link
              href="/admin/masalar"
              className="inline-flex min-h-[44px] items-center rounded-xl border border-[var(--admin-border-strong)] px-4 py-2 text-sm text-[var(--admin-text-soft)]"
            >
              Masalara dön
            </Link>
            <PrintButton disabled={tables.length === 0} />
          </div>
        }
      />
      {tables.length === 0 ? (
        <p className="text-sm text-[var(--admin-text-soft)]">
          Yazdırılacak aktif masa yok.
        </p>
      ) : (
        <div className="qr-sheet" data-print-receipt="">
          {tables.map((t, i) => (
            <section key={t.id} className="qr-card">
              {/* qrcode output for our own URL; no user text inside. */}
              <div
                className="qr-card-code"
                role="img"
                aria-label={`${t.name} QR kodu`}
                dangerouslySetInnerHTML={{ __html: svgs[i] }}
              />
              <div className="qr-card-name">{t.name}</div>
              <div className="qr-card-line">Menü · Uygulamadan sipariş ver</div>
            </section>
          ))}
        </div>
      )}
    </main>
  );
}
