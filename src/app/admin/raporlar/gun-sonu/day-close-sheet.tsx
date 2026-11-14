import type { ReactNode } from "react";

import { formatTRY } from "@/components/admin/forms";
import { StatCard } from "@/components/admin/dashboard/stat-card";
import { Badge, NUMERIC_STYLE, Section } from "@/components/admin/ui";
import { cx } from "@/components/laffogato/cx";
import Link from "@/components/link";
import type { DayCloseSummary } from "@/lib/admin/day-close";

const TH =
  "py-2 pr-3 text-left text-xs font-medium text-[var(--admin-text-soft)] last:pr-0";
const TD = "py-2 pr-3 align-top last:pr-0";
const ROW = "border-b border-[var(--admin-border)]";
const LINK =
  "text-[var(--admin-primary)] underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]/45 focus-visible:outline-none print:text-inherit print:no-underline";
const QUIET = "text-sm text-[var(--admin-text-soft)]";
/** A card of the sheet: no shadow on paper. */
const SHEET_CARD = "print:shadow-none";
/** A short card is kept whole on paper; the two tables may run on. */
const KEEP_WHOLE = "break-inside-avoid print:shadow-none";

function Money({ minor, sign }: { minor: number; sign?: "-" }) {
  return (
    <span style={NUMERIC_STYLE} className="whitespace-nowrap">
      {sign && minor > 0 ? "−" : ""}
      {formatTRY(minor)}
    </span>
  );
}

/** Label left, figure right: one line of a card, wrapping on a phone. */
function Figures({
  rows,
}: {
  rows: ReadonlyArray<
    { label: string; value: ReactNode; strong?: boolean } | false
  >;
}) {
  return (
    <dl className="divide-y divide-[var(--admin-border)] text-sm">
      {rows
        .filter((r): r is Exclude<typeof r, false> => Boolean(r))
        .map((r) => (
          <div
            key={r.label}
            className="flex flex-wrap items-baseline justify-between gap-x-3 py-2 first:pt-0 last:pb-0"
          >
            <dt className="min-w-0 text-[var(--admin-text-soft)]">{r.label}</dt>
            <dd
              className={cx(
                "ml-auto text-right text-[var(--admin-text)]",
                r.strong && "font-semibold",
              )}
              style={NUMERIC_STYLE}
            >
              {r.value}
            </dd>
          </div>
        ))}
    </dl>
  );
}

/**
 * The Gün sonu sheet: what the page shows and what goes on paper. It
 * carries `data-print-receipt`, so the panel's print rule (globals.css)
 * hides the sidebar, the top bar and the page's own header and buttons, and
 * prints this alone, with its own heading. Server-safe; it names no
 * customer: orders by number, bookings by code, stamps by count.
 */
export function DayCloseSheet({
  summary,
  dayLabel,
  printedAt,
  productHref,
}: {
  summary: DayCloseSummary;
  /** "19 Ekim 2026 Pazartesi". */
  dayLabel: string;
  /** When the sheet was drawn, Istanbul clock. */
  printedAt: string;
  /** The page of a product, for the role; null hides the link. */
  productHref: (productId: string) => string | null;
}) {
  const { headline, karaoke, stamps } = summary;
  const counted = summary.channels.reduce((s, c) => s + c.counted, 0);
  return (
    <article
      data-print-receipt=""
      aria-label={`Gün sonu, ${dayLabel}`}
      className="space-y-4 text-[var(--admin-text)] print:space-y-3"
    >
      <header className="hidden print:block">
        <h2 className="text-lg font-semibold">Gün sonu · {dayLabel}</h2>
        <p className="text-xs">
          Hazırlandı: {printedAt}. Ciro Raporlar ile aynı sayılır.
        </p>
      </header>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 xl:grid-cols-5">
        <StatCard
          label="Net ciro"
          value={formatTRY(headline.netRevenueMinor)}
          hint="İadeler düşülmüş"
          money
        />
        <StatCard
          label="Brüt ciro"
          value={formatTRY(headline.grossRevenueMinor)}
          hint="İadeler düşülmeden"
          money
        />
        <StatCard
          label="İade"
          value={
            headline.refundedMinor > 0
              ? `−${formatTRY(headline.refundedMinor)}`
              : "-"
          }
          hint="Bu günün siparişlerinden"
          tone={headline.refundedMinor > 0 ? "danger" : undefined}
          money
        />
        <StatCard
          label="Sipariş"
          value={headline.totalOrders.toLocaleString("tr-TR")}
          hint="Ödemesi alınmış"
        />
        <StatCard
          label="Ortalama sepet"
          value={formatTRY(headline.averageOrderMinor)}
          hint="Brüt / sipariş"
          money
        />
      </div>

      <Section
        title="Siparişler"
        className={SHEET_CARD}
        description={
          summary.placed > 0
            ? `${summary.placed} sipariş verildi; ${counted} tanesi ödendi ve ciroya sayıldı.`
            : undefined
        }
        actions={
          summary.placed > 0 ? (
            <Link
              href={summary.ordersHref}
              className={cx(LINK, "text-sm print:hidden")}
            >
              Listede gör
            </Link>
          ) : null
        }
      >
        {summary.placed === 0 ? (
          <p className={QUIET}>Bu gün sipariş verilmedi.</p>
        ) : (
          <div className="grid items-start gap-6 sm:grid-cols-2">
            <table className="w-full text-sm">
              <caption className="sr-only">Kanala göre siparişler</caption>
              <thead>
                <tr className={ROW}>
                  <th scope="col" className={TH}>
                    Kanal
                  </th>
                  <th scope="col" className={cx(TH, "text-right")}>
                    Ödenen
                  </th>
                  <th scope="col" className={cx(TH, "text-right")}>
                    Net
                  </th>
                </tr>
              </thead>
              <tbody>
                {summary.channels.map((c) => (
                  <tr key={c.key} className={ROW}>
                    <th scope="row" className={cx(TD, "text-left font-normal")}>
                      {c.placed > 0 ? (
                        <Link href={c.href} className={LINK}>
                          {c.label}
                        </Link>
                      ) : (
                        c.label
                      )}
                    </th>
                    <td className={cx(TD, "text-right")} style={NUMERIC_STYLE}>
                      {c.counted}
                    </td>
                    <td className={cx(TD, "text-right")}>
                      <Money minor={c.netMinor} />
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="print:table-row-group">
                <tr className="font-semibold">
                  <th scope="row" className={cx(TD, "text-left")}>
                    Toplam
                  </th>
                  <td className={cx(TD, "text-right")} style={NUMERIC_STYLE}>
                    {counted}
                  </td>
                  <td className={cx(TD, "text-right")}>
                    <Money minor={headline.netRevenueMinor} />
                  </td>
                </tr>
              </tfoot>
            </table>

            <table className="w-full text-sm">
              <caption className="sr-only">Duruma göre siparişler</caption>
              <thead>
                <tr className={ROW}>
                  <th scope="col" className={TH}>
                    Durum
                  </th>
                  <th scope="col" className={cx(TH, "text-right")}>
                    Sipariş
                  </th>
                </tr>
              </thead>
              <tbody>
                {summary.statuses.map((s) => (
                  <tr key={s.status} className={ROW}>
                    <th scope="row" className={cx(TD, "text-left font-normal")}>
                      {s.label}
                    </th>
                    <td className={cx(TD, "text-right")} style={NUMERIC_STYLE}>
                      {s.count}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="print:table-row-group">
                <tr className="font-semibold">
                  <th scope="row" className={cx(TD, "text-left")}>
                    Toplam
                  </th>
                  <td className={cx(TD, "text-right")} style={NUMERIC_STYLE}>
                    {summary.placed}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </Section>

      <Section
        title="İadeler"
        className={SHEET_CARD}
        description="Bu gün yapılan iadeler; sipariş başka gün verilmiş olabilir."
      >
        {summary.refunds.length === 0 ? (
          <p className={QUIET}>Bu gün iade yapılmadı.</p>
        ) : (
          <table className="w-full text-sm">
            <caption className="sr-only">Bu gün yapılan iadeler</caption>
            <thead>
              <tr className={ROW}>
                <th scope="col" className={TH}>
                  Saat
                </th>
                <th scope="col" className={TH}>
                  Kayıt
                </th>
                <th scope="col" className={TH}>
                  Nereye
                </th>
                <th scope="col" className={cx(TH, "text-right")}>
                  Tutar
                </th>
              </tr>
            </thead>
            <tbody>
              {summary.refunds.map((r) => (
                <tr key={r.key} className={ROW}>
                  <td className={TD} style={NUMERIC_STYLE}>
                    {r.time}
                  </td>
                  <td
                    className={cx(TD, "whitespace-nowrap")}
                    style={NUMERIC_STYLE}
                  >
                    <Link href={r.href} className={LINK}>
                      {r.label}
                    </Link>
                  </td>
                  <td className={cx(TD, "text-[var(--admin-text-soft)]")}>
                    {r.destination}
                  </td>
                  <td className={cx(TD, "text-right")}>
                    <Money minor={r.amountMinor} sign="-" />
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="print:table-row-group">
              <tr className="font-semibold">
                <th scope="row" colSpan={3} className={cx(TD, "text-left")}>
                  Toplam
                </th>
                <td className={cx(TD, "text-right")}>
                  <Money minor={summary.refundTotalMinor} sign="-" />
                </td>
              </tr>
            </tfoot>
          </table>
        )}
      </Section>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 print:gap-3">
        <Section title="Karaoke" className={KEEP_WHOLE}>
          <Figures
            rows={[
              {
                label: "Yapıldı",
                value: karaoke.done,
              },
              { label: "Odada geçen saat", value: karaoke.doneHours },
              summary.isToday && { label: "Sırada", value: karaoke.upcoming },
              { label: "Onay bekliyor", value: karaoke.requested },
              { label: "Gelmedi", value: karaoke.noShow },
              { label: "İptal", value: karaoke.cancelled },
              karaoke.unpaid > 0 && {
                label: "Ödenmeden kapanan",
                value: karaoke.unpaid,
              },
              {
                label: "Ön ödeme (net)",
                value: (
                  <>
                    <Money minor={karaoke.netMinor} />
                    <span className="block text-xs font-normal text-[var(--admin-text-soft)]">
                      {karaoke.paidCount} rezervasyon
                    </span>
                  </>
                ),
                strong: true,
              },
            ]}
          />
        </Section>

        <Section title="Kasa damgaları" className={KEEP_WHOLE}>
          <Figures
            rows={[
              { label: "Verilen damga", value: stamps.given },
              stamps.corrected > 0 && {
                label: "Düzeltme",
                value: `−${stamps.corrected}`,
              },
              {
                label: "Net",
                value: stamps.given - stamps.corrected,
                strong: true,
              },
            ]}
          />
        </Section>

        <Section
          title="Stokta biten"
          className={cx(KEEP_WHOLE, "sm:col-span-2 xl:col-span-1")}
        >
          {summary.soldOut.length === 0 ? (
            <p className={QUIET}>Bu gün stoğu biten ürün yok.</p>
          ) : (
            <ul className="divide-y divide-[var(--admin-border)] text-sm">
              {summary.soldOut.map((s) => {
                const href = productHref(s.productId);
                return (
                  <li key={s.key} className="py-2 first:pt-0 last:pb-0">
                    <div className="break-words">
                      {href ? (
                        <Link href={href} className={LINK}>
                          {s.name}
                        </Link>
                      ) : (
                        s.name
                      )}
                    </div>
                    <div className="mt-1 flex items-center gap-2">
                      <span
                        className="text-xs text-[var(--admin-text-soft)]"
                        style={NUMERIC_STYLE}
                      >
                        {s.time}
                      </span>
                      {s.stillOut ? (
                        <Badge tone="warning">Stok 0</Badge>
                      ) : (
                        <Badge>Dolduruldu</Badge>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Section>
      </div>

      {/* An internal summary, not the till's end-of-day (Z) report or any
          other fiscal record (VUK m.229, m.233): it must not pass for one,
          like the order receipt (legal decision ASK-INVOICE, X-FIS). */}
      <p
        data-day-close-fiscal-note=""
        className="text-xs text-[var(--admin-text-soft)]"
      >
        Bu sayfa iç kullanım içindir, mali belge değildir.
      </p>
    </article>
  );
}
