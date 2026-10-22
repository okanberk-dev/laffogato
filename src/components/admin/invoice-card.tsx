import Link from "next/link";

import { formatDateTime, formatTRY } from "@/components/admin/forms";
import { Badge, KeyValueGrid, Section } from "@/components/admin/ui";
import type { EarsivMode } from "@/lib/invoice/config";
import {
  CONSUMER_TAX_NUMBER,
  type InvoiceLine,
  type InvoiceRow,
  type InvoiceSourceKind,
} from "@/lib/invoice/invoice-core";
import {
  deadlineBadge,
  INVOICE_STATUS_TONE,
  INVOICES_PATH,
  invoiceDraftMarker,
  invoiceNoteText,
  invoicePdfHref,
  invoiceRouteLabel,
  invoiceStatusLabel,
} from "@/lib/invoice/panel-core";

import { InvoiceActions } from "./invoice-actions";

/**
 * The e-Arşiv invoice of one order or booking (docs/EARSIV.md): where it is,
 * its number and deadline, why a person has to cut it, a refund after it,
 * and for an issued one "Faturayı yazdır / indir" (a parcel carries the
 * printout). The actions need the `invoices` role; the PDF link the order's
 * or the booking's own (the route checks both).
 *
 * A draft shows what was sent to Paraşüt, line by line, before a person
 * formalises it ("Faturayı kesinleştir").
 */
export function InvoiceCard({
  row,
  source,
  mode,
  canManage,
  unread = false,
  now = new Date(),
  draftLines = null,
  buyerName = "",
  parasutUrl = null,
}: {
  row: InvoiceRow | null;
  source: { kind: InvoiceSourceKind; id: string; label: string };
  mode: EarsivMode;
  canManage: boolean;
  /** The invoice row could not be read. */
  unread?: boolean;
  now?: Date;
  /** A draft's lines as sent (invoiceDraftLines); null hides the table. */
  draftLines?: InvoiceLine[] | null;
  /** The buyer's name as the invoice carries it (the order's or booking's). */
  buyerName?: string;
  /** The company in Paraşüt's web app (parasutAppUrl). */
  parasutUrl?: string | null;
}) {
  const deadline = row ? deadlineBadge(row, now) : null;
  const note = row ? invoiceNoteText(row) : "";
  return (
    <Section
      title="e-Arşiv fatura"
      actions={
        canManage ? (
          <Link
            href={INVOICES_PATH}
            className="text-sm text-[var(--admin-text-soft)] underline-offset-4 hover:underline"
          >
            Faturalar
          </Link>
        ) : null
      }
    >
      <div className="flex flex-col gap-3 text-sm">
        {unread ? (
          <p className="text-[var(--admin-danger-ink)]">
            Fatura kaydı okunamadı. Sayfayı yenile.
          </p>
        ) : !row ? (
          <p className="text-[var(--admin-text-soft)]">
            {mode === "off"
              ? "Otomatik e-Arşiv kapalı: fatura Paraşüt'te elle kesilir."
              : "Henüz fatura kaydı yok. Ödenmiş online sipariş ve rezervasyonlar bir sonraki çalıştırmada eklenir."}
          </p>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={INVOICE_STATUS_TONE[row.status]} dot>
                {invoiceStatusLabel(row)}
              </Badge>
              <Badge>{invoiceRouteLabel(row)}</Badge>
              {deadline ? (
                <Badge tone={deadline.tone}>{deadline.label}</Badge>
              ) : null}
              {row.refundNotedAt ? (
                <Badge tone="danger">Faturalı siparişte iade</Badge>
              ) : null}
            </div>
            <KeyValueGrid
              items={[
                { label: "Fatura no", value: row.invoiceNo || "-" },
                {
                  label: "Tutar (KDV dahil)",
                  value: row.amountMinor ? formatTRY(row.amountMinor) : "-",
                },
                {
                  label: "Son gün (VUK 231/5)",
                  value: row.deadlineAt ? formatDateTime(row.deadlineAt) : "-",
                },
                {
                  label: "Kesildi",
                  value: row.issuedAt ? formatDateTime(row.issuedAt) : "-",
                },
                {
                  label: "E-posta",
                  value: row.emailedAt
                    ? `Gönderildi (${formatDateTime(row.emailedAt)})`
                    : row.status === "issued"
                      ? row.emailError
                        ? "Gönderilemedi"
                        : "Gönderilecek"
                      : "-",
                },
                {
                  label: "Fatura adresi",
                  value:
                    [row.billingDistrict, row.billingCity]
                      .filter(Boolean)
                      .join(" / ") || "-",
                },
              ]}
            />
            {row.status === "draft" ? (
              <DraftPreview
                row={row}
                lines={draftLines}
                buyerName={buyerName}
              />
            ) : null}
            {note ? (
              <p className="text-[var(--admin-text-soft)]">{note}</p>
            ) : null}
            {row.refundNotedAt ? (
              <p className="text-[var(--admin-danger-ink)]">
                Faturalı siparişte iade: iade faturası / gider pusulası gerekir.
                Kesilmiş fatura otomatik değiştirilmez.
              </p>
            ) : null}
          </>
        )}
        {canManage ? (
          <InvoiceActions row={row} source={source} parasutUrl={parasutUrl} />
        ) : row?.eDocumentId ? (
          <div>
            <a
              href={invoicePdfHref(row)}
              download
              className="text-sm underline underline-offset-4"
            >
              Faturayı yazdır / indir
            </a>
          </div>
        ) : null}
      </div>
    </Section>
  );
}

const CELL = "px-2 py-1.5 text-left align-top";
const NUM = "px-2 py-1.5 text-right align-top tabular-nums whitespace-nowrap";

/**
 * The draft as the site sent it: buyer, address, lines, KDV and total, and
 * where it sits in Paraşüt. What Paraşüt shows wins if it was edited there.
 */
function DraftPreview({
  row,
  lines,
  buyerName,
}: {
  row: InvoiceRow;
  lines: InvoiceLine[] | null;
  buyerName: string;
}) {
  const address = [row.billingAddress, row.billingDistrict, row.billingCity]
    .filter(Boolean)
    .join(", ");
  // The discount column only when a line has one: four columns fit a phone.
  const discounted = (lines ?? []).some((l) => l.discountMinor > 0);
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface-2)] p-3">
      <p className="font-medium">
        Taslak: Paraşüt&apos;te hazır, henüz kesinleşmedi
      </p>
      <KeyValueGrid
        items={[
          { label: "Alıcı", value: buyerName || "-" },
          {
            label: "TCKN",
            value: `${CONSUMER_TAX_NUMBER} (nihai tüketici)`,
          },
          { label: "Fatura adresi", value: address || "-" },
          {
            label: "Paraşüt'te",
            value: `Satışlar > Faturalar, açıklaması "${invoiceDraftMarker(row)}"`,
          },
        ]}
      />
      {lines && lines.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <caption className="sr-only">
              Taslağın satırları, tutarlar KDV dahil
            </caption>
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
                  <td className={CELL}>{l.description}</td>
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
      ) : null}
      {row.kdvRows.length > 0 ? (
        <ul className="flex flex-col gap-0.5 text-[var(--admin-text-soft)]">
          {row.kdvRows.map((k) => (
            <li key={k.ratePct}>
              KDV %{k.ratePct}: matrah {formatTRY(k.netMinor)}, KDV{" "}
              {formatTRY(k.taxMinor)}
            </li>
          ))}
        </ul>
      ) : null}
      <p className="font-medium">
        Genel toplam (KDV dahil):{" "}
        {row.amountMinor ? formatTRY(row.amountMinor) : "-"}
      </p>
    </div>
  );
}
