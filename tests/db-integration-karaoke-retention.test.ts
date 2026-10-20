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
 * Karaoke retention against a real Postgres (decision ASK-RETENTION,
 * db/migrations/20261020174226_karaoke_guest_retention.sql):
 *
 *   karaoke_guest_retention        three years after the booking day: the
 *                                  guest's name and address, every booking's
 *                                  contact address, phone and note, and the
 *                                  consent's IP and user agent;
 *   karaoke_reservation_retention  eleven years after it: the row.
 *
 * Every filter, both p_apply modes, the second run, and the whole path from
 * runRetention: the köşk's clock, one destruction record per applied run and
 * none for a report. Skipped without TEST_DATABASE_URL.
 *
 * The functions act on the whole table, so every row here is dated before
 * 2010 (no other suite writes a karaoke booking that old) and carries the
 * `krk-ret-` prefix; the suite checks the first and removes its own.
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

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/db")>();
  const db = createDb(execute);
  return { ...real, getDb: () => db };
});

const P = "krk-ret-";
const CONSENT = {
  acceptedAt: "2004-01-01T10:00:00.000Z",
  documents: ["karaoke-odasi-rezervasyon"],
  version: "1 Eylül 2004",
  confirmations: ["on-bilgilendirme", "hizmet-sozlesmesi", "kvkk-aydinlatma"],
  surface: "web",
  ip: "203.0.113.7",
  userAgent: "Mozilla/5.0 (Misafir)",
};

interface Booking {
  id: string;
  date: string;
  guest?: boolean;
  email?: string;
  name?: string;
  contactEmail?: string;
  contactPhone?: string;
  note?: string;
  legalConsent?: Record<string, unknown> | null;
  paymentStatus?: string;
  status?: string;
  hold?: string;
  startHour?: number;
}

async function book(b: Booking): Promise<void> {
  await pool!.query(
    `insert into public.karaoke_reservations
       (id, "customerEmail", "customerName", date, "startHour", hours, guests,
        status, guest, "contactEmail", "contactPhone", note, "legalConsent",
        "paymentStatus", "retentionHold", "createdAt", "updatedAt")
     values ($1, $2, $3, $4, $5, 1, 2, $6, $7, $8, $9, $10, $11, $12, $13,
             '2004-01-01T10:00:00.000Z', '2004-01-01T10:00:00.000Z')`,
    [
      `${P}${b.id}`,
      b.email ?? `misafir-${b.id}@ornek.com`,
      b.name ?? "Deniz Misafir",
      b.date,
      b.startHour ?? 20,
      b.status ?? "confirmed",
      b.guest ?? true,
      b.contactEmail ?? `iletisim-${b.id}@ornek.com`,
      b.contactPhone ?? "+905550001144",
      b.note ?? "Doğum günü, pasta getireceğiz",
      b.legalConsent === undefined ? JSON.stringify(CONSENT) : b.legalConsent,
      b.paymentStatus ?? "paid",
      b.hold ?? "",
    ],
  );
}

type Row = Record<string, unknown>;

async function rows(): Promise<Record<string, Row>> {
  const { rows: list } = await pool!.query<Row>(
    `select * from public.karaoke_reservations where id like $1 order by id`,
    [`${P}%`],
  );
  return Object.fromEntries(list.map((r) => [String(r.id).slice(P.length), r]));
}

async function guestRetention(cutoff: string, apply: boolean): Promise<number> {
  const { rows: r } = await pool!.query<{ n: number }>(
    "select public.karaoke_guest_retention($1, $2) as n",
    [cutoff, apply],
  );
  return r[0].n;
}

async function bookingRetention(
  cutoff: string,
  apply: boolean,
): Promise<number> {
  const { rows: r } = await pool!.query<{ n: number }>(
    "select public.karaoke_reservation_retention($1, $2) as n",
    [cutoff, apply],
  );
  return r[0].n;
}

/** The record rows a run filed under `at`. */
async function records(at: string): Promise<Row[]> {
  const { rows: r } = await pool!.query<Row>(
    `select * from public.audit_logs where entity = 'retention' and "entityId" = $1`,
    [at],
  );
  return r;
}

/** Runs filed under these instants, removed past the append-only trigger. */
const RUNS: string[] = [];

maybe("karaoke retention in a real Postgres", () => {
  let release: (() => Promise<void>) | undefined;

  beforeAll(async () => {
    release = await holdSharedDatabase(URL_!);
    pool = new pg.Pool({ connectionString: URL_, max: 4 });
    await applyBundledSchema(pool);
    // A booking this old from another suite would be counted with ours.
    const { rows: foreign } = await pool.query(
      `select id from public.karaoke_reservations
        where date < '2010-01-01' and id not like $1`,
      [`${P}%`],
    );
    expect(foreign, "another suite left a pre-2010 karaoke booking").toEqual(
      [],
    );
  }, SUITE_LOCK_WAIT_MS);

  beforeEach(async () => {
    await pool!.query(
      `delete from public.karaoke_reservations where id like $1`,
      [`${P}%`],
    );
  });

  afterAll(async () => {
    if (pool) {
      await pool.query(
        `delete from public.karaoke_reservations where id like $1`,
        [`${P}%`],
      );
      // The runs' destruction records are young: the append-only trigger
      // refuses their delete, so the table owner lifts it for this one
      // statement (as tests/db-integration-audit-append-only.test.ts does).
      if (RUNS.length > 0) {
        const client = await pool.connect();
        try {
          await client.query("begin");
          await client.query(
            "alter table public.audit_logs disable trigger audit_logs_retention_delete",
          );
          await client.query(
            `delete from public.audit_logs
              where entity = 'retention' and "entityId" = any($1::text[])`,
            [RUNS],
          );
          await client.query(
            "alter table public.audit_logs enable trigger audit_logs_retention_delete",
          );
          await client.query("commit");
        } catch (err) {
          await client.query("rollback");
          throw err;
        } finally {
          client.release();
        }
      }
      await pool.end();
    }
    pool = null;
    await release?.();
  });

  describe("karaoke_guest_retention (three years)", () => {
    const CUTOFF = "2005-06-01T09:00:00.000+03:00";

    it("clears a guest's identity and every contact detail, and nothing else", async () => {
      await book({ id: "g1", date: "2004-03-10" });
      expect(await guestRetention(CUTOFF, true)).toBe(1);
      const g1 = (await rows()).g1;
      expect(g1).toMatchObject({
        customerName: "",
        customerEmail: `anon-${P}g1@anon.local`,
        contactEmail: "",
        contactPhone: "",
        note: "",
        guest: true,
        // The booking itself stays for the books.
        date: "2004-03-10",
        status: "confirmed",
        paymentStatus: "paid",
        retentionHold: "",
      });
      // The consent loses where it came from, and only that (MSY m.20 keeps
      // the record itself).
      const { ip: _ip, userAgent: _ua, ...kept } = CONSENT;
      expect(g1.legalConsent).toEqual(kept);
    });

    it("keeps a member's own name and address, and clears the rest", async () => {
      await book({
        id: "m1",
        date: "2004-03-11",
        guest: false,
        email: "uye-m1@ornek.com",
        name: "Ece Üye",
      });
      expect(await guestRetention(CUTOFF, true)).toBe(1);
      expect((await rows()).m1).toMatchObject({
        customerName: "Ece Üye",
        customerEmail: "uye-m1@ornek.com",
        contactEmail: "",
        contactPhone: "",
        note: "",
      });
    });

    it("leaves a NULL consent NULL and keeps a consent without IP as it is", async () => {
      await book({ id: "n1", date: "2004-03-12", legalConsent: null });
      await book({
        id: "n2",
        date: "2004-03-13",
        legalConsent: { acceptedAt: "2004-01-01T10:00:00.000Z", version: "x" },
        contactEmail: "",
        contactPhone: "",
        note: "",
      });
      expect(await guestRetention(CUTOFF, true)).toBe(2);
      const after = await rows();
      expect(after.n1.legalConsent).toBeNull();
      expect(after.n2.legalConsent).toEqual({
        acceptedAt: "2004-01-01T10:00:00.000Z",
        version: "x",
      });
    });

    it("counts without writing when p_apply is false", async () => {
      await book({ id: "d1", date: "2004-03-14" });
      await book({ id: "d2", date: "2004-03-15", guest: false });
      const before = await rows();
      expect(await guestRetention(CUTOFF, false)).toBe(2);
      expect(await rows()).toEqual(before);
    });

    it("never counts a cleared row twice", async () => {
      await book({ id: "i1", date: "2004-03-16" });
      await book({ id: "i2", date: "2004-03-17", guest: false });
      expect(await guestRetention(CUTOFF, true)).toBe(2);
      const once = await rows();
      expect(await guestRetention(CUTOFF, false)).toBe(0);
      expect(await guestRetention(CUTOFF, true)).toBe(0);
      expect(await rows()).toEqual(once);
    });

    it("counts a half-cleared row once more, and finishes it", async () => {
      // Account deletion clears a member row's name, address and contact,
      // but not its note or the consent's IP (src/lib/mobile/me.ts).
      await book({
        id: "h1",
        date: "2004-03-18",
        guest: false,
        email: "deleted-cus-0042@anon.local",
        name: "",
        contactEmail: "",
        contactPhone: "",
      });
      expect(await guestRetention(CUTOFF, true)).toBe(1);
      expect((await rows()).h1).toMatchObject({
        customerEmail: "deleted-cus-0042@anon.local",
        note: "",
      });
      expect(await guestRetention(CUTOFF, true)).toBe(0);
    });

    it("compares the booking day with the cutoff's first ten characters", async () => {
      await book({ id: "c1", date: "2005-05-31", startHour: 18 });
      await book({ id: "c2", date: "2005-06-01", startHour: 18 });
      expect(await guestRetention(CUTOFF, true)).toBe(1);
      const after = await rows();
      expect(after.c1.customerName).toBe("");
      // The cutoff's own day is not before it: kept.
      expect(after.c2.customerName).toBe("Deniz Misafir");
    });

    it("skips an open payment, a held row and a malformed day", async () => {
      await book({
        id: "s1",
        date: "2004-04-01",
        paymentStatus: "pending",
        status: "requested",
      });
      await book({ id: "s2", date: "2004-04-02", paymentStatus: "refunding" });
      await book({
        id: "s3",
        date: "2004-04-03",
        hold: "Tüketici hakem heyeti",
      });
      await book({ id: "s4", date: "2004-4-4" });
      await book({ id: "s5", date: "" });
      const before = await rows();
      expect(await guestRetention(CUTOFF, false)).toBe(0);
      expect(await guestRetention(CUTOFF, true)).toBe(0);
      expect(await rows()).toEqual(before);
      // Cleared once the hold is lifted and the refund settles.
      await pool!.query(
        `update public.karaoke_reservations
            set "retentionHold" = '', "paymentStatus" = 'refunded', status = 'cancelled'
          where id in ($1, $2)`,
        [`${P}s2`, `${P}s3`],
      );
      expect(await guestRetention(CUTOFF, true)).toBe(2);
    });

    it("never writes the account deletion's placeholder", async () => {
      await book({ id: "p1", date: "2004-05-01" });
      await guestRetention(CUTOFF, true);
      const email = String((await rows()).p1.customerEmail);
      expect(email).toBe(`anon-${P}p1@anon.local`);
      expect(email.startsWith("deleted-")).toBe(false);
      // A guest row's own id: two guests never share one placeholder.
      await book({ id: "p2", date: "2004-05-02" });
      await guestRetention(CUTOFF, true);
      expect((await rows()).p2.customerEmail).toBe(`anon-${P}p2@anon.local`);
    });

    it("refuses a cutoff that is not a past day, writing nothing", async () => {
      await book({ id: "b1", date: "2004-06-01" });
      const before = await rows();
      for (const bad of ["zzzz", "", "2099-01-01T00:00:00.000Z"]) {
        await expect(guestRetention(bad, true), bad).rejects.toMatchObject({
          code: "22007",
        });
      }
      expect(await rows()).toEqual(before);
    });
  });

  describe("karaoke_reservation_retention (eleven years)", () => {
    const CUTOFF = "1997-05-25T09:00:00.000+03:00";

    it("deletes a booking past the cutoff day, keeps the boundary day", async () => {
      await book({ id: "o1", date: "1997-05-24" });
      await book({ id: "o2", date: "1997-05-25" });
      expect(await bookingRetention(CUTOFF, false)).toBe(1);
      expect(Object.keys(await rows()).sort()).toEqual(["o1", "o2"]);
      expect(await bookingRetention(CUTOFF, true)).toBe(1);
      expect(Object.keys(await rows())).toEqual(["o2"]);
      expect(await bookingRetention(CUTOFF, true)).toBe(0);
    });

    it("keeps an open payment, a held row and a malformed day", async () => {
      await book({
        id: "k1",
        date: "1996-01-01",
        paymentStatus: "pending",
        status: "requested",
      });
      await book({ id: "k2", date: "1996-01-02", paymentStatus: "refunding" });
      await book({ id: "k3", date: "1996-01-03", hold: "Resmî talep" });
      await book({ id: "k4", date: "1996-1-4" });
      expect(await bookingRetention(CUTOFF, false)).toBe(0);
      expect(await bookingRetention(CUTOFF, true)).toBe(0);
      expect(Object.keys(await rows()).sort()).toEqual([
        "k1",
        "k2",
        "k3",
        "k4",
      ]);
    });

    it("refuses a cutoff that is not a past day, deleting nothing", async () => {
      await book({ id: "z1", date: "1990-01-01" });
      await expect(bookingRetention("9999-12-31", true)).rejects.toMatchObject({
        code: "22007",
      });
      expect(Object.keys(await rows())).toEqual(["z1"]);
    });
  });

  describe("runRetention over the real functions", () => {
    // 00:30 on 2 Haziran 2008 in Tuzla, still 1 Haziran in UTC. Three
    // 366-day years earlier is 31 Mayıs 2005 on the köşk's clock (30 in
    // UTC); eleven are 25 Mayıs 1997.
    const NOW = "2008-06-01T21:30:00.000Z";

    it("reports without writing, then destroys and files one record", async () => {
      await book({ id: "r1", date: "2005-05-30" });
      await book({ id: "r2", date: "2005-05-31", startHour: 21 });
      await book({ id: "r3", date: "1997-05-24" });
      await book({ id: "r4", date: "2004-07-01", guest: false });
      const { runRetention } = await import("@/lib/retention");

      // Report mode: counts, no change, no record.
      const before = await rows();
      const dry = await runRetention({ now: new Date(NOW) });
      RUNS.push(NOW);
      const dryGuest = dry.results.find((r) => r.id === "karaoke-guest-data")!;
      const dryBooking = dry.results.find(
        (r) => r.id === "karaoke-reservations",
      )!;
      expect(dryGuest).toMatchObject({
        cutoff: "2005-05-31T00:30:00.000+03:00",
        matched: 3,
        destroyed: 0,
      });
      expect(dryGuest.error).toBeUndefined();
      expect(dryBooking).toMatchObject({
        cutoff: "1997-05-25T00:30:00.000+03:00",
        matched: 1,
        destroyed: 0,
      });
      expect(dry.recorded).toBe(false);
      expect(await rows()).toEqual(before);
      expect(await records(NOW)).toEqual([]);

      // Applied: r1 is on the köşk's day before the cutoff (the UTC day,
      // 30 Mayıs, would have kept it), r2 is the cutoff's own day.
      const run = await runRetention({ now: new Date(NOW), apply: true });
      const guest = run.results.find((r) => r.id === "karaoke-guest-data")!;
      const booking = run.results.find((r) => r.id === "karaoke-reservations")!;
      expect(guest).toMatchObject({ matched: 3, destroyed: 3 });
      expect(booking).toMatchObject({ matched: 1, destroyed: 1 });
      const after = await rows();
      expect(after.r1.customerEmail).toBe(`anon-${P}r1@anon.local`);
      expect(after.r2.customerName).toBe("Deniz Misafir");
      expect(after.r3).toBeUndefined();
      expect(after.r4.contactPhone).toBe("");

      // One record, by the system, counts only.
      expect(run.recorded).toBe(true);
      const filed = await records(NOW);
      expect(filed).toHaveLength(1);
      expect(filed[0]).toMatchObject({
        actor: "system",
        action: "bulk_delete",
        entity: "retention",
        entityId: NOW,
      });
      const payload = filed[0].payload as {
        at: string;
        results: Array<Record<string, unknown>>;
      };
      expect(payload.at).toBe(NOW);
      expect(
        payload.results.find((r) => r.id === "karaoke-guest-data"),
      ).toEqual({
        id: "karaoke-guest-data",
        table: "karaoke_reservations",
        cutoff: "2005-05-31T00:30:00.000+03:00",
        matched: 3,
        destroyed: 3,
      });
      const text = JSON.stringify(filed[0]);
      for (const personal of [
        "ornek.com",
        "Deniz",
        "+905550001144",
        "203.0.113.7",
        "Doğum günü",
        `${P}r1`,
      ]) {
        expect(text, personal).not.toContain(personal);
      }

      // The next run finds the cleared rows already cleared, and files its
      // own record.
      const NEXT = "2008-06-02T06:00:00.000Z";
      const again = await runRetention({ now: new Date(NEXT), apply: true });
      RUNS.push(NEXT);
      expect(
        again.results.find((r) => r.id === "karaoke-guest-data"),
      ).toMatchObject({ matched: 0, destroyed: 0 });
      expect(await records(NEXT)).toHaveLength(1);
      expect(await records(NOW)).toHaveLength(1);
    });
  });
});
