import Link from "next/link";

import { formatDateTime, formatTRY } from "@/components/admin/forms";
import { Badge, KeyValueGrid, Section } from "@/components/admin/ui";
import type { EarsivMode } from "@/lib/invoice/config";
import type { InvoiceRow, InvoiceSourceKind } from "@/lib/invoice/invoice-core";
import {
  deadlineBadge,
  INVOICE_STATUS_TONE,
  INVOICES_PATH,
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
 */
export function InvoiceCard({
  row,
  source,
  mode,
  canManage,
  unread = false,
  now = new Date(),
}: {
  row: InvoiceRow | null;
  source: { kind: InvoiceSourceKind; id: string; label: string };
  mode: EarsivMode;
  canManage: boolean;
  /** The invoice row could not be read. */
  unread?: boolean;
  now?: Date;
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
          <InvoiceActions row={row} source={source} />
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
