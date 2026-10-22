import "server-only";

import { parasutReadConfig } from "./config";
import { invoicePdfName, type InvoiceRow } from "./invoice-core";
import { ParasutClient } from "./parasut-client";
import { dbInvoiceStore } from "./store";

/**
 * Whether issued invoices can be read back from Paraşüt at all: its
 * credentials are set (EARSIV_MODE does not matter). Without them no
 * surface offers a download, and the routes answer 404 instead of a 503
 * that "birazdan yeniden dene" could never cure.
 */
export function invoicePdfAvailable(): boolean {
  return parasutReadConfig(process.env) !== null;
}

/**
 * An issued invoice's PDF, fresh from Paraşüt: its one-hour URL is asked
 * for, downloaded here (https, size-capped, `%PDF` checked) and streamed to
 * the panel or the member; the browser never goes to Paraşüt and the file
 * is not stored. Reads with Paraşüt's credentials whatever EARSIV_MODE says,
 * so invoices cut while the automation was on stay downloadable after it is
 * turned off. Null when the row has no e-document or the credentials are
 * not set; throws when Paraşüt fails.
 */
export async function fetchInvoicePdf(
  row: Pick<InvoiceRow, "eDocumentId" | "eDocumentType">,
  budgetMs = 25_000,
): Promise<Buffer | null> {
  if (!row.eDocumentId) return null;
  const parasut = parasutReadConfig(process.env);
  if (!parasut) return null;
  const client = new ParasutClient(parasut, {
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
