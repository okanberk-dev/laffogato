import "server-only";

import type { AdminOrder } from "@/lib/admin/store";
import type { KaraokeReservation } from "@/lib/mobile/karaoke-core";
import { LEGAL_TAX_RATES } from "@/lib/utils/kdv";

import {
  earsivConfigStatus,
  type EarsivConfig,
  type EarsivMode,
} from "./config";
import {
  buyerOf,
  contactBody,
  contactCacheKey,
  contactFingerprint,
  dayLabel,
  eArchiveBody,
  eInvoiceBody,
  expectedTotalMinor,
  FINAL_STATUSES,
  formatMinor,
  invoiceMarker,
  invoiceNote,
  invoicePdfName,
  invoiceRecipient,
  istanbulDay,
  jobOutcome,
  JOB_TTL_MS,
  karaokeInvoiceLines,
  linesKdvRows,
  maskText,
  matchCarrier,
  MAX_ATTEMPTS,
  MAX_EMAIL_ATTEMPTS,
  orderInvoiceLines,
  parasutMinor,
  pickEInvoiceInbox,
  planKaraokeInvoice,
  planOrderInvoice,
  productBody,
  RECHECKABLE_MANUAL,
  retryDelayMs,
  salesInvoiceBody,
  shipmentFor,
  STALE_CLAIM_MS,
  totalsAgree,
  type BillingAddress,
  type CarrierEntry,
  type ContactInput,
  type InvoiceBuyer,
  type InvoiceLine,
  type InvoicePayment,
  type InvoicePlan,
  type InvoiceRow,
  type InvoiceSourceKind,
  type ManualCode,
} from "./invoice-core";
import {
  ParasutAuthError,
  ParasutClient,
  ParasutDeadlineError,
  ParasutError,
  type JsonDocument,
  type JsonList,
  type JsonResource,
} from "./parasut-client";
import {
  blankInvoice,
  LAST_RUN_KEY,
  type InvoicePatch,
  type InvoiceStore,
} from "./store";

/**
 * The e-Arşiv run (docs/EARSIV.md): the sweep that keeps one invoice row per
 * billable order and karaoke booking, then the due rows, one at a time,
 * within a time budget. Called by the daily cron, by `after()` when an
 * order is paid, shipped/served or completed (./hook.ts), and by the
 * panel's "Şimdi çalıştır".
 *
 * Off (EARSIV_MODE unset or "off") it does nothing at all, the database
 * included. Misconfigured it records the problem and does nothing else.
 *
 * Each claimed row walks the same steps; every Paraşüt id is written the
 * moment it is known, so a run that stops anywhere resumes from the last
 * one: contact → products → sales invoice (checked against the order's
 * total; a mismatch deletes the draft and hands the row to a person) →
 * in `draft` mode, stop → e-Arşiv job → its result → the e-document's
 * number → the PDF mailed to the buyer.
 *
 * In `draft` mode a person formalises each draft from the panel after
 * reading it ("Faturayı kesinleştir", runInvoiceRow): the same steps from
 * the stored draft on, for that row only.
 */

/** What a run reads and calls, injectable for tests. */
export interface InvoiceDeps {
  env: Record<string, string | undefined>;
  production: boolean;
  now: () => Date;
  store: InvoiceStore;
  client: (cfg: EarsivConfig) => InvoiceClient;
  mail: (
    mail: InvoiceMail,
  ) => Promise<{ ok: true } | { ok: false; error: string }>;
  siteUrl: string;
  /** settings.taxRates.karaoke, for a booking made before it was stamped. */
  karaokeRate: () => Promise<number>;
  sleep: (ms: number) => Promise<void>;
}

/** The part of ParasutClient a run uses. */
export type InvoiceClient = Pick<
  ParasutClient,
  | "companyId"
  | "setDeadline"
  | "timeLeft"
  | "get"
  | "post"
  | "put"
  | "del"
  | "pdfUrl"
  | "downloadPdf"
>;

/** The invoice mail, as ./send.ts sends it. */
export interface InvoiceMail {
  to: string;
  customerName: string;
  kind: InvoiceSourceKind;
  /** "#10234", or the evening's day for karaoke ("23 Ekim 2026"). */
  ref: string;
  orderNo: number | null;
  invoiceNo: string;
  /** "22 Ekim 2026". */
  invoiceDay: string;
  amountMinor: number;
  pdfBase64: string;
  filename: string;
  idempotencyKey: string;
}

export interface RunOptions {
  budgetMs: number;
  /** Rows to process at most. */
  limit?: number;
  /** Sweep only this order (the hooks); the cron and the panel sweep all. */
  orderId?: string;
  reason: "cron" | "hook" | "admin";
}

export interface RunSummary {
  at: string;
  reason: RunOptions["reason"];
  mode: EarsivMode;
  errors: string[];
  created: number;
  updated: number;
  processed: number;
  issued: number;
  drafts: number;
  failed: number;
  manual: number;
  emailed: number;
  /** True when the budget ran out with work left. */
  more: boolean;
}

const SWEEP_DAYS = 10;
const DAY_MS = 24 * 60 * 60_000;
/**
 * No row is started with less than this left, and a job is not polled on
 * with less. A row cut short by the deadline is safe: it goes back to the
 * queue from its last stored id (ParasutDeadlineError).
 */
const ROW_RESERVE_MS = 8_000;
const POLLS = 5;
const POLL_GAP_MS = 2_000;

class LostClaim extends Error {}

function emptySummary(
  reason: RunOptions["reason"],
  mode: EarsivMode,
  at: string,
): RunSummary {
  return {
    at,
    reason,
    mode,
    errors: [],
    created: 0,
    updated: 0,
    processed: 0,
    issued: 0,
    drafts: 0,
    failed: 0,
    manual: 0,
    emailed: 0,
    more: false,
  };
}

/** Plan inputs that both the sweep and a claimed row read. */
interface Ctx {
  deps: InvoiceDeps;
  cfg: EarsivConfig;
  carriers: CarrierEntry[];
  nowIso: () => string;
}

function billingOverride(row: InvoiceRow | undefined): BillingAddress | null {
  return row && row.billingEditedBy
    ? {
        city: row.billingCity,
        district: row.billingDistrict,
        address: row.billingAddress,
      }
    : null;
}

async function orderPlan(
  ctx: Ctx,
  order: AdminOrder,
  payments: Map<string, InvoicePayment[]>,
  coupons: Map<number, string>,
  row: InvoiceRow | undefined,
): Promise<InvoicePlan | null> {
  return planOrderInvoice({
    order,
    payments: payments.get(order.id) ?? [],
    couponSource: coupons.get(order.orderNo) ?? null,
    startAt: ctx.cfg.startAt,
    production: ctx.deps.production,
    carriers: ctx.carriers,
    billingOverride: billingOverride(row),
    now: ctx.deps.now(),
    requested: Boolean(row?.requestedBy),
  });
}

function planPatch(
  plan: InvoicePlan,
  row: InvoiceRow | undefined,
): InvoicePatch {
  const patch: InvoicePatch = {
    route: plan.route,
    sourceLabel: plan.sourceLabel,
    status: plan.status,
    dueAt: plan.dueAt,
    deadlineAt: plan.deadlineAt,
    amountMinor: plan.amountMinor,
    manualReason: plan.reason,
    manualCode: plan.manualCode,
  };
  if (plan.billing && !(row && row.billingEditedBy)) {
    patch.billingCity = plan.billing.city;
    patch.billingDistrict = plan.billing.district;
    patch.billingAddress = plan.billing.address;
  }
  return patch;
}

function changed(row: InvoiceRow, patch: InvoicePatch): boolean {
  return Object.entries(patch).some(
    ([k, v]) =>
      JSON.stringify((row as unknown as Record<string, unknown>)[k]) !==
      JSON.stringify(v),
  );
}

/**
 * Brings one source's row in line with its plan. Only rows nothing has
 * been formalised for are re-planned; an issued row only learns of a refund
 * made after it (the flag on the order, the warning on the invoice).
 */
async function syncRow(
  ctx: Ctx,
  kind: InvoiceSourceKind,
  sourceId: string,
  plan: InvoicePlan | null,
  row: InvoiceRow | undefined,
  refundAfterIssue: boolean,
  summary: RunSummary,
): Promise<void> {
  const { store } = ctx.deps;
  const now = ctx.nowIso();
  if (!row) {
    if (!plan) return;
    const fresh: InvoiceRow = {
      ...blankInvoice(kind, sourceId, now),
      ...(planPatch(plan, undefined) as Partial<InvoiceRow>),
    };
    if (await store.insertRow(fresh)) summary.created += 1;
    return;
  }
  if (row.status === "issued") {
    if (refundAfterIssue && !row.refundNotedAt) {
      if (await store.updateRow(row, { refundNotedAt: now, updatedAt: now })) {
        summary.updated += 1;
        if (kind === "order") await store.flagOrderRefund(sourceId);
      }
    }
    return;
  }
  if (FINAL_STATUSES.has(row.status) || row.eDocumentId) return;
  if (row.status === "working" || row.status === "formalizing") return;
  if (
    row.status === "manual" &&
    (row.actor || !RECHECKABLE_MANUAL.has(row.manualCode))
  ) {
    // Out of the automation, still on the clock: a parcel marked corporate
    // (or paid from the wallet) before it ships learns its VUK 231/5
    // deadline when it ships, so the panel keeps warning a person.
    const timing: InvoicePatch = {
      dueAt: plan?.dueAt || row.dueAt,
      deadlineAt: plan?.deadlineAt || row.deadlineAt,
    };
    if (
      plan &&
      changed(row, timing) &&
      (await store.updateRow(row, { ...timing, updatedAt: now }))
    ) {
      summary.updated += 1;
    }
    return;
  }
  const billable =
    plan !== null && (plan.status === "due" || plan.status === "waiting");
  if (row.salesInvoiceId) {
    // A draft is in Paraşüt. Still billable: the runner keeps it. Not any
    // more: the runner (which re-plans) deletes it.
    if (!billable && row.status !== "due") {
      if (
        await store.updateRow(row, {
          status: "due",
          nextAttemptAt: "",
          dueAt: row.dueAt || now,
          updatedAt: now,
        })
      ) {
        summary.updated += 1;
      }
    }
    return;
  }
  if (!plan) {
    const patch: InvoicePatch = {
      status: "skipped",
      manualReason: "Artık otomatik faturalama kapsamında değil.",
      manualCode: "",
    };
    if (
      changed(row, patch) &&
      (await store.updateRow(row, { ...patch, updatedAt: now }))
    ) {
      summary.updated += 1;
    }
    return;
  }
  const patch = planPatch(plan, row);
  // A failed row keeps its retry time unless the plan takes it out of the queue.
  if (row.status === "failed" && billable) {
    delete patch.status;
    delete patch.manualReason;
    delete patch.manualCode;
  }
  if (
    changed(row, patch) &&
    (await store.updateRow(row, { ...patch, updatedAt: now }))
  ) {
    summary.updated += 1;
  }
}

/** The sweep: one row per billable order and booking, each re-planned. */
export async function syncInvoices(
  ctx: Ctx,
  summary: RunSummary,
  only?: { orderId?: string },
): Promise<void> {
  const { store, now } = ctx.deps;
  const since = new Date(
    Math.max(
      Date.parse(ctx.cfg.startAt),
      now().getTime() - SWEEP_DAYS * DAY_MS,
    ),
  ).toISOString();
  const open = only?.orderId ? [] : await store.openRows();

  // Orders.
  let orders: AdminOrder[];
  if (only?.orderId) {
    orders = await store.ordersByIds([only.orderId]);
  } else {
    const recent = await store.recentPaidOrders(since);
    const seen = new Set(recent.map((o) => o.id));
    const extra = open
      .filter((r) => r.sourceKind === "order" && !seen.has(r.sourceId))
      .map((r) => r.sourceId);
    orders = [...recent, ...(await store.ordersByIds(extra))];
  }
  if (orders.length > 0) {
    const ids = orders.map((o) => o.id);
    const [payments, coupons, rows] = await Promise.all([
      store.paymentsFor(ids),
      store.couponSources(orders),
      store.rowsForSources("order", ids),
    ]);
    const byId = new Map(rows.map((r) => [r.sourceId, r]));
    for (const order of orders) {
      const row = byId.get(order.id);
      const plan = await orderPlan(ctx, order, payments, coupons, row);
      const refunded = (order.refunds ?? []).some(
        (r) => Number(r.amountMinor) > 0,
      );
      await syncRow(ctx, "order", order.id, plan, row, refunded, summary);
    }
  }
  if (only?.orderId) return;

  // Karaoke bookings: evenings from the day before the sweep window on.
  const sinceDay = istanbulDay(new Date(Date.parse(since) - DAY_MS));
  const recent = await store.recentPaidBookings(sinceDay);
  const seen = new Set(recent.map((b) => b.id));
  const extra = open
    .filter((r) => r.sourceKind === "karaoke" && !seen.has(r.sourceId))
    .map((r) => r.sourceId);
  const bookings = [...recent, ...(await store.bookingsByIds(extra))];
  if (bookings.length > 0) {
    const ids = bookings.map((b) => b.id);
    const [payments, rows] = await Promise.all([
      store.paymentsFor(ids),
      store.rowsForSources("karaoke", ids),
    ]);
    const byId = new Map(rows.map((r) => [r.sourceId, r]));
    for (const booking of bookings) {
      const row = byId.get(booking.id);
      const plan = planKaraokeInvoice({
        booking,
        payments: payments.get(booking.id) ?? [],
        startAt: ctx.cfg.startAt,
        production: ctx.deps.production,
        now: now(),
      });
      const issuedAt = Date.parse(row?.issuedAt ?? "");
      const refundedAt = Date.parse(booking.refundedAt ?? "");
      const refundAfter =
        booking.paymentStatus === "refunding" ||
        (Number.isFinite(issuedAt) &&
          Number.isFinite(refundedAt) &&
          refundedAt > issuedAt);
      await syncRow(
        ctx,
        "karaoke",
        booking.id,
        plan,
        row,
        refundAfter,
        summary,
      );
    }
  }
}

// ─── One claimed row ───────────────────────────────────────────────────────

interface Source {
  plan: InvoicePlan | null;
  lines: InvoiceLine[] | null;
  email: string;
  name: string;
  orderNo: number | null;
  /** YYYY-MM-DD of the order or the booking. */
  orderDate: string;
  /** YYYY-MM-DD the money was taken. */
  paymentDate: string;
  /** YYYY-MM-DD the goods left (parcel, courier). */
  deliveredDay: string;
  carrier: CarrierEntry | null;
  /** For the mail: "#10234" or the evening's day. */
  ref: string;
  /** Who the invoice is cut to: the wizard's company, else the consumer. */
  buyer: InvoiceBuyer;
}

async function loadSource(ctx: Ctx, row: InvoiceRow): Promise<Source | null> {
  const { store, now } = ctx.deps;
  if (row.sourceKind === "order") {
    const [order] = await store.ordersByIds([row.sourceId]);
    if (!order) return null;
    const [payments, coupons] = await Promise.all([
      store.paymentsFor([order.id]),
      store.couponSources([order]),
    ]);
    const plan = await orderPlan(ctx, order, payments, coupons, row);
    const delivered =
      order.shippedAt || order.completedAt || order.paidAt || "";
    const buyer = buyerOf(row);
    return {
      plan,
      lines: orderInvoiceLines(order),
      // The wizard's invoice address, else the order's.
      email: row.buyerEmail.trim() || order.customerEmail,
      // A company's mail greets the company.
      name: buyer.kind === "company" ? buyer.title : order.customerName,
      orderNo: order.orderNo,
      orderDate: istanbulDay(order.createdAt),
      paymentDate: istanbulDay(order.paidAt || order.createdAt),
      deliveredDay: istanbulDay(delivered),
      carrier: matchCarrier(order.carrier ?? "", ctx.carriers),
      ref: `#${order.orderNo}`,
      buyer,
    };
  }
  const [booking] = await store.bookingsByIds([row.sourceId]);
  if (!booking) return null;
  const payments = await store.paymentsFor([booking.id]);
  const plan = planKaraokeInvoice({
    booking,
    payments: payments.get(booking.id) ?? [],
    startAt: ctx.cfg.startAt,
    production: ctx.deps.production,
    now: now(),
  });
  const rate = await ctx.deps.karaokeRate();
  return {
    plan,
    lines:
      plan && plan.amountMinor > 0
        ? karaokeInvoiceLines(booking, plan.amountMinor, rate)
        : null,
    email: booking.contactEmail?.trim() || booking.customerEmail,
    name: booking.customerName,
    orderNo: null,
    orderDate: istanbulDay(booking.createdAt),
    paymentDate: istanbulDay(booking.paidAt || booking.createdAt),
    deliveredDay: booking.date,
    carrier: null,
    ref: dayLabel(booking.date),
    buyer: { kind: "consumer" },
  };
}

/** Where a row goes back to when a run stops in the middle of it. */
function resumeStatus(row: InvoiceRow): InvoiceRow["status"] {
  if (row.eDocumentId) return "issued";
  if (row.jobId) return "formalizing";
  return "due";
}

export type Step =
  "issued" | "draft" | "manual" | "waiting" | "failed" | "skipped" | "pending";

/** What a person's button asks of one row (runInvoiceRow). */
interface RowOpts {
  /** "Faturayı kesinleştir": formalise the draft the person has read. */
  approved?: boolean;
  /** "Taslağı yenile": the draft goes and is prepared again, dated today. */
  rebuild?: boolean;
}

async function processRow(
  ctx: Ctx,
  client: InvoiceClient,
  held: InvoiceRow,
  summary: RunSummary,
  opts: RowOpts = {},
): Promise<Step> {
  const { store } = ctx.deps;
  let row = { ...held };
  const save = async (patch: InvoicePatch): Promise<void> => {
    const ok = await store.updateClaimed(row.id, held.claimedAt, {
      ...patch,
      updatedAt: ctx.nowIso(),
    });
    if (!ok) throw new LostClaim(row.id);
    row = { ...row, ...patch } as InvoiceRow;
  };
  const release = async (patch: InvoicePatch): Promise<void> => {
    await save({ ...patch, claimedAt: "" });
  };

  // An issued row is held only for its mail.
  if (row.eDocumentId) return mailRow(ctx, client, row, save, release, summary);

  const source = await loadSource(ctx, row);
  if (!source) {
    await release({
      status: "manual",
      manualCode: "other",
      manualReason: "Sipariş ya da rezervasyon bulunamadı.",
    });
    return "manual";
  }
  const plan = source.plan;

  // No longer billable: a draft in Paraşüt goes, the row takes the plan.
  if (!plan || plan.status !== "due") {
    if (row.salesInvoiceId) {
      const si = await readSalesInvoice(client, row.salesInvoiceId);
      if (si && activeEDocument(si)) {
        // Formalised in Paraşüt by hand meanwhile: that is the invoice.
        return recordEDocument(
          ctx,
          client,
          row,
          si,
          save,
          release,
          summary,
          source,
        );
      }
      if (si)
        await client.del(
          `sales_invoices/${encodeURIComponent(row.salesInvoiceId)}`,
        );
      await save({ salesInvoiceId: "" });
    }
    const status = plan ? plan.status : "skipped";
    await release({
      ...(plan ? planPatch(plan, row) : {}),
      status,
      manualReason: plan
        ? plan.reason
        : "Artık otomatik faturalama kapsamında değil.",
      manualCode: plan ? plan.manualCode : "",
      nextAttemptAt: "",
    });
    return status === "due" ? "pending" : status;
  }
  const billing: BillingAddress = plan.billing ?? {
    city: row.billingCity,
    district: row.billingDistrict,
    address: row.billingAddress,
  };
  const lines = source.lines;
  if (!lines) {
    await release({
      status: "manual",
      manualCode: "totals_mismatch",
      manualReason: "Fatura satırları oluşturulamadı.",
      nextAttemptAt: "",
    });
    return "manual";
  }
  const expected = expectedTotalMinor(lines);
  const recipient = invoiceRecipient(source.email);

  // 1. Contact.
  const contact: ContactInput = {
    name: source.name,
    email: recipient ?? source.email,
    billing,
    buyer: source.buyer,
  };
  const contactId = await ensureContact(ctx, client, contact);
  if (contactId !== row.contactId && !row.salesInvoiceId)
    await save({ contactId });

  // 2. Products.
  const productIds = new Map<string, string>();
  for (const line of lines) {
    if (!productIds.has(line.productCode)) {
      productIds.set(line.productCode, await ensureProduct(ctx, client, line));
    }
  }

  // 3. Sales invoice.
  const today = istanbulDay(ctx.deps.now());
  const marker = invoiceMarker(row.sourceKind, plan.sourceLabel);
  // Whether this run made the draft (or found the one its lost create made).
  let ours = false;
  let si: JsonDocument | null = null;
  if (row.salesInvoiceId) {
    si = await readSalesInvoice(client, row.salesInvoiceId);
    const issueDay = String(si?.data.attributes.issue_date ?? "").slice(0, 10);
    // The draft was made for another Paraşüt contact: the buyer changed
    // since (the order's invoice wizard), so it is not this invoice. Only a
    // contact kept under a key says so (without an e-mail every run makes a
    // new one).
    const otherBuyer =
      Boolean(row.contactId) &&
      row.contactId !== contactId &&
      contactCacheKey(contact) !== "";
    if (!si) {
      await save({ salesInvoiceId: "" });
    } else if (activeEDocument(si)) {
      return recordEDocument(
        ctx,
        client,
        row,
        si,
        save,
        release,
        summary,
        source,
        lines,
      );
    } else if (opts.approved && otherBuyer) {
      // The person read a draft for another buyer: not formalised.
      await release({
        status: "draft",
        lastError:
          'Taslak başka bir alıcı için hazırlanmış (alıcı sonradan değişti). "Taslağı yenile" ile yeni alıcıyla hazırla, kontrol et, sonra kesinleştir.',
        nextAttemptAt: "",
      });
      return "draft";
    } else if (
      opts.rebuild ||
      otherBuyer ||
      (ctx.cfg.mode === "live" && issueDay !== today)
    ) {
      // "Taslağı yenile", a draft for another buyer, or a draft from an
      // earlier day in live mode (the e-Arşiv is dated the day it is
      // formalised): the draft is cut again, today, for this buyer.
      await client.del(
        `sales_invoices/${encodeURIComponent(row.salesInvoiceId)}`,
      );
      await save({ salesInvoiceId: "" });
      si = null;
    } else if (opts.approved && issueDay !== today) {
      // The person read a draft dated another day. It is not recut behind
      // their back (they may have corrected it in Paraşüt): they decide.
      await release({
        status: "draft",
        lastError: `Taslak ${issueDay ? dayLabel(issueDay) : "başka bir gün"} tarihli; e-Arşiv bugünün tarihiyle kesilir. "Taslağı yenile" ile bugüne al ya da tarihi Paraşüt'te bugüne çek, sonra yeniden kesinleştir.`,
        nextAttemptAt: "",
      });
      return "draft";
    }
  }
  if (!row.salesInvoiceId && row.createStartedAt) {
    // The last create's answer was lost: look before creating again.
    const found = await findByMarker(
      client,
      row.contactId || contactId,
      istanbulDay(row.createStartedAt),
      marker,
    );
    if (found.length > 1) {
      await release({
        status: "manual",
        manualCode: "parasut",
        manualReason: `Paraşüt'te "${marker}" için birden fazla fatura var; fazlasını Paraşüt'te sil, sonra yeniden dene.`,
        nextAttemptAt: "",
      });
      return "manual";
    }
    if (found.length === 1) {
      await save({ salesInvoiceId: found[0].id, createStartedAt: "" });
      ours = true;
      si = await readSalesInvoice(client, found[0].id);
      if (si && activeEDocument(si)) {
        return recordEDocument(
          ctx,
          client,
          row,
          si,
          save,
          release,
          summary,
          source,
          lines,
        );
      }
    } else {
      await save({ createStartedAt: "" });
    }
  }
  if (!row.salesInvoiceId) {
    await save({ createStartedAt: ctx.nowIso() });
    const body = salesInvoiceBody({
      marker,
      note: invoiceNote(row.sourceKind, plan.sourceLabel, plan.route),
      issueDate: today,
      orderNo: source.orderNo !== null ? String(source.orderNo) : row.sourceId,
      orderDate: source.orderDate,
      contactId,
      billing,
      lines: lines.map((l) => ({
        ...l,
        productId: productIds.get(l.productCode) ?? "",
      })),
      cashSale:
        ctx.cfg.paymentAccountId !== null
          ? {
              accountId: ctx.cfg.paymentAccountId,
              paymentDate: source.paymentDate,
            }
          : null,
      buyer: source.buyer,
    });
    si = await client.post<JsonDocument>("sales_invoices", body);
    const id = si?.data?.id;
    if (!id)
      throw new ParasutError("Paraşüt fatura kimliği döndürmedi.", 0, {
        ambiguous: true,
      });
    await save({ salesInvoiceId: String(id), createStartedAt: "", contactId });
    ours = true;
  }
  // A create's answer without the totals: read it back before judging it.
  if (si && parasutMinor(si.data.attributes.net_total) === null) {
    si = await readSalesInvoice(client, row.salesInvoiceId);
  }
  if (!si) throw new ParasutError("Paraşüt faturası okunamadı.", 0);

  // The total, checked before anything is formalised.
  if (!totalsAgree(si.data.attributes.net_total, expected)) {
    const got = parasutMinor(si.data.attributes.net_total);
    if (opts.approved && !ours) {
      // A draft the person read and may have changed in Paraşüt: it stays.
      await release({
        status: "draft",
        lastError: `Kesinleştirilmedi: Paraşüt'teki taslağın tutarı ${got === null ? "okunamadı" : formatMinor(got)}, beklenen ${formatMinor(expected)}. Taslağı Paraşüt'te düzelt ya da "Taslağı yenile".`,
        nextAttemptAt: "",
      });
      return "draft";
    }
    await client.del(
      `sales_invoices/${encodeURIComponent(row.salesInvoiceId)}`,
    );
    await release({
      salesInvoiceId: "",
      status: "manual",
      manualCode: "amount_mismatch",
      manualReason: `Tutar tutmadı: Paraşüt ${got === null ? "tutar vermedi" : formatMinor(got)}, beklenen ${formatMinor(expected)}. Taslak silindi; faturayı Paraşüt'te elle kes.`,
      nextAttemptAt: "",
    });
    return "manual";
  }

  // 4. Draft mode stops here: a person reads the draft (the panel shows
  // its lines, Paraşüt the invoice) and formalises it. Their approval holds
  // for the draft they read only, never for one this run had to make; a
  // formalisation already under way (its e-Arşiv job posted, the post
  // counted before it went) goes on.
  const formalise =
    ctx.cfg.mode === "live" ||
    row.formalizePosts > 0 ||
    (opts.approved === true && !ours);
  if (!formalise) {
    await release({
      status: "draft",
      amountMinor: expected,
      kdvRows: linesKdvRows(lines),
      lastError: opts.approved
        ? "Paraşüt'te taslak bulunamadı; yeniden hazırlandı. Kontrol et, sonra kesinleştir."
        : "",
      nextAttemptAt: "",
      billingCity: billing.city,
      billingDistrict: billing.district,
      billingAddress: billing.address,
    });
    return "draft";
  }

  // 5. Formalise: an e-Fatura to a company registered at GİB (its inbox
  // is asked at every post, never cached: a company can register any day),
  // the e-Arşiv to anyone else.
  if (!row.jobId) {
    if (row.formalizePosts > 0 && row.jobPostedAt) {
      // A post whose job got lost (answer lost, or job expired before it
      // was read): Paraşüt may still be working on it.
      const age = ctx.deps.now().getTime() - Date.parse(row.jobPostedAt);
      if (age < JOB_TTL_MS) {
        await release({
          status: "formalizing",
          nextAttemptAt: new Date(
            Date.parse(row.jobPostedAt) + JOB_TTL_MS,
          ).toISOString(),
        });
        return "pending";
      }
      if (row.formalizePosts >= 2) {
        await release({
          status: "manual",
          manualCode: "parasut",
          manualReason:
            'e-Arşiv işi iki kez sonuçsuz kaldı. Faturayı Paraşüt\'te kontrol et: resmileşmişse numarasıyla "elle kestim" de, değilse resmileştir.',
          nextAttemptAt: "",
        });
        return "manual";
      }
    }
    const inbox =
      source.buyer.kind === "company"
        ? pickEInvoiceInbox(
            (
              await client.get<JsonList>("e_invoice_inboxes", {
                "filter[vkn]": source.buyer.taxNumber,
                "page[size]": 25,
              })
            )?.data ?? [],
          )
        : null;
    await save({
      jobPostedAt: ctx.nowIso(),
      formalizePosts: row.formalizePosts + 1,
    });
    const job = inbox
      ? await client.post<JsonDocument>(
          "e_invoices",
          eInvoiceBody({ salesInvoiceId: row.salesInvoiceId, to: inbox }),
        )
      : await client.post<JsonDocument>(
          "e_archives",
          eArchiveBody({
            salesInvoiceId: row.salesInvoiceId,
            siteUrl: ctx.deps.siteUrl,
            paymentDate: source.paymentDate,
            shipment: shipmentFor(
              plan.route,
              source.carrier,
              source.deliveredDay,
            ),
          }),
        );
    const jobId = job?.data?.id;
    if (!jobId)
      throw new ParasutError(
        "Paraşüt resmileştirme işinin kimliğini döndürmedi.",
        0,
        { ambiguous: true },
      );
    await save({ jobId: String(jobId) });
  }

  // 6. The job's result.
  for (let i = 0; i < POLLS; i += 1) {
    const job = await client.get<
      JsonDocument<{ status?: string; errors?: unknown }>
    >(`trackable_jobs/${encodeURIComponent(row.jobId)}`, {}, [404]);
    if (!job) {
      // Paraşüt forgets a job after 15 minutes.
      const age = ctx.deps.now().getTime() - Date.parse(row.jobPostedAt);
      if (age >= JOB_TTL_MS) {
        const fresh = await readSalesInvoice(client, row.salesInvoiceId);
        if (fresh && activeEDocument(fresh)) {
          return recordEDocument(
            ctx,
            client,
            row,
            fresh,
            save,
            release,
            summary,
            source,
            lines,
          );
        }
        await release({ jobId: "", status: "due", nextAttemptAt: "" });
        return "pending";
      }
    } else {
      const outcome = jobOutcome(job.data.attributes.status);
      if (outcome === "done") break;
      if (outcome === "error") {
        const errors = Array.isArray(job.data.attributes.errors)
          ? job.data.attributes.errors.map((e) => maskText(String(e)))
          : [];
        const text = `Resmileştirme işi hata verdi: ${errors.join("; ") || "Paraşüt nedenini söylemedi"}`;
        if (ctx.cfg.mode !== "live") {
          // Back to the person who asked for it, with Paraşüt's reason.
          await release({
            status: "draft",
            lastError: text,
            jobId: "",
            jobPostedAt: "",
            formalizePosts: 0,
            nextAttemptAt: "",
          });
          return "draft";
        }
        return failRow(
          row,
          release,
          text,
          false,
          { jobId: "", jobPostedAt: "", formalizePosts: 0 },
          ctx.deps.now().getTime(),
        );
      }
    }
    if (i === POLLS - 1 || client.timeLeft() < ROW_RESERVE_MS) {
      await release({
        status: "formalizing",
        nextAttemptAt: new Date(
          ctx.deps.now().getTime() + 60_000,
        ).toISOString(),
      });
      return "pending";
    }
    await ctx.deps.sleep(POLL_GAP_MS);
  }

  // 7. The e-document's number and ETTN.
  for (let i = 0; i < 3; i += 1) {
    const done = await readSalesInvoice(client, row.salesInvoiceId);
    if (done && activeEDocument(done)) {
      return recordEDocument(
        ctx,
        client,
        row,
        done,
        save,
        release,
        summary,
        source,
        lines,
      );
    }
    if (i < 2) await ctx.deps.sleep(1_500);
  }
  await release({
    status: "formalizing",
    nextAttemptAt: new Date(ctx.deps.now().getTime() + 60_000).toISOString(),
  });
  return "pending";
}

function activeEDocument(
  si: JsonDocument,
): { id: string; type: string } | null {
  const rel = si.data.relationships?.active_e_document?.data;
  return rel && !Array.isArray(rel) && rel.id
    ? { id: String(rel.id), type: String(rel.type) }
    : null;
}

async function readSalesInvoice(
  client: InvoiceClient,
  id: string,
): Promise<JsonDocument | null> {
  return client.get<JsonDocument>(
    `sales_invoices/${encodeURIComponent(id)}`,
    { include: "active_e_document" },
    [404],
  );
}

async function findByMarker(
  client: InvoiceClient,
  contactId: string,
  day: string,
  marker: string,
): Promise<JsonResource[]> {
  if (!contactId || !day) return [];
  const list = await client.get<JsonList>("sales_invoices", {
    "filter[contact_id]": contactId,
    "filter[issue_date]": day,
    "page[size]": 25,
  });
  return (list?.data ?? []).filter(
    (r) =>
      String(r.attributes.description ?? "") === marker &&
      r.attributes.item_type !== "cancelled",
  );
}

/** Stores the e-document's ids, number and ETTN; then the mail. */
async function recordEDocument(
  ctx: Ctx,
  client: InvoiceClient,
  row: InvoiceRow,
  si: JsonDocument,
  save: (p: InvoicePatch) => Promise<void>,
  release: (p: InvoicePatch) => Promise<void>,
  summary: RunSummary,
  source: Source,
  lines?: InvoiceLine[] | null,
): Promise<Step> {
  const ref = activeEDocument(si)!;
  const included = (si.included ?? []).find(
    (r) => r.type === ref.type && String(r.id) === ref.id,
  );
  const attrs = (included?.attributes ?? {}) as {
    invoice_number?: string;
    uuid?: string;
  };
  const invoiceNo = String(
    attrs.invoice_number ?? si.data.attributes.invoice_no ?? "",
  );
  const now = ctx.nowIso();
  const patch: InvoicePatch = {
    eDocumentId: ref.id,
    eDocumentType: ref.type,
    invoiceNo,
    uuid: String(attrs.uuid ?? ""),
    issuedAt: now,
    jobId: "",
    lastError: "",
    manualCode: "",
    manualReason: "",
    nextAttemptAt: now,
    ...(lines
      ? { amountMinor: expectedTotalMinor(lines), kdvRows: linesKdvRows(lines) }
      : {}),
  };
  await save(patch);
  summary.issued += 1;
  return mailRow(
    ctx,
    client,
    { ...row, ...patch } as InvoiceRow,
    save,
    release,
    summary,
    source,
  );
}

/** The PDF, downloaded and mailed to the buyer; the row is then issued. */
async function mailRow(
  ctx: Ctx,
  client: InvoiceClient,
  row: InvoiceRow,
  save: (p: InvoicePatch) => Promise<void>,
  release: (p: InvoicePatch) => Promise<void>,
  summary: RunSummary,
  known?: Source,
): Promise<Step> {
  if (row.emailedAt) {
    await release({ status: "issued", nextAttemptAt: "" });
    return "issued";
  }
  if (row.eDocumentType === "e_invoices") {
    // GİB delivered the e-Fatura to the buyer's inbox: no mail of ours.
    await release({ status: "issued", nextAttemptAt: "", emailError: "" });
    return "issued";
  }
  const source = known ?? (await loadSource(ctx, row));
  const to = invoiceRecipient(source?.email);
  if (!source || !to) {
    await release({
      status: "issued",
      nextAttemptAt: "",
      emailError:
        "Alıcının geçerli bir e-posta adresi yok; PDF'i panelden indirip ilet.",
    });
    return "issued";
  }
  const attempt = row.emailAttempts + 1;
  const giveUp = (error: string) =>
    release({
      status: "issued",
      emailAttempts: attempt,
      emailError: maskText(error),
      nextAttemptAt:
        attempt >= MAX_EMAIL_ATTEMPTS
          ? ""
          : new Date(
              ctx.deps.now().getTime() + retryDelayMs(attempt),
            ).toISOString(),
    });
  const url = await client.pdfUrl(
    row.eDocumentType || "e_archives",
    row.eDocumentId,
  );
  if (!url) {
    await giveUp("Paraşüt PDF'i henüz hazırlamadı.");
    return "issued";
  }
  const pdf = await client.downloadPdf(url);
  const sent = await ctx.deps.mail({
    to,
    customerName: source.name,
    kind: row.sourceKind,
    ref: source.ref,
    orderNo: source.orderNo,
    invoiceNo: row.invoiceNo,
    invoiceDay: dayLabel(istanbulDay(row.issuedAt || ctx.nowIso())),
    amountMinor: row.amountMinor,
    pdfBase64: pdf.toString("base64"),
    filename: invoicePdfName(row),
    idempotencyKey: `earsiv-${row.id}`,
  });
  if (!sent.ok) {
    await giveUp(`E-posta gönderilemedi: ${sent.error}`);
    return "issued";
  }
  await release({
    status: "issued",
    emailedAt: ctx.nowIso(),
    emailError: "",
    nextAttemptAt: "",
  });
  summary.emailed += 1;
  return "issued";
}

async function failRow(
  row: InvoiceRow,
  release: (p: InvoicePatch) => Promise<void>,
  error: string,
  keepAttempts: boolean,
  extra: InvoicePatch = {},
  now = Date.now(),
): Promise<Step> {
  const attempts = keepAttempts ? row.attempts : row.attempts + 1;
  const text = maskText(error);
  if (attempts >= MAX_ATTEMPTS) {
    await release({
      ...extra,
      attempts,
      lastError: text,
      status: "manual",
      manualCode: "attempts",
      manualReason: `${MAX_ATTEMPTS} denemede kesilemedi. Son hata: ${text}`,
      nextAttemptAt: "",
    });
    return "manual";
  }
  await release({
    ...extra,
    attempts,
    lastError: text,
    status: "failed",
    nextAttemptAt: new Date(now + retryDelayMs(attempts)).toISOString(),
  });
  return "failed";
}

// ─── Contacts and products ─────────────────────────────────────────────────

async function ensureContact(
  ctx: Ctx,
  client: InvoiceClient,
  c: ContactInput,
): Promise<string> {
  const { store } = ctx.deps;
  // The e-mail for a consumer, `vkn:<number>` for a company.
  const email = contactCacheKey(c);
  const print = contactFingerprint(c);
  const cached = email ? await store.contact(client.companyId, email) : null;
  if (cached) {
    if (cached.fingerprint === print) return cached.contactId;
    const updated = await client
      .put<JsonDocument>(
        `contacts/${encodeURIComponent(cached.contactId)}`,
        contactBody(c, cached.contactId),
      )
      .catch((e: unknown) => {
        // A contact deleted in Paraşüt: a new one below.
        if (e instanceof ParasutError && e.status === 404) return null;
        throw e;
      });
    if (updated?.data?.id) {
      await store.saveContact(client.companyId, email, cached.contactId, print);
      return cached.contactId;
    }
  }
  const created = await client.post<JsonDocument>("contacts", contactBody(c));
  const id = created?.data?.id;
  if (!id)
    throw new ParasutError("Paraşüt müşteri kimliği döndürmedi.", 0, {
      ambiguous: true,
    });
  if (email)
    await store.saveContact(client.companyId, email, String(id), print);
  return String(id);
}

async function ensureProduct(
  ctx: Ctx,
  client: InvoiceClient,
  line: InvoiceLine,
): Promise<string> {
  const { store } = ctx.deps;
  const key = `parasut.product.${client.companyId}.${line.productCode}`;
  const cached = await store.readState<{ id?: string }>(key);
  if (cached?.id) return cached.id;
  const list = await client.get<JsonList>("products", {
    "filter[code]": line.productCode,
  });
  const hit = (list?.data ?? []).find(
    (p) => String(p.attributes.code ?? "") === line.productCode,
  );
  let id = hit ? String(hit.id) : "";
  if (!id) {
    const created = await client.post<JsonDocument>(
      "products",
      productBody(line.group, line.vatRate),
    );
    id = created?.data?.id ? String(created.data.id) : "";
  }
  if (!id) throw new ParasutError("Paraşüt ürün kimliği döndürmedi.", 0);
  await store.writeState(key, { id });
  return id;
}

/** Where an error out of processRow leaves the held row. */
type Settled =
  | { kind: "lost" }
  | { kind: "deadline" }
  | { kind: "auth"; message: string }
  | { kind: "step"; step: Step; message: string };

/**
 * Puts a row whose processing threw back where it can resume: the ids
 * written before the error stay (the row is read again), a deadline sends it
 * back to the queue untouched, a refused login waits, an issued invoice only
 * retries its mail, anything else counts as a failed attempt.
 */
async function settleError(
  deps: InvoiceDeps,
  held: InvoiceRow,
  err: unknown,
): Promise<Settled> {
  if (err instanceof LostClaim) return { kind: "lost" };
  const release = (patch: InvoicePatch) =>
    deps.store.updateClaimed(held.id, held.claimedAt, {
      ...patch,
      claimedAt: "",
      updatedAt: deps.now().toISOString(),
    });
  const [current] = await deps.store.rowsForSources(held.sourceKind, [
    held.sourceId,
  ]);
  const row =
    current &&
    current.status === "working" &&
    current.claimedAt === held.claimedAt
      ? current
      : held;
  if (err instanceof ParasutDeadlineError) {
    await release({
      status: resumeStatus(row),
      nextAttemptAt: row.eDocumentId ? deps.now().toISOString() : "",
    });
    return { kind: "deadline" };
  }
  const message = maskText(err instanceof Error ? err.message : String(err));
  console.error(
    `[earsiv] ${held.sourceKind} ${held.sourceLabel || held.sourceId}: ${message}`,
  );
  if (err instanceof ParasutAuthError) {
    await release({
      status: resumeStatus(row),
      lastError: message,
      nextAttemptAt: new Date(
        deps.now().getTime() + retryDelayMs(1),
      ).toISOString(),
    });
    return { kind: "auth", message };
  }
  if (row.eDocumentId) {
    // The invoice exists; only the mail failed.
    const attempt = row.emailAttempts + 1;
    await release({
      status: "issued",
      emailAttempts: attempt,
      emailError: message,
      nextAttemptAt:
        attempt >= MAX_EMAIL_ATTEMPTS
          ? ""
          : new Date(
              deps.now().getTime() + retryDelayMs(attempt),
            ).toISOString(),
    });
    return { kind: "step", step: "issued", message };
  }
  const step = await failRow(
    row,
    async (p) => void (await release(p)),
    message,
    false,
    {},
    deps.now().getTime(),
  );
  return { kind: "step", step, message };
}

// ─── The run ───────────────────────────────────────────────────────────────

export async function runInvoicesWith(
  deps: InvoiceDeps,
  opts: RunOptions,
): Promise<RunSummary> {
  const status = earsivConfigStatus(deps.env);
  const started = deps.now();
  const summary = emptySummary(opts.reason, status.mode, started.toISOString());
  if (status.mode === "off") {
    summary.errors = status.errors;
    return summary;
  }
  if (!status.config) {
    summary.errors = status.errors;
    await deps.store.writeState(LAST_RUN_KEY, summary).catch(() => undefined);
    return summary;
  }
  const cfg = status.config;
  const deadline = started.getTime() + opts.budgetMs;
  const ctx: Ctx = {
    deps,
    cfg,
    carriers: await deps.store.carriers(),
    nowIso: () => deps.now().toISOString(),
  };

  try {
    await syncInvoices(
      ctx,
      summary,
      opts.orderId ? { orderId: opts.orderId } : undefined,
    );
  } catch (err) {
    console.error(
      "[earsiv] sweep failed",
      err instanceof Error ? maskText(err.message) : err,
    );
    summary.errors.push("Sipariş ve rezervasyonlar taranamadı.");
  }

  const client = deps.client(cfg);
  client.setDeadline(deadline);
  const limit = opts.limit ?? 40;
  let authFailed = false;
  while (summary.processed < limit && !authFailed) {
    if (deadline - deps.now().getTime() < ROW_RESERVE_MS) {
      summary.more = true;
      break;
    }
    const now = deps.now();
    const [held] = await deps.store.claim(
      now.toISOString(),
      new Date(now.getTime() - STALE_CLAIM_MS).toISOString(),
      cfg.mode === "live",
      1,
    );
    if (!held) break;
    summary.processed += 1;
    try {
      const step = await processRow(ctx, client, held, summary);
      if (step === "draft") summary.drafts += 1;
      if (step === "manual") summary.manual += 1;
      if (step === "failed") summary.failed += 1;
    } catch (err) {
      const settled = await settleError(deps, held, err);
      if (settled.kind === "lost") continue;
      if (settled.kind === "deadline") {
        summary.more = true;
        break;
      }
      if (settled.kind === "auth") {
        authFailed = true;
        summary.errors.push(settled.message);
        break;
      }
      if (settled.step === "manual") summary.manual += 1;
      if (settled.step === "failed") summary.failed += 1;
    }
  }
  await deps.store.writeState(LAST_RUN_KEY, summary).catch((err: unknown) => {
    console.error("[earsiv] run summary not stored", err);
  });
  return summary;
}

/** A person's button on one invoice row (docs/EARSIV.md "Panel"). */
export type RowAction = "cut" | "formalize" | "rebuild";

/** The statuses each button takes a row from; any other is refused. */
const ROW_ACTION_FROM: Record<RowAction, InvoiceRow["status"][]> = {
  // "Faturayı kes": a draft in draft mode, the e-Arşiv in live mode.
  cut: ["due", "failed"],
  // "Faturayı kesinleştir": the draft the person has read.
  formalize: ["draft"],
  // "Taslağı yenile": that draft deleted and prepared again, dated today.
  rebuild: ["draft"],
};

export interface RowRunOptions {
  id: string;
  action: RowAction;
  budgetMs: number;
}

export interface RowRunResult {
  mode: EarsivMode;
  /** False when the row was not in a state the action takes, or held. */
  taken: boolean;
  step: Step | null;
  /** What went wrong, in Turkish and masked; null when nothing did. */
  error: string | null;
}

/**
 * One row, now, for a person: claimed by id (only from the statuses its
 * action takes), walked through the same steps as the queue, settled the
 * same way when something throws. Nothing else is swept or claimed.
 */
export async function runInvoiceRowWith(
  deps: InvoiceDeps,
  opts: RowRunOptions,
): Promise<RowRunResult> {
  const status = earsivConfigStatus(deps.env);
  if (status.mode === "off" || !status.config) {
    return {
      mode: status.mode,
      taken: false,
      step: null,
      error: status.errors[0] ?? null,
    };
  }
  const cfg = status.config;
  const started = deps.now();
  const held = await deps.store.claimRow(
    opts.id,
    started.toISOString(),
    ROW_ACTION_FROM[opts.action],
  );
  if (!held) return { mode: cfg.mode, taken: false, step: null, error: null };
  const ctx: Ctx = {
    deps,
    cfg,
    carriers: await deps.store.carriers(),
    nowIso: () => deps.now().toISOString(),
  };
  const client = deps.client(cfg);
  client.setDeadline(started.getTime() + opts.budgetMs);
  const summary = emptySummary("admin", cfg.mode, started.toISOString());
  try {
    const step = await processRow(ctx, client, held, summary, {
      approved: opts.action === "formalize",
      rebuild: opts.action === "rebuild",
    });
    return { mode: cfg.mode, taken: true, step, error: null };
  } catch (err) {
    const settled = await settleError(deps, held, err);
    switch (settled.kind) {
      case "lost":
        return {
          mode: cfg.mode,
          taken: true,
          step: null,
          error: "Kaydı bu arada başka bir çalıştırma aldı. Sayfayı yenile.",
        };
      case "deadline":
        return { mode: cfg.mode, taken: true, step: "pending", error: null };
      case "auth":
        return {
          mode: cfg.mode,
          taken: true,
          step: null,
          error: settled.message,
        };
      default:
        return {
          mode: cfg.mode,
          taken: true,
          step: settled.step,
          error: settled.message,
        };
    }
  }
}

/** Codes a manual row may carry, for the panel's filter. */
export type { ManualCode };

/** The production wiring. */
async function productionDeps(): Promise<InvoiceDeps> {
  const [{ dbInvoiceStore }, { SITE }, { sendInvoiceEmail }] =
    await Promise.all([
      import("./store"),
      import("@/lib/seo/site"),
      import("@/lib/email/send"),
    ]);
  return {
    env: process.env,
    production: process.env.NODE_ENV === "production",
    now: () => new Date(),
    store: dbInvoiceStore,
    client: (cfg) =>
      new ParasutClient(cfg.parasut, { tokens: dbInvoiceStore.tokens }),
    mail: sendInvoiceEmail,
    siteUrl: SITE.url,
    karaokeRate: async () => {
      try {
        const { getSettings } = await import("@/lib/admin/store");
        const s = await getSettings();
        return s.taxRates?.karaoke ?? LEGAL_TAX_RATES.karaoke;
      } catch {
        return LEGAL_TAX_RATES.karaoke;
      }
    },
    sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
  };
}

export async function runInvoices(opts: RunOptions): Promise<RunSummary> {
  const status = earsivConfigStatus(process.env);
  if (status.mode === "off") {
    return emptySummary(opts.reason, "off", new Date().toISOString());
  }
  return runInvoicesWith(await productionDeps(), opts);
}

export async function runInvoiceRow(
  opts: RowRunOptions,
): Promise<RowRunResult> {
  const status = earsivConfigStatus(process.env);
  if (status.mode === "off") {
    return { mode: "off", taken: false, step: null, error: null };
  }
  return runInvoiceRowWith(await productionDeps(), opts);
}

export type { KaraokeReservation };
