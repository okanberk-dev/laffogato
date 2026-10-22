import { formatTRY } from "@/components/admin/forms";
import type { InvoiceLine } from "@/lib/invoice/invoice-core";
import type { KdvRow } from "@/lib/utils/kdv";

const CELL = "px-2 py-1.5 text-left align-top";
const NUM = "px-2 py-1.5 text-right align-top tabular-nums whitespace-nowrap";

/**
 * An invoice's lines as the site sends them to Paraşüt (the draft on the
 * invoice card, the order's invoice wizard): description, product,
 * quantity, KDV rate, discount, total. The discount column only when a
 * line has one: four columns fit a phone.
 */
export function InvoiceLinesTable({
  lines,
  caption = "Faturanın satırları, tutarlar KDV dahil",
}: {
  lines: readonly InvoiceLine[];
  caption?: string;
}) {
  const discounted = lines.some((l) => l.discountMinor > 0);
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead className="text-xs text-[var(--admin-text-soft)]">
          <tr>
            <th scope="col" className={CELL}>
              Satır
            </th>
            <th scope="col" className={NUM}>
              Adet
            </th>
            <th scope="col" className={NUM}>
              KDV
            </th>
            {discounted ? (
              <th scope="col" className={NUM}>
                İndirim
              </th>
            ) : null}
            <th scope="col" className={NUM}>
              Tutar
            </th>
          </tr>
        </thead>
        <tbody>
          {lines.map((l, i) => (
            <tr
              key={`${l.productCode}-${i}`}
              className="border-t border-[var(--admin-border)]"
            >
              <td className={CELL}>
                {l.description}
                <span className="block text-xs text-[var(--admin-text-soft)]">
                  Ürün: {l.productName}
                </span>
              </td>
              <td className={NUM}>{l.quantity}</td>
              <td className={NUM}>%{l.vatRate}</td>
              {discounted ? (
                <td className={NUM}>
                  {l.discountMinor ? formatTRY(l.discountMinor) : "-"}
                </td>
              ) : null}
              <td className={NUM}>{formatTRY(l.totalMinor)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** The KDV per rate and the total, under the lines. */
export function InvoiceTotals({
  kdvRows,
  totalMinor,
}: {
  kdvRows: readonly KdvRow[];
  totalMinor: number;
}) {
  return (
    <>
      {kdvRows.length > 0 ? (
        <ul className="flex flex-col gap-0.5 text-[var(--admin-text-soft)]">
          {kdvRows.map((k) => (
            <li key={k.ratePct}>
              KDV %{k.ratePct}: matrah {formatTRY(k.netMinor)}, KDV{" "}
              {formatTRY(k.taxMinor)}
            </li>
          ))}
        </ul>
      ) : null}
      <p className="font-medium">
        Genel toplam (KDV dahil): {totalMinor ? formatTRY(totalMinor) : "-"}
      </p>
    </>
  );
}
