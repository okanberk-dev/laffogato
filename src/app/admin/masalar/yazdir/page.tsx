import { PageHeader } from "@/components/admin/forms";
import { BUTTON } from "@/components/admin/ui";
import Link from "@/components/link";
import { requireRole } from "@/lib/admin/auth";
import { tableQrSvg } from "@/lib/admin/cafe-table-qr";
import { cafeTableIdSchema } from "@/lib/admin/cafe-table-schema";
import { listCafeTables } from "@/lib/admin/cafe-tables";
import {
  CAFE_TABLE_PRINT_PARAM,
  CAFE_TABLES_PATH,
  cafeTableHref,
  tablesToPrint,
} from "@/lib/admin/cafe-tables-panel";
import { firstParam } from "@/lib/admin/list-params";

import { PrintButton } from "./print-button";

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export const metadata = { title: "Admin · Masa kartları" };
export const dynamic = "force-dynamic";

/*
 * The global print rule (globals.css, `@media print`) hides everything but
 * `[data-print-receipt]` and pins that element to the page's top-left corner.
 * The sheet carries the attribute, so the sidebar and the header disappear on
 * paper; the scoped rules below let it run across several pages and keep a
 * card from being split between two. The cards keep the site's voice
 * (Poppins, --font-display) while the panel speaks Inter: they sit on the
 * tables, in front of customers.
 */
const PRINT_CSS = `
@page { size: A4; margin: 12mm; }
.qr-sheet { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 16px; }
.qr-card { break-inside: avoid; page-break-inside: avoid; border: 1px solid #d9d2c7; border-radius: 16px; padding: 18px; text-align: center; background: #fff; color: #201c17; font-family: var(--font-display), "Poppins", sans-serif; }
.qr-card-code { width: 100%; max-width: 220px; margin: 0 auto; }
.qr-card-code svg { width: 100%; height: auto; display: block; }
.qr-card-name { margin-top: 10px; font-size: 22px; font-weight: 700; }
.qr-card-line { margin-top: 4px; font-size: 13px; color: #5f594e; }
@media print {
  [data-print-receipt].qr-sheet { position: absolute; inset: 0 auto auto 0; width: 100%; padding: 0; display: grid !important; grid-template-columns: repeat(2, 1fr); gap: 10mm; }
  .qr-card { border-color: #999; }
}
`;

/**
 * The cards to print: every active table, or with `?masa=<id>` that one
 * table's card alone (after "Kodu yenile", admin audit KAR-24).
 */
export default async function PrintCafeTablesPage({ searchParams }: PageProps) {
  await requireRole("tables");
  const raw = firstParam(await searchParams, CAFE_TABLE_PRINT_PARAM);
  const parsed = raw ? cafeTableIdSchema.safeParse(raw) : null;
  // A ?masa= that is not a table id prints nothing rather than every card.
  const only = parsed ? (parsed.success ? parsed.data : "-") : undefined;
  const tables = tablesToPrint(await listCafeTables(), only);
  const svgs = await Promise.all(tables.map((t) => tableQrSvg(t.code)));
  const single = only !== undefined;
  const back =
    single && tables[0] ? cafeTableHref(tables[0].id) : CAFE_TABLES_PATH;

  return (
    <main className="w-full px-4 pt-5 pb-10 sm:px-5 lg:px-6 lg:pt-6 [&>:not(header)]:max-w-5xl">
      <style>{PRINT_CSS}</style>
      <PageHeader
        title={
          single && tables[0] ? `${tables[0].name} kartı` : "Masa kartları"
        }
        description={
          single
            ? "Yalnız bu masanın kartı. Yazdır, kes, masaya koy; eski kartı masadan kaldır."
            : "Aktif her masa için bir kart. Yazdır, kes, masaya koy. Kodu yenilenen masanın kartını yeniden yazdır."
        }
        action={
          <div className="flex flex-wrap gap-2">
            <Link href={back} className={BUTTON.ghost}>
              {single && tables[0] ? "Masaya dön" : "Masalara dön"}
            </Link>
            <PrintButton disabled={tables.length === 0} />
          </div>
        }
      />
      {tables.length === 0 ? (
        <p className="text-sm text-[var(--admin-text-soft)]">
          {single ? "Bu masa bulunamadı." : "Yazdırılacak aktif masa yok."}
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
