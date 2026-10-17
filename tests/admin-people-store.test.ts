import { readFileSync } from "node:fs";

import { beforeEach, describe, expect, it, vi } from "vitest";

import { createDb, type Executor } from "@/lib/db/client";

/**
 * The store halves of the people screens (promos, members, newsletter),
 * over a fake executor that records the SQL each call sends.
 */

const PROMO = {
  id: "prm-0003",
  code: "YAZ25",
  kind: "pct",
  value: 25,
  minSubtotalMinor: 0,
  usageLimit: 100,
  usageCount: 41,
  expiresAt: "",
  isActive: true,
  createdAt: "2026-09-01T09:00:00.000Z",
  updatedAt: "2026-09-01T09:00:00.000Z",
};

const seen: { text: string; params: unknown[] }[] = [];
let answer: (text: string) => Record<string, unknown>[] = () => [];

const exec: Executor = async ({ text, params }) => {
  seen.push({ text, params: [...params] });
  // The seed checks: the tables are not empty.
  if (/count\(\*\)/i.test(text)) return { rows: [{ count: 3 }], rowCount: 1 };
  const rows = answer(text);
  return { rows, rowCount: rows.length };
};

vi.mock("@/lib/db", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/db")>();
  const db = createDb(exec);
  return { ...real, getDb: () => db };
});

const store = await import("@/lib/admin/store");
const customers = await import("@/lib/customer/store");

beforeEach(() => {
  seen.length = 0;
  answer = () => [];
});

describe("updatePromo", () => {
  it("writes the form's fields only, never the usage count", async () => {
    answer = (text) => {
      if (/^SELECT \* FROM "promos"/.test(text)) return [PROMO];
      if (/^UPDATE "promos"/.test(text)) {
        // A redemption landed while the form was open: the row says 42.
        return [{ ...PROMO, usageCount: 42, value: 30 }];
      }
      return [];
    };
    const res = await store.updatePromo(PROMO.id, {
      code: "yaz25",
      kind: "pct",
      value: 30,
      minSubtotalMinor: 0,
      usageLimit: 100,
      expiresAt: "",
      isActive: true,
    });
    const update = seen.find((q) => /^UPDATE "promos"/.test(q.text));
    expect(update?.text).toBeDefined();
    // The old write sent the row it read back, usage count and all, and lost
    // the redemption that came in between.
    expect(update?.text).not.toMatch(/"usageCount"|"createdAt"/);
    expect(update?.params).not.toContain(41);
    expect(update?.params).toContain(30);
    expect(update?.text).toMatch(/RETURNING \*$/);
    // The answer is the row as the database has it now.
    expect(res).toMatchObject({ ok: true, promo: { usageCount: 42 } });
  });

  it("says so when the code went between the read and the write", async () => {
    answer = (text) => (/^SELECT \* FROM "promos"/.test(text) ? [PROMO] : []);
    const res = await store.updatePromo(PROMO.id, {
      code: "YAZ25",
      kind: "pct",
      value: 25,
      minSubtotalMinor: 0,
      usageLimit: 100,
      expiresAt: "",
      isActive: true,
    });
    expect(res).toEqual({ ok: false, error: "Kod bulunamadı." });
  });
});

describe("deactivateNewsletterSubscriber", () => {
  it("says whether a row was there to change", async () => {
    vi.resetModules();
    const { deactivateNewsletterSubscriber } =
      await import("@/lib/newsletter/store");
    answer = (text) => (/^UPDATE /.test(text) ? [{ id: "nws-0004" }] : []);
    expect(await deactivateNewsletterSubscriber("nws-0004")).toBe(true);
    const update = seen.find((q) => /^UPDATE /.test(q.text));
    expect(update?.text).toMatch(/RETURNING "id"$/);
    answer = () => [];
    expect(await deactivateNewsletterSubscriber("nws-0004")).toBe(false);
  });
});

describe("adminUpdateCustomer and commercial consent (6563)", () => {
  const ROW = {
    id: "cus-0042",
    email: "uye@ornek.com",
    name: "Ayşe",
    phone: "",
    birthday: "",
    notificationPrefs: {
      orderUpdates: true,
      marketing: false,
      newsletter: true,
    },
    marketingConsentAt: "2026-05-01T09:00:00.000Z",
    isActive: true,
  };
  const input = (marketing: boolean, newsletter: boolean) => ({
    name: "Ayşe",
    phone: "",
    birthday: "",
    notificationPrefs: { orderUpdates: true, marketing, newsletter },
  });
  const row = (over: Record<string, unknown> = {}) => {
    answer = (text) =>
      /^SELECT \* FROM "customers"/.test(text) ? [{ ...ROW, ...over }] : [];
  };
  const updates = () => seen.filter((q) => /^UPDATE "customers"/.test(q.text));
  const ledger = () =>
    seen.filter((q) => /^INSERT INTO "customer_consents"/.test(q.text));

  it("refuses to switch marketing or the bulletin on, and writes nothing", async () => {
    // Panel OFF then ON put a withdrawn member back in the audiences under
    // the old date, and the ledger got an admin "grant".
    row();
    expect(
      await customers.adminUpdateCustomer("uye@ornek.com", input(true, true)),
    ).toEqual({ ok: false, error: "consent_grant", purposes: ["marketing"] });
    row({
      notificationPrefs: {
        orderUpdates: true,
        marketing: false,
        newsletter: false,
      },
    });
    expect(
      await customers.adminUpdateCustomer("uye@ornek.com", input(true, true)),
    ).toEqual({
      ok: false,
      error: "consent_grant",
      purposes: ["marketing", "newsletter"],
    });
    expect(updates()).toHaveLength(0);
    expect(ledger()).toHaveLength(0);
  });

  it("clears the consent date when the panel turns marketing off", async () => {
    row({
      notificationPrefs: {
        orderUpdates: true,
        marketing: true,
        newsletter: true,
      },
    });
    const res = await customers.adminUpdateCustomer(
      "uye@ornek.com",
      input(false, true),
    );
    expect(res.ok).toBe(true);
    const [update] = updates();
    expect(update.text).toContain('"marketingConsentAt" = $');
    expect(update.params).toContain("");
    // The withdrawal is the panel's, with no IP.
    const [insert] = ledger();
    expect(insert.text).toBeDefined();
    expect(JSON.stringify(insert.params)).toContain("admin");
  });

  it("keeps the date of a consent that stays on", async () => {
    row({
      notificationPrefs: {
        orderUpdates: true,
        marketing: true,
        newsletter: true,
      },
    });
    await customers.adminUpdateCustomer("uye@ornek.com", input(true, false));
    const [update] = updates();
    expect(update.text).not.toContain("marketingConsentAt");
  });

  it("answers not_found for an address with no member", async () => {
    answer = () => [];
    expect(
      await customers.adminUpdateCustomer("yok@ornek.com", input(false, false)),
    ).toEqual({ ok: false, error: "not_found" });
    expect(updates()).toHaveLength(0);
  });
});

describe("Müşteriler leaves closed accounts out (D13)", () => {
  const order = (customerEmail: string, customerName: string) => ({
    customerEmail,
    customerName,
    customerPhone: "0532 000 00 00",
    status: "delivered" as const,
    totalMinor: 25_000,
    refunds: [],
    createdAt: "2026-09-01T09:00:00.000Z",
  });

  it("drops the placeholder a closed account's orders point at", async () => {
    const { anonymizedEmail } = await import("@/lib/mobile/me");
    const closed = anonymizedEmail("cus-0042");
    expect(store.isClosedAccountEmail(closed)).toBe(true);
    expect(store.isClosedAccountEmail(closed.toUpperCase())).toBe(true);
    expect(store.isClosedAccountEmail("ayse@ornek.com")).toBe(false);
    // The orders keep the invoice name and phone (fiscal retention): keyed
    // on the placeholder, the roll-up listed the closed member by name.
    const rows = store.summarizeCustomers([
      order(closed, "Ayşe Yılmaz"),
      order("ali@ornek.com", "Ali"),
    ] as never);
    expect(rows.map((r) => r.email)).toEqual(["ali@ornek.com"]);
    expect(JSON.stringify(rows)).not.toContain("Ayşe");
  });

  it("the list page drops the anonymised member row too", () => {
    const page = readFileSync("src/app/admin/musteriler/page.tsx", "utf8");
    expect(page).toMatch(
      /\.filter\(\(m\) => !isClosedAccountEmail\(m\.email\)\)/,
    );
  });
});
