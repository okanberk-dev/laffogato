import { createHmac } from "node:crypto";

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
 * The two findings of the security review of PR #189 (UI-13, the köşk
 * chip), kept as they were written: both failed on 9cf0f85a. Real
 * Postgres, the real auth module (signed cookies, the account re-read from
 * admin_users) and the real data-layer write hook. Skipped without a
 * database:
 *
 *   TEST_DATABASE_URL=postgres://user@host:5432/db npm test
 *
 * F1: the chip's Yoğun wrote Otomatik with the free tables, so on an Açık
 * night after hours it closed the köşk in the app (placeAppOrder answered
 * cafe_closed) and within the hours it lifted a manual Kapalı. It now
 * writes the free tables alone.
 * F2: the poll's cheap gate trusted the cookie's role, so a cashier
 * promoted to Personel got no status until a new sign-in although the page
 * and the quick action allowed them. The account decides now.
 */

const URL_ = process.env.TEST_DATABASE_URL;
const maybe = URL_ ? describe : describe.skip;

process.env.ADMIN_SESSION_SECRET ??=
  "venue-review-session-secret-0123456789abcdef";

const h = vi.hoisted(() => ({
  cookie: undefined as string | undefined,
  hours: {} as Record<string, { open: string; close: string; closed: boolean }>,
  dc: new Map<string, { value: unknown; tags: string[] }>(),
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
    throw Object.assign(new Error(`NEXT_REDIRECT:${url}`), { redirectTo: url });
  },
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
  unstable_rethrow: () => undefined,
}));
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
    for (const [k, e] of h.dc) if (e.tags.includes(tag)) h.dc.delete(k);
  },
  revalidatePath: () => undefined,
}));
vi.mock("next/server", async (orig) => ({
  ...(await orig<Record<string, unknown>>()),
  after: () => undefined,
}));
vi.mock("@/lib/cache/presentation", async (orig) => ({
  ...(await orig<typeof import("@/lib/cache/presentation")>()),
  presentationCacheEnabled: () => true,
}));

let pool: pg.Pool | null = null;
const execute: Executor = async (q) => {
  if (!pool) throw new Error("pool not ready");
  const r = await pool.query(q.text, q.params as unknown[]);
  return {
    rows: (r.rows ?? []) as Record<string, unknown>[],
    rowCount: r.rowCount ?? 0,
  };
};
vi.mock("@/lib/db", async (orig) => {
  const real = await orig<typeof import("@/lib/db")>();
  const tags = await import("@/lib/cache/tags");
  const db = createDb(execute, {
    onWrite: (t) => tags.expireTags(tags.tagsForWrite(t)),
  });
  return { ...real, getDb: () => db };
});
vi.mock("@/lib/admin/store", async (orig) => {
  const real = await orig<typeof import("@/lib/admin/store")>();
  return {
    ...real,
    getSettings: async () => ({ weeklyHours: h.hours, karaokeCapacity: 8 }),
  };
});

const actions = await import("@/app/admin/mobil/canli-durum/actions");
const venue = await import("@/lib/mobile/venue");
const { getDb } = await import("@/lib/db");

const EXPIRES = Date.now() + 6 * 3_600_000;
function tokenFor(email: string, role: string, passwordHash: string): string {
  const secret = process.env.ADMIN_SESSION_SECRET!;
  const fp = createHmac("sha256", secret)
    .update(`fp|db|${passwordHash}`)
    .digest("hex")
    .slice(0, 24);
  const payload = `${email}|${role}|${EXPIRES}|${fp}`;
  const sig = createHmac("sha256", secret).update(payload).digest("hex");
  return `${payload}|${sig}`;
}
const STAFF = {
  email: "review189-f-staff@laffogato.test",
  hash: "review189-f-staff",
};
const CASHIER = {
  email: "review189-f-cashier@laffogato.test",
  hash: "review189-f-cash",
};

const ROW = {
  id: "main",
  manualOverride: "open",
  freeTables: 4,
  totalTables: 12,
  wifi: "slow",
  noise: "high",
  power: false,
  note: "Maç gecesi",
  updatedAt: "2026-10-20T18:00:00.000Z",
};
async function putRow(row: Record<string, unknown>) {
  await pool!.query(`delete from public.venue_status`);
  const cols = Object.keys(row);
  await pool!.query(
    `insert into public.venue_status (${cols.map((c) => `"${c}"`).join(", ")})
     values (${cols.map((_, i) => `$${i + 1}`).join(", ")})`,
    cols.map((c) => row[c]),
  );
}
function form(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
}
const day = { open: "09:00", close: "22:00", closed: false };
const WEEK = {
  mon: { ...day },
  tue: { ...day },
  wed: { ...day },
  thu: { ...day },
  fri: { ...day },
  sat: { ...day },
  sun: { ...day },
};

maybe("PR #189 review findings (both failed on 9cf0f85a)", () => {
  let release: (() => Promise<void>) | undefined;
  let before: Record<string, unknown>[] = [];

  beforeAll(async () => {
    release = await holdSharedDatabase(URL_!);
    pool = new pg.Pool({ connectionString: URL_, max: 4 });
    await applyBundledSchema(pool);
    before = (await pool.query(`select * from public.venue_status`)).rows;
  }, SUITE_LOCK_WAIT_MS);

  afterAll(async () => {
    if (pool) {
      await pool.query(`delete from public.venue_status`);
      for (const row of before) await putRow(row);
      await pool.query(
        `delete from public.admin_users where email like 'review189-f-%'`,
      );
      await pool.end();
    }
    pool = null;
    await release?.();
  });

  beforeEach(async () => {
    h.dc.clear();
    h.hours = WEEK;
    for (const [a, role] of [
      [STAFF, "staff"],
      [CASHIER, "cashier"],
    ] as const) {
      await pool!.query(
        `insert into public.admin_users (email, "passwordHash", role, "isActive")
         values ($1, $2, $3, true)
         on conflict (email) do update set "passwordHash" = excluded."passwordHash",
           role = excluded.role, "isActive" = true`,
        [a.email, a.hash, role],
      );
    }
  });

  it("F1: the chip's Yoğun on an Açık night after hours shows the app what the full form's 'no free table' shows (open, full)", async () => {
    // 23:30 in Tuzla, posted hours end at 22:00, the owner set Açık for a
    // match night; the room fills up.
    const at = new Date("2026-10-20T23:30:00+03:00");
    const settings = { weeklyHours: WEEK, karaokeCapacity: 8 } as never;
    h.cookie = tokenFor(STAFF.email, "staff", STAFF.hash);

    // What "the room is full" was on main: the form's Boş masa 0.
    await putRow(ROW);
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

    // The chip's Yoğun on the same night.
    await putRow(ROW);
    const res = await actions.saveVenueQuickAction(
      null,
      form({ status: "busy", freeTables: "4" }),
    );
    expect(res.ok).toBe(true);
    const stored = await venue.getVenueStatus();
    const viaChip = venue.toLiveStatus(stored, settings, at);

    expect(viaForm).toMatchObject({ isOpen: true, freeTables: 0 });
    // On 9cf0f85a: isOpen false, "Şu an kapalı", and placeAppOrder answered
    // cafe_closed (store.ts: isCafeOpenNow(hours, manualOverride, at)).
    expect(viaChip).toMatchObject({
      isOpen: viaForm.isOpen,
      openLabel: viaForm.openLabel,
      freeTables: 0,
    });
    expect(venue.isCafeOpenNow(WEEK as never, stored.manualOverride, at)).toBe(
      true,
    );
  });

  it("F2: a cashier promoted to Personel (same session, the fingerprint covers only the password) gets the chip's status, as the page and the quick action already allow", async () => {
    const cookie = tokenFor(CASHIER.email, "cashier", CASHIER.hash);
    await putRow({ ...ROW, manualOverride: "auto" });
    // Kullanıcılar → role Personel, written through the data layer.
    await getDb()
      .from("admin_users")
      .update({ role: "staff" })
      .eq("email", CASHIER.email);
    h.cookie = cookie;
    // The quick action re-reads the account: allowed.
    const saved = await actions.saveVenueQuickAction(
      null,
      form({ status: "auto", freeTables: "2" }),
    );
    expect(saved.ok).toBe(true);
    // The layout (account role) mounts the chip; its poll must answer.
    const answer = await actions.venueQuickSignalAction("");
    // On 9cf0f85a: { status: null, cursor: "" } until the next sign-in (up
    // to 7 days): the cheap gate trusted the cookie's role.
    expect("status" in answer && answer.status).toMatchObject({
      manualOverride: "auto",
      freeTables: 2,
      totalTables: 12,
    });
  });
});
