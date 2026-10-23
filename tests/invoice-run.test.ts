import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AdminOrder } from "@/lib/admin/store";
import {
  vatOfNet,
  type CarrierEntry,
  type InvoicePayment,
  type InvoiceRow,
} from "@/lib/invoice/invoice-core";
import { ParasutError } from "@/lib/invoice/parasut-client";
import {
  runInvoiceRowWith,
  runInvoicesWith,
  type InvoiceDeps,
  type InvoiceMail,
  type RowAction,
} from "@/lib/invoice/run";
import type { InvoicePatch, InvoiceStore } from "@/lib/invoice/store";
import { LEGAL_ENTITY } from "@/lib/legal/entity";
import type { KaraokeReservation } from "@/lib/mobile/karaoke-core";

/**
 * The e-Arşiv run (src/lib/invoice/run.ts) with an in-memory database and
 * a scripted Paraşüt: each id written the moment it is known, a run that
 * dies resumes without a second invoice, a total that does not agree
 * deletes the draft and hands the row to a person, draft mode never
 * formalises or mails, EARSIV_START_AT is respected, and off does nothing.
 */

const LIVE_ENV = {
  EARSIV_MODE: "live",
  EARSIV_START_AT: "2026-10-22T00:00:00+03:00",
  PARASUT_CLIENT_ID: "cid",
  PARASUT_CLIENT_SECRET: "cs",
  PARASUT_USERNAME: "site@laffogato.net",
  PARASUT_PASSWORD: "pw",
  PARASUT_COMPANY_ID: "123",
};

let clock = Date.parse("2026-10-22T12:00:00.000Z");
const events: string[] = [];

// ─── An in-memory InvoiceStore, claim included ──────────────────────────────

class MemoryStore implements InvoiceStore {
  orders = new Map<string, AdminOrder>();
  bookings = new Map<string, KaraokeReservation>();
  payments = new Map<string, InvoicePayment[]>();
  rows = new Map<string, InvoiceRow>();
  state = new Map<string, unknown>();
  contacts = new Map<string, { contactId: string; fingerprint: string }>();
  flagged: string[] = [];
  carrierList: CarrierEntry[] = [];
  calls: string[] = [];

  private note(name: string) {
    this.calls.push(name);
  }
  async recentPaidOrders(since: string) {
    this.note("recentPaidOrders");
    return [...this.orders.values()].filter(
      (o) => (o.paidAt ?? "") >= since && o.source !== "manual",
    );
  }
  async ordersByIds(ids: readonly string[]) {
    this.note("ordersByIds");
    return ids
      .map((id) => this.orders.get(id))
      .filter((o): o is AdminOrder => Boolean(o))
      .map((o) => structuredClone(o));
  }
  async recentPaidBookings() {
    this.note("recentPaidBookings");
    return [...this.bookings.values()];
  }
  async bookingsByIds(ids: readonly string[]) {
    this.note("bookingsByIds");
    return ids
      .map((id) => this.bookings.get(id))
      .filter((b): b is KaraokeReservation => Boolean(b));
  }
  async paymentsFor(ids: readonly string[]) {
    this.note("paymentsFor");
    return new Map(ids.map((id) => [id, this.payments.get(id) ?? []]));
  }
  async couponSources() {
    this.note("couponSources");
    return new Map<number, string>();
  }
  async rowsForSources(kind: string, ids: readonly string[]) {
    this.note("rowsForSources");
    return [...this.rows.values()]
      .filter((r) => r.sourceKind === kind && ids.includes(r.sourceId))
      .map((r) => ({ ...r }));
  }
  async openRows() {
    this.note("openRows");
    return [...this.rows.values()]
      .filter((r) => !["issued", "manual_done", "skipped"].includes(r.status))
      .map((r) => ({ ...r }));
  }
  async insertRow(row: InvoiceRow) {
    this.note("insertRow");
    if (
      [...this.rows.values()].some(
        (r) => r.sourceKind === row.sourceKind && r.sourceId === row.sourceId,
      )
    )
      return false;
    this.rows.set(row.id, { ...row });
    events.push(`db:insert:${row.status}`);
    return true;
  }
  async updateRow(
    row: Pick<InvoiceRow, "id" | "updatedAt">,
    patch: InvoicePatch,
  ) {
    this.note("updateRow");
    const cur = this.rows.get(row.id);
    if (!cur || cur.updatedAt !== row.updatedAt) return false;
    this.rows.set(row.id, {
      ...cur,
      ...patch,
      updatedAt: patch.updatedAt ?? new Date(clock).toISOString(),
    } as InvoiceRow);
    return true;
  }
  async claim(now: string, staleBefore: string, live: boolean, limit: number) {
    this.note("claim");
    const picked = [...this.rows.values()]
      .filter(
        (i) =>
          (["waiting", "due", "failed", "formalizing"].includes(i.status) &&
            i.dueAt !== "" &&
            i.dueAt <= now &&
            (i.nextAttemptAt === "" || i.nextAttemptAt <= now)) ||
          (i.status === "draft" &&
            live &&
            (i.nextAttemptAt === "" || i.nextAttemptAt <= now)) ||
          (i.status === "issued" &&
            i.emailedAt === "" &&
            i.nextAttemptAt !== "" &&
            i.nextAttemptAt <= now) ||
          (i.status === "working" &&
            i.claimedAt !== "" &&
            i.claimedAt < staleBefore),
      )
      .sort((a, b) => a.deadlineAt.localeCompare(b.deadlineAt))
      .slice(0, limit);
    for (const r of picked)
      this.rows.set(r.id, {
        ...r,
        status: "working",
        claimedAt: now,
        updatedAt: now,
      });
    return picked.map((r) => ({ ...this.rows.get(r.id)! }));
  }
  async claimRow(
    id: string,
    now: string,
    statuses: readonly InvoiceRow["status"][],
  ) {
    this.note("claimRow");
    const cur = this.rows.get(id);
    if (!cur || !statuses.includes(cur.status)) return null;
    const held = {
      ...cur,
      status: "working" as const,
      claimedAt: now,
      updatedAt: now,
    };
    this.rows.set(id, held);
    return { ...held };
  }
  async updateClaimed(id: string, claimedAt: string, patch: InvoicePatch) {
    this.note("updateClaimed");
    const cur = this.rows.get(id);
    if (!cur || cur.status !== "working" || cur.claimedAt !== claimedAt)
      return false;
    this.rows.set(id, { ...cur, ...patch } as InvoiceRow);
    for (const k of Object.keys(patch)) {
      const v = (patch as Record<string, unknown>)[k];
      if (
        [
          "contactId",
          "salesInvoiceId",
          "jobId",
          "eDocumentId",
          "status",
          "createStartedAt",
          "jobPostedAt",
          "emailedAt",
        ].includes(k)
      ) {
        events.push(`db:${k}=${String(v)}`);
      }
    }
    return true;
  }
  async carriers() {
    return this.carrierList;
  }
  async readState<T>(key: string) {
    return (this.state.get(key) as T) ?? null;
  }
  async writeState(key: string, value: unknown) {
    this.state.set(key, value);
  }
  async contact(companyId: string, email: string) {
    return this.contacts.get(`${companyId}:${email}`) ?? null;
  }
  async saveContact(
    companyId: string,
    email: string,
    contactId: string,
    fingerprint: string,
  ) {
    this.contacts.set(`${companyId}:${email}`, { contactId, fingerprint });
  }
  async flagOrderRefund(orderId: string) {
    this.flagged.push(orderId);
    return true;
  }
  tokens = {
    read: async () => null,
    write: async () => undefined,
    lease: async () => true,
  };

  row(): InvoiceRow {
    const [r] = [...this.rows.values()];
    return r;
  }
}

// ─── A scripted Paraşüt ────────────────────────────────────────────────────

type Doc = {
  id: string;
  type: string;
  attributes: Record<string, unknown>;
  relationships?: Record<string, unknown>;
};

class FakeParasut {
  companyId = "123";
  seq = 100;
  invoices = new Map<
    string,
    {
      attrs: Record<string, unknown>;
      contactId: string;
      eDoc: { id: string; type: string; number: string; uuid: string } | null;
    }
  >();
  jobs = new Map<
    string,
    { invoiceId: string; type: string; script: string[]; errors: string[] }
  >();
  /** GİB's e-Fatura users: VKN → inbox address. */
  inboxes = new Map<string, string>();
  /** Statuses each new job reports, poll after poll. */
  jobScript = ["running", "done"];
  jobErrors: string[] = [];
  /** Added to the computed net_total (TL). */
  netDelta = 0;
  /** Throw an ambiguous error on this POST path, after applying it. */
  loseAnswerOf: string | null = null;
  /** Throw on this POST path without applying it. */
  failPost: string | null = null;
  posts: Array<{ path: string; body: unknown }> = [];
  deletes: string[] = [];
  pdfFails = false;

  setDeadline() {}
  timeLeft() {
    return 120_000;
  }
  private id() {
    return String(++this.seq);
  }
  private doc(id: string): Doc {
    const inv = this.invoices.get(id)!;
    return {
      id,
      type: "sales_invoices",
      attributes: inv.attrs,
      relationships: {
        active_e_document: {
          data: inv.eDoc ? { id: inv.eDoc.id, type: inv.eDoc.type } : null,
        },
      },
    };
  }
  async get<T>(
    path: string,
    query: Record<string, string | number | undefined> = {},
  ): Promise<T | null> {
    events.push(`api:GET ${path.split("/")[0]}`);
    if (path === "products") return { data: [] } as T;
    if (path === "e_invoice_inboxes") {
      const vkn = String(query["filter[vkn]"] ?? "");
      const address = this.inboxes.get(vkn);
      return {
        data: address
          ? [
              {
                id: "1",
                type: "e_invoice_inboxes",
                attributes: {
                  vkn,
                  e_invoice_address: address,
                  address_registered_at: "2024-05-01T00:00:00Z",
                },
              },
            ]
          : [],
      } as T;
    }
    if (path === "sales_invoices") {
      const data = [...this.invoices.entries()]
        .filter(
          ([, v]) =>
            v.contactId === query["filter[contact_id]"] &&
            v.attrs.issue_date === query["filter[issue_date]"],
        )
        .map(([id]) => this.doc(id));
      return { data } as T;
    }
    const m = /^sales_invoices\/(\d+)$/.exec(path);
    if (m) {
      const inv = this.invoices.get(m[1]);
      if (!inv) return null;
      return {
        data: this.doc(m[1]),
        included: inv.eDoc
          ? [
              {
                id: inv.eDoc.id,
                type: inv.eDoc.type,
                attributes: {
                  invoice_number: inv.eDoc.number,
                  uuid: inv.eDoc.uuid,
                },
              },
            ]
          : [],
      } as T;
    }
    const j = /^trackable_jobs\/(\d+)$/.exec(path);
    if (j) {
      const job = this.jobs.get(j[1]);
      if (!job) return null;
      const status =
        job.script.length > 1 ? job.script.shift()! : job.script[0];
      if (status === "done") this.formalize(job.invoiceId, job.type);
      return {
        data: {
          id: j[1],
          type: "trackable_jobs",
          attributes: { status, errors: status === "error" ? job.errors : [] },
        },
      } as T;
    }
    throw new Error(`fake GET ${path}`);
  }
  private formalize(invoiceId: string, type = "e_archives") {
    const inv = this.invoices.get(invoiceId)!;
    inv.eDoc ??= {
      id: `ea${invoiceId}`,
      type,
      number: `GIB2026${invoiceId.padStart(9, "0")}`,
      uuid: `uuid-${invoiceId}`,
    };
  }
  async post<T>(path: string, body: unknown): Promise<T | null> {
    events.push(`api:POST ${path}`);
    this.posts.push({ path, body });
    if (this.failPost === path) {
      this.failPost = null;
      throw new ParasutError("Paraşüt'e bağlanılamadı.", 0, {
        ambiguous: true,
      });
    }
    const id = this.id();
    let out: Doc;
    const data = (
      body as {
        data: Doc & { relationships?: Record<string, { data: unknown }> };
      }
    ).data;
    if (path === "sales_invoices") {
      const details = (
        data.relationships!.details.data as Array<{
          attributes: Record<string, number>;
        }>
      ).map((d) => d.attributes);
      const kurus = details.reduce((s, d) => {
        const net = Math.round(
          (d.quantity * d.unit_price - (d.discount_value ?? 0)) * 100,
        );
        return s + net + vatOfNet(net, d.vat_rate);
      }, 0);
      const attrs = {
        ...data.attributes,
        net_total: (kurus / 100 + this.netDelta).toFixed(2),
      };
      const contactId = (data.relationships!.contact.data as { id: string }).id;
      this.invoices.set(id, { attrs, contactId, eDoc: null });
      out = this.doc(id);
    } else if (path === "e_archives" || path === "e_invoices") {
      const rel =
        path === "e_archives"
          ? data.relationships!.sales_invoice
          : data.relationships!.invoice;
      const invoiceId = (rel.data as { id: string }).id;
      this.jobs.set(id, {
        invoiceId,
        type: path,
        script: [...this.jobScript],
        errors: [...this.jobErrors],
      });
      out = { id, type: "trackable_jobs", attributes: { status: "pending" } };
    } else {
      out = { id, type: path, attributes: data.attributes };
    }
    if (this.loseAnswerOf === path) {
      this.loseAnswerOf = null;
      throw new ParasutError("Paraşüt 15 saniye içinde yanıt vermedi.", 0, {
        ambiguous: true,
      });
    }
    return { data: out } as T;
  }
  async put<T>(path: string, body: unknown): Promise<T | null> {
    events.push(`api:PUT ${path.split("/")[0]}`);
    return { data: { ...(body as { data: Doc }).data } } as T;
  }
  async del(path: string): Promise<void> {
    events.push(`api:DELETE ${path.split("/")[0]}`);
    this.deletes.push(path);
    this.invoices.delete(path.split("/")[1]);
  }
  async pdfUrl() {
    events.push("api:pdf");
    return this.pdfFails ? null : "https://files.parasut.test/x.pdf";
  }
  async downloadPdf() {
    return Buffer.from("%PDF-1.7");
  }
}

// ─── Fixtures ───────────────────────────────────────────────────────────────

function anOrder(over: Partial<AdminOrder> = {}): AdminOrder {
  return {
    id: "ord-1",
    orderNo: 10234,
    customerName: "Eda Mancuso",
    customerEmail: "eda@example.com",
    customerPhone: "+90 532 123 45 67",
    shippingAddress: "",
    internalNote: "",
    status: "shipped",
    items: [
      {
        productName: "Affogato",
        qty: 3,
        unitPriceMinor: 9_000,
        status: "ready",
        taxRatePct: 10,
      },
    ],
    subtotalMinor: 27_000,
    discountMinor: 0,
    promoCode: "",
    shippingMinor: 0,
    totalMinor: 27_000,
    refunds: [],
    createdAt: "2026-10-22T08:00:00.000Z",
    paidAt: "2026-10-22T08:01:00.000Z",
    shippedAt: "2026-10-22T08:20:00.000Z",
    channel: "app",
    kind: "cafe",
    fulfillment: "pickup",
    source: "",
    ...over,
  } as AdminOrder;
}

let store: MemoryStore;
let parasut: FakeParasut;
let mails: InvoiceMail[];
let mailResult: { ok: true } | { ok: false; error: string };

function deps(env: Record<string, string | undefined> = LIVE_ENV): InvoiceDeps {
  return {
    env,
    production: true,
    now: () => new Date(clock),
    store,
    client: () => parasut,
    mail: async (m) => {
      events.push("mail");
      mails.push(m);
      return mailResult;
    },
    siteUrl: "https://laffogato.net",
    karaokeRate: async () => 20,
    sleep: async () => undefined,
  };
}

const run = (
  env?: Record<string, string | undefined>,
  opts: Partial<Parameters<typeof runInvoicesWith>[1]> = {},
) => runInvoicesWith(deps(env), { budgetMs: 120_000, reason: "cron", ...opts });

beforeEach(() => {
  clock = Date.parse("2026-10-22T12:00:00.000Z");
  events.length = 0;
  store = new MemoryStore();
  parasut = new FakeParasut();
  mails = [];
  mailResult = { ok: true };
  store.orders.set("ord-1", anOrder());
  store.payments.set("ord-1", [{ provider: "paynkolay", status: "succeeded" }]);
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

describe("off and misconfigured", () => {
  it("does nothing at all while EARSIV_MODE is off: no database, no Paraşüt", async () => {
    const client = vi.fn();
    const r = await runInvoicesWith(
      { ...deps({}), client },
      { budgetMs: 120_000, reason: "cron" },
    );
    expect(r.mode).toBe("off");
    expect(store.calls).toEqual([]);
    expect(client).not.toHaveBeenCalled();
  });

  it("without EARSIV_START_AT records the error and invoices nothing", async () => {
    const env: Record<string, string | undefined> = {
      ...LIVE_ENV,
      EARSIV_START_AT: undefined,
    };
    const r = await run(env);
    expect(r.errors.join(" ")).toContain("EARSIV_START_AT");
    expect(store.calls).toEqual([]);
    expect(store.state.get("run.last")).toMatchObject({
      mode: "live",
      processed: 0,
    });
    expect(parasut.posts).toEqual([]);
  });

  it("leaves an order paid before EARSIV_START_AT alone (it was cut by hand)", async () => {
    store.orders.set("ord-1", anOrder({ paidAt: "2026-10-21T20:00:00.000Z" }));
    await run();
    expect(store.rows.size).toBe(0);
    expect(parasut.posts).toEqual([]);
  });
});

describe("live: one order from row to mailed PDF", () => {
  it("writes each Paraşüt id the moment it has it, then mails the PDF", async () => {
    const r = await run();
    expect(r).toMatchObject({
      created: 1,
      processed: 1,
      issued: 1,
      emailed: 1,
    });
    const row = store.row();
    expect(row).toMatchObject({
      status: "issued",
      invoiceNo: expect.stringMatching(/^GIB2026/),
      uuid: expect.stringMatching(/^uuid-/),
      amountMinor: 27_000,
      route: "pickup",
      billingCity: "İstanbul",
      billingDistrict: "Tuzla",
    });
    expect(row.emailedAt).not.toBe("");
    expect(row.kdvRows).toEqual([
      { ratePct: 10, grossMinor: 27_000, netMinor: 24_545, taxMinor: 2_455 },
    ]);
    const order = (s: string) => events.indexOf(s);
    expect(order("db:contactId=101")).toBeLessThan(
      order("api:POST sales_invoices"),
    );
    expect(order("api:POST sales_invoices")).toBeLessThan(
      events.findIndex((e) => e.startsWith("db:salesInvoiceId=1")),
    );
    expect(
      events.findIndex((e) => e.startsWith("db:salesInvoiceId=1")),
    ).toBeLessThan(order("api:POST e_archives"));
    expect(order("api:POST e_archives")).toBeLessThan(
      events.findIndex((e) => e.startsWith("db:jobId=1")),
    );
    expect(
      events.findIndex((e) => e.startsWith("db:eDocumentId=")),
    ).toBeLessThan(order("mail"));
    // The mail: the buyer, the number, the PDF, once.
    expect(mails).toHaveLength(1);
    expect(mails[0]).toMatchObject({
      to: "eda@example.com",
      kind: "order",
      ref: "#10234",
      invoiceNo: row.invoiceNo,
      amountMinor: 27_000,
      idempotencyKey: `earsiv-${row.id}`,
      filename: `L-Affogato-e-Arsiv-${row.invoiceNo}.pdf`,
    });
    expect(Buffer.from(mails[0].pdfBase64, "base64").toString()).toBe(
      "%PDF-1.7",
    );
    // The e-Arşiv: an internet sale, no shipment for a pickup.
    const ea = parasut.posts.find((p) => p.path === "e_archives")!.body as {
      data: { attributes: Record<string, unknown> };
    };
    expect(ea.data.attributes.shipment).toBeUndefined();
    expect(ea.data.attributes.internet_sale).toMatchObject({
      payment_platform: "PayNkolay",
      payment_date: "2026-10-22",
    });
    // The contact: no phone anywhere in what Paraşüt got.
    expect(JSON.stringify(parasut.posts)).not.toContain("532");
    // A second run finds nothing to do.
    const again = await run();
    expect(again.processed).toBe(0);
    expect(
      parasut.posts.filter((p) => p.path === "sales_invoices"),
    ).toHaveLength(1);
  });

  it("sends the carrier's title and VKN for a parcel", async () => {
    store.carrierList = [
      {
        name: "Yurtiçi",
        title: "Yurtiçi Kargo Servisi A.Ş.",
        vkn: LEGAL_ENTITY.taxNo,
      },
    ];
    store.orders.set(
      "ord-1",
      anOrder({
        kind: "shop",
        fulfillment: "shipping",
        carrier: "Yurtiçi",
        shippingAddress: "Moda Cad. 5\nKadıköy / İstanbul",
        shippingMinor: 5_000,
        shippingTaxRatePct: 20,
        totalMinor: 32_000,
      }),
    );
    await run();
    expect(store.row()).toMatchObject({
      status: "issued",
      route: "parcel",
      billingDistrict: "Kadıköy",
    });
    const ea = parasut.posts.find((p) => p.path === "e_archives")!.body as {
      data: { attributes: { shipment: unknown } };
    };
    expect(ea.data.attributes.shipment).toEqual({
      title: "Yurtiçi Kargo Servisi A.Ş.",
      vkn: LEGAL_ENTITY.taxNo,
      date: "2026-10-22",
    });
    const si = parasut.posts.find((p) => p.path === "sales_invoices")!.body as {
      data: { relationships: { details: { data: unknown[] } } };
    };
    expect(si.data.relationships.details.data).toHaveLength(2);
  });

  it("invoices a karaoke evening once it is over", async () => {
    store.orders.clear();
    store.bookings.set("krk-00042", {
      id: "krk-00042",
      customerEmail: "eda@example.com",
      customerName: "Eda",
      contactEmail: "",
      date: "2026-10-22",
      startHour: 10,
      hours: 2,
      guests: 4,
      status: "confirmed",
      priceMinor: 120_000,
      discountMinor: 0,
      totalMinor: 120_000,
      note: "",
      createdAt: "2026-10-20T10:00:00.000Z",
      updatedAt: "2026-10-20T10:00:00.000Z",
      paymentStatus: "paid",
      paidMinor: 120_000,
      paidAt: "2026-10-20T10:05:00.000Z",
      taxRatePct: 20,
    } as KaraokeReservation);
    // 10:00-12:00 Istanbul ends 09:00 UTC, before the run at 12:00 UTC.
    store.payments.set("krk-00042", [
      { provider: "paynkolay", status: "succeeded" },
    ]);
    await run();
    expect(store.row()).toMatchObject({
      sourceKind: "karaoke",
      status: "issued",
      amountMinor: 120_000,
    });
    expect(mails[0]).toMatchObject({
      kind: "karaoke",
      ref: "22 Ekim 2026",
      orderNo: null,
    });
  });
});

describe("a row that cannot be cut yet does not hold up the queue", () => {
  // Post-merge review (22 Eki 2026): a karaoke booking whose refund is still
  // in progress after its evening was claimed again and again, by the same
  // run, ahead of every newer invoice, so nothing behind it was ever cut.
  it("cuts the order behind a karaoke booking whose refund is still in progress", async () => {
    store.bookings.set("krk-00007", {
      id: "krk-00007",
      customerEmail: "eda@example.com",
      customerName: "Eda",
      contactEmail: "",
      date: "2026-10-22",
      startHour: 10,
      hours: 1,
      guests: 2,
      status: "cancelled",
      priceMinor: 60_000,
      discountMinor: 0,
      totalMinor: 60_000,
      note: "",
      createdAt: "2026-10-20T10:00:00.000Z",
      updatedAt: "2026-10-22T07:00:00.000Z",
      paymentStatus: "refunding",
      paidMinor: 60_000,
      paidAt: "2026-10-20T10:05:00.000Z",
      taxRatePct: 20,
    } as KaraokeReservation);
    store.payments.set("krk-00007", [
      { provider: "paynkolay", status: "succeeded" },
    ]);
    const r = await run();
    expect(r.issued).toBe(1);
    const rows = [...store.rows.values()];
    expect(rows.find((x) => x.sourceId === "ord-1")?.status).toBe("issued");
    const booking = rows.find((x) => x.sourceId === "krk-00007")!;
    expect(booking).toMatchObject({ status: "waiting", dueAt: "" });
    // Not claimable until the refund settles.
    expect((await run()).processed).toBe(0);
    // Settled by hand, half kept: the kept half is invoiced.
    store.bookings.set("krk-00007", {
      ...store.bookings.get("krk-00007")!,
      paymentStatus: "refunded",
      refundMinor: 30_000,
      refundedAt: "2026-10-22T12:30:00.000Z",
    });
    clock = Date.parse("2026-10-22T13:00:00.000Z");
    await run();
    expect(
      [...store.rows.values()].find((x) => x.sourceId === "krk-00007"),
    ).toMatchObject({ status: "issued", amountMinor: 30_000 });
  });
});

describe("draft mode", () => {
  it("prepares the sales invoice and stops: no e-Arşiv, no mail; live later recuts an old draft today and formalises it", async () => {
    await run({ ...LIVE_ENV, EARSIV_MODE: "draft" });
    expect(store.row().status).toBe("draft");
    expect(parasut.posts.map((p) => p.path)).not.toContain("e_archives");
    expect(mails).toEqual([]);
    // A draft is not claimed again in draft mode.
    expect((await run({ ...LIVE_ENV, EARSIV_MODE: "draft" })).processed).toBe(
      0,
    );
    // The next day, live: yesterday's draft is deleted and cut again today.
    clock = Date.parse("2026-10-23T09:00:00.000Z");
    await run();
    expect(parasut.deletes).toHaveLength(1);
    expect(
      parasut.posts.filter((p) => p.path === "sales_invoices"),
    ).toHaveLength(2);
    expect(store.row()).toMatchObject({ status: "issued" });
    expect(mails).toHaveLength(1);
  });
});

describe("draft mode: a person reads each draft and formalises it", () => {
  const DRAFT = { ...LIVE_ENV, EARSIV_MODE: "draft" };
  const press = (action: RowAction, id = store.row().id) =>
    runInvoiceRowWith(deps(DRAFT), { id, action, budgetMs: 50_000 });

  it('"Faturayı kes" makes this row a draft and nothing else; "kesinleştir" formalises it and mails the PDF', async () => {
    clock = Date.parse("2026-10-22T07:00:00.000Z");
    store.orders.set(
      "ord-2",
      anOrder({
        id: "ord-2",
        orderNo: 10235,
        paidAt: "2026-10-22T08:05:00.000Z",
      }),
    );
    store.payments.set("ord-2", [
      { provider: "paynkolay", status: "succeeded" },
    ]);
    // The sweep makes the rows; both are due only after delivery.
    clock = Date.parse("2026-10-22T09:00:00.000Z");
    await runInvoicesWith(deps(DRAFT), {
      budgetMs: 120_000,
      reason: "cron",
      limit: 0,
    });
    const first = [...store.rows.values()].find((r) => r.sourceId === "ord-1")!;
    expect(first.status).toBe("due");

    const cut = await press("cut", first.id);
    expect(cut).toMatchObject({ mode: "draft", taken: true, step: "draft" });
    let row = store.rows.get(first.id)!;
    expect(row).toMatchObject({ status: "draft", amountMinor: 27_000 });
    expect(row.kdvRows).toEqual([
      { ratePct: 10, grossMinor: 27_000, netMinor: 24_545, taxMinor: 2_455 },
    ]);
    // Only this row went to Paraşüt.
    expect(
      parasut.posts.filter((p) => p.path === "sales_invoices"),
    ).toHaveLength(1);
    expect(
      [...store.rows.values()].find((r) => r.sourceId === "ord-2")!.status,
    ).toBe("due");
    expect(parasut.posts.map((p) => p.path)).not.toContain("e_archives");
    expect(mails).toEqual([]);

    // A cron run in draft mode leaves the draft alone.
    await runInvoicesWith(deps(DRAFT), { budgetMs: 120_000, reason: "cron" });
    expect(store.rows.get(first.id)!.status).toBe("draft");
    expect(parasut.posts.map((p) => p.path)).not.toContain("e_archives");

    const done = await press("formalize", first.id);
    expect(done).toMatchObject({ taken: true, step: "issued" });
    row = store.rows.get(first.id)!;
    expect(row).toMatchObject({
      status: "issued",
      invoiceNo: expect.stringMatching(/^GIB2026/),
    });
    expect(row.emailedAt).not.toBe("");
    expect(mails).toHaveLength(1);
    // The draft the person read is the one formalised: no second invoice.
    expect(
      parasut.posts.filter((p) => p.path === "sales_invoices").length,
    ).toBeGreaterThanOrEqual(1);
    expect(parasut.deletes).toEqual([]);
  });

  it("refuses a button on a row in another state, touching nothing", async () => {
    await run(DRAFT);
    const posts = parasut.posts.length;
    expect(await press("cut")).toMatchObject({ taken: false, step: null });
    expect(store.row().status).toBe("draft");
    await press("formalize");
    expect(await press("formalize")).toMatchObject({ taken: false });
    expect(store.row().status).toBe("issued");
    expect(await press("rebuild")).toMatchObject({ taken: false });
    expect(parasut.posts.length).toBeGreaterThan(posts);
  });

  it("does not formalise yesterday's draft: it says so and keeps it for the person", async () => {
    await run(DRAFT);
    clock = Date.parse("2026-10-23T09:00:00.000Z");
    const r = await press("formalize");
    expect(r).toMatchObject({ taken: true, step: "draft" });
    const row = store.row();
    expect(row.status).toBe("draft");
    expect(row.lastError).toContain("bugünün tarihiyle");
    expect(parasut.deletes).toEqual([]);
    expect(parasut.posts.map((p) => p.path)).not.toContain("e_archives");
    // "Taslağı yenile": deleted and cut again today, still a draft.
    expect(await press("rebuild")).toMatchObject({ step: "draft" });
    expect(parasut.deletes).toHaveLength(1);
    const again = store.row();
    expect(again).toMatchObject({ status: "draft", lastError: "" });
    const inv = parasut.invoices.get(again.salesInvoiceId)!;
    expect(inv.attrs.issue_date).toBe("2026-10-23");
    expect(await press("formalize")).toMatchObject({ step: "issued" });
    expect(mails).toHaveLength(1);
  });

  it("keeps a draft whose total was changed in Paraşüt and does not formalise it", async () => {
    await run(DRAFT);
    const inv = parasut.invoices.get(store.row().salesInvoiceId)!;
    inv.attrs.net_total = "250.00";
    const r = await press("formalize");
    expect(r.step).toBe("draft");
    const row = store.row();
    expect(row.status).toBe("draft");
    expect(row.salesInvoiceId).not.toBe("");
    expect(row.lastError).toContain("250,00 TL");
    expect(parasut.deletes).toEqual([]);
    expect(parasut.posts.map((p) => p.path)).not.toContain("e_archives");
  });

  it("never formalises a draft the person did not see: one deleted in Paraşüt is prepared again and stops", async () => {
    await run(DRAFT);
    parasut.invoices.delete(store.row().salesInvoiceId);
    const r = await press("formalize");
    expect(r.step).toBe("draft");
    expect(store.row().lastError).toContain("yeniden hazırlandı");
    expect(parasut.posts.map((p) => p.path)).not.toContain("e_archives");
  });

  it("an e-Arşiv job error goes back to the draft with Paraşüt's reason", async () => {
    await run(DRAFT);
    parasut.jobScript = ["error"];
    parasut.jobErrors = ["Alıcı adresi eksik"];
    const r = await press("formalize");
    expect(r.step).toBe("draft");
    expect(store.row()).toMatchObject({
      status: "draft",
      jobId: "",
      formalizePosts: 0,
    });
    expect(store.row().lastError).toContain("Alıcı adresi eksik");
    expect(mails).toEqual([]);
  });

  it("a formalisation cut short by the clock goes on in the next draft-mode run", async () => {
    await run(DRAFT);
    parasut.jobScript = [
      "running",
      "running",
      "running",
      "running",
      "running",
      "done",
    ];
    const r = await press("formalize");
    expect(r.step).toBe("pending");
    expect(store.row().status).toBe("formalizing");
    clock += 2 * 60_000;
    await run(DRAFT);
    expect(store.row().status).toBe("issued");
    expect(mails).toHaveLength(1);
  });
});

describe("Paraşüt's total must be ours", () => {
  it("deletes the draft and hands the row to a person, with both amounts", async () => {
    parasut.netDelta = 0.05;
    const r = await run();
    expect(r.manual).toBe(1);
    const row = store.row();
    expect(row).toMatchObject({
      status: "manual",
      manualCode: "amount_mismatch",
      salesInvoiceId: "",
    });
    expect(row.manualReason).toContain("Paraşüt 270,05 TL");
    expect(row.manualReason).toContain("beklenen 270,00 TL");
    expect(parasut.deletes).toHaveLength(1);
    expect(parasut.posts.map((p) => p.path)).not.toContain("e_archives");
    // A person cuts it now: the run leaves it alone.
    expect((await run()).processed).toBe(0);
  });
});

describe("a run that dies halfway resumes without a second invoice", () => {
  it("a lost create answer: the next run finds the invoice by its marker instead of creating another", async () => {
    parasut.loseAnswerOf = "sales_invoices";
    await run();
    let row = store.row();
    expect(row).toMatchObject({
      status: "failed",
      salesInvoiceId: "",
      attempts: 1,
    });
    expect(row.createStartedAt).not.toBe("");
    clock += 6 * 60_000;
    await run();
    row = store.row();
    expect(row.status).toBe("issued");
    expect(
      parasut.posts.filter((p) => p.path === "sales_invoices"),
    ).toHaveLength(1);
  });

  it("a lost e-Arşiv answer: waits out the job's 15 minutes, then re-posts once only if nothing was formalised", async () => {
    parasut.failPost = "e_archives";
    await run();
    let row = store.row();
    expect(row).toMatchObject({
      status: "failed",
      jobId: "",
      formalizePosts: 1,
    });
    expect(row.salesInvoiceId).not.toBe("");
    clock += 6 * 60_000;
    await run();
    expect(store.row().status).toBe("formalizing");
    expect(parasut.posts.filter((p) => p.path === "e_archives")).toHaveLength(
      1,
    );
    clock += 10 * 60_000;
    await run();
    row = store.row();
    expect(row.status).toBe("issued");
    expect(parasut.posts.filter((p) => p.path === "e_archives")).toHaveLength(
      2,
    );
    expect(
      parasut.posts.filter((p) => p.path === "sales_invoices"),
    ).toHaveLength(1);
  });

  it("a lost e-Arşiv answer that Paraşüt did apply: takes the e-document, posts nothing again", async () => {
    parasut.loseAnswerOf = "e_archives";
    parasut.jobScript = ["done"];
    await run();
    // Paraşüt formalised it meanwhile.
    for (const inv of parasut.invoices.keys()) {
      parasut.invoices.get(inv)!.eDoc = {
        id: "ea1",
        type: "e_archives",
        number: "GIB2026000000001",
        uuid: "u1",
      };
    }
    clock += 16 * 60_000;
    await run();
    expect(store.row()).toMatchObject({
      status: "issued",
      invoiceNo: "GIB2026000000001",
    });
    expect(parasut.posts.filter((p) => p.path === "e_archives")).toHaveLength(
      1,
    );
  });

  it("a run whose claim went stale (15 minutes) is taken over from the last id", async () => {
    // Simulate a run that died after the sales invoice: the row is still working.
    await run({ ...LIVE_ENV, EARSIV_MODE: "draft" });
    const row = store.row();
    store.rows.set(row.id, {
      ...row,
      status: "working",
      claimedAt: new Date(clock).toISOString(),
    });
    clock += 16 * 60_000;
    await run();
    expect(store.row().status).toBe("issued");
    expect(
      parasut.posts.filter((p) => p.path === "sales_invoices"),
    ).toHaveLength(1);
  });
});

describe("errors", () => {
  it("stores the job's errors masked, retries with backoff, and hands the row to a person after 5 attempts", async () => {
    parasut.jobScript = ["error"];
    parasut.jobErrors = [
      "Alıcı il/ilçe adresi doldurulmalı",
      "iletişim: eda@example.com",
    ];
    await run();
    let row = store.row();
    expect(row).toMatchObject({ status: "failed", attempts: 1, jobId: "" });
    expect(row.lastError).toContain("Alıcı il/ilçe adresi doldurulmalı");
    expect(row.lastError).not.toContain("eda@example.com");
    expect(Date.parse(row.nextAttemptAt) - clock).toBe(5 * 60_000);
    for (let i = 0; i < 6; i += 1) {
      clock += 7 * 60 * 60_000;
      await run();
    }
    row = store.row();
    expect(row).toMatchObject({
      status: "manual",
      manualCode: "attempts",
      attempts: 5,
    });
    // One sales invoice, kept and reused for every attempt.
    expect(
      parasut.posts.filter((p) => p.path === "sales_invoices").length,
    ).toBeLessThanOrEqual(6);
  });

  it("keeps an issued invoice when only the mail failed, and retries the mail alone", async () => {
    mailResult = { ok: false, error: "Sağlayıcı şu an yanıt vermiyor" };
    await run();
    let row = store.row();
    expect(row).toMatchObject({
      status: "issued",
      emailedAt: "",
      emailAttempts: 1,
    });
    expect(row.emailError).toContain("E-posta gönderilemedi");
    const postsBefore = parasut.posts.length;
    mailResult = { ok: true };
    clock += 6 * 60_000;
    await run();
    row = store.row();
    expect(row.emailedAt).not.toBe("");
    expect(parasut.posts.length).toBe(postsBefore);
    expect(mails).toHaveLength(2);
  });
});

describe("after the invoice", () => {
  it("never touches an issued invoice on a refund: flags the order and notes it", async () => {
    await run();
    const order = store.orders.get("ord-1")!;
    store.orders.set("ord-1", {
      ...order,
      refunds: [{ id: "r1", amountMinor: 9_000, reason: "x", createdAt: "x" }],
    });
    const calls = parasut.posts.length;
    await run();
    expect(store.row().refundNotedAt).not.toBe("");
    expect(store.flagged).toEqual(["ord-1"]);
    expect(parasut.posts.length).toBe(calls);
    expect(parasut.deletes).toEqual([]);
    // An unreadable refund time is noted once, never on every run.
    clock += 60_000;
    await run();
    expect(store.flagged).toEqual(["ord-1"]);
  });

  it("a refund marked handled stays closed; a later one is noted again", async () => {
    await run();
    const order = store.orders.get("ord-1")!;
    const refundAt = (ms: number) => new Date(ms).toISOString();
    store.orders.set("ord-1", {
      ...order,
      refunds: [
        {
          id: "r1",
          amountMinor: 3_000,
          reason: "x",
          createdAt: refundAt(clock - 1_000),
        },
      ],
    });
    await run();
    const noted = store.row().refundNotedAt;
    expect(noted).not.toBe("");
    // A person cut the return document (markInvoiceRefundHandled).
    clock += 60_000;
    const handled = new Date(clock).toISOString();
    const id = store.row().id;
    store.rows.set(id, { ...store.row(), refundHandledAt: handled });
    clock += 60_000;
    await run();
    expect(store.row().refundNotedAt).toBe(noted);
    expect(
      (await import("@/lib/invoice/panel-core")).refundOpen(store.row()),
    ).toBe(false);
    // A second refund, recorded after the handling: open again.
    clock += 60_000;
    store.orders.set("ord-1", {
      ...store.orders.get("ord-1")!,
      refunds: [
        ...(store.orders.get("ord-1")!.refunds ?? []),
        {
          id: "r2",
          amountMinor: 2_000,
          reason: "y",
          createdAt: refundAt(clock),
        },
      ],
    });
    clock += 1_000;
    await run();
    expect(store.row().refundNotedAt > handled).toBe(true);
    expect(
      (await import("@/lib/invoice/panel-core")).refundOpen(store.row()),
    ).toBe(true);
    expect(store.flagged).toEqual(["ord-1", "ord-1"]);
  });

  it("deletes a draft for an order cancelled before it was formalised", async () => {
    await run({ ...LIVE_ENV, EARSIV_MODE: "draft" });
    const order = store.orders.get("ord-1")!;
    store.orders.set("ord-1", { ...order, status: "cancelled" });
    await run({ ...LIVE_ENV, EARSIV_MODE: "draft" });
    expect(store.row()).toMatchObject({
      status: "skipped",
      salesInvoiceId: "",
    });
    expect(parasut.deletes).toHaveLength(1);
  });
});

describe("a row a person took over", () => {
  // Post-merge review (22 Ekim 2026): a parcel marked "Elle kesilecek
  // (kurumsal)" before it ships still learns its VUK 231/5 deadline when it
  // ships, so the panel keeps warning; nothing else about the row changes.
  it("still learns its deadline when the parcel ships", async () => {
    store.orders.set(
      "ord-1",
      anOrder({
        kind: "shop",
        fulfillment: "shipping",
        status: "paid",
        shippedAt: undefined,
        shippingAddress: "Moda Cad. 5\nKadıköy / İstanbul",
      }),
    );
    await run();
    const waiting = store.row();
    expect(waiting).toMatchObject({ status: "waiting", deadlineAt: "" });
    store.rows.set(waiting.id, {
      ...waiting,
      status: "manual",
      actor: "patron@laffogato.net",
      manualReason: "Kurumsal fatura: elle kesilecek.",
    });

    clock = Date.parse("2026-10-23T09:00:00.000Z");
    store.orders.set(
      "ord-1",
      anOrder({
        kind: "shop",
        fulfillment: "shipping",
        status: "shipped",
        shippedAt: "2026-10-23T08:30:00.000Z",
        shippingAddress: "Moda Cad. 5\nKadıköy / İstanbul",
      }),
    );
    await run();
    const after = store.row();
    expect(after).toMatchObject({
      status: "manual",
      actor: "patron@laffogato.net",
    });
    expect(after.deadlineAt).not.toBe("");
    expect(after.deadlineAt > "2026-10-29").toBe(true);
    expect(parasut.posts).toHaveLength(0);
  });
});

describe("the hook", () => {
  it("sweeps only its own order", async () => {
    await run(LIVE_ENV, {
      orderId: "ord-1",
      reason: "hook",
      budgetMs: 25_000,
      limit: 3,
    });
    expect(store.calls).not.toContain("openRows");
    expect(store.calls).not.toContain("recentPaidOrders");
    expect(store.row().status).toBe("issued");
  });
});

/**
 * The order's invoice wizard (22 Oct 2026): a person names the buyer and
 * the row is cut now. A company registered at GİB gets an e-Fatura (to its
 * inbox, no mail of ours); a company that is not, an e-Arşiv with its VKN
 * and tax office; an order paid before EARSIV_START_AT is cut too.
 */
describe("the order's invoice wizard", () => {
  const DRAFT = { ...LIVE_ENV, EARSIV_MODE: "draft" };
  const VKN = LEGAL_ENTITY.taxNo; // a valid check digit
  const company = (over: Partial<InvoiceRow> = {}): Partial<InvoiceRow> => ({
    buyerKind: "company",
    buyerTitle: "Örnek Gıda Ticaret A.Ş.",
    buyerTaxNumber: VKN,
    buyerTaxOffice: "Tuzla",
    buyerEmail: "muhasebe@ornek.com.tr",
    requestedBy: "owner@laffogato.net",
    ...over,
  });
  /** What requestOrderInvoice writes: the buyer, and the row due now. */
  async function ask(over: Partial<InvoiceRow>, env = DRAFT) {
    await runInvoicesWith(deps(env), {
      budgetMs: 120_000,
      reason: "cron",
      limit: 0,
    });
    let row = store.row();
    if (!row) {
      const { blankInvoice } = await import("@/lib/invoice/store");
      row = blankInvoice("order", "ord-1", new Date(clock).toISOString());
      store.rows.set(row.id, row);
    }
    store.rows.set(row.id, {
      ...row,
      ...over,
      sourceLabel: "#10234",
      status: row.status === "draft" ? "draft" : "due",
      dueAt: row.dueAt || new Date(clock).toISOString(),
    } as InvoiceRow);
    // createOrderInvoiceAction: one action for every state it takes.
    return runInvoiceRowWith(deps(env), {
      id: row.id,
      action: "request",
      budgetMs: 50_000,
    });
  }

  it("a company registered at GİB: its contact and draft carry VKN and tax office, formalised as an e-Fatura to its inbox, no mail", async () => {
    parasut.inboxes.set(VKN, "urn:mail:defaultpk@ornek.com.tr");
    const cut = await ask(company());
    expect(cut).toMatchObject({ taken: true, step: "draft" });
    const contact = parasut.posts.find((p) => p.path === "contacts")!.body as {
      data: { attributes: Record<string, unknown> };
    };
    expect(contact.data.attributes).toMatchObject({
      name: "Örnek Gıda Ticaret A.Ş.",
      contact_type: "company",
      tax_number: VKN,
      tax_office: "Tuzla",
      email: "muhasebe@ornek.com.tr",
    });
    expect(JSON.stringify(contact)).not.toContain("Eda Mancuso");
    // Cached under the VKN, not under the person's e-mail.
    expect([...store.contacts.keys()]).toEqual([`123:vkn:${VKN}`]);
    const si = parasut.posts.find((p) => p.path === "sales_invoices")!.body as {
      data: { attributes: Record<string, unknown> };
    };
    expect(si.data.attributes).toMatchObject({
      tax_number: VKN,
      tax_office: "Tuzla",
    });

    const done = await runInvoiceRowWith(deps(DRAFT), {
      id: store.row().id,
      action: "formalize",
      budgetMs: 50_000,
    });
    expect(done).toMatchObject({ taken: true, step: "issued" });
    const posted = parasut.posts.map((p) => p.path);
    expect(posted).toContain("e_invoices");
    expect(posted).not.toContain("e_archives");
    expect(
      parasut.posts.find((p) => p.path === "e_invoices")!.body,
    ).toMatchObject({
      data: {
        attributes: {
          scenario: "basic",
          to: "urn:mail:defaultpk@ornek.com.tr",
        },
      },
    });
    expect(store.row()).toMatchObject({
      status: "issued",
      eDocumentType: "e_invoices",
      emailedAt: "",
      emailError: "",
      nextAttemptAt: "",
    });
    // GİB delivers it: no mail of ours, and the queue does not try one.
    expect(mails).toEqual([]);
    await run(DRAFT);
    expect(mails).toEqual([]);
  });

  it("a company that is not an e-Fatura user: an e-Arşiv with its VKN, the PDF to the invoice e-mail", async () => {
    await ask(company(), LIVE_ENV);
    const posted = parasut.posts.map((p) => p.path);
    expect(posted).toContain("e_archives");
    expect(posted).not.toContain("e_invoices");
    expect(store.row()).toMatchObject({
      status: "issued",
      eDocumentType: "e_archives",
    });
    expect(mails).toHaveLength(1);
    expect(mails[0]).toMatchObject({
      to: "muhasebe@ornek.com.tr",
      customerName: "Örnek Gıda Ticaret A.Ş.",
    });
  });

  it("an order paid before EARSIV_START_AT is cut when a person asks, and the sweep keeps it due", async () => {
    store.orders.set(
      "ord-1",
      anOrder({
        createdAt: "2026-10-16T08:00:00.000Z",
        paidAt: "2026-10-16T08:01:00.000Z",
        shippedAt: "2026-10-16T08:20:00.000Z",
      }),
    );
    // The automation leaves it alone.
    await run(DRAFT);
    expect(store.rows.size).toBe(0);
    const cut = await ask({
      buyerKind: "consumer",
      requestedBy: "owner@laffogato.net",
    });
    expect(cut).toMatchObject({ taken: true, step: "draft" });
    expect(store.row()).toMatchObject({ status: "draft", amountMinor: 27_000 });
    // A later sweep does not take it out of scope.
    await run(DRAFT);
    expect(store.row().status).toBe("draft");
  });

  it("live: a failed row whose sales invoice was made for the consumer is not formalised for the company as it was: it is made again", async () => {
    // The e-Arşiv job fails once: the row keeps its sales invoice and waits.
    parasut.jobScript = ["error"];
    parasut.jobErrors = ["geçici hata"];
    await run();
    const failed = store.row();
    expect(failed.status).toBe("failed");
    const old = failed.salesInvoiceId;
    expect(old).not.toBe("");
    parasut.jobScript = ["running", "done"];
    parasut.jobErrors = [];
    // Even if the queue takes it first, the new buyer is what is formalised.
    store.rows.set(failed.id, {
      ...failed,
      ...company(),
      status: "due",
      nextAttemptAt: "",
    } as InvoiceRow);
    await run();
    expect(parasut.deletes).toContain(`sales_invoices/${old}`);
    const latest = parasut.posts
      .filter((p) => p.path === "sales_invoices")
      .at(-1)!.body as { data: { attributes: Record<string, unknown> } };
    expect(latest.data.attributes).toMatchObject({ tax_number: VKN });
    expect(store.row()).toMatchObject({ status: "issued" });
  });

  it("does not formalise a draft the person read for another buyer", async () => {
    await run(DRAFT);
    const draft = store.row();
    store.rows.set(draft.id, { ...draft, ...company() } as InvoiceRow);
    const r = await runInvoiceRowWith(deps(DRAFT), {
      id: draft.id,
      action: "formalize",
      budgetMs: 50_000,
    });
    expect(r).toMatchObject({ taken: true, step: "draft" });
    expect(store.row().lastError).toMatch(/başka bir alıcı/);
    expect(parasut.posts.map((p) => p.path)).not.toContain("e_archives");
    expect(parasut.deletes).toEqual([]);
  });

  it("a draft made for the consumer is rebuilt for the company: the old draft goes, the new one names the company", async () => {
    await run(DRAFT);
    expect(store.row().status).toBe("draft");
    const before = store.row().salesInvoiceId;
    const r = await ask(company());
    expect(r).toMatchObject({ taken: true, step: "draft" });
    expect(parasut.deletes).toEqual([`sales_invoices/${before}`]);
    const row = store.row();
    expect(row.salesInvoiceId).not.toBe(before);
    const latest = parasut.posts
      .filter((p) => p.path === "sales_invoices")
      .at(-1)!.body as { data: { attributes: Record<string, unknown> } };
    expect(latest.data.attributes).toMatchObject({ tax_number: VKN });
  });

  it("a failed row that still holds a Paraşüt invoice is made again with the typed address, not formalised as it was", async () => {
    // A courier order's e-Arşiv job fails on the address; the row keeps the
    // sales invoice it made. The person types the address in the wizard.
    store.orders.set(
      "ord-1",
      anOrder({
        fulfillment: "delivery",
        shippingAddress: "Cami Sk. 3, Pendik / İstanbul",
      }),
    );
    parasut.jobScript = ["error"];
    parasut.jobErrors = ["Alıcı il/ilçe adresi doldurulmalı"];
    await run();
    const failed = store.row();
    expect(failed).toMatchObject({ status: "failed", jobId: "" });
    const stale = failed.salesInvoiceId;
    expect(stale).not.toBe("");
    parasut.jobScript = ["done"];
    parasut.jobErrors = [];
    clock += 60_000;
    const r = await ask(
      {
        billingCity: "Kocaeli",
        billingDistrict: "Gebze",
        billingAddress: "Yeni adres 5",
        billingEditedBy: "owner@laffogato.net",
        requestedBy: "owner@laffogato.net",
        attempts: 0,
        lastError: "",
        nextAttemptAt: "",
      },
      LIVE_ENV,
    );
    expect(r.taken).toBe(true);
    // On 64a6bd0 the wizard ran "cut", the invoice made with Pendik was
    // kept, and that one became the legal e-Arşiv.
    expect(parasut.deletes).toEqual([`sales_invoices/${stale}`]);
    const row = store.row();
    expect(row.salesInvoiceId).not.toBe(stale);
    expect(parasut.invoices.get(row.salesInvoiceId)!.attrs).toMatchObject({
      city: "Kocaeli",
      district: "Gebze",
    });
  });

  it("a company's corrected tax office reaches the invoice after a failed run", async () => {
    parasut.jobScript = ["error"];
    parasut.jobErrors = ["Vergi dairesi hatalı"];
    await ask(company({ buyerTaxOffice: "Tuzla" }), LIVE_ENV);
    const failed = store.row();
    expect(failed.status).toBe("failed");
    const stale = failed.salesInvoiceId;
    parasut.jobScript = ["done"];
    parasut.jobErrors = [];
    clock += 60_000;
    await ask(
      company({
        buyerTaxOffice: "Kartal",
        attempts: 0,
        lastError: "",
        nextAttemptAt: "",
      }),
      LIVE_ENV,
    );
    const row = store.row();
    expect(parasut.deletes).toContain(`sales_invoices/${stale}`);
    expect(parasut.invoices.get(row.salesInvoiceId)!.attrs).toMatchObject({
      tax_office: "Kartal",
    });
  });

  it("a create whose answer was lost, then a new buyer: the lost draft is found under its own contact and goes; one sale stays in Paraşüt", async () => {
    parasut.loseAnswerOf = "sales_invoices";
    await run(DRAFT);
    const lost = store.row();
    expect(lost.createStartedAt).not.toBe("");
    expect(lost.salesInvoiceId).toBe("");
    expect(parasut.invoices.size).toBe(1);
    const [orphan] = [...parasut.invoices.keys()];
    const r = await ask(company());
    expect(r).toMatchObject({ taken: true, step: "draft" });
    // On 64a6bd0 the lookup ran under the company's contact, missed the
    // consumer's draft and made a second sale with the same marker.
    expect(parasut.deletes).toEqual([`sales_invoices/${orphan}`]);
    expect(parasut.invoices.size).toBe(1);
    const row = store.row();
    expect(parasut.invoices.get(row.salesInvoiceId)!.contactId).toBe(
      row.contactId,
    );
    expect(row.createStartedAt).toBe("");
  });

  it("a lost create the queue finds again, buyer unchanged, is kept, not made twice", async () => {
    parasut.loseAnswerOf = "sales_invoices";
    await run(DRAFT);
    const [made] = [...parasut.invoices.keys()];
    clock += 10 * 60_000;
    const row = store.row();
    store.rows.set(row.id, { ...row, nextAttemptAt: "" } as InvoiceRow);
    await run(DRAFT);
    expect(parasut.deletes).toEqual([]);
    expect(parasut.invoices.size).toBe(1);
    expect(store.row()).toMatchObject({
      status: "draft",
      salesInvoiceId: made,
    });
  });
});
