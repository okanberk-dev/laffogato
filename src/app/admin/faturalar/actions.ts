"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import {
  actionError,
  actionOk,
  fieldErrorsFromIssues,
  type ActionResult,
} from "@/lib/admin/action-result";
import { safeAudit } from "@/lib/admin/audit";
import { requireRole } from "@/lib/admin/auth";
import { setAdminFlash } from "@/lib/admin/flash";
import { panelSignal } from "@/lib/admin/panel-signal";
import {
  invoiceSignalKey,
  type PanelSignalAnswer,
} from "@/lib/admin/panel-signal-core";
import { provinceOf } from "@/lib/invoice/address-core";
import { earsivConfigStatus } from "@/lib/invoice/config";
import { checkParasutConnection } from "@/lib/invoice/connection";
import {
  isValidVkn,
  type CarrierEntry,
  type InvoiceBuyer,
} from "@/lib/invoice/invoice-core";
import { loadOrderInvoiceRequest } from "@/lib/invoice/order-request";
import { cleanTaxOffice } from "@/lib/invoice/vkn";
import {
  INVOICES_PATH,
  invoiceSourceHref,
  isEInvoice,
  needsAttention,
} from "@/lib/invoice/panel-core";
import {
  runInvoiceRow,
  runInvoices,
  type RowRunResult,
} from "@/lib/invoice/run";
import {
  dbInvoiceStore,
  getInvoice,
  listAttentionInvoices,
  markInvoiceManual,
  markInvoiceManualDone,
  markInvoiceRefundHandled,
  requestOrderInvoice,
  retryInvoice,
  setInvoiceBilling,
  writeCarriers,
} from "@/lib/invoice/store";
import { istanbulClock } from "@/lib/mobile/venue";

// Every export here is a public POST endpoint (CLAUDE.md rule 27): each one
// checks the session and the `invoices` role itself. Nothing here touches an
// issued e-Arşiv invoice: a refund after one is a person's document in
// Paraşüt (docs/EARSIV.md).

/**
 * The sidebar's Faturalar badge (Innex, 23 Eki 2026: a counter only where
 * work waits): the invoices that need a person, the Dikkat tab's own set
 * (`needsAttention` over `listAttentionInvoices`), as the dashboard's
 * e-Arşiv band counts them. Nothing while the automation is off: the band
 * is off then too. Every write to `invoices` moves its marker
 * (`live:invoices`), the runner's in the background too; the key carries
 * the köşk's day, because a deadline comes near with the clock, not with a
 * write (two days' warning, so a day late at worst is still in time).
 */
export async function invoiceAttentionSignalAction(
  cursor: string,
): Promise<PanelSignalAnswer> {
  const now = new Date();
  if (earsivConfigStatus(process.env).mode === "off") {
    return { count: null, cursor: "" };
  }
  return panelSignal({
    kind: "invoices",
    section: "invoices",
    key: invoiceSignalKey(istanbulClock(now).date),
    cursor,
    read: async () =>
      (await listAttentionInvoices()).filter((r) => needsAttention(r, now))
        .length,
    label: "dikkat isteyen fatura sayılamadı",
  });
}

function refusedIssues(
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

const OFF = "e-Arşiv kapalı (EARSIV_MODE). Hiçbir şey yapılmadı.";

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
  if (r.mode === "off") return actionError(OFF);
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

/**
 * "Paraşüt bağlantısını sına": one login and one read of the company with
 * the site's own credentials. Cuts nothing; works whatever EARSIV_MODE is.
 */
export async function checkParasutConnectionAction(
  _prev: ActionResult | null,
  _formData: FormData,
): Promise<ActionResult> {
  const session = await requireRole("invoices");
  const r = await checkParasutConnection(process.env, {
    tokens: dbInvoiceStore.tokens,
  });
  await safeAudit({
    action: "update",
    entity: "invoice",
    entityId: "connection",
    actor: session.email,
    payload: { event: "parasut_connection_check", ok: r.ok },
  });
  if (!r.ok) return actionError(r.error);
  return actionOk(
    "Paraşüt bağlantısı çalışıyor: giriş yapıldı ve firma okunabildi.",
    "success",
  );
}

/** The row's state after a button's run, in the operator's words. */
function rowAnswer(
  r: RowRunResult,
  after: Awaited<ReturnType<typeof getInvoice>>,
): ActionResult {
  if (!after) return actionError("Fatura kaydı bulunamadı.");
  if (after.status === "issued" && isEInvoice(after)) {
    const no = after.invoiceNo ? `: ${after.invoiceNo}` : "";
    return actionOk(
      `e-Fatura kesildi${no}. Alıcının GİB kutusuna gitti.`,
      "success",
    );
  }
  if (after.status === "issued") {
    const no = after.invoiceNo ? `: ${after.invoiceNo}` : "";
    return actionOk(
      after.emailedAt
        ? `Fatura kesinleşti${no}. PDF müşteriye e-postayla gönderildi.`
        : `Fatura kesinleşti${no}. ${after.emailError || "PDF e-postası birazdan gönderilecek."}`,
      after.emailedAt ? "success" : "warning",
    );
  }
  if (after.status === "draft") {
    if (after.lastError) return actionError(after.lastError);
    return actionOk(
      'Taslak hazır. Kartta satırları, KDV\'yi ve tutarı kontrol et; doğruysa "Faturayı kesinleştir".',
      "success",
    );
  }
  if (after.status === "formalizing") {
    return actionOk(
      'Paraşüt resmileştiriyor; fatura numarası bir sonraki çalıştırmada (yeni bir sipariş, günlük iş ya da "Şimdi çalıştır") kayda geçer.',
      "warning",
    );
  }
  if (r.step === "pending") {
    // The deadline came first: the row went back to the queue, nothing is
    // being formalised now.
    return actionOk(
      r.mode === "draft"
        ? 'Paraşüt zamanında yanıt vermedi; kayıt sıraya döndü ve bir sonraki çalıştırmada (ya da "Şimdi çalıştır" ile) kaldığı yerden devam eder. Taslak olarak dönerse kontrol edip yeniden kesinleştir.'
        : 'Paraşüt zamanında yanıt vermedi; kayıt sıraya döndü ve bir sonraki çalıştırmada (ya da "Şimdi çalıştır" ile) kaldığı yerden devam eder.',
      "warning",
    );
  }
  if (after.status === "manual")
    return actionOk(
      `Elle kesilecek: ${after.manualReason || "otomatik kesilemedi."}`,
      "warning",
    );
  if (after.status === "failed")
    return actionError(after.lastError || r.error || "Fatura kesilemedi.");
  if (r.error) return actionError(r.error);
  if (after.status === "skipped")
    return actionOk(after.manualReason || "Fatura gerekmiyor.", "warning");
  return actionOk("Sıraya alındı; birazdan işlenir.", "warning");
}

async function rowButton(
  formData: FormData,
  action: "cut" | "formalize" | "rebuild",
  from: string,
  refused: string,
  event: string,
): Promise<ActionResult> {
  const session = await requireRole("invoices");
  const parsed = idSchema.safeParse(String(formData.get("id") ?? ""));
  if (!parsed.success) return refusedIssues(parsed.error.issues);
  const before = await getInvoice(parsed.data);
  if (!before) return actionError("Fatura kaydı bulunamadı.");
  if (before.status !== from) return actionError(refused);
  // The approval is for the draft the card showed: one made again since
  // ("Taslağı yenile", the order's invoice wizard, another tab) is a new
  // Paraşüt id, and nobody has read it yet.
  if (
    action === "formalize" &&
    String(formData.get("draft") ?? "") !== before.salesInvoiceId
  ) {
    revalidateFor(before);
    return actionError(
      "Taslak bu arada yeniden hazırlandı. Sayfayı yenile, yeni taslağı kontrol et, sonra kesinleştir.",
    );
  }
  const r = await runInvoiceRow({ id: before.id, action, budgetMs: 50_000 });
  if (r.mode === "off") return actionError(OFF);
  if (!r.taken) {
    revalidateFor(before);
    return actionError(r.error ?? refused);
  }
  const after = await getInvoice(before.id);
  await safeAudit({
    action: "update",
    entity: "invoice",
    entityId: before.id,
    actor: session.email,
    payload: {
      event,
      mode: r.mode,
      source: `${before.sourceKind}:${before.sourceId}`,
      status: after?.status ?? "",
      invoiceNo: after?.invoiceNo ?? "",
    },
  });
  revalidateFor(before);
  return rowAnswer(r, after);
}

/**
 * "Faturayı kes": this row now, nothing else. In draft mode it becomes a
 * draft in Paraşüt that the card shows line by line; "Faturayı
 * kesinleştir" formalises it. In live mode it is formalised at once.
 */
export async function cutInvoiceNowAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  return rowButton(
    formData,
    "cut",
    "due",
    "Bu kaydın kesim zamanı gelmedi ya da kaydı başka bir işlem tutuyor. Sayfayı yenile.",
    "earsiv_cut_now",
  );
}

/**
 * "Faturayı kesinleştir": the draft the person read becomes the e-Arşiv
 * invoice (dated today), and its PDF is mailed to the buyer. Refused, with
 * the reason, when the draft is from another day or its total no longer
 * agrees; the draft then stays as it is.
 */
export async function formalizeInvoiceAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  return rowButton(
    formData,
    "formalize",
    "draft",
    "Yalnız taslak durumundaki fatura kesinleştirilir. Sayfayı yenile.",
    "earsiv_formalize",
  );
}

/**
 * "Taslağı yenile": the draft is deleted in Paraşüt and prepared again from
 * the order or the booking, dated today (changes made to it in Paraşüt go).
 */
export async function rebuildInvoiceDraftAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  return rowButton(
    formData,
    "rebuild",
    "draft",
    "Yalnız taslak durumundaki fatura yenilenir. Sayfayı yenile.",
    "earsiv_rebuild_draft",
  );
}

/** "Yeniden dene": the row back in the queue (or its PDF mail again). */
export async function retryInvoiceAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const session = await requireRole("invoices");
  const parsed = idSchema.safeParse(String(formData.get("id") ?? ""));
  if (!parsed.success) return refusedIssues(parsed.error.issues);
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
  if (!parsed.success) return refusedIssues(parsed.error.issues);
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

const refundHandledSchema = z.object({
  id: idSchema,
  docNo: z
    .string()
    .trim()
    .min(3, "İade faturasının ya da gider pusulasının numarasını yaz.")
    .max(40, "Belge numarası çok uzun.")
    .regex(
      /^[A-Za-z0-9/-]+$/,
      "Belge numarası yalnız harf, rakam, tire ve eğik çizgi içerir.",
    ),
});

/**
 * "İade belgesini kestim": the return document of a refund after an issued
 * invoice was cut (in Paraşüt or by the accountant). The refund leaves
 * Dikkat, the dashboard and the badge; the invoice itself is not touched.
 */
export async function markInvoiceRefundHandledAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const session = await requireRole("invoices");
  const parsed = refundHandledSchema.safeParse({
    id: String(formData.get("id") ?? ""),
    docNo: String(formData.get("docNo") ?? ""),
  });
  if (!parsed.success) return refusedIssues(parsed.error.issues);
  const res = await markInvoiceRefundHandled(
    parsed.data.id,
    parsed.data.docNo,
    session.email,
  );
  if (!res.ok) return actionError(res.error);
  await safeAudit({
    action: "update",
    entity: "invoice",
    entityId: res.row.id,
    actor: session.email,
    payload: {
      event: "earsiv_refund_handled",
      docNo: parsed.data.docNo,
      source: `${res.row.sourceKind}:${res.row.sourceId}`,
    },
  });
  revalidateFor(res.row);
  return actionOk(`İade belgesi kaydedildi (${parsed.data.docNo}).`);
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
  if (!parsed.success) return refusedIssues(parsed.error.issues);
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

const vknSchema = z
  .string()
  .trim()
  .refine(
    isValidVkn,
    "VKN 10 haneli ve geçerli olmalı (vergi levhasından bak). Şahıs şirketinin TCKN'si burada alınmaz.",
  );

const requestSchema = z
  .object({
    orderId: z
      .string()
      .trim()
      .min(1)
      .max(80)
      .regex(/^[A-Za-z0-9_-]+$/, "Sipariş geçersiz."),
    buyerKind: z.enum(["consumer", "company"], "Alıcı türünü seç."),
    buyerTitle: z.string().trim().max(200, "Unvan en çok 200 karakter."),
    buyerTaxNumber: z.string().trim().max(20),
    buyerTaxOffice: z.string().trim().max(100, "Vergi dairesi çok uzun."),
    buyerEmail: z
      .string()
      .trim()
      .toLowerCase()
      .max(254, "E-posta çok uzun.")
      .refine(
        (v) => v === "" || z.email().safeParse(v).success,
        "Geçerli bir e-posta gir ya da boş bırak.",
      ),
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
  })
  .superRefine((d, ctx) => {
    if (d.buyerKind !== "company") return;
    if (d.buyerTitle.length < 3) {
      ctx.addIssue({
        code: "custom",
        path: ["buyerTitle"],
        message: "Şirketin ticaret unvanını vergi levhasındaki gibi yaz.",
      });
    }
    const vkn = vknSchema.safeParse(d.buyerTaxNumber);
    if (!vkn.success) {
      ctx.addIssue({
        code: "custom",
        path: ["buyerTaxNumber"],
        message: vkn.error.issues[0]?.message ?? "VKN geçersiz.",
      });
    }
    if (!/^[\p{L}0-9 .'-]{2,100}$/u.test(d.buyerTaxOffice)) {
      ctx.addIssue({
        code: "custom",
        path: ["buyerTaxOffice"],
        message: "Vergi dairesini yaz (örneğin Tuzla).",
      });
    }
  });

/**
 * The order's invoice wizard ("Fatura oluştur", /admin/siparisler/[id]/
 * fatura): the buyer (a final consumer, or a company with its legal title,
 * VKN and tax office) and the billing address go on the order's invoice
 * row, then the row is cut now: a draft in Paraşüt in draft mode (a draft
 * already there is rebuilt for the new buyer), the invoice itself in live
 * mode. A company registered at GİB gets an e-Fatura when it is
 * formalised, anyone else an e-Arşiv. Back to the order with the answer.
 */
export async function createOrderInvoiceAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const session = await requireRole("invoices");
  const field = (k: string) => String(formData.get(k) ?? "");
  const parsed = requestSchema.safeParse({
    orderId: field("orderId"),
    buyerKind: field("buyerKind"),
    buyerTitle: field("buyerTitle"),
    buyerTaxNumber: field("buyerTaxNumber").replace(/\s+/g, ""),
    buyerTaxOffice: cleanTaxOffice(field("buyerTaxOffice")),
    buyerEmail: field("buyerEmail"),
    city: field("city"),
    district: field("district"),
    address: field("address"),
  });
  if (!parsed.success) return refusedIssues(parsed.error.issues);
  const d = parsed.data;
  const billing = {
    city: provinceOf(d.city) ?? d.city,
    district: d.district,
    address: d.address,
  };
  const view = await loadOrderInvoiceRequest(d.orderId, billing);
  if (!view) return actionError("Sipariş bulunamadı.");
  if (view.refusal || !view.plan) {
    return actionError(view.refusal ?? "Bu siparişe fatura kesilemez.");
  }
  const buyer: InvoiceBuyer =
    d.buyerKind === "company"
      ? {
          kind: "company",
          title: d.buyerTitle,
          taxNumber: d.buyerTaxNumber,
          taxOffice: d.buyerTaxOffice,
        }
      : { kind: "consumer" };
  const res = await requestOrderInvoice(
    view.order.id,
    view.plan,
    { buyer, email: d.buyerEmail, billing },
    session.email,
  );
  if (!res.ok) return actionError(res.error);
  await safeAudit({
    action: "update",
    entity: "invoice",
    entityId: res.row.id,
    actor: session.email,
    // The company's identity is a record of the invoice; the e-mail and the
    // address text stay out of the log.
    payload: {
      event: "earsiv_request",
      source: `order:${view.order.id}`,
      buyerKind: buyer.kind,
      ...(buyer.kind === "company"
        ? { buyerTitle: buyer.title, buyerTaxNumber: buyer.taxNumber }
        : {}),
      city: billing.city,
      district: billing.district,
    },
  });
  const r = await runInvoiceRow({
    id: res.row.id,
    action: "request",
    budgetMs: 50_000,
  });
  const after = await getInvoice(res.row.id);
  revalidateFor(res.row);
  const answer: ActionResult = !r.taken
    ? actionOk(
        r.error ??
          "Kaydedildi; kaydı bu arada başka bir çalıştırma aldı. Birkaç dakika sonra sayfayı yenile.",
        "warning",
      )
    : rowAnswer(r, after);
  await setAdminFlash(
    answer.ok ? answer.message : answer.error,
    answer.ok ? (answer.tone ?? "success") : "warning",
  );
  redirect(invoiceSourceHref(res.row));
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
  if (!parsed.success) return refusedIssues(parsed.error.issues);
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
