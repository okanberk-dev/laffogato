import Link from "next/link";
import { notFound } from "next/navigation";

import { BackLink } from "@/components/admin/back-link";
import { Card, PageHeader, formatTRY } from "@/components/admin/forms";
import { InvoiceWizard } from "@/components/admin/invoice-wizard";
import { PageShell } from "@/components/admin/ui";
import { BUTTON } from "@/components/admin/ui/styles";
import { requireRole } from "@/lib/admin/auth";
import { expectedTotalMinor, linesKdvRows } from "@/lib/invoice/invoice-core";
import { loadOrderInvoiceRequest } from "@/lib/invoice/order-request";
import { invoiceSourceHref } from "@/lib/invoice/panel-core";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
}

export const metadata = { title: "Admin · Fatura oluştur" };

/**
 * "Fatura oluştur" (docs/EARSIV.md "Siparişten fatura"): the order's
 * invoice wizard. Who it is cut to (a final consumer, or a company with its
 * title, VKN and tax office), the billing address, the lines as they go to
 * Paraşüt, a summary; then a draft in Paraşüt (draft mode) that the
 * order's invoice card shows before "Faturayı kesinleştir". When the order
 * cannot be invoiced from here the page says why and links back.
 */
export default async function OrderInvoiceWizardPage({ params }: PageProps) {
  await requireRole("invoices");
  const { id } = await params;
  const view = await loadOrderInvoiceRequest(id);
  if (!view) notFound();
  const { order, row, plan, refusal, lines, billing, mode } = view;
  const orderHref = invoiceSourceHref({
    sourceKind: "order",
    sourceId: order.id,
  });
  const ready = !refusal && plan && lines && lines.length > 0 && mode !== "off";
  return (
    <PageShell width="form">
      <BackLink href={orderHref}>Sipariş #{order.orderNo}</BackLink>
      <PageHeader
        title="Fatura oluştur"
        description={`Sipariş #${order.orderNo} · ${formatTRY(order.totalMinor)} · ${order.customerName || "Ad yok"}`}
      />
      {ready ? (
        <InvoiceWizard
          orderId={order.id}
          orderNo={order.orderNo}
          orderHref={orderHref}
          mode={mode}
          rebuild={row?.status === "draft"}
          consumerName={order.customerName}
          orderEmail={
            order.customerEmail.includes("@") ? order.customerEmail : ""
          }
          initial={{
            buyerKind: row?.buyerKind === "company" ? "company" : "consumer",
            buyerTitle: row?.buyerTitle ?? "",
            buyerTaxNumber: row?.buyerTaxNumber ?? "",
            buyerTaxOffice: row?.buyerTaxOffice ?? "",
            buyerEmail: row?.buyerEmail ?? "",
            city: billing?.city ?? "",
            district: billing?.district ?? "",
            address: billing?.address ?? "",
          }}
          addressUnread={!billing}
          lines={lines}
          kdvRows={linesKdvRows(lines)}
          totalMinor={expectedTotalMinor(lines)}
        />
      ) : (
        <Card>
          <div className="grid gap-4 text-sm">
            <p className="text-[var(--admin-text)]">
              {refusal ?? "Bu siparişin fatura satırları oluşturulamadı."}
            </p>
            <div>
              <Link href={orderHref} className={BUTTON.ghost}>
                Siparişe dön
              </Link>
            </div>
          </div>
        </Card>
      )}
    </PageShell>
  );
}
