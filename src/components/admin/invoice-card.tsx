import Link from "next/link";

import { formatDateTime, formatTRY } from "@/components/admin/forms";
import { Badge, KeyValueGrid, Section } from "@/components/admin/ui";
import type { EarsivMode } from "@/lib/invoice/config";
import type {
  InvoiceLine,
  InvoiceRow,
  InvoiceSourceKind,
} from "@/lib/invoice/invoice-core";
import {
  deadlineBadge,
  INVOICE_STATUS_TONE,
  INVOICES_PATH,
  invoiceBuyerLines,
  invoiceDraftMarker,
  invoiceKindLabel,
  invoiceNoteText,
  invoicePdfHref,
  invoiceRouteLabel,
  invoiceStatusLabel,
  invoiceWizardHref,
  invoiceWizardOpen,
  isEInvoice,
  refundOpen,
} from "@/lib/invoice/panel-core";

import { InvoiceActions } from "./invoice-actions";
import { InvoiceLinesTable, InvoiceTotals } from "./invoice-lines";

/**
 * The invoice of one order or booking (docs/EARSIV.md): e-Arşiv, or an
 * e-Fatura to a company registered at GİB (the order's invoice wizard).
 * Where it is,
 * its number and deadline, why a person has to cut it, a refund after it,
 * and for an issued one "Faturayı yazdır / indir" (a parcel carries the
 * printout). The actions need the `invoices` role; the PDF link the order's
 * or the booking's own (the route checks both).
 *
 * A draft shows what was sent to Paraşüt, line by line, before a person
 * formalises it ("Faturayı kesinleştir"). An order's card opens the
 * invoice wizard ("Fatura oluştur") while nothing is formalised.
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
  const wizardHref =
    canManage &&
    mode !== "off" &&
    source.kind === "order" &&
    invoiceWizardOpen(row)
      ? invoiceWizardHref(source.id)
      : null;
  const buyer = row ? invoiceBuyerLines(row, buyerName) : null;
  return (
    <Section
      title={invoiceKindLabel(row)}
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
              : source.kind === "order"
                ? 'Henüz fatura kaydı yok. Ödenmiş online sipariş bir sonraki çalıştırmada eklenir; beklemeden ya da kurumsal kesmek için "Fatura oluştur".'
                : "Henüz fatura kaydı yok. Ödenmiş rezervasyonlar bir sonraki çalıştırmada eklenir."}
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
              {refundOpen(row) ? (
                <Badge tone="danger">Faturalı siparişte iade</Badge>
              ) : row.refundNotedAt ? (
                <Badge>İade belgesi kesildi</Badge>
              ) : null}
            </div>
            <KeyValueGrid
              items={[
                ...(row.buyerKind === "company" && buyer
                  ? [{ label: "Alıcı", value: `${buyer.name} (${buyer.tax})` }]
                  : []),
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
                  value: isEInvoice(row)
                    ? "e-Fatura: alıcının GİB kutusuna gitti"
                    : row.emailedAt
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
            {refundOpen(row) ? (
              <p className="text-[var(--admin-danger-ink)]">
                Faturalı siparişte iade: iade faturası / gider pusulası gerekir.
                Kesilmiş fatura otomatik değiştirilmez.
              </p>
            ) : row.refundNotedAt && row.refundHandledAt ? (
              <p className="text-[var(--admin-text-soft)]">
                İadenin belgesi kesildi
                {row.refundDocNo ? ` (${row.refundDocNo})` : ""},{" "}
                {formatDateTime(row.refundHandledAt)}
                {row.refundHandledBy ? `, ${row.refundHandledBy}` : ""}.
              </p>
            ) : null}
          </>
        )}
        {canManage ? (
          <InvoiceActions
            row={row}
            source={source}
            parasutUrl={parasutUrl}
            wizardHref={wizardHref}
          />
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
  const buyer = invoiceBuyerLines(row, buyerName);
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface-2)] p-3">
      <p className="font-medium">
        Taslak: Paraşüt&apos;te hazır, henüz kesinleşmedi
      </p>
      <KeyValueGrid
        items={[
          { label: "Alıcı", value: buyer.name },
          { label: "Vergi", value: buyer.tax },
          { label: "Fatura adresi", value: address || "-" },
          {
            label: "Paraşüt'te",
            value: `Satışlar > Faturalar, açıklaması "${invoiceDraftMarker(row)}"`,
          },
        ]}
      />
      {lines && lines.length > 0 ? (
        <InvoiceLinesTable
          lines={lines}
          caption="Taslağın satırları, tutarlar KDV dahil"
        />
      ) : null}
      <InvoiceTotals kdvRows={row.kdvRows} totalMinor={row.amountMinor} />
    </div>
  );
}
