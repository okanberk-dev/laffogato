import "server-only";

import type { AdminOrder } from "@/lib/admin/store";

import { earsivConfigStatus, type EarsivMode } from "./config";
import {
  invoiceWizardRefusal,
  orderInvoiceLines,
  planOrderInvoice,
  type BillingAddress,
  type InvoiceLine,
  type InvoicePlan,
  type InvoiceRow,
} from "./invoice-core";
import { dbInvoiceStore, getInvoiceForSource } from "./store";

/**
 * What the order's invoice wizard (`/admin/siparisler/[id]/fatura`) and its
 * action read: the order, its invoice row, its plan as asked for (no
 * EARSIV_START_AT, no café waiting time; invoice-core `planOrderInvoice`),
 * the lines that would go to Paraşüt and why the wizard cannot be used
 * now. The action calls it again with the address the person typed.
 */
export interface OrderInvoiceRequestView {
  order: AdminOrder;
  row: InvoiceRow | null;
  mode: EarsivMode;
  plan: InvoicePlan | null;
  /** Null when the wizard may go on. */
  refusal: string | null;
  lines: InvoiceLine[] | null;
  /** The address the plan would bill; null when it could not read one. */
  billing: BillingAddress | null;
}

export async function loadOrderInvoiceRequest(
  orderId: string,
  typed: BillingAddress | null = null,
): Promise<OrderInvoiceRequestView | null> {
  const store = dbInvoiceStore;
  const [order] = await store.ordersByIds([orderId]);
  if (!order) return null;
  const status = earsivConfigStatus(process.env);
  const [row, payments, coupons, carriers] = await Promise.all([
    getInvoiceForSource("order", order.id),
    store.paymentsFor([order.id]),
    store.couponSources([order]),
    store.carriers(),
  ]);
  const stored: BillingAddress | null =
    row && row.billingEditedBy
      ? {
          city: row.billingCity,
          district: row.billingDistrict,
          address: row.billingAddress,
        }
      : null;
  const plan = planOrderInvoice({
    order,
    payments: payments.get(order.id) ?? [],
    couponSource: coupons.get(order.orderNo) ?? null,
    startAt: status.config?.startAt ?? "",
    production: process.env.NODE_ENV === "production",
    carriers,
    billingOverride: typed ?? stored,
    now: new Date(),
    requested: true,
  });
  let refusal: string | null = null;
  if (status.mode === "off") {
    refusal =
      "Otomatik fatura kapalı (EARSIV_MODE): fatura Paraşüt'te elle kesilir.";
  } else if (!status.config) {
    refusal = `Paraşüt ayarı eksik: ${status.errors[0] ?? "Faturalar sayfasına bak."}`;
  } else {
    refusal = invoiceWizardRefusal({ order, row, plan });
  }
  return {
    order,
    row,
    mode: status.mode,
    plan,
    refusal,
    lines: orderInvoiceLines(order),
    billing: plan?.billing ?? stored,
  };
}
