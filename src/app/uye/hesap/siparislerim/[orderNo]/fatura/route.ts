import { reserveLoginAttempt } from "@/lib/admin/rate-limit";
import { getActiveCustomer } from "@/lib/customer/auth";
import { memberOrders } from "@/lib/customer/member-orders";
import { maskText } from "@/lib/invoice/invoice-core";
import {
  fetchInvoicePdf,
  invoicePdfAvailable,
  invoicePdfNotFound,
  invoicePdfResponse,
  invoicePdfUnavailable,
} from "@/lib/invoice/pdf";
import { getInvoiceForSource } from "@/lib/invoice/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * `GET /uye/hesap/siparislerim/{orderNo}/fatura` - the e-Arşiv invoice of
 * this member's order, as a PDF fresh from Paraşüt (docs/EARSIV.md).
 *
 * The same access rule as `../sozlesme`: only the signed-in owner, through
 * `memberOrders` (a verified address, the member's own orders); the session
 * is checked here on every request (CLAUDE.md rule 27). No session,
 * another member's order, an unknown or malformed number, an order without
 * an issued invoice: one and the same 404. Each download costs two or three
 * Paraşüt requests, whose limit the köşk shares, so a member gets ten in
 * five minutes (`invoice-download`). A failure on the way is a 503.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ orderNo: string }> },
) {
  const { orderNo } = await params;
  if (!/^[1-9]\d{0,11}$/.test(orderNo)) return invoicePdfNotFound();
  try {
    const customer = await getActiveCustomer();
    if (!customer) return invoicePdfNotFound();
    const order = (await memberOrders(customer)).find(
      (o) => String(o.orderNo) === orderNo,
    );
    if (!order) return invoicePdfNotFound();
    const row = await getInvoiceForSource("order", order.id);
    if (
      !row ||
      row.status !== "issued" ||
      !row.eDocumentId ||
      !invoicePdfAvailable()
    ) {
      return invoicePdfNotFound();
    }
    const limit = await reserveLoginAttempt(
      "invoice-download",
      "",
      customer.id,
    );
    if (limit.blocked) {
      return new Response("Çok sık indirildi. Birazdan yeniden dene.", {
        status: 429,
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "Cache-Control": "private, no-store",
          "Retry-After": String(limit.retryAfterSeconds),
        },
      });
    }
    const pdf = await fetchInvoicePdf(row);
    if (!pdf) return invoicePdfUnavailable();
    return invoicePdfResponse(row, pdf);
  } catch (err) {
    console.error(
      `[earsiv] member pdf order no=${orderNo}`,
      maskText(err instanceof Error ? err.message : "error"),
    );
    return invoicePdfUnavailable();
  }
}
