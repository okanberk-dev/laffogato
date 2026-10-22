import pg from "pg";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import { createDb, type Executor } from "@/lib/db/client";
import type { InvoiceRow } from "@/lib/invoice/invoice-core";

import { applyBundledSchema } from "./_support/apply-schema";
import {
  holdSharedDatabase,
  SUITE_LOCK_WAIT_MS,
} from "./_support/db-suite-lock";

/**
 * The e-Arşiv tables in a real Postgres (20261022190000_earsiv_invoices.sql)
 * through the store the run uses (src/lib/invoice/store.ts):
 * `invoice_claim` hands each due row to exactly one run, also under
 * concurrent claims, takes back a row whose run died after 15 minutes, and
 * leaves alone what is not due; a held row's writes are guarded by its
 * claim; one row per source; the Paraşüt token lease is exclusive.
 * Skipped without TEST_DATABASE_URL, like the other db-integration suites.
 */
const URL_ = process.env.TEST_DATABASE_URL;
const maybe = URL_ ? describe : describe.skip;

let pool: pg.Pool | null = null;
const execute: Executor = async (q) => {
  if (!pool) throw new Error("pool not ready");
  const r = await pool.query(q.text, q.params as unknown[]);
  return {
    rows: (r.rows ?? []) as Record<string, unknown>[],
    rowCount: r.rowCount ?? 0,
  };
};

vi.mock("@/lib/db", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/db")>();
  const db = createDb(execute);
  return { ...real, getDb: () => db };
});

const NOW = "2026-10-22T12:00:00.000Z";
const STALE = "2026-10-22T11:45:00.000Z";

maybe("e-Arşiv invoices in a real Postgres", () => {
  let release: (() => Promise<void>) | undefined;
  let mod: typeof import("@/lib/invoice/store");

  beforeAll(async () => {
    release = await holdSharedDatabase(URL_!);
    pool = new pg.Pool({ connectionString: URL_, max: 6 });
    await applyBundledSchema(pool);
    mod = await import("@/lib/invoice/store");
  }, SUITE_LOCK_WAIT_MS);

  afterAll(async () => {
    await pool?.query("delete from public.invoices");
    await pool?.query("delete from public.invoice_state");
    await pool?.query("delete from public.invoice_contacts");
    await pool?.end();
    pool = null;
    await release?.();
  });

  beforeEach(async () => {
    await pool!.query("delete from public.invoices");
    await pool!.query("delete from public.invoice_state");
    await pool!.query("delete from public.invoice_contacts");
  });

  function row(sourceId: string, over: Partial<InvoiceRow> = {}): InvoiceRow {
    return {
      ...mod.blankInvoice("order", sourceId, "2026-10-22T08:00:00.000Z"),
      status: "due",
      dueAt: "2026-10-22T10:00:00.000Z",
      deadlineAt: "2026-10-29T10:00:00.000Z",
      ...over,
    };
  }

  async function seed(...rows: InvoiceRow[]) {
    for (const r of rows)
      expect(await mod.dbInvoiceStore.insertRow(r)).toBe(true);
  }

  async function statusOf(sourceId: string) {
    const r = await pool!.query(
      'select status, "claimedAt" from public.invoices where "sourceId" = $1',
      [sourceId],
    );
    return r.rows[0] as { status: string; claimedAt: string };
  }

  it("keeps one row per order or booking", async () => {
    await seed(row("ord-1"));
    expect(await mod.dbInvoiceStore.insertRow(row("ord-1"))).toBe(false);
    expect(
      await mod.dbInvoiceStore.insertRow({
        ...row("ord-1"),
        sourceKind: "karaoke",
      }),
    ).toBe(true);
    const n = await pool!.query(
      "select count(*)::int as n from public.invoices",
    );
    expect(n.rows[0].n).toBe(2);
  });

  it("claims what is due, oldest deadline first, and nothing that is not", async () => {
    await seed(
      row("due-late", { deadlineAt: "2026-10-28T00:00:00.000Z" }),
      row("due-early", { deadlineAt: "2026-10-24T00:00:00.000Z" }),
      row("waiting-due", { status: "waiting" }),
      row("future", { status: "waiting", dueAt: "2026-10-23T00:00:00.000Z" }),
      row("unknown-due", { status: "waiting", dueAt: "" }),
      row("failed-later", {
        status: "failed",
        nextAttemptAt: "2026-10-22T13:00:00.000Z",
      }),
      row("failed-now", {
        status: "failed",
        nextAttemptAt: "2026-10-22T11:00:00.000Z",
      }),
      row("manual", { status: "manual" }),
      row("issued-mailed", { status: "issued", emailedAt: NOW }),
      row("issued-mail", {
        status: "issued",
        nextAttemptAt: "2026-10-22T11:59:00.000Z",
      }),
      row("draft", { status: "draft" }),
      row("fresh-work", {
        status: "working",
        claimedAt: "2026-10-22T11:55:00.000Z",
      }),
      row("stale-work", {
        status: "working",
        claimedAt: "2026-10-22T11:00:00.000Z",
      }),
    );
    // One at a time, the nearest legal deadline goes first.
    const [first] = await mod.dbInvoiceStore.claim(NOW, STALE, false, 1);
    expect(first.sourceId).toBe("due-early");
    const rest = await mod.dbInvoiceStore.claim(NOW, STALE, false, 50);
    const claimed = [first, ...rest];
    expect(claimed.map((r) => r.sourceId).sort()).toEqual(
      [
        "due-early",
        "due-late",
        "failed-now",
        "issued-mail",
        "stale-work",
        "waiting-due",
      ].sort(),
    );
    for (const r of claimed) {
      expect(r.status).toBe("working");
      expect(r.claimedAt).toBe(NOW);
      expect(typeof r.amountMinor).toBe("number");
      expect(Array.isArray(r.kdvRows)).toBe(true);
    }
    // A draft is claimed only when the mode is live.
    const live = await mod.dbInvoiceStore.claim(NOW, STALE, true, 50);
    expect(live.map((r) => r.sourceId)).toEqual(["draft"]);
    expect((await statusOf("manual")).status).toBe("manual");
    expect((await statusOf("future")).status).toBe("waiting");
  });

  it("hands each due row to exactly one of many concurrent runs", async () => {
    for (let i = 0; i < 20; i += 1) await seed(row(`ord-${i}`));
    const runs = await Promise.all(
      Array.from({ length: 8 }, () =>
        mod.dbInvoiceStore.claim(NOW, STALE, true, 5),
      ),
    );
    const ids = runs.flat().map((r) => r.id);
    expect(ids).toHaveLength(new Set(ids).size);
    expect(ids.length).toBe(20);
  });

  it("claims one named row for a button, only from the statuses it takes, never one a run holds", async () => {
    await seed(row("draft", { status: "draft" }), row("due"));
    const draftId = (
      await pool!.query(
        `select id from public.invoices where "sourceId" = 'draft'`,
      )
    ).rows[0].id as string;
    // Not from a status the button does not take.
    expect(await mod.dbInvoiceStore.claimRow(draftId, NOW, ["due"])).toBe(null);
    expect((await statusOf("draft")).status).toBe("draft");
    // Two presses at once: one of them holds it.
    const both = await Promise.all([
      mod.dbInvoiceStore.claimRow(draftId, NOW, ["draft"]),
      mod.dbInvoiceStore.claimRow(draftId, NOW, ["draft"]),
    ]);
    expect(both.filter(Boolean)).toHaveLength(1);
    const held = both.find(Boolean)!;
    expect(held).toMatchObject({ status: "working", claimedAt: NOW });
    expect(Array.isArray(held.kdvRows)).toBe(true);
    // Held: the queue does not take it either, and the row's own claim guards it.
    expect(await mod.dbInvoiceStore.claim(NOW, STALE, true, 50)).toEqual([
      expect.objectContaining({ sourceId: "due" }),
    ]);
    expect(
      await mod.dbInvoiceStore.updateClaimed(held.id, NOW, {
        status: "draft",
        claimedAt: "",
      }),
    ).toBe(true);
    expect((await statusOf("draft")).status).toBe("draft");
  });

  it("guards a held row's writes by its own claim", async () => {
    await seed(row("ord-1"));
    const [held] = await mod.dbInvoiceStore.claim(NOW, STALE, true, 1);
    expect(
      await mod.dbInvoiceStore.updateClaimed(held.id, held.claimedAt, {
        salesInvoiceId: "9",
      }),
    ).toBe(true);
    // Another run took it over after 15 minutes: the first one's writes stop.
    const later = "2026-10-22T12:20:00.000Z";
    const [taken] = await mod.dbInvoiceStore.claim(
      later,
      "2026-10-22T12:05:00.000Z",
      true,
      1,
    );
    expect(taken.id).toBe(held.id);
    expect(taken.salesInvoiceId).toBe("9");
    expect(
      await mod.dbInvoiceStore.updateClaimed(held.id, held.claimedAt, {
        jobId: "1",
      }),
    ).toBe(false);
    expect(
      await mod.dbInvoiceStore.updateClaimed(taken.id, taken.claimedAt, {
        jobId: "2",
        status: "formalizing",
        claimedAt: "",
      }),
    ).toBe(true);
    const r = await pool!.query('select "jobId", status from public.invoices');
    expect(r.rows[0]).toEqual({ jobId: "2", status: "formalizing" });
  });

  it("compares and sets a panel or sweep write on updatedAt", async () => {
    await seed(row("ord-1"));
    const [r] = await mod.dbInvoiceStore.rowsForSources("order", ["ord-1"]);
    expect(
      await mod.dbInvoiceStore.updateRow(r, {
        status: "manual",
        updatedAt: "2026-10-22T12:01:00.000Z",
      }),
    ).toBe(true);
    expect(await mod.dbInvoiceStore.updateRow(r, { status: "due" })).toBe(
      false,
    );
  });

  it("refuses a status the schema does not know and a negative amount", async () => {
    await expect(
      pool!.query(
        `insert into public.invoices (id, "sourceKind", "sourceId", status, "createdAt", "updatedAt") values ('x', 'order', 'o', 'sent', 'a', 'a')`,
      ),
    ).rejects.toThrow(/invoices_status/);
    await expect(
      pool!.query(
        `insert into public.invoices (id, "sourceKind", "sourceId", "amountMinor", "createdAt", "updatedAt") values ('y', 'order', 'o2', -1, 'a', 'a')`,
      ),
    ).rejects.toThrow(/invoices_amount/);
  });

  it("leases the Paraşüt token to one holder at a time", async () => {
    const lease = mod.dbInvoiceStore.tokens.lease;
    expect(
      await lease("parasut.token.lease", "a", NOW, "2026-10-22T12:00:20.000Z"),
    ).toBe(true);
    expect(
      await lease(
        "parasut.token.lease",
        "b",
        "2026-10-22T12:00:05.000Z",
        "2026-10-22T12:00:25.000Z",
      ),
    ).toBe(false);
    // The holder renews or releases (expires now).
    expect(
      await lease(
        "parasut.token.lease",
        "a",
        "2026-10-22T12:00:06.000Z",
        "2026-10-22T12:00:06.000Z",
      ),
    ).toBe(true);
    expect(
      await lease(
        "parasut.token.lease",
        "b",
        "2026-10-22T12:00:07.000Z",
        "2026-10-22T12:00:27.000Z",
      ),
    ).toBe(true);
    const races = await Promise.all(
      ["c", "d", "e", "f"].map((o) =>
        lease(
          "parasut.token.lease",
          o,
          "2026-10-22T12:01:00.000Z",
          "2026-10-22T12:01:20.000Z",
        ),
      ),
    );
    expect(races.filter(Boolean)).toHaveLength(1);
  });

  it("keeps the sealed token, product ids and carriers, and a contact per lower-cased e-mail", async () => {
    await mod.dbInvoiceStore.tokens.write("parasut.token", "sealed.value.x");
    expect(await mod.dbInvoiceStore.tokens.read("parasut.token")).toBe(
      "sealed.value.x",
    );
    await mod.writeCarriers([
      {
        name: "Yurtiçi",
        title: "Yurtiçi Kargo Servisi A.Ş.",
        vkn: "6312110904",
      },
    ]);
    expect(await mod.readCarriers()).toEqual([
      {
        name: "Yurtiçi",
        title: "Yurtiçi Kargo Servisi A.Ş.",
        vkn: "6312110904",
      },
    ]);
    await mod.dbInvoiceStore.saveContact(
      "123",
      "Eda@Example.com",
      "555",
      "fp1",
    );
    expect(await mod.dbInvoiceStore.contact("123", "eda@example.com")).toEqual({
      contactId: "555",
      fingerprint: "fp1",
    });
    await mod.dbInvoiceStore.saveContact(
      "123",
      "eda@example.com",
      "555",
      "fp2",
    );
    expect(await mod.dbInvoiceStore.contact("123", "EDA@example.com")).toEqual({
      contactId: "555",
      fingerprint: "fp2",
    });
    expect(
      await mod.dbInvoiceStore.contact("999", "eda@example.com"),
    ).toBeNull();
  });

  it("writes the invoice wizard's request: the buyer, the address, the row due now; never on a cut or posted one", async () => {
    const company = {
      kind: "company" as const,
      title: "Örnek Gıda Ticaret A.Ş.",
      taxNumber: "1234567890",
      taxOffice: "Tuzla",
    };
    const billing = { city: "İstanbul", district: "Tuzla", address: "No 28" };
    const planOf = (label: string) => ({
      sourceLabel: label,
      route: "pickup" as const,
      deadlineAt: "2026-10-29T10:00:00.000Z",
      amountMinor: 38_000,
    });
    // No row yet: one is made, due now, marked as asked for.
    const fresh = await mod.requestOrderInvoice(
      "ord-20",
      planOf("#10020"),
      { buyer: company, email: "muhasebe@ornek.com.tr", billing },
      "a@laffogato.net",
    );
    expect(fresh.ok).toBe(true);
    const made = await mod.getInvoiceForSource("order", "ord-20");
    expect(made).toMatchObject({
      status: "due",
      sourceLabel: "#10020",
      route: "pickup",
      deadlineAt: "2026-10-29T10:00:00.000Z",
      amountMinor: 38_000,
      buyerKind: "company",
      buyerTitle: company.title,
      buyerTaxNumber: company.taxNumber,
      buyerTaxOffice: "Tuzla",
      buyerEmail: "muhasebe@ornek.com.tr",
      requestedBy: "a@laffogato.net",
      billingCity: "İstanbul",
      billingEditedBy: "a@laffogato.net",
    });
    expect(made!.dueAt).not.toBe("");
    // A person's "elle kesilecek" row comes back into the queue.
    await seed(
      row("ord-21", {
        status: "manual",
        manualCode: "corporate",
        actor: "b",
        dueAt: "",
      }),
    );
    const back = await mod.requestOrderInvoice(
      "ord-21",
      planOf("#10021"),
      { buyer: { kind: "consumer" }, email: "", billing: null },
      "a",
    );
    expect(back.ok).toBe(true);
    expect(await mod.getInvoiceForSource("order", "ord-21")).toMatchObject({
      status: "due",
      manualCode: "",
      actor: "",
      buyerKind: "consumer",
      requestedBy: "a",
    });
    // A draft stays a draft (the caller rebuilds it for the new buyer).
    await seed(row("ord-22", { status: "draft", salesInvoiceId: "5" }));
    const draft = await mod.requestOrderInvoice(
      "ord-22",
      planOf("#10022"),
      { buyer: company, email: "", billing },
      "a",
    );
    expect(draft.ok && draft.row.status).toBe("draft");
    expect(await mod.getInvoiceForSource("order", "ord-22")).toMatchObject({
      status: "draft",
      salesInvoiceId: "5",
      buyerKind: "company",
    });
    // Cut, cut by hand, held by a run, or its job posted: refused, untouched.
    await seed(
      row("ord-23", { status: "issued", eDocumentId: "1", emailedAt: NOW }),
      row("ord-24", { status: "manual_done", invoiceNo: "X1" }),
      row("ord-25", { status: "working", claimedAt: NOW }),
      row("ord-26", { status: "manual", jobId: "", formalizePosts: 2 }),
    );
    for (const id of ["ord-23", "ord-24", "ord-25", "ord-26"]) {
      const r = await mod.requestOrderInvoice(
        id,
        planOf("#1"),
        { buyer: company, email: "", billing },
        "a",
      );
      expect(r.ok, id).toBe(false);
      expect((await mod.getInvoiceForSource("order", id))!.buyerKind, id).toBe(
        "consumer",
      );
    }
    // The schema refuses a buyer kind it does not know.
    await expect(
      pool!.query(
        `update public.invoices set "buyerKind" = 'person' where "sourceId" = 'ord-20'`,
      ),
    ).rejects.toThrow(/invoices_buyer_kind/);
  });

  it("marks an invoice manual and done by hand, and retries it, through the panel's helpers", async () => {
    const marked = await mod.markInvoiceManual(
      "order",
      "ord-9",
      "#10009",
      "Kurumsal fatura istendi.",
      "a@laffogato.net",
    );
    expect(marked.ok).toBe(true);
    const id = marked.ok ? marked.row.id : "";
    expect(await mod.getInvoice(id)).toMatchObject({
      status: "manual",
      manualCode: "corporate",
      actor: "a@laffogato.net",
    });
    const done = await mod.markInvoiceManualDone(
      id,
      "GIB2026000000099",
      "a@laffogato.net",
    );
    expect(done.ok).toBe(true);
    expect(await mod.getInvoice(id)).toMatchObject({
      status: "manual_done",
      invoiceNo: "GIB2026000000099",
    });
    // An issued one cannot be marked or retried into the queue.
    await seed(
      row("ord-10", { status: "issued", eDocumentId: "1", emailedAt: NOW }),
    );
    const issued = await mod.getInvoiceForSource("order", "ord-10");
    expect(
      (await mod.markInvoiceManual("order", "ord-10", "#10010", "x y z", "a"))
        .ok,
    ).toBe(false);
    expect((await mod.retryInvoice(issued!.id)).ok).toBe(false);
    // Nor one whose e-Arşiv job is already posted: Paraşüt will still make
    // it official, and "elle kestim" would leave it unrecorded and unsent.
    await seed(row("ord-11", { status: "formalizing", jobId: "77" }));
    const posted = await mod.getInvoiceForSource("order", "ord-11");
    expect(
      (await mod.markInvoiceManualDone(posted!.id, "GIB2026000000100", "a")).ok,
    ).toBe(false);
    expect(await mod.getInvoice(posted!.id)).toMatchObject({
      status: "formalizing",
      jobId: "77",
    });
    expect(
      (
        await mod.setInvoiceBilling(
          issued!.id,
          { city: "İstanbul", district: "Tuzla", address: "" },
          "a",
        )
      ).ok,
    ).toBe(false);
  });
});
