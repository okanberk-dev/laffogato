import { getAdminSession } from "@/lib/admin/auth";
import { canAccess } from "@/lib/admin/roles";
import { maskText } from "@/lib/invoice/invoice-core";
import {
  fetchInvoicePdf,
  invoicePdfNotFound,
  invoicePdfResponse,
  invoicePdfUnavailable,
} from "@/lib/invoice/pdf";
import { getInvoice } from "@/lib/invoice/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * `GET /admin/faturalar/{id}/pdf` - an issued e-Arşiv invoice's PDF, for the
 * parcel ("irsaliye yerine geçer") or for anyone who asks for a copy.
 *
 * A route handler is not behind `requireRole` and `proxy.ts` only redirects
 * page views, so the session and the role are checked here, on every
 * request: Faturalar's own role (`invoices`), or the role of the record the
 * invoice belongs to (an order's for Personel packing a parcel, a booking's
 * for the karaoke shift). The PDF comes fresh from Paraşüt and is streamed;
 * the browser is never sent to Paraşüt's own URL.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getAdminSession();
  if (!session) {
    return new Response("Giriş gerekli.", {
      status: 401,
      headers: { "Cache-Control": "no-store" },
    });
  }
  const { id } = await params;
  if (!/^inv_[a-f0-9]{16}$/.test(id)) return invoicePdfNotFound();
  try {
    const row = await getInvoice(id);
    if (!row) return invoicePdfNotFound();
    const allowed =
      canAccess("invoices", session.role) ||
      (row.sourceKind === "order" && canAccess("orders", session.role)) ||
      (row.sourceKind === "karaoke" && canAccess("karaoke", session.role));
    if (!allowed) {
      return new Response("Bu sayfaya erişimin yok.", {
        status: 403,
        headers: { "Cache-Control": "no-store" },
      });
    }
    if (!row.eDocumentId) return invoicePdfNotFound();
    const pdf = await fetchInvoicePdf(row);
    if (!pdf) return invoicePdfUnavailable();
    return invoicePdfResponse(row, pdf);
  } catch (err) {
    console.error(
      `[earsiv] admin pdf ${id}`,
      maskText(err instanceof Error ? err.message : "error"),
    );
    return invoicePdfUnavailable();
  }
}
