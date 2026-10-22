"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import {
  actionError,
  actionOk,
  fieldErrorsFromIssues,
  type ActionResult,
} from "@/lib/admin/action-result";
import { safeAudit } from "@/lib/admin/audit";
import { requireRole } from "@/lib/admin/auth";
import { provinceOf } from "@/lib/invoice/address-core";
import { isValidVkn, type CarrierEntry } from "@/lib/invoice/invoice-core";
import { INVOICES_PATH, invoiceSourceHref } from "@/lib/invoice/panel-core";
import { runInvoices } from "@/lib/invoice/run";
import {
  markInvoiceManual,
  markInvoiceManualDone,
  retryInvoice,
  setInvoiceBilling,
  writeCarriers,
} from "@/lib/invoice/store";

// Every export here is a public POST endpoint (CLAUDE.md rule 27): each one
// checks the session and the `invoices` role itself. Nothing here touches an
// issued e-Arşiv invoice: a refund after one is a person's document in
// Paraşüt (docs/EARSIV.md).

function refused(
  issues: ReadonlyArray<{ path: ReadonlyArray<PropertyKey>; message: string }>,
): ActionResult {
  return actionError(
    issues[0]?.message ?? "Form geçersiz.",
    fieldErrorsFromIssues(issues),
  );
}

function revalidateFor(row?: {
  sourceKind: "order" | "karaoke";
  sourceId: string;
}) {
  revalidatePath(INVOICES_PATH);
  if (row) revalidatePath(invoiceSourceHref(row));
}

const idSchema = z
  .string()
  .trim()
  .regex(/^inv_[a-f0-9]{16}$/, "Fatura kaydı geçersiz.");

/** "Şimdi çalıştır": the sweep and whatever is due, within 50 s. */
export async function runInvoicesNowAction(
  _prev: ActionResult | null,
  _formData: FormData,
): Promise<ActionResult> {
  const session = await requireRole("invoices");
  const r = await runInvoices({ budgetMs: 50_000, reason: "admin" });
  await safeAudit({
    action: "update",
    entity: "invoice",
    entityId: "run",
    actor: session.email,
    payload: {
      event: "earsiv_run",
      mode: r.mode,
      processed: r.processed,
      issued: r.issued,
      drafts: r.drafts,
      failed: r.failed,
      manual: r.manual,
    },
  });
  revalidateFor();
  if (r.mode === "off")
    return actionError("e-Arşiv kapalı (EARSIV_MODE). Hiçbir şey yapılmadı.");
  if (r.errors.length > 0) return actionError(r.errors[0]);
  const parts = [
    `${r.processed} kayıt işlendi`,
    r.issued ? `${r.issued} fatura kesildi` : "",
    r.drafts ? `${r.drafts} taslak hazırlandı` : "",
    r.manual ? `${r.manual} kayıt elle kesilecek` : "",
    r.failed ? `${r.failed} hata` : "",
    r.more ? "kalanlar bir sonraki çalıştırmada" : "",
  ].filter(Boolean);
  return actionOk(
    `${parts.join(", ")}.`,
    r.failed || r.manual ? "warning" : "success",
  );
}

/** "Yeniden dene": the row back in the queue (or its PDF mail again). */
export async function retryInvoiceAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const session = await requireRole("invoices");
  const parsed = idSchema.safeParse(String(formData.get("id") ?? ""));
  if (!parsed.success) return refused(parsed.error.issues);
  const res = await retryInvoice(parsed.data);
  if (!res.ok) return actionError(res.error);
  await safeAudit({
    action: "update",
    entity: "invoice",
    entityId: res.row.id,
    actor: session.email,
    payload: {
      event: "earsiv_retry",
      source: `${res.row.sourceKind}:${res.row.sourceId}`,
    },
  });
  revalidateFor(res.row);
  return actionOk(
    "Yeniden denenecek: bir sonraki çalıştırmada (ya da Şimdi çalıştır ile).",
  );
}

const manualDoneSchema = z.object({
  id: idSchema,
  invoiceNo: z
    .string()
    .trim()
    .min(3, "Paraşüt'teki fatura numarasını yaz.")
    .max(40, "Fatura numarası çok uzun.")
    .regex(
      /^[A-Za-z0-9-]+$/,
      "Fatura numarası yalnız harf, rakam ve tire içerir.",
    ),
});

/** "Paraşüt'te elle kestim": the number it was cut under. */
export async function markInvoiceManualDoneAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const session = await requireRole("invoices");
  const parsed = manualDoneSchema.safeParse({
    id: String(formData.get("id") ?? ""),
    invoiceNo: String(formData.get("invoiceNo") ?? ""),
  });
  if (!parsed.success) return refused(parsed.error.issues);
  const res = await markInvoiceManualDone(
    parsed.data.id,
    parsed.data.invoiceNo,
    session.email,
  );
  if (!res.ok) return actionError(res.error);
  await safeAudit({
    action: "update",
    entity: "invoice",
    entityId: res.row.id,
    actor: session.email,
    payload: {
      event: "earsiv_manual_done",
      invoiceNo: parsed.data.invoiceNo,
      source: `${res.row.sourceKind}:${res.row.sourceId}`,
    },
  });
  revalidateFor(res.row);
  return actionOk(`Elle kesildi olarak kaydedildi (${parsed.data.invoiceNo}).`);
}

const manualSchema = z.object({
  kind: z.enum(["order", "karaoke"]),
  sourceId: z
    .string()
    .trim()
    .min(1)
    .max(80)
    .regex(/^[A-Za-z0-9_-]+$/, "Kayıt geçersiz."),
  label: z.string().trim().max(40),
  reason: z
    .string()
    .trim()
    .min(3, "Nedenini yaz (örneğin: kurumsal fatura istendi).")
    .max(300, "En çok 300 karakter."),
});

/**
 * "Elle kesilecek" before the invoice is due: a corporate invoice asked
 * for by e-mail (the automation only ever invoices a final consumer), or
 * anything else the operator wants to cut by hand.
 */
export async function markInvoiceManualAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const session = await requireRole("invoices");
  const parsed = manualSchema.safeParse({
    kind: String(formData.get("kind") ?? ""),
    sourceId: String(formData.get("sourceId") ?? ""),
    label: String(formData.get("label") ?? ""),
    reason: String(formData.get("reason") ?? ""),
  });
  if (!parsed.success) return refused(parsed.error.issues);
  const d = parsed.data;
  const res = await markInvoiceManual(
    d.kind,
    d.sourceId,
    d.label,
    d.reason,
    session.email,
  );
  if (!res.ok) return actionError(res.error);
  await safeAudit({
    action: "update",
    entity: "invoice",
    entityId: res.row.id,
    actor: session.email,
    payload: {
      event: "earsiv_manual",
      source: `${d.kind}:${d.sourceId}`,
      reason: d.reason,
    },
  });
  revalidateFor(res.row);
  return actionOk(
    "Otomatik kesilmeyecek; faturayı Paraşüt'te elle kes, sonra numarasını gir.",
  );
}

const billingSchema = z.object({
  id: idSchema,
  city: z
    .string()
    .trim()
    .refine((v) => provinceOf(v) !== null, "İl, 81 ilden biri olmalı."),
  district: z
    .string()
    .trim()
    .min(2, "İlçeyi yaz.")
    .max(60, "İlçe çok uzun.")
    .regex(/^[\p{L} .'-]+$/u, "İlçe yalnız harf içerir."),
  address: z.string().trim().max(500, "Adres en çok 500 karakter."),
});

/** The billing province, district and address, typed by a person. */
export async function setInvoiceBillingAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const session = await requireRole("invoices");
  const parsed = billingSchema.safeParse({
    id: String(formData.get("id") ?? ""),
    city: String(formData.get("city") ?? ""),
    district: String(formData.get("district") ?? ""),
    address: String(formData.get("address") ?? ""),
  });
  if (!parsed.success) return refused(parsed.error.issues);
  const d = parsed.data;
  const res = await setInvoiceBilling(
    d.id,
    {
      city: provinceOf(d.city) ?? d.city,
      district: d.district,
      address: d.address,
    },
    session.email,
  );
  if (!res.ok) return actionError(res.error);
  await safeAudit({
    action: "update",
    entity: "invoice",
    entityId: res.row.id,
    actor: session.email,
    // The province and district only: the address text stays out of the log.
    payload: {
      event: "earsiv_billing",
      city: res.row.billingCity,
      district: res.row.billingDistrict,
    },
  });
  revalidateFor(res.row);
  return actionOk(
    "Fatura adresi kaydedildi. Elle kesilecek durumdaysa Yeniden dene ile kuyruğa al.",
  );
}

/**
 * The carriers' legal titles and VKNs, one per line: "Ad | Unvan | VKN".
 * A VKN must pass GİB's check digit: a typo would be printed on the invoice.
 */
export async function saveInvoiceCarriersAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const session = await requireRole("invoices");
  const text = String(formData.get("carriers") ?? "");
  if (text.length > 5_000)
    return actionError("Liste çok uzun.", { carriers: "Liste çok uzun." });
  const list: CarrierEntry[] = [];
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  for (const [i, line] of lines.entries()) {
    const [name = "", title = "", vkn = ""] = line
      .split("|")
      .map((p) => p.trim());
    const where = `${i + 1}. satır`;
    if (!name || name.length > 60)
      return actionError(`${where}: kargo firmasının adını yaz.`, {
        carriers: `${where}: ad eksik.`,
      });
    if (title.length < 3 || title.length > 200)
      return actionError(`${where}: ticaret unvanını yaz.`, {
        carriers: `${where}: unvan eksik.`,
      });
    if (!isValidVkn(vkn)) {
      return actionError(
        `${where}: VKN 10 haneli ve geçerli olmalı (vergi levhasından bak).`,
        { carriers: `${where}: VKN geçersiz.` },
      );
    }
    if (
      list.some(
        (c) =>
          c.name.toLocaleLowerCase("tr-TR") === name.toLocaleLowerCase("tr-TR"),
      )
    ) {
      return actionError(`${where}: "${name}" iki kez yazılmış.`, {
        carriers: `${where}: tekrar.`,
      });
    }
    list.push({ name, title, vkn });
  }
  if (list.length > 30)
    return actionError("En çok 30 kargo firması.", { carriers: "En çok 30." });
  await writeCarriers(list);
  await safeAudit({
    action: "update",
    entity: "invoice",
    entityId: "carriers",
    actor: session.email,
    payload: {
      event: "earsiv_carriers",
      carriers: list.map((c) => ({ name: c.name, vkn: c.vkn })),
    },
  });
  revalidateFor();
  return actionOk(`Kargo firmaları kaydedildi (${list.length}).`);
}
