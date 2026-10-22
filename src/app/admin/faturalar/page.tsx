import Link from "next/link";

import {
  ActionButton,
  ActionForm,
  FormFieldError,
  FormMessage,
} from "@/components/admin/action-form";
import {
  Field,
  formatDateTime,
  formatTRY,
  PageHeader,
  Textarea,
} from "@/components/admin/forms";
import { InvoiceActions } from "@/components/admin/invoice-actions";
import {
  Badge,
  BUTTON,
  DataTable,
  EmptyState,
  NUMERIC_STYLE,
  PageShell,
  Section,
  StatusTabs,
} from "@/components/admin/ui";
import { requireRole } from "@/lib/admin/auth";
import { EARSIV_MODE_LABELS, earsivConfigStatus } from "@/lib/invoice/config";
import type { InvoiceRow } from "@/lib/invoice/invoice-core";
import {
  deadlineBadge,
  INVOICE_STATUS_TONE,
  INVOICE_TAB_PARAM,
  INVOICE_TABS,
  INVOICES_PATH,
  invoiceNoteText,
  invoiceRouteLabel,
  invoiceSourceHref,
  invoiceStatusLabel,
  invoiceTab,
  parseInvoiceTab,
} from "@/lib/invoice/panel-core";
import type { RunSummary } from "@/lib/invoice/run";
import { listInvoices, readCarriers, readLastRun } from "@/lib/invoice/store";

import { runInvoicesNowAction, saveInvoiceCarriersAction } from "./actions";

export const metadata = { title: "Admin · Faturalar" };
export const dynamic = "force-dynamic";
// "Şimdi çalıştır" runs here for up to 50 s.
export const maxDuration = 120;

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function Status({ row, now }: { row: InvoiceRow; now: Date }) {
  const deadline = deadlineBadge(row, now);
  return (
    <span className="flex flex-wrap items-center gap-1.5">
      <Badge tone={INVOICE_STATUS_TONE[row.status]} dot>
        {invoiceStatusLabel(row)}
      </Badge>
      {deadline ? <Badge tone={deadline.tone}>{deadline.label}</Badge> : null}
      {row.refundNotedAt ? <Badge tone="danger">İade</Badge> : null}
    </span>
  );
}

function ConfigCard({ lastRun }: { lastRun: RunSummary | null }) {
  const status = earsivConfigStatus(process.env);
  return (
    <Section title="Bağlantı ve çalışma">
      <div className="flex flex-col gap-2 text-sm">
        <p>
          Mod: <strong>{EARSIV_MODE_LABELS[status.mode]}</strong>
          {status.config ? (
            <>
              {" · "}Başlangıç: {formatDateTime(status.config.startAt)}
              {" · "}Kasa/banka hesabı:{" "}
              {status.config.paymentAccountId === null
                ? "tanımlı değil"
                : "tanımlı"}
            </>
          ) : null}
        </p>
        {status.mode === "off" ? (
          <p className="text-[var(--admin-text-soft)]">
            {
              "Otomatik e-Arşiv kapalı: hiçbir sipariş Paraşüt'e gönderilmez, faturalar elle kesilir. Açmak için docs/EARSIV.md'deki adımlar (EARSIV_MODE, EARSIV_START_AT ve Paraşüt bilgileri)."
            }
          </p>
        ) : null}
        {status.mode === "draft" && status.config ? (
          <p className="text-[var(--admin-text-soft)]">
            {
              "Taslak modu: faturalar Paraşüt'te taslak olarak hazırlanır, resmileştirilmez ve müşteriye gönderilmez. Muhasebeci kontrol edince EARSIV_MODE=live."
            }
          </p>
        ) : null}
        {status.errors.map((e) => (
          <p key={e} role="alert" className="text-[var(--admin-danger-ink)]">
            {e}
          </p>
        ))}
        {lastRun ? (
          <p className="text-[var(--admin-text-soft)]">
            Son çalıştırma: {formatDateTime(lastRun.at)} · {lastRun.processed}{" "}
            kayıt işlendi
            {lastRun.issued ? `, ${lastRun.issued} kesildi` : ""}
            {lastRun.drafts ? `, ${lastRun.drafts} taslak` : ""}
            {lastRun.manual ? `, ${lastRun.manual} elle` : ""}
            {lastRun.failed ? `, ${lastRun.failed} hata` : ""}
            {lastRun.errors.length ? ` · ${lastRun.errors[0]}` : ""}
          </p>
        ) : null}
      </div>
    </Section>
  );
}

/**
 * Faturalar: every e-Arşiv invoice row (docs/EARSIV.md). What is due, what
 * waits and why, what a person has to cut in Paraşüt, the legal deadline of
 * each (VUK m.231/5: 7 days), refunds after an invoice, and the carriers'
 * titles and VKNs the parcels' e-Arşiv needs.
 */
export default async function InvoicesPage({ searchParams }: PageProps) {
  await requireRole("invoices");
  const sp = (await searchParams) ?? {};
  const now = new Date();
  const [rows, carriers, lastRun] = await Promise.all([
    listInvoices(500),
    readCarriers(),
    readLastRun<RunSummary>(),
  ]);
  const tab = parseInvoiceTab(sp[INVOICE_TAB_PARAM]);
  const counts = new Map<string | null, number>([[null, rows.length]]);
  for (const r of rows) {
    for (const t of invoiceTab(r, now)) counts.set(t, (counts.get(t) ?? 0) + 1);
  }
  const shown = tab
    ? rows.filter((r) => invoiceTab(r, now).includes(tab))
    : rows;
  const carrierText = carriers
    .map((c) => `${c.name} | ${c.title} | ${c.vkn}`)
    .join("\n");

  return (
    <PageShell width="list">
      <PageHeader
        title="Faturalar"
        description="Online siparişlerin ve karaoke rezervasyonlarının e-Arşiv faturaları (Paraşüt)."
        help={
          <p>
            Kargo kolisinin faturası kargoya verilince, kafe siparişininki
            teslimden sonra, karaokeninki saat bitince kesilir ve müşteriye
            e-postayla gider. Teslimden en geç 7 gün içinde kesilmeyen fatura
            kesilmemiş sayılır (VUK 231/5): kırmızı rozetlere bak.
          </p>
        }
        action={
          <ActionButton
            action={runInvoicesNowAction}
            variant="primary"
            pendingLabel="Çalışıyor…"
          >
            Şimdi çalıştır
          </ActionButton>
        }
      />

      <div className="mb-4 flex flex-col gap-4">
        <ConfigCard lastRun={lastRun} />
      </div>

      <StatusTabs
        tabs={INVOICE_TABS.map((t) => ({
          value: t.value,
          label: t.label,
          count: counts.get(t.value) ?? 0,
        }))}
        current={tab}
        searchParams={sp}
        pathname={INVOICES_PATH}
        param={INVOICE_TAB_PARAM}
        label="Fatura sekmeleri"
      />

      <DataTable<InvoiceRow>
        caption="Faturalar"
        rows={shown}
        rowKey={(r) => r.id}
        pathname={INVOICES_PATH}
        searchParams={sp}
        empty={<EmptyState title="Bu sekmede fatura yok." />}
        columns={[
          {
            key: "kaynak",
            header: "Kaynak",
            cell: (r) => (
              <Link
                href={invoiceSourceHref(r)}
                className="font-medium underline-offset-4 hover:underline"
              >
                {r.sourceLabel || r.sourceId}
              </Link>
            ),
          },
          { key: "yol", header: "Yol", cell: (r) => invoiceRouteLabel(r) },
          {
            key: "durum",
            header: "Durum",
            cell: (r) => <Status row={r} now={now} />,
          },
          {
            key: "tutar",
            header: "Tutar",
            align: "right",
            cell: (r) => (
              <span style={NUMERIC_STYLE}>
                {r.amountMinor ? formatTRY(r.amountMinor) : "-"}
              </span>
            ),
          },
          {
            key: "no",
            header: "Fatura no",
            hideBelow: "lg",
            cell: (r) => (
              <span style={NUMERIC_STYLE}>{r.invoiceNo || "-"}</span>
            ),
          },
          {
            key: "not",
            header: "Not",
            hideBelow: "lg",
            cell: (r) => (
              <span className="text-xs text-[var(--admin-text-soft)]">
                {invoiceNoteText(r) || "-"}
              </span>
            ),
          },
        ]}
        rowActions={(r) => (
          <InvoiceActions
            row={r}
            source={{
              kind: r.sourceKind,
              id: r.sourceId,
              label: r.sourceLabel,
            }}
            menu
          />
        )}
        mobileCard={(r) => (
          <div className="flex flex-col gap-1.5">
            <Link
              href={invoiceSourceHref(r)}
              className="font-medium underline-offset-4 hover:underline"
            >
              {r.sourceLabel || r.sourceId} · {invoiceRouteLabel(r)}
            </Link>
            <Status row={r} now={now} />
            <span className="text-xs text-[var(--admin-text-soft)]">
              {invoiceNoteText(r)}
            </span>
          </div>
        )}
      />

      <div className="mt-6">
        <Section
          title="Kargo firmaları"
          description="Kargo kolisinin e-Arşiv faturası taşıyan firmanın unvanını ve VKN'sini ister. Kargoya verirken yazılan firma adı burada yoksa fatura elle kesilecek diye işaretlenir."
        >
          <div>
            <ActionForm
              action={saveInvoiceCarriersAction}
              className="flex flex-col gap-3"
            >
              <Field
                label="Her satıra bir firma: Ad | Ticaret unvanı | VKN"
                hint="Ad, kargoya verirken yazdığın ad (Yurtiçi, Aras…). Unvan ve VKN firmanın vergi levhasından; uydurma değer yazma."
              >
                <Textarea
                  name="carriers"
                  rows={5}
                  maxLength={5000}
                  defaultValue={carrierText}
                  style={{ fontFamily: "var(--mono), monospace" }}
                />
              </Field>
              <FormFieldError name="carriers" />
              <div className="flex items-center gap-3">
                <button type="submit" className={BUTTON.primary}>
                  Kaydet
                </button>
                <FormMessage />
              </div>
            </ActionForm>
          </div>
        </Section>
      </div>
    </PageShell>
  );
}
