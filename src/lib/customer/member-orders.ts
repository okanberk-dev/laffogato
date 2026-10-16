import "server-only";

import { customerOrdersByEmail, type AdminOrder } from "@/lib/admin/store";

import { memberMaySeeOrder } from "./member-order-visibility";

/**
 * The orders a signed-in member may see on the site: matched by e-mail, and
 * only once that e-mail is proven theirs.
 *
 * Registration signs the visitor in before the address is verified, and
 * orders are matched by e-mail alone. An order an admin entered by hand (a
 * phone or counter sale) can carry the address of someone who never signed
 * up - so whoever registered that address first saw the name, phone number
 * and delivery address on it. Web checkout already requires a verified
 * address; reading the history now does too.
 *
 * Unpaid attempts are left out (`memberMaySeeOrder`): an order the payment
 * never completed is not one the member placed.
 */
export async function memberOrders(customer: {
  email: string;
  emailVerified: boolean;
}): Promise<AdminOrder[]> {
  if (!customer.emailVerified) return [];
  const orders = await customerOrdersByEmail(customer.email);
  return orders.filter(memberMaySeeOrder);
}
