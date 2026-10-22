import "server-only";

import { earsivConfig } from "./config";
import { invoicePdfName, type InvoiceRow } from "./invoice-core";
import { ParasutClient } from "./parasut-client";
import { dbInvoiceStore } from "./store";

/**
 * An issued invoice's PDF, fresh from Paraşüt: its one-hour URL is asked
 * for, downloaded here (https, size-capped, `%PDF` checked) and streamed to
 * the panel or the member; the browser never goes to Paraşüt and the file
 * is not stored. Null when the row has no e-document or e-Arşiv is not
 * configured; throws when Paraşüt fails.
 */
export async function fetchInvoicePdf(
  row: Pick<InvoiceRow, "eDocumentId" | "eDocumentType">,
  budgetMs = 25_000,
): Promise<Buffer | null> {
  if (!row.eDocumentId) return null;
  const cfg = earsivConfig(process.env);
  if (!cfg) return null;
  const client = new ParasutClient(cfg.parasut, {
    tokens: dbInvoiceStore.tokens,
  });
  client.setDeadline(Date.now() + budgetMs);
  const url = await client.pdfUrl(
    row.eDocumentType || "e_archives",
    row.eDocumentId,
    3,
  );
  if (!url) return null;
  return client.downloadPdf(url);
}

/** The PDF as a download: private, never cached, never sniffed. */
export function invoicePdfResponse(
  row: Pick<InvoiceRow, "invoiceNo" | "sourceLabel">,
  pdf: Buffer,
): Response {
  return new Response(new Uint8Array(pdf), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${invoicePdfName(row)}"`,
      "Content-Length": String(pdf.length),
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer",
    },
  });
}

export function invoicePdfNotFound(): Response {
  return new Response("Bulunamadı.", {
    status: 404,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

export function invoicePdfUnavailable(): Response {
  return new Response("Fatura şu an alınamadı. Birazdan yeniden dene.", {
    status: 503,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "private, no-store",
      "Retry-After": "30",
    },
  });
}
