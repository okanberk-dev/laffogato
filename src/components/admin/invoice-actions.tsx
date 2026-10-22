import type { ReactNode } from "react";

import { ActionButton } from "@/components/admin/action-form";
import { Field, TextInput, Textarea } from "@/components/admin/forms";
import {
  ActionMenu,
  ActionMenuSeparator,
  ActionModal,
  BUTTON,
  FieldError,
} from "@/components/admin/ui";
import {
  cutInvoiceNowAction,
  formalizeInvoiceAction,
  markInvoiceManualAction,
  markInvoiceManualDoneAction,
  rebuildInvoiceDraftAction,
  retryInvoiceAction,
  setInvoiceBillingAction,
} from "@/app/admin/faturalar/actions";
import type { InvoiceRow, InvoiceSourceKind } from "@/lib/invoice/invoice-core";
import { invoicePdfHref } from "@/lib/invoice/panel-core";
import { invoicePdfAvailable } from "@/lib/invoice/pdf";

// An invoice row's actions (docs/EARSIV.md "Panel"), as the list's ⋯ menu
// or as a row of buttons on an order's or a booking's invoice card.
// Server-safe: every control is a client component with plain props.
// Nothing here can touch an issued e-Arşiv invoice.

const BUSY = new Set(["working", "formalizing"]);

/** Whether a person may still take the invoice out of the automation. */
export function mayMarkManual(row: InvoiceRow | null): boolean {
  if (!row) return true;
  return (
    !row.salesInvoiceId &&
    !row.eDocumentId &&
    ["waiting", "due", "failed", "skipped"].includes(row.status)
  );
}

function retryable(row: InvoiceRow): boolean {
  return (
    ["manual", "failed"].includes(row.status) ||
    (row.status === "issued" && !row.emailedAt)
  );
}

function manualDone(row: InvoiceRow): boolean {
  return (
    !row.eDocumentId &&
    ["manual", "failed", "waiting", "due", "draft"].includes(row.status)
  );
}

function billingEditable(row: InvoiceRow): boolean {
  return (
    !row.salesInvoiceId &&
    !row.eDocumentId &&
    !BUSY.has(row.status) &&
    row.status !== "manual_done"
  );
}

export function InvoiceActions({
  row,
  source,
  parasutUrl = null,
  menu = false,
}: {
  row: InvoiceRow | null;
  /** The order or booking, for "elle kesilecek" when there is no row yet. */
  source: { kind: InvoiceSourceKind; id: string; label: string };
  /** The company in Paraşüt's web app, for a draft ("Paraşüt'ü aç"). */
  parasutUrl?: string | null;
  menu?: boolean;
}) {
  const v = menu ? "menu" : "ghost";
  const items: ReactNode[] = [];
  if (row?.eDocumentId && invoicePdfAvailable()) {
    items.push(
      <a key="pdf" href={invoicePdfHref(row)} download className={BUTTON[v]}>
        Faturayı yazdır / indir
      </a>,
    );
  }
  if (row?.status === "due") {
    items.push(
      <ActionButton
        key="cut"
        action={cutInvoiceNowAction}
        hidden={{ id: row.id }}
        variant={v}
        ariaLabel={`Faturayı kes: ${row.sourceLabel}`}
        pendingLabel="Hazırlanıyor…"
      >
        Faturayı kes
      </ActionButton>,
    );
  }
  if (row?.status === "draft") {
    items.push(
      <ActionModal
        key="formalize"
        action={formalizeInvoiceAction}
        title="Faturayı kesinleştir"
        description="Paraşüt'teki taslak bugünün tarihiyle e-Arşiv fatura olur ve PDF'i müşteriye e-postayla gider. Kesinleşen faturayı yalnız Paraşüt'ten, 7 gün içinde iptal edebilirsin. Taslağı Paraşüt'te değiştirdiysen o hâli kesinleşir; tutarı siparişle tutmazsa kesinleştirilmez."
        trigger="Faturayı kesinleştir"
        triggerVariant={menu ? v : "primary"}
        ariaLabel={`Faturayı kesinleştir: ${row.sourceLabel}`}
        submitLabel="Kesinleştir"
        hidden={{ id: row.id }}
      />,
      <ActionModal
        key="rebuild"
        action={rebuildInvoiceDraftAction}
        title="Taslağı yenile"
        description="Paraşüt'teki taslak silinir ve siparişten (rezervasyondan) bugünün tarihiyle yeniden hazırlanır; taslakta Paraşüt'te yaptığın değişiklikler gider. Dünden kalan bir taslağı kesinleştirmeden önce kullan. Ad ya da adres yanlışsa taslağı Paraşüt'te düzelt, sonra kesinleştir."
        trigger="Taslağı yenile"
        triggerVariant={v}
        ariaLabel={`Taslağı yenile: ${row.sourceLabel}`}
        submitLabel="Yenile"
        hidden={{ id: row.id }}
      />,
    );
    if (parasutUrl) {
      items.push(
        <a
          key="parasut"
          href={parasutUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={BUTTON[v]}
        >
          Paraşüt&apos;ü aç
        </a>,
      );
    }
  }
  if (row && retryable(row)) {
    items.push(
      <ActionButton
        key="retry"
        action={retryInvoiceAction}
        hidden={{ id: row.id }}
        variant={v}
        ariaLabel={`Yeniden dene: ${row.sourceLabel}`}
        pendingLabel="Kuyruğa alınıyor…"
      >
        {row.status === "issued" ? "E-postayı yeniden gönder" : "Yeniden dene"}
      </ActionButton>,
    );
  }
  if (row && billingEditable(row)) {
    items.push(
      <ActionModal
        key="billing"
        action={setInvoiceBillingAction}
        title="Fatura adresi"
        description="Paraşüt alıcının ilini ve ilçesini ister. Burada yazılan, siparişteki adres metninin yerine geçer."
        trigger="Fatura adresini düzenle"
        triggerVariant={v}
        submitLabel="Kaydet"
        hidden={{ id: row.id }}
      >
        <div className="flex flex-col gap-1.5">
          <Field label="İl">
            <TextInput
              name="city"
              required
              maxLength={40}
              defaultValue={row.billingCity}
            />
          </Field>
          <FieldError name="city" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Field label="İlçe">
            <TextInput
              name="district"
              required
              maxLength={60}
              defaultValue={row.billingDistrict}
            />
          </Field>
          <FieldError name="district" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Field
            label="Adres"
            hint="Telefon numarası yazma: faturada telefon yer almaz."
          >
            <Textarea
              name="address"
              maxLength={500}
              rows={3}
              defaultValue={row.billingAddress}
            />
          </Field>
          <FieldError name="address" />
        </div>
      </ActionModal>,
    );
  }
  if (mayMarkManual(row)) {
    items.push(
      <ActionModal
        key="manual"
        action={markInvoiceManualAction}
        title="Elle kesilecek"
        description="Bu fatura otomatik kesilmez. Kurumsal fatura (unvan, vergi dairesi, VKN) e-postayla istendiyse ya da başka bir nedenle Paraşüt'te elle keseceksen işaretle; kestikten sonra numarasını gir."
        trigger="Elle kesilecek (kurumsal)"
        triggerVariant={v}
        submitLabel="İşaretle"
        hidden={{ kind: source.kind, sourceId: source.id, label: source.label }}
      >
        <div className="flex flex-col gap-1.5">
          <Field label="Neden">
            <Textarea
              name="reason"
              required
              minLength={3}
              maxLength={300}
              rows={2}
              defaultValue="Kurumsal fatura istendi."
            />
          </Field>
          <FieldError name="reason" />
        </div>
      </ActionModal>,
    );
  }
  if (row && manualDone(row)) {
    items.push(
      <ActionModal
        key="done"
        action={markInvoiceManualDoneAction}
        title="Paraşüt'te elle kestim"
        description="Faturayı Paraşüt'te kestiysen numarasını yaz: bu kayıt bir daha otomatik kesilmez."
        trigger="Paraşüt'te elle kestim"
        triggerVariant={v}
        submitLabel="Kaydet"
        hidden={{ id: row.id }}
      >
        <div className="flex flex-col gap-1.5">
          <Field
            label="Fatura numarası"
            hint="Paraşüt'te görünen e-Arşiv numarası (örneğin GIB2026000000123)."
          >
            <TextInput
              name="invoiceNo"
              required
              maxLength={40}
              autoComplete="off"
            />
          </Field>
          <FieldError name="invoiceNo" />
        </div>
      </ActionModal>,
    );
  }
  if (items.length === 0) return null;
  if (menu) {
    return (
      <ActionMenu
        label={`${row?.sourceLabel ?? source.label} fatura işlemleri`}
      >
        {items.flatMap((item, i) =>
          i === 1 && row?.eDocumentId
            ? [<ActionMenuSeparator key="sep" />, item]
            : [item],
        )}
      </ActionMenu>
    );
  }
  return <div className="flex flex-wrap items-start gap-2">{items}</div>;
}
