import Link from "next/link";
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
  markInvoiceRefundHandledAction,
  rebuildInvoiceDraftAction,
  retryInvoiceAction,
  setInvoiceBillingAction,
} from "@/app/admin/faturalar/actions";
import type { InvoiceRow, InvoiceSourceKind } from "@/lib/invoice/invoice-core";
import {
  invoiceCardHref,
  invoicePdfHref,
  isEInvoice,
  refundOpen,
} from "@/lib/invoice/panel-core";
import { invoicePdfAvailable } from "@/lib/invoice/pdf";

import { ROW_CONTROL } from "./ui/styles";

// An invoice row's actions (docs/EARSIV.md "Panel"), as the list's ⋯ menu
// or as a row of buttons on an order's or a booking's invoice card.
// Server-safe: every control is a client component with plain props.
// Nothing here can touch an issued invoice (e-Arşiv or e-Fatura).

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
    // An e-Fatura reached the buyer's GİB inbox: there is no mail of ours.
    (row.status === "issued" && !row.emailedAt && !isEInvoice(row))
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

/**
 * The list row's one visible step, beside its ⋯ (Innex: the button follows
 * the row's state, recipe §3.4): a draft is read before it is formalised,
 * so "Taslağı gör" opens its order's or booking's Fatura tab, where the
 * lines and "Faturayı kesinleştir" are; a due one is cut, a failed one
 * tried again, a manual one recorded once cut in Paraşüt; an issued one is
 * its PDF. Filled where a person is the next step, outlined otherwise.
 * Nothing else: the rest stays in the menu.
 */
export function InvoiceRowStep({ row }: { row: InvoiceRow }) {
  if (row.status === "draft") {
    return (
      <Link
        href={invoiceCardHref(row)}
        className={ROW_CONTROL.textStrong}
        aria-label={`Taslağı gör: ${row.sourceLabel}`}
      >
        Taslağı gör
      </Link>
    );
  }
  if (row.status === "due") {
    return (
      <ActionButton
        action={cutInvoiceNowAction}
        hidden={{ id: row.id }}
        variant="bare"
        className={ROW_CONTROL.textStrong}
        ariaLabel={`Faturayı kes: ${row.sourceLabel}`}
        pendingLabel="Hazırlanıyor…"
      >
        Faturayı kes
      </ActionButton>
    );
  }
  if (row.status === "failed") {
    return (
      <ActionButton
        action={retryInvoiceAction}
        hidden={{ id: row.id }}
        variant="bare"
        className={ROW_CONTROL.textStrong}
        ariaLabel={`Yeniden dene: ${row.sourceLabel}`}
        pendingLabel="Kuyruğa alınıyor…"
      >
        Yeniden dene
      </ActionButton>
    );
  }
  if (row.status === "manual" && manualDone(row)) {
    return <ManualDoneModal row={row} variant="bare" label="Kestim" />;
  }
  // A refund after issue: a person cuts its return document, then says so.
  if (refundOpen(row)) {
    return (
      <RefundHandledModal row={row} variant="bare" label="Belgeyi kestim" />
    );
  }
  if (row.eDocumentId && invoicePdfAvailable()) {
    return (
      <a
        href={invoicePdfHref(row)}
        download
        className={ROW_CONTROL.text}
        // The visible word first: a voice user says "PDF" (WCAG 2.5.3).
        aria-label={`PDF indir: ${row.sourceLabel}`}
      >
        PDF
      </a>
    );
  }
  return null;
}

/**
 * "İade belgesini kestim": the number of the return document (iade
 * faturası / gider pusulası) of a refund after an issued invoice.
 */
function RefundHandledModal({
  row,
  variant,
  label = "İade belgesini kestim",
}: {
  row: InvoiceRow;
  variant: "menu" | "ghost" | "bare";
  label?: string;
}) {
  return (
    <ActionModal
      action={markInvoiceRefundHandledAction}
      title="İade belgesini kestim"
      description="Bu faturalı siparişteki iadenin iade faturasını ya da gider pusulasını Paraşüt'te (ya da muhasebecin) düzenlediysen numarasını yaz: iade Dikkat'ten çıkar. Kesilmiş faturaya dokunulmaz; sonra yeni bir iade olursa yeniden işaretlenir."
      trigger={label}
      triggerVariant={variant}
      triggerClassName={variant === "bare" ? ROW_CONTROL.textStrong : undefined}
      ariaLabel={
        variant === "bare"
          ? `İade belgesini kestim: ${row.sourceLabel}`
          : undefined
      }
      submitLabel="Kaydet"
      hidden={{ id: row.id }}
    >
      <div className="flex flex-col gap-1.5">
        <Field
          label="Belge numarası"
          hint="İade faturasının ya da gider pusulasının numarası."
        >
          <TextInput name="docNo" required maxLength={40} autoComplete="off" />
        </Field>
        <FieldError name="docNo" />
      </div>
    </ActionModal>
  );
}

/** "Paraşüt'te elle kestim": the number of the invoice cut by hand. */
function ManualDoneModal({
  row,
  variant,
  label = "Paraşüt'te elle kestim",
}: {
  row: InvoiceRow;
  variant: "menu" | "ghost" | "bare";
  label?: string;
}) {
  return (
    <ActionModal
      action={markInvoiceManualDoneAction}
      title="Paraşüt'te elle kestim"
      description="Faturayı Paraşüt'te kestiysen numarasını yaz: bu kayıt bir daha otomatik kesilmez."
      trigger={label}
      triggerVariant={variant}
      triggerClassName={variant === "bare" ? ROW_CONTROL.textStrong : undefined}
      ariaLabel={
        variant === "bare" ? `Elle kestim: ${row.sourceLabel}` : undefined
      }
      submitLabel="Kaydet"
      hidden={{ id: row.id }}
    >
      <div className="flex flex-col gap-1.5">
        <Field
          label="Fatura numarası"
          hint="Paraşüt'te görünen fatura numarası (örneğin GIB2026000000123)."
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
    </ActionModal>
  );
}

export function InvoiceActions({
  row,
  source,
  parasutUrl = null,
  wizardHref = null,
  menu = false,
}: {
  row: InvoiceRow | null;
  /** The order or booking, for "elle kesilecek" when there is no row yet. */
  source: { kind: InvoiceSourceKind; id: string; label: string };
  /** The company in Paraşüt's web app, for a draft ("Paraşüt'ü aç"). */
  parasutUrl?: string | null;
  /** The order's invoice wizard, when it may still set the buyer. */
  wizardHref?: string | null;
  menu?: boolean;
}) {
  const v = menu ? "menu" : "ghost";
  const items: ReactNode[] = [];
  if (wizardHref) {
    items.push(
      <Link
        key="wizard"
        href={wizardHref}
        className={BUTTON[row?.status === "draft" || menu ? v : "primary"]}
      >
        {row?.status === "draft"
          ? "Alıcıyı / adresi değiştir"
          : "Fatura oluştur"}
      </Link>,
    );
  }
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
      menu ? (
        // The list never formalises: a draft is read before it is cut, on
        // its order's or booking's Fatura tab, where its lines are (review
        // of #231: the ⋯ still formalised a draft nobody had seen).
        <Link key="formalize" href={invoiceCardHref(row)} className={BUTTON[v]}>
          Taslağı gör ve kesinleştir
        </Link>
      ) : (
        <ActionModal
          key="formalize"
          action={formalizeInvoiceAction}
          title="Faturayı kesinleştir"
          description={
            row.buyerKind === "company"
              ? "Paraşüt'teki taslak bugünün tarihiyle kesinleşir: şirket GİB'de e-Fatura kullanıcısıysa e-Fatura olarak kutusuna gider, değilse e-Arşiv olur ve PDF'i e-postayla gider. Kesinleşen faturayı yalnız Paraşüt'ten iptal edebilirsin. Taslağı Paraşüt'te değiştirdiysen o hâli kesinleşir; tutarı siparişle tutmazsa kesinleştirilmez."
              : "Paraşüt'teki taslak bugünün tarihiyle e-Arşiv fatura olur ve PDF'i müşteriye e-postayla gider. Kesinleşen faturayı yalnız Paraşüt'ten, 7 gün içinde iptal edebilirsin. Taslağı Paraşüt'te değiştirdiysen o hâli kesinleşir; tutarı siparişle tutmazsa kesinleştirilmez."
          }
          trigger="Faturayı kesinleştir"
          triggerVariant="primary"
          ariaLabel={`Faturayı kesinleştir: ${row.sourceLabel}`}
          submitLabel="Kesinleştir"
          hidden={{ id: row.id, draft: row.salesInvoiceId }}
        />
      ),
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
        description="Bu fatura otomatik kesilmez. Paraşüt'te elle keseceksen işaretle; kestikten sonra numarasını gir. Kurumsal fatura için önce siparişteki “Fatura oluştur”u dene: unvan, VKN ve vergi dairesiyle buradan kesilir."
        trigger="Elle kesilecek"
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
    items.push(<ManualDoneModal key="done" row={row} variant={v} />);
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
