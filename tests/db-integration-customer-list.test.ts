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

import { applyBundledSchema } from "./_support/apply-schema";
import {
  holdSharedDatabase,
  SUITE_LOCK_WAIT_MS,
} from "./_support/db-suite-lock";

/**
 * Müşteriler's SQL (db/migrations/20261018120000_admin_customer_list.sql)
 * against a real Postgres, through the app's own readers
 * (lib/admin/customer-list.ts): the merge of member accounts with the order
 * roll-up follows the TypeScript rule (`summarizeCustomers`), the search
 * folds the Turkish I family on both sides, the tabs, filters, sorts and
 * pages hold. Skipped without a database:
 *
 *   TEST_DATABASE_URL=postgres://user@host:5432/db npm test
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

// Every row this suite writes carries it, and the searches are scoped by it:
// other suites share the database.
const PREFIX = "mlist-";
const ORDER_NO = 9_310_000;

interface Member {
  email: string;
  name: string;
  phone: string;
  isActive: boolean;
  emailVerified: boolean;
  marketing: boolean;
  createdAt: string;
}

interface Order {
  customerEmail: string;
  customerName: string;
  customerPhone: string;
  status: string;
  totalMinor: number;
  refunds: Array<{ amountMinor: number }>;
  createdAt: string;
}

const MEMBERS: Member[] = [
  {
    email: `${PREFIX}ayse@ornek.test`,
    name: "Ayşe Yılmaz",
    phone: "+90 532 111 22 33",
    isActive: true,
    emailVerified: true,
    marketing: true,
    createdAt: "2026-01-10T09:00:00.000Z",
  },
  {
    email: `${PREFIX}ismail@ornek.test`,
    name: "İsmail Kaya",
    phone: "",
    isActive: true,
    emailVerified: false,
    marketing: false,
    createdAt: "2026-02-01T09:00:00.000Z",
  },
  {
    email: `${PREFIX}pasif@ornek.test`,
    name: "Çağla Demir",
    phone: "",
    isActive: false,
    emailVerified: true,
    marketing: false,
    createdAt: "2026-03-01T09:00:00.000Z",
  },
  {
    email: `${PREFIX}Can@Ornek.test`,
    name: "Can Öz",
    phone: "",
    isActive: true,
    emailVerified: true,
    marketing: false,
    createdAt: "2026-03-05T09:00:00.000Z",
  },
  // A closed account: the placeholder address and nothing else (D13).
  {
    email: `${PREFIX}cst-9@anon.local`,
    name: "",
    phone: "",
    isActive: false,
    emailVerified: false,
    marketing: false,
    createdAt: "2026-01-02T09:00:00.000Z",
  },
];

const ORDERS: Order[] = [
  {
    customerEmail: `${PREFIX}ayse@ornek.test`,
    customerName: "Ayşe Y.",
    customerPhone: "0532 111 22 33",
    status: "paid",
    totalMinor: 15_000,
    refunds: [{ amountMinor: 2_000 }],
    createdAt: "2026-07-01T09:00:00.000Z",
  },
  {
    customerEmail: `${PREFIX}AYSE@ornek.test`,
    customerName: "Ayşe Y.",
    customerPhone: "0532 111 22 33",
    status: "completed",
    totalMinor: 25_000,
    refunds: [],
    createdAt: "2026-08-01T09:00:00.000Z",
  },
  {
    customerEmail: `${PREFIX}pasif@ornek.test`,
    customerName: "Çağla",
    customerPhone: "0555 000 00 00",
    status: "completed",
    totalMinor: 10_000,
    refunds: [],
    createdAt: "2026-04-15T09:00:00.000Z",
  },
  // A guest: four orders, two of which are no spend.
  {
    customerEmail: ` ${PREFIX}Guest@Ornek.test `,
    customerName: "IRMAK Su",
    customerPhone: "0544 333 22 11",
    status: "completed",
    totalMinor: 20_000,
    refunds: [],
    createdAt: "2026-05-01T09:00:00.000Z",
  },
  {
    customerEmail: `${PREFIX}guest@ornek.test`,
    customerName: "Irmak Su",
    customerPhone: "0544 333 22 11",
    status: "pending_payment",
    totalMinor: 99_000,
    refunds: [],
    createdAt: "2026-09-01T09:00:00.000Z",
  },
  {
    customerEmail: `${PREFIX}guest@ornek.test`,
    customerName: "Irmak Su",
    customerPhone: "0544 333 22 11",
    status: "cancelled",
    totalMinor: 5_000,
    refunds: [],
    createdAt: "2026-06-01T09:00:00.000Z",
  },
  {
    customerEmail: `${PREFIX}guest@ornek.test`,
    customerName: "Irmak Su",
    customerPhone: "0544 333 22 11",
    status: "refunded",
    totalMinor: 30_000,
    refunds: [{ amountMinor: 30_000 }],
    createdAt: "2026-04-01T09:00:00.000Z",
  },
  // The closed account's order keeps the invoice name (fiscal retention).
  {
    customerEmail: `${PREFIX}cst-9@anon.local`,
    customerName: "Kapalı Hesap",
    customerPhone: "0500 000 00 00",
    status: "completed",
    totalMinor: 40_000,
    refunds: [],
    createdAt: "2026-02-10T09:00:00.000Z",
  },
];

async function seed(): Promise<void> {
  for (const m of MEMBERS) {
    await pool!.query(
      `insert into public.customers
         (id, email, name, phone, "isActive", "emailVerified",
          "notificationPrefs", "marketingConsentAt", "createdAt", "updatedAt")
       values ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, $9, $9)`,
      [
        `cst-${m.email.toLowerCase()}`,
        m.email,
        m.name,
        m.phone,
        m.isActive,
        m.emailVerified,
        JSON.stringify({
          orderUpdates: true,
          marketing: m.marketing,
          newsletter: false,
        }),
        m.marketing ? "2026-01-10T09:00:00.000Z" : "",
        m.createdAt,
      ],
    );
  }
  let i = 0;
  for (const o of ORDERS) {
    i += 1;
    await pool!.query(
      `insert into public.orders (id, "orderNo", status, items, refunds,
         "totalMinor", "subtotalMinor", "createdAt", "customerEmail",
         "customerName", "customerPhone")
       values ($1, $2, $3, '[]'::jsonb, $4::jsonb, $5, $5, $6, $7, $8, $9)`,
      [
        `ord-${PREFIX}${i}`,
        ORDER_NO + i,
        o.status,
        JSON.stringify(o.refunds),
        o.totalMinor,
        o.createdAt,
        o.customerEmail,
        o.customerName,
        o.customerPhone,
      ],
    );
  }
}

/** The list as the old page built it: members merged with the roll-up. */
async function expectedRows() {
  const { summarizeCustomers, isClosedAccountEmail } =
    await import("@/lib/admin/store");
  const summaries = summarizeCustomers(ORDERS as never);
  const byEmail = new Map<string, Record<string, unknown>>();
  for (const m of MEMBERS) {
    if (isClosedAccountEmail(m.email)) continue;
    byEmail.set(m.email.toLowerCase(), {
      email: m.email,
      name: m.name,
      phone: m.phone,
      isMember: true,
      isActive: m.isActive,
      emailVerified: m.emailVerified,
      memberSince: m.createdAt,
      marketingConsent: m.marketing,
      orderCount: 0,
      lifetimeValueMinor: 0,
      refundedMinor: 0,
      lastOrderAt: "",
      lastActivity: m.createdAt,
    });
  }
  for (const s of summaries) {
    const row = byEmail.get(s.email);
    if (row) {
      Object.assign(row, {
        orderCount: s.orderCount,
        lifetimeValueMinor: s.lifetimeValueMinor,
        refundedMinor: s.refundedMinor,
        lastOrderAt: s.lastOrderAt,
        lastActivity: s.lastOrderAt || row.memberSince,
      });
      if (!row.name) row.name = s.name;
      if (!row.phone) row.phone = s.phone;
    } else {
      byEmail.set(s.email, {
        email: s.email,
        name: s.name,
        phone: s.phone,
        isMember: false,
        isActive: true,
        emailVerified: false,
        memberSince: "",
        marketingConsent: false,
        orderCount: s.orderCount,
        lifetimeValueMinor: s.lifetimeValueMinor,
        refundedMinor: s.refundedMinor,
        lastOrderAt: s.lastOrderAt,
        lastActivity: s.lastOrderAt,
      });
    }
  }
  return [...byEmail.values()];
}

async function read(
  text: string,
  over: {
    kind?: "all" | "members" | "guests" | "inactive";
    sort?: {
      key: "hareket" | "ad" | "siparis" | "harcama";
      dir: "asc" | "desc";
    };
    consent?: "" | "yes" | "no";
    verified?: "" | "yes" | "no";
    page?: number;
    pageSize?: number;
  } = {},
) {
  const { listCustomerPage } = await import("@/lib/admin/customer-list");
  const { customerSearch } = await import("@/lib/admin/customer-list-core");
  return listCustomerPage({
    query: {
      ...customerSearch(text),
      consent: over.consent ?? "",
      verified: over.verified ?? "",
    },
    kind: over.kind ?? "all",
    sort: over.sort ?? { key: "hareket", dir: "desc" },
    page: over.page ?? 1,
    pageSize: over.pageSize ?? 50,
  });
}

maybe("Müşteriler in SQL against a real Postgres", () => {
  let release: (() => Promise<void>) | undefined;

  beforeAll(async () => {
    release = await holdSharedDatabase(URL_!);
    pool = new pg.Pool({ connectionString: URL_, max: 4 });
    await applyBundledSchema(pool);
  }, SUITE_LOCK_WAIT_MS);

  afterAll(async () => {
    await pool?.query(`delete from public.orders where id like $1`, [
      `ord-${PREFIX}%`,
    ]);
    await pool?.query(`delete from public.customers where id like $1`, [
      `cst-${PREFIX}%`,
    ]);
    await pool?.end();
    pool = null;
    await release?.();
  });

  beforeEach(async () => {
    await pool!.query(`delete from public.orders where id like $1`, [
      `ord-${PREFIX}%`,
    ]);
    await pool!.query(`delete from public.customers where id like $1`, [
      `cst-${PREFIX}%`,
    ]);
    await seed();
  });

  it("merges members and orders by the TypeScript rule", async () => {
    const rows = await read(PREFIX);
    const expected = (await expectedRows()).sort(
      (a, b) =>
        String(b.lastActivity).localeCompare(String(a.lastActivity)) ||
        String(a.email)
          .toLowerCase()
          .localeCompare(String(b.email).toLowerCase()),
    );
    expect(rows).toEqual(expected);
    // Spot checks of the rule itself.
    const guest = rows.find((r) => r.email === `${PREFIX}guest@ornek.test`)!;
    expect(guest).toMatchObject({
      isMember: false,
      orderCount: 2,
      lifetimeValueMinor: 50_000,
      refundedMinor: 30_000,
      // The newest order of any status dates the activity.
      lastOrderAt: "2026-09-01T09:00:00.000Z",
      name: "Irmak Su",
    });
    const ayse = rows.find((r) => r.email === `${PREFIX}ayse@ornek.test`)!;
    expect(ayse).toMatchObject({
      isMember: true,
      orderCount: 2,
      lifetimeValueMinor: 40_000,
      refundedMinor: 2_000,
      marketingConsent: true,
      // The member's own name and phone win over the order's.
      name: "Ayşe Yılmaz",
      phone: "+90 532 111 22 33",
    });
    // The closed account is gone, member row and orders alike (D13).
    expect(JSON.stringify(rows)).not.toContain("anon.local");
    expect(JSON.stringify(rows)).not.toContain("Kapalı");
  });

  it("counts every tab under the same filters", async () => {
    const { countCustomers } = await import("@/lib/admin/customer-list");
    const { customerSearch } = await import("@/lib/admin/customer-list-core");
    const counts = await countCustomers({
      ...customerSearch(PREFIX),
      consent: "",
      verified: "",
    });
    expect(counts.all).toEqual({
      customers: 5,
      orderCount: 5,
      lifetimeValueMinor: 100_000,
      refundedMinor: 32_000,
    });
    expect(counts.members.customers).toBe(4);
    expect(counts.guests).toEqual({
      customers: 1,
      orderCount: 2,
      lifetimeValueMinor: 50_000,
      refundedMinor: 30_000,
    });
    expect(counts.inactive.customers).toBe(1);
    for (const kind of ["members", "guests", "inactive"] as const) {
      const rows = await read(PREFIX, { kind });
      expect(rows.length, kind).toBe(counts[kind].customers);
    }
  });

  it("finds İsmail for ismail, IRMAK for ırmak: the fold runs on both sides", async () => {
    const emails = async (text: string) =>
      (await read(text)).map((r) => r.email);
    for (const typed of ["ismail", "İSMAİL", "Ismail", "İsmail kaya"]) {
      expect(await emails(typed), typed).toContain(
        `${PREFIX}ismail@ornek.test`,
      );
    }
    for (const typed of ["ırmak", "irmak", "IRMAK"]) {
      expect(await emails(typed), typed).toContain(`${PREFIX}guest@ornek.test`);
    }
    expect(await emails("ÇAĞLA")).toContain(`${PREFIX}pasif@ornek.test`);
    // ç and c stay different letters.
    expect(await emails("cagla demir")).not.toContain(
      `${PREFIX}pasif@ornek.test`,
    );
    // The phone as typed, or as digits in another format.
    expect(await emails("0532 111 22 33")).toContain(
      `${PREFIX}ayse@ornek.test`,
    );
    expect(await emails("5321112233")).toContain(`${PREFIX}ayse@ornek.test`);
    // A LIKE wildcard typed is a literal character.
    expect(await emails(`${PREFIX}%`)).toEqual([]);
  });

  it("filters on consent and verification, members only", async () => {
    const emails = async (o: Parameters<typeof read>[1]) =>
      (await read(PREFIX, o)).map((r) => r.email).sort();
    expect(await emails({ consent: "yes" })).toEqual([
      `${PREFIX}ayse@ornek.test`,
    ]);
    expect(await emails({ consent: "no" })).toEqual(
      [
        `${PREFIX}Can@Ornek.test`,
        `${PREFIX}ismail@ornek.test`,
        `${PREFIX}pasif@ornek.test`,
      ].sort(),
    );
    expect(await emails({ verified: "no" })).toEqual([
      `${PREFIX}ismail@ornek.test`,
    ]);
  });

  it("sorts by name in Turkish order, and by spend and orders", async () => {
    const names = async (dir: "asc" | "desc") =>
      (await read(PREFIX, { sort: { key: "ad", dir } })).map((r) => r.name);
    expect(await names("asc")).toEqual([
      "Ayşe Yılmaz",
      "Can Öz",
      "Çağla Demir",
      "Irmak Su",
      "İsmail Kaya",
    ]);
    expect(await names("desc")).toEqual([
      "İsmail Kaya",
      "Irmak Su",
      "Çağla Demir",
      "Can Öz",
      "Ayşe Yılmaz",
    ]);
    const spend = await read(PREFIX, { sort: { key: "harcama", dir: "desc" } });
    expect(spend.map((r) => r.lifetimeValueMinor)).toEqual([
      50_000, 40_000, 10_000, 0, 0,
    ]);
    const orders = await read(PREFIX, { sort: { key: "siparis", dir: "asc" } });
    expect(orders.map((r) => r.orderCount)).toEqual([0, 0, 1, 2, 2]);
  });

  it("pages without repeating or skipping anyone", async () => {
    const all = (await read(PREFIX)).map((r) => r.email);
    const pages = [];
    for (const page of [1, 2, 3]) {
      pages.push(
        ...(await read(PREFIX, { page, pageSize: 2 })).map((r) => r.email),
      );
    }
    expect(pages).toEqual(all);
    expect(await read(PREFIX, { page: 4, pageSize: 2 })).toEqual([]);
  });

  it("admin_fold_tr folds like foldTr", async () => {
    const { foldTr } = await import("@/lib/admin/text-fold");
    for (const word of [
      "İsmail",
      "ISPARTA",
      "ırmak",
      "Çağla ŞEKER",
      "ÖZGÜR Ünal",
      "i̇talyan",
      "Âşık Îmam Ûmran",
    ]) {
      const { rows } = await pool!.query<{ f: string }>(
        "select public.admin_fold_tr($1) as f",
        [word],
      );
      expect(rows[0].f, word).toBe(foldTr(word));
    }
  });
});
