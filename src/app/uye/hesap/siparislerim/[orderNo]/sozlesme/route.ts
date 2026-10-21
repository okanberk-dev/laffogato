import { getActiveCustomer } from "@/lib/customer/auth";
import { memberOrders } from "@/lib/customer/member-orders";
import {
  durableCopyNotFound,
  durableCopyResponse,
  durableCopyUnavailable,
} from "@/lib/legal/durable-copy-http";
import { orderDurableCopy } from "@/lib/legal/durable-copy-load";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * `GET /uye/hesap/siparislerim/{orderNo}/sozlesme` - the Ön Bilgilendirme
 * Formu and the Mesafeli Satış Sözleşmesi this order's customer confirmed,
 * in the version the consent recorded and filled with the order: the same
 * file the paid mail attaches (decision ASK-DURABLE).
 *
 * Only the signed-in owner gets it: the member's own orders, by the rule the
 * order page uses (`memberOrders`: a verified address, a paid order). A
 * route handler is not behind a page's `requireCustomer`, and `proxy.ts`
 * only refreshes sessions, so the session is checked here, on every request
 * (CLAUDE.md rule 27). No session, another member's order, an unknown or
 * malformed number, an order with no stored copy: one and the same 404,
 * never a 403 that would say the order exists. A database that fails on
 * the way is a 503 (`Retry-After`), never a bare 500.
 *
 * A GET that can write: when the consent's text is shown today but its own
 * store did not land, the copy stores it on the way (one INSERT ... ON
 * CONFLICT DO NOTHING, durable-copy-load.ts), so the mail's version link
 * and this file name the same stored text.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ orderNo: string }> },
) {
  const { orderNo } = await params;
  if (!/^[1-9]\d{0,11}$/.test(orderNo)) return durableCopyNotFound();
  try {
    const customer = await getActiveCustomer();
    if (!customer) return durableCopyNotFound();
    const order = (await memberOrders(customer)).find(
      (o) => String(o.orderNo) === orderNo,
    );
    if (!order) return durableCopyNotFound();
    const copy = await orderDurableCopy(order);
    if (!copy) return durableCopyNotFound();
    return durableCopyResponse(copy);
  } catch (err) {
    console.error(
      `[durable-copy] order no=${orderNo}: download failed`,
      err instanceof Error ? err.message.slice(0, 160) : "unknown",
    );
    return durableCopyUnavailable();
  }
}
