import { createHmac } from "node:crypto";

import pg from "pg";
import { renderToStaticMarkup } from "react-dom/server";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import { adminSessionKey } from "@/lib/admin/session-key";
import { createDb, type Executor } from "@/lib/db/client";

import { applyBundledSchema } from "./_support/apply-schema";
import {
  holdSharedDatabase,
  SUITE_LOCK_WAIT_MS,
} from "./_support/db-suite-lock";

/**
 * Canlı durum for Personel and the top bar's köşk chip (UI-13), as the
 * security review of PR #189 checked them: against a REAL Postgres and the
 * REAL auth module (signed session cookies, account re-reads from
 * admin_users), with the real data-layer write hook expiring a Data Cache
 * stand-in, so the change marker moves as it does in production. Every SQL
 * statement the code sends is logged, so "no database" is measured, not
 * assumed. Skipped without a database:
 *
 *   TEST_DATABASE_URL=postgres://user@host:5432/db npm test
 *
 * The review's two findings (F1 Yoğun, F2 a promoted cashier) are
 * db-integration-venue-quick-findings; their fixed behaviour is pinned here
 * too.
 */

const URL_ = process.env.TEST_DATABASE_URL;
const maybe = URL_ ? describe : describe.skip;

process.env.ADMIN_SESSION_SECRET ??=
  "venue-review-session-secret-0123456789abcdef";

const h = vi.hoisted(() => ({
  cookie: undefined as string | undefined,
  queries: [] as string[],
  settingsReads: 0,
  hours: {} as Record<string, { open: string; close: string; closed: boolean }>,
  dc: new Map<string, { value: unknown; tags: string[] }>(),
  expired: [] as string[],
  revalidatedPaths: [] as string[],
}));

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) =>
      name === "laffogato_panel_session" && h.cookie !== undefined
        ? { name, value: h.cookie }
        : undefined,
    getAll: () => [],
    has: () => false,
    set: () => undefined,
    delete: () => undefined,
  }),
  headers: async () => new Headers(),
}));

vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    const err = new Error(`NEXT_REDIRECT:${url}`) as Error & {
      redirectTo: string;
    };
    err.redirectTo = url;
    throw err;
  },
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
  unstable_rethrow: () => undefined,
  usePathname: () => "/admin/mobil/canli-durum",
  useRouter: () => ({ refresh: () => undefined, push: () => undefined }),
}));

// The Next Data Cache, with tags: what change-marker.ts stores its marker in.
vi.mock("next/cache", () => ({
  unstable_cache:
    (
      fn: (...a: unknown[]) => Promise<unknown>,
      keyParts: string[] = [],
      opts: { tags?: string[] } = {},
    ) =>
    async (...args: unknown[]) => {
      const key = JSON.stringify([keyParts, args]);
      const hit = h.dc.get(key);
      if (hit) return hit.value;
      const value = await fn(...args);
      h.dc.set(key, { value, tags: opts.tags ?? [] });
      return value;
    },
  revalidateTag: (tag: string) => {
    h.expired.push(tag);
    for (const [k, e] of h.dc) if (e.tags.includes(tag)) h.dc.delete(k);
  },
  revalidatePath: (p: string) => {
    h.revalidatedPaths.push(p);
  },
}));

vi.mock("next/server", async (orig) => ({
  ...(await orig<Record<string, unknown>>()),
  after: () => undefined,
}));

// Production has the Data Cache on; vitest sets NODE_ENV=test, which turns
// it off. Turned on here so the marker path is the production one.
vi.mock("@/lib/cache/presentation", async (orig) => ({
  ...(await orig<typeof import("@/lib/cache/presentation")>()),
  presentationCacheEnabled: () => true,
}));

let pool: pg.Pool | null = null;
const execute: Executor = async (q) => {
  h.queries.push(q.text);
  if (!pool) throw new Error("pool not ready");
  const r = await pool.query(q.text, q.params as unknown[]);
  return {
    rows: (r.rows ?? []) as Record<string, unknown>[],
    rowCount: r.rowCount ?? 0,
  };
};

// The real data layer, with the real write hook (src/lib/db/index.ts).
vi.mock("@/lib/db", async (orig) => {
  const real = await orig<typeof import("@/lib/db")>();
  const tags = await import("@/lib/cache/tags");
  const db = createDb(execute, {
    onWrite: (t) => tags.expireTags(tags.tagsForWrite(t)),
  });
  return { ...real, getDb: () => db };
});

// Settings are counted as a database read (the real getSettings is one).
vi.mock("@/lib/admin/store", async (orig) => {
  const real = await orig<typeof import("@/lib/admin/store")>();
  return {
    ...real,
    getSettings: async () => {
      h.settingsReads++;
      return { weeklyHours: h.hours, karaokeCapacity: 8 };
    },
  };
});

const actions = await import("@/app/admin/mobil/canli-durum/actions");
const VenuePage = (await import("@/app/admin/mobil/canli-durum/page")).default;
const { venueSignal } = await import("@/lib/admin/venue-signal");
const { readChangeMarker } = await import("@/lib/admin/change-marker");
const { sessionBinding } = await import("@/lib/admin/poll-binding");
const { formatSignalCursor, parseSignalCursor } =
  await import("@/lib/admin/panel-signal-core");
const venue = await import("@/lib/mobile/venue");
const core = await import("@/lib/admin/venue-quick-core");
const { getDb } = await import("@/lib/db");
const { deniedPathFor } = await import("@/lib/admin/roles");

type Role = "owner" | "manager" | "staff" | "cashier";
const ACCOUNTS: Record<Role, { email: string; hash: string }> = {
  owner: {
    email: "review189-s-owner@laffogato.test",
    hash: "review189-s-owner",
  },
  manager: {
    email: "review189-s-manager@laffogato.test",
    hash: "review189-s-manager",
  },
  staff: {
    email: "review189-s-staff@laffogato.test",
    hash: "review189-s-staff",
  },
  cashier: {
    email: "review189-s-cashier@laffogato.test",
    hash: "review189-s-cashier",
  },
};

/** The cookie auth.ts issues (signToken), built the same way. */
function tokenFor(
  email: string,
  role: string,
  passwordHash: string,
  expiresAt = Date.now() + 3_600_000,
): string {
  const secret = process.env.ADMIN_SESSION_SECRET!;
  const fp = createHmac("sha256", secret)
    .update(`fp|db|${passwordHash}`)
    .digest("hex")
    .slice(0, 24);
  const payload = `${email}|${role}|${expiresAt}|${fp}`;
  const sig = createHmac("sha256", adminSessionKey(secret))
    .update(payload)
    .digest("hex");
  return `${payload}|${sig}`;
}
/** One cookie per role for the whole file (a fresh expiry is a new cookie). */
const EXPIRES = Date.now() + 6 * 3_600_000;
const token = (role: Role) =>
  tokenFor(ACCOUNTS[role].email, role, ACCOUNTS[role].hash, EXPIRES);

const ROW = {
  id: "main",
  manualOverride: "auto",
  freeTables: 3,
  totalTables: 12,
  wifi: "slow",
  noise: "high",
  power: false,
  note: "Maç gecesi",
  updatedAt: "2026-10-19T18:00:00.000Z",
};

const ALWAYS = { open: "00:00", close: "24:00", closed: false };
const allDays = (d: { open: string; close: string; closed: boolean }) => ({
  mon: { ...d },
  tue: { ...d },
  wed: { ...d },
  thu: { ...d },
  fri: { ...d },
  sat: { ...d },
  sun: { ...d },
});

async function putRow(row: Record<string, unknown> = ROW) {
  await pool!.query(`delete from public.venue_status`);
  const cols = Object.keys(row);
  await pool!.query(
    `insert into public.venue_status (${cols.map((c) => `"${c}"`).join(", ")})
     values (${cols.map((_, i) => `$${i + 1}`).join(", ")})`,
    cols.map((c) => row[c]),
  );
}
async function readRow() {
  return (await pool!.query(`select * from public.venue_status`)).rows;
}
async function putAccounts() {
  for (const [role, a] of Object.entries(ACCOUNTS)) {
    await pool!.query(
      `insert into public.admin_users (email, "passwordHash", role, "isActive")
       values ($1, $2, $3, true)
       on conflict (email) do update set "passwordHash" = excluded."passwordHash",
         role = excluded.role, "isActive" = true`,
      [a.email, a.hash, role],
    );
  }
}

/** Resolves to the redirect target, or null when there was none. */
async function redirectOf(p: Promise<unknown>): Promise<string | null> {
  try {
    await p;
    return null;
  } catch (err) {
    const to = (err as { redirectTo?: string }).redirectTo;
    if (typeof to === "string") return to;
    throw err;
  }
}

/** A FormData that records which fields were read. */
function trackedForm(fields: Record<string, string>) {
  const reads: string[] = [];
  const fd = {
    get: (name: string) => {
      reads.push(name);
      return Object.prototype.hasOwnProperty.call(fields, name)
        ? fields[name]
        : null;
    },
  } as unknown as FormData;
  return { fd, reads };
}
function form(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
}

const venueWrites = () =>
  h.queries.filter((q) => /^(UPDATE|INSERT)/.test(q) && /venue_status/.test(q));
const venueReads = () =>
  h.queries.filter((q) => /^SELECT/.test(q) && /venue_status/.test(q));
const accountReads = () =>
  h.queries.filter((q) => /^SELECT/.test(q) && /admin_users/.test(q));

/** A marker made an hour ago (settled), as a long-open tab would hold. */
async function settleMarker(
  madeAt: number = Date.now() - 3_600_000,
): Promise<string> {
  for (const k of [...h.dc.keys()]) {
    if (k.includes("laf-marker-venue")) h.dc.delete(k);
  }
  const spy = vi.spyOn(Date, "now").mockReturnValue(madeAt);
  try {
    const m = await readChangeMarker("venue");
    if (!m) throw new Error("no marker");
    return m;
  } finally {
    spy.mockRestore();
  }
}

async function auditRows(email: string) {
  return (
    await pool!.query(
      `select actor, action, entity, "entityId", payload from public.audit_logs
       where entity = 'venue_status' and actor = $1 order by id`,
      [email],
    )
  ).rows as {
    actor: string;
    action: string;
    entity: string;
    entityId: string;
    payload: Record<string, unknown>;
  }[];
}

maybe("Canlı durum and the köşk chip (real auth, real Postgres)", () => {
  let release: (() => Promise<void>) | undefined;
  let before: Record<string, unknown>[] = [];

  beforeAll(async () => {
    release = await holdSharedDatabase(URL_!);
    pool = new pg.Pool({ connectionString: URL_, max: 6 });
    await applyBundledSchema(pool);
    before = await readRow();
  }, SUITE_LOCK_WAIT_MS);

  afterAll(async () => {
    if (pool) {
      await pool.query(`delete from public.venue_status`);
      for (const row of before) await putRow(row);
      await pool.query(
        `delete from public.admin_users where email like 'review189-s-%'`,
      );
      await pool.end();
    }
    pool = null;
    await release?.();
  });

  beforeEach(async () => {
    await putRow();
    await putAccounts();
    h.cookie = undefined;
    h.hours = allDays(ALWAYS);
    h.dc.clear();
    h.expired = [];
    h.revalidatedPaths = [];
    h.queries = [];
    h.settingsReads = 0;
  });

  // ── 1. Access ────────────────────────────────────────────────────────

  describe("the page", () => {
    it("signed out and the cashier are redirected before anything is read", async () => {
      expect(await redirectOf(VenuePage())).toBe("/admin/giris");
      h.cookie = token("cashier");
      expect(await redirectOf(VenuePage())).toBe(deniedPathFor("cashier"));
      expect(venueReads()).toEqual([]);
      expect(h.settingsReads).toBe(0);
    });

    it("owner, manager and Personel open it; only Personel sees the total read-only and unnamed", async () => {
      for (const role of ["owner", "manager", "staff"] as const) {
        h.cookie = token(role);
        const html = renderToStaticMarkup(await VenuePage());
        const named = /name="totalTables"/.test(html);
        expect({ role, named }).toEqual({ role, named: role !== "staff" });
        if (role === "staff") {
          expect(html).toContain("data-venue-total-readonly");
          expect(html).toContain('value="12"');
        }
      }
    });
  });

  describe("every export of the 'use server' file gates itself (rule 27)", () => {
    it("the file exports exactly three async functions", () => {
      expect(Object.keys(actions).sort()).toEqual([
        "saveVenueQuickAction",
        "saveVenueStatusAction",
        "venueQuickSignalAction",
      ]);
    });

    for (const who of ["none", "cashier"] as const) {
      it(`${who}: both save actions redirect before reading the form, and write nothing`, async () => {
        h.cookie = who === "none" ? undefined : token("cashier");
        const target =
          who === "none" ? "/admin/giris" : deniedPathFor("cashier");
        const full = trackedForm({
          manualOverride: "open",
          freeTables: "1",
          totalTables: "1",
          wifi: "down",
          noise: "low",
          note: "x",
        });
        expect(
          await redirectOf(actions.saveVenueStatusAction(null, full.fd)),
        ).toBe(target);
        const quick = trackedForm({ status: "closed", freeTables: "0" });
        expect(
          await redirectOf(actions.saveVenueQuickAction(null, quick.fd)),
        ).toBe(target);
        expect(full.reads).toEqual([]);
        expect(quick.reads).toEqual([]);
        expect(venueWrites()).toEqual([]);
        expect(await readRow()).toEqual([ROW]);
      });
    }

    it("a forged cookie (role edited, signature kept) is signed out for both actions", async () => {
      const real = token("cashier");
      h.cookie = real.replace("|cashier|", "|owner|");
      expect(
        await redirectOf(
          actions.saveVenueQuickAction(
            null,
            form({ status: "open", freeTables: "1" }),
          ),
        ),
      ).toBe("/admin/giris");
      expect(
        await redirectOf(
          actions.saveVenueStatusAction(
            null,
            form({ manualOverride: "open", freeTables: "1", totalTables: "1" }),
          ),
        ),
      ).toBe("/admin/giris");
      expect(venueWrites()).toEqual([]);
    });
  });

  describe("Personel and the table count", () => {
    it("the full form: a posted totalTables is ignored, the rest is written, the audit row names Personel", async () => {
      h.cookie = token("staff");
      const res = await actions.saveVenueStatusAction(
        null,
        form({
          manualOverride: "closed",
          freeTables: "2",
          totalTables: "2",
          wifi: "down",
          noise: "low",
          power: "on",
          note: "Erken kapanış",
        }),
      );
      expect(res.ok).toBe(true);
      const [row] = await readRow();
      expect(row).toMatchObject({
        manualOverride: "closed",
        freeTables: 2,
        totalTables: 12,
        wifi: "down",
        noise: "low",
        power: true,
        note: "Erken kapanış",
      });
      const audit = await auditRows(ACCOUNTS.staff.email);
      expect(audit.at(-1)).toMatchObject({
        action: "update",
        entity: "venue_status",
        entityId: "main",
      });
      expect(Object.keys(audit.at(-1)!.payload)).not.toContain("totalTables");
    });

    it("the full form: a posted total cannot make room for more free tables than the stored total", async () => {
      h.cookie = token("staff");
      const res = await actions.saveVenueStatusAction(
        null,
        form({
          manualOverride: "auto",
          freeTables: "20",
          totalTables: "30",
          wifi: "stable",
          noise: "medium",
          note: "",
        }),
      );
      expect(res.ok).toBe(false);
      expect(await readRow()).toEqual([ROW]);
    });

    it("the quick action reads only status and freeTables: total, Wi-Fi, noise, power and note are never written", async () => {
      h.cookie = token("staff");
      const q = trackedForm({
        status: "open",
        freeTables: "5",
        totalTables: "1",
        wifi: "down",
        noise: "low",
        power: "on",
        note: "hacked",
        manualOverride: "closed",
        updatedAt: "1999-01-01T00:00:00.000Z",
        id: "other",
      });
      const res = await actions.saveVenueQuickAction(null, q.fd);
      expect(res.ok).toBe(true);
      expect([...new Set(q.reads)].sort()).toEqual(["freeTables", "status"]);
      const [row] = await readRow();
      expect(row).toMatchObject({
        id: "main",
        manualOverride: "open",
        freeTables: 5,
        totalTables: 12,
        wifi: "slow",
        noise: "high",
        power: false,
        note: "Maç gecesi",
      });
      // One UPDATE that sets only the two fields and the time.
      const writes = venueWrites();
      expect(writes).toHaveLength(1);
      expect(writes[0]).toMatch(
        /^UPDATE "venue_status" SET "manualOverride" = \$1, "freeTables" = \$2, "updatedAt" = \$3 WHERE "id" = \$4 AND "totalTables" >= \$5 RETURNING \*$/,
      );
      const audit = await auditRows(ACCOUNTS.staff.email);
      expect(audit.at(-1)!.payload).toEqual({
        manualOverride: "open",
        freeTables: 5,
      });
      expect(h.revalidatedPaths).toContain("/admin/mobil/canli-durum");
    });

    it("the quick action parses before any write: junk is refused and nothing is written", async () => {
      h.cookie = token("staff");
      for (const fields of [
        { status: "auto'; drop table venue_status; --", freeTables: "1" },
        { status: "open", freeTables: "-1" },
        { status: "open", freeTables: "2.5" },
        { status: "open", freeTables: "1e3" },
        { status: "open", freeTables: "abc" },
        { freeTables: "1" },
        { status: "OPEN", freeTables: "1" },
      ]) {
        const res = await actions.saveVenueQuickAction(
          null,
          form(fields as Record<string, string>),
        );
        expect({ fields, ok: res.ok }).toEqual({ fields, ok: false });
      }
      expect(venueWrites()).toEqual([]);
      expect(await readRow()).toEqual([ROW]);
    });

    it("note: a missing or empty freeTables is not refused, z.coerce reads it as 0 (the full form's schema does the same on main)", async () => {
      h.cookie = token("staff");
      for (const fields of [
        { status: "open" },
        { status: "open", freeTables: "" },
        { status: "open", freeTables: "  " },
      ] as Record<string, string>[]) {
        await putRow();
        const res = await actions.saveVenueQuickAction(null, form(fields));
        expect({ fields, ok: res.ok }).toEqual({ fields, ok: true });
        expect((await readRow())[0]).toMatchObject({
          manualOverride: "open",
          freeTables: 0,
        });
      }
    });

    it("the quick action refuses more free tables than the stored total, writes nothing, no audit row", async () => {
      h.cookie = token("staff");
      const auditBefore = (await auditRows(ACCOUNTS.staff.email)).length;
      const res = await actions.saveVenueQuickAction(
        null,
        form({ status: "auto", freeTables: "13" }),
      );
      expect(res).toMatchObject({ ok: false });
      expect(await readRow()).toEqual([ROW]);
      expect((await auditRows(ACCOUNTS.staff.email)).length).toBe(auditBefore);
    });

    it("manager and owner change the total through the full form", async () => {
      for (const role of ["manager", "owner"] as const) {
        await putRow();
        h.cookie = token(role);
        const res = await actions.saveVenueStatusAction(
          null,
          form({
            manualOverride: "auto",
            freeTables: "2",
            totalTables: "8",
            wifi: "stable",
            noise: "medium",
            note: "",
          }),
        );
        expect(res.ok).toBe(true);
        expect((await readRow())[0]).toMatchObject({
          totalTables: 8,
          freeTables: 2,
        });
        expect(
          (await auditRows(ACCOUNTS[role].email)).at(-1)!.payload,
        ).toMatchObject({ totalTables: 8 });
      }
    });
  });

  // ── 2. The poll ──────────────────────────────────────────────────────

  describe("venueQuickSignalAction: who gets what, and what touches the database", () => {
    it("signed out, a bad signature and an expired cookie: no state and NO statement at all", async () => {
      const cases: (string | undefined)[] = [
        undefined,
        "",
        "garbage",
        token("cashier").replace("|cashier|", "|staff|"),
        tokenFor(
          ACCOUNTS.staff.email,
          "staff",
          ACCOUNTS.staff.hash,
          Date.now() - 1,
        ),
      ];
      for (const c of cases) {
        h.cookie = c;
        expect(await actions.venueQuickSignalAction("")).toEqual({
          status: null,
          cursor: "",
        });
      }
      expect(h.queries).toEqual([]);
      expect(h.settingsReads).toBe(0);
    });

    it("the cashier: no state, and no venue or settings read; the account decides, not the cookie (F2)", async () => {
      h.cookie = token("cashier");
      expect(await actions.venueQuickSignalAction("")).toEqual({
        status: null,
        cursor: "",
      });
      expect(accountReads().length).toBeGreaterThan(0);
      expect(venueReads()).toEqual([]);
      expect(h.settingsReads).toBe(0);
      // A cookie without the section never reads the marker: it could not
      // use a cursor anyway.
      expect([...h.dc.keys()].some((k) => k.includes("laf-marker-venue"))).toBe(
        false,
      );
    });

    it("owner, manager, Personel: a full answer re-reads the account and carries exactly five non-personal fields", async () => {
      for (const role of ["owner", "manager", "staff"] as const) {
        h.queries = [];
        h.cookie = token(role);
        const answer = await actions.venueQuickSignalAction("");
        expect("status" in answer && answer.status).toEqual({
          manualOverride: "auto",
          freeTables: 3,
          totalTables: 12,
          isOpen: true,
          saved: true,
        });
        expect(accountReads().length).toBeGreaterThan(0);
        const text = JSON.stringify(answer);
        expect(text).not.toMatch(/@|Maç|slow|high|review189/);
      }
    });

    it("cheap path: a settled cursor for the same session answers { unchanged: true } with NO statement", async () => {
      await settleMarker();
      h.cookie = token("staff");
      const first = await actions.venueQuickSignalAction("");
      expect("cursor" in first && first.cursor).toBeTruthy();
      h.queries = [];
      h.settingsReads = 0;
      const again = await actions.venueQuickSignalAction(
        (first as { cursor: string }).cursor,
      );
      expect(again).toEqual({ unchanged: true });
      expect(h.queries).toEqual([]);
      expect(h.settingsReads).toBe(0);
    });

    it("another account's cursor, a replay after a new sign-in, and forged cursors never answer from the cursor", async () => {
      await settleMarker();
      h.cookie = token("staff");
      const staffCursor = (
        (await actions.venueQuickSignalAction("")) as { cursor: string }
      ).cursor;
      const parsed = parseSignalCursor(staffCursor)!;
      expect(parsed.session).toBe(sessionBinding(token("staff")));

      // The manager's cookie with Personel's cursor: a full read for the manager.
      h.cookie = token("manager");
      h.queries = [];
      const m = await actions.venueQuickSignalAction(staffCursor);
      expect("status" in m).toBe(true);
      expect(accountReads().length).toBeGreaterThan(0);
      expect(parseSignalCursor((m as { cursor: string }).cursor)!.session).toBe(
        sessionBinding(token("manager")),
      );

      // Same account, new cookie (signed in again): the old cursor is not its.
      h.cookie = tokenFor(
        ACCOUNTS.staff.email,
        "staff",
        ACCOUNTS.staff.hash,
        Date.now() + 7_200_000,
      );
      h.queries = [];
      expect(
        "status" in (await actions.venueQuickSignalAction(staffCursor)),
      ).toBe(true);
      expect(accountReads().length).toBeGreaterThan(0);

      // Personel's own cookie, forged cursors: all full reads.
      h.cookie = token("staff");
      const now = Date.now();
      const forged: unknown[] = [
        formatSignalCursor(parsed.marker, parsed.key, "0123456789ab"),
        formatSignalCursor(
          `${(now - 3_600_000).toString(36)}-abc`,
          parsed.key,
          parsed.session,
        ),
        formatSignalCursor(
          parsed.marker,
          core.venueSignalKey(now - 60_000),
          parsed.session,
        ),
        formatSignalCursor(
          parsed.marker,
          core.venueSignalKey(now + 3 * 86_400_000),
          parsed.session,
        ),
        formatSignalCursor(parsed.marker, "2026-10-20", parsed.session),
        `${staffCursor}x`,
        staffCursor.repeat(3),
        42,
        { marker: parsed.marker, key: parsed.key, session: parsed.session },
        [staffCursor],
        null,
      ];
      for (const c of forged) {
        h.queries = [];
        const a = await actions.venueQuickSignalAction(c as string);
        expect({ c, full: "status" in a }).toEqual({ c, full: true });
        expect(accountReads().length).toBeGreaterThan(0);
      }

      // The one thing a session can forge for itself: a later key within the
      // day. It buys only `{ unchanged: true }`, which carries nothing.
      const selfForged = formatSignalCursor(
        parsed.marker,
        core.venueSignalKey(now + 20 * 3_600_000),
        parsed.session,
      );
      expect(await actions.venueQuickSignalAction(selfForged)).toEqual({
        unchanged: true,
      });
    });

    it("rule 30: demoted, deactivated or re-passworded through the data layer, the next poll gets no state", async () => {
      for (const change of [
        { role: "cashier" },
        { isActive: false },
        { passwordHash: "review189-s-new" },
      ]) {
        await putAccounts();
        await settleMarker();
        h.cookie = token("staff");
        const cursor = (
          (await actions.venueQuickSignalAction("")) as { cursor: string }
        ).cursor;
        expect(cursor).toBeTruthy();
        expect(await actions.venueQuickSignalAction(cursor)).toEqual({
          unchanged: true,
        });
        // The users page writes through the data layer: live:access expires.
        await getDb()
          .from("admin_users")
          .update(change)
          .eq("email", ACCOUNTS.staff.email);
        expect(h.expired).toContain("live:access");
        h.queries = [];
        const after = await actions.venueQuickSignalAction(cursor);
        expect({ change, after }).toEqual({
          change,
          after: { status: null, cursor: "" },
        });
        expect(accountReads().length).toBeGreaterThan(0);
        expect(venueReads()).toEqual([]);
      }
    });

    it("a full answer reads the account BEFORE the venue row and the hours", async () => {
      h.cookie = token("staff");
      await actions.venueQuickSignalAction("");
      const firstAccount = h.queries.findIndex(
        (q) => /^SELECT/.test(q) && /admin_users/.test(q),
      );
      const firstVenue = h.queries.findIndex(
        (q) => /^SELECT/.test(q) && /venue_status/.test(q),
      );
      expect(firstAccount).toBeGreaterThanOrEqual(0);
      expect(firstVenue).toBeGreaterThan(firstAccount);
    });

    it("a cashier promoted to Personel gets the status on the next poll, from the account, with no cursor for a cookie that names the old role (F2)", async () => {
      // The users page promotes the cashier; the session stays valid (the
      // fingerprint covers the password, not the role).
      const cashierCookie = token("cashier");
      await getDb()
        .from("admin_users")
        .update({ role: "staff" })
        .eq("email", ACCOUNTS.cashier.email);
      h.cookie = cashierCookie;
      // The page and the quick action re-read the account: open to them.
      const html = renderToStaticMarkup(await VenuePage());
      expect(html).toContain("Canlı durum");
      const res = await actions.saveVenueQuickAction(
        null,
        form({ status: "open", freeTables: "2" }),
      );
      expect(res.ok).toBe(true);
      // So does the chip's poll now, as panelSignal and the bell's route.
      h.queries = [];
      expect(await actions.venueQuickSignalAction("")).toEqual({
        status: {
          manualOverride: "open",
          freeTables: 2,
          totalTables: 12,
          isOpen: true,
          saved: true,
        },
        cursor: "",
      });
      expect(accountReads().length).toBeGreaterThan(0);
    });

    it("every venue write and every settings write moves the marker: the next poll reads in full", async () => {
      await settleMarker();
      h.cookie = token("staff");
      const cursor = (
        (await actions.venueQuickSignalAction("")) as { cursor: string }
      ).cursor;
      // A quick save from the chip.
      const res = await actions.saveVenueQuickAction(
        null,
        form({ status: "busy", freeTables: "7" }),
      );
      expect(res.ok).toBe(true);
      expect(h.expired).toContain("pub:site");
      const a = await actions.venueQuickSignalAction(cursor);
      expect("status" in a && a.status).toMatchObject({
        manualOverride: "auto",
        freeTables: 0,
      });
      // A refused one (free > total) still expires the tag (failure-safe).
      h.expired = [];
      await actions.saveVenueQuickAction(
        null,
        form({ status: "auto", freeTables: "99" }),
      );
      expect(h.expired).toContain("pub:site");
      // The owner's full save.
      h.expired = [];
      h.cookie = token("owner");
      await actions.saveVenueStatusAction(
        null,
        form({
          manualOverride: "auto",
          freeTables: "1",
          totalTables: "9",
          wifi: "stable",
          noise: "medium",
          note: "",
        }),
      );
      expect(h.expired).toContain("pub:site");
      // A settings write (the hours).
      h.expired = [];
      await getDb()
        .from("settings")
        .update({ id: "no-such-row" })
        .eq("id", "no-such-row");
      expect(h.expired).toContain("pub:site");
    });
  });

  describe("the hours turn on the köşk's clock (rule 22)", () => {
    const ist = (local: string) => Date.parse(`${local}+03:00`);

    it("a cursor read at 21:58:30 holds to 21:59:59.999 and not at 22:00:00 Istanbul (19:00Z)", async () => {
      h.hours = allDays({ open: "09:00", close: "22:00", closed: false });
      const t0 = ist("2026-10-20T21:58:30");
      // The marker an hour older than the instant asked about (not the
      // machine's clock: the test asks about a fixed evening).
      await settleMarker(t0 - 3_600_000);
      h.cookie = token("staff");
      const first = (await venueSignal("", t0)) as {
        status: { isOpen: boolean };
        cursor: string;
      };
      expect(first.status.isOpen).toBe(true);
      expect(parseSignalCursor(first.cursor)!.key).toBe(
        core.venueSignalKey(Date.parse("2026-10-20T19:00:00Z")),
      );
      expect(
        await venueSignal(first.cursor, ist("2026-10-20T21:59:59.999")),
      ).toEqual({
        unchanged: true,
      });
      const at22 = (await venueSignal(
        first.cursor,
        ist("2026-10-20T22:00:00"),
      )) as {
        status: { isOpen: boolean };
      };
      expect(at22.status.isOpen).toBe(false);
    });

    it("past midnight Istanbul (UTC still the day before): the overnight tail holds until 01:00 Istanbul", async () => {
      // Tuesday 09:00-01:00 runs past midnight; Wednesday is closed. At 00:30
      // Wednesday in Tuzla (21:30Z, still Tuesday in UTC) the köşk is open on
      // Tuesday's tail and turns at 01:00 Istanbul (22:00Z).
      h.hours = allDays({ open: "09:00", close: "01:00", closed: false });
      h.hours.wed = { open: "09:00", close: "01:00", closed: true };
      const t0 = ist("2026-10-21T00:30:00");
      await settleMarker(t0 - 3_600_000);
      h.cookie = token("staff");
      const first = (await venueSignal("", t0)) as {
        status: { isOpen: boolean };
        cursor: string;
      };
      expect(first.status.isOpen).toBe(true);
      expect(parseSignalCursor(first.cursor)!.key).toBe(
        core.venueSignalKey(ist("2026-10-21T01:00:00")),
      );
    });
  });

  // ── 3. Data integrity under concurrency ─────────────────────────────

  describe("patchVenueStatus under concurrency", () => {
    it("a quick save blocked behind a total-lowering save is refused against the NEW total (EvalPlanQual)", async () => {
      const x = await pool!.connect();
      try {
        await x.query("begin");
        await x.query(
          `update public.venue_status set "totalTables" = 5, "freeTables" = 2 where id = 'main'`,
        );
        let settled = false;
        const quick = venue
          .patchVenueStatus({ manualOverride: "auto", freeTables: 10 })
          .finally(() => {
            settled = true;
          });
        await new Promise((r) => setTimeout(r, 300));
        expect(settled).toBe(false); // waiting on the row lock
        await x.query("commit");
        expect(await quick).toBeNull();
        expect((await readRow())[0]).toMatchObject({
          totalTables: 5,
          freeTables: 2,
        });
      } finally {
        x.release();
      }
    });

    it("no row yet: the seed INSERT waits for a concurrent insert, never overwrites it, then decides on its total", async () => {
      await pool!.query(`delete from public.venue_status`);
      for (const [free, expected] of [
        [10, null],
        [4, 4],
      ] as const) {
        await pool!.query(`delete from public.venue_status`);
        const x = await pool!.connect();
        try {
          await x.query("begin");
          await x.query(
            `insert into public.venue_status (id, "manualOverride", "freeTables", "totalTables", wifi, noise, power, note, "updatedAt")
             values ('main', 'closed', 2, 5, 'down', 'low', false, 'owner', '2026-10-20T10:00:00.000Z')`,
          );
          const quick = venue.patchVenueStatus({
            manualOverride: "open",
            freeTables: free,
          });
          await new Promise((r) => setTimeout(r, 300));
          await x.query("commit");
          const saved = await quick;
          const [row] = await readRow();
          // The owner's row stands: total, Wi-Fi, noise, power, note.
          expect(row).toMatchObject({
            totalTables: 5,
            wifi: "down",
            noise: "low",
            power: false,
            note: "owner",
          });
          if (expected === null) {
            expect(saved).toBeNull();
            expect(row).toMatchObject({
              manualOverride: "closed",
              freeTables: 2,
            });
          } else {
            expect(saved).toMatchObject({
              freeTables: expected,
              totalTables: 5,
            });
            expect(row).toMatchObject({
              manualOverride: "open",
              freeTables: expected,
            });
          }
        } finally {
          x.release();
        }
      }
    });

    it("stress: two quick saves and a full save at once, 150 rounds: free <= total always, every answer agrees with the row", async () => {
      let rnd = 7;
      const next = (n: number) => {
        rnd = (rnd * 1103515245 + 12345) % 2147483648;
        return rnd % n;
      };
      for (let i = 0; i < 150; i++) {
        if (i % 3 === 0) await pool!.query(`delete from public.venue_status`);
        const total = next(15);
        const [a, b, c] = await Promise.all([
          venue.patchVenueStatus({
            manualOverride: "auto",
            freeTables: next(16),
          }),
          venue.patchVenueStatus({
            manualOverride: "open",
            freeTables: next(16),
          }),
          venue.updateVenueStatus({
            manualOverride: "closed",
            freeTables: Math.min(total, next(16)),
            totalTables: total,
            wifi: "stable",
            noise: "medium",
            power: true,
            note: `r${i}`,
          }),
        ]);
        const rows = await readRow();
        expect(rows).toHaveLength(1);
        expect(rows[0].freeTables).toBeLessThanOrEqual(rows[0].totalTables);
        for (const saved of [a, b, c]) {
          if (saved)
            expect(saved.freeTables).toBeLessThanOrEqual(saved.totalTables);
        }
      }
    }, 60_000);
  });

  // ── 4. Semantics: what the app shows after the chip's "Yoğun" (F1) ──

  describe("the chip's Yoğun is the full form's 'Boş masa 0'", () => {
    const ist = (local: string) => new Date(`${local}+03:00`);

    it("after hours on an Açık night, the köşk stays open in the app (app orders too), as with the form's free tables = 0", async () => {
      h.hours = allDays({ open: "09:00", close: "22:00", closed: false });
      await putRow({ ...ROW, manualOverride: "open", freeTables: 4 });
      const at = ist("2026-10-20T23:30:00");
      const settings = { weeklyHours: h.hours, karaokeCapacity: 8 } as never;

      h.cookie = token("staff");
      await actions.saveVenueStatusAction(
        null,
        form({
          manualOverride: "open",
          freeTables: "0",
          wifi: "slow",
          noise: "high",
          note: "Maç gecesi",
        }),
      );
      const viaForm = venue.toLiveStatus(
        await venue.getVenueStatus(),
        settings,
        at,
      );

      await putRow({ ...ROW, manualOverride: "open", freeTables: 4 });
      const res = await actions.saveVenueQuickAction(
        null,
        form({ status: "busy", freeTables: "4" }),
      );
      expect(res.ok).toBe(true);
      const stored = await venue.getVenueStatus();
      const viaChip = venue.toLiveStatus(stored, settings, at);

      expect(viaForm).toMatchObject({
        isOpen: true,
        openLabel: "Şu an açık",
        freeTables: 0,
      });
      expect(viaChip).toMatchObject({
        isOpen: true,
        openLabel: "Şu an açık",
        freeTables: 0,
      });
      // placeAppOrder's cafe gate (store.ts) reads the same two inputs.
      expect(stored.manualOverride).toBe("open");
      expect(
        venue.isCafeOpenNow(h.hours as never, stored.manualOverride, at),
      ).toBe(true);
      // One UPDATE of the free tables alone: the open/closed is not sent.
      expect(venueWrites().at(-1)).toMatch(
        /^UPDATE "venue_status" SET "freeTables" = \$1, "updatedAt" = \$2 WHERE "id" = \$3 AND "totalTables" >= \$4 RETURNING \*$/,
      );
      // The audit row names what was written.
      expect((await auditRows(ACCOUNTS.staff.email)).at(-1)!.payload).toEqual({
        freeTables: 0,
      });
    });

    it("the chip names an Açık night with no free table 'Yoğun', and its popover opens on Yoğun", () => {
      const s = {
        manualOverride: "open" as const,
        freeTables: 0,
        totalTables: 12,
        isOpen: true,
        saved: true,
      };
      expect(core.venueChipState(s).label).toBe("Yoğun");
      expect(core.quickChoiceOf(s)).toBe("busy");
      // Choosing it writes the free tables alone, whatever count was shown.
      expect(core.quickPatchFor("busy", 0)).toEqual({ freeTables: 0 });
      expect(core.quickPatchFor("busy", 7)).toEqual({ freeTables: 0 });
    });

    it("within the hours, a manual Kapalı stays closed after the chip's Yoğun", async () => {
      h.hours = allDays({ open: "09:00", close: "22:00", closed: false });
      await putRow({ ...ROW, manualOverride: "closed", freeTables: 3 });
      h.cookie = token("staff");
      await actions.saveVenueQuickAction(
        null,
        form({ status: "busy", freeTables: "3" }),
      );
      const stored = await venue.getVenueStatus();
      expect(stored).toMatchObject({ manualOverride: "closed", freeTables: 0 });
      const at = ist("2026-10-20T15:00:00");
      expect(
        venue.toLiveStatus(
          stored,
          { weeklyHours: h.hours, karaokeCapacity: 8 } as never,
          at,
        ).isOpen,
      ).toBe(false);
    });
  });
});
