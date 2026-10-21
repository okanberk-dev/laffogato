import { readFileSync } from "node:fs";

import { beforeEach, describe, expect, it, vi } from "vitest";

import type { WeeklyHours } from "@/lib/admin/days";

/**
 * The köşk chip's poll (admin UI v2, UI-13): venueQuickSignalAction answers
 * through venueSignal (src/lib/admin/venue-signal.ts), the nav badges'
 * pattern (panel-signal.ts, #185) for a status instead of a count.
 *
 * What it must hold:
 * - a session of a role with Canlı durum, or nothing: signed out and a bad
 *   signature get no state without the database; a cookie whose role has
 *   no Canlı durum is decided by the account (the cashier gets nothing, a
 *   cashier promoted to Personel gets the status);
 * - a status only after the account was read again (rule 30), and the
 *   status is the venue's five public fields, nothing about anyone;
 * - while nothing was written and the hours have not turned, the answer is
 *   `{ unchanged: true }` with no account read and no status read: the
 *   chip does not keep Neon awake (docs/DATABASE.md "Uyanmalar").
 */

const getAdminSession = vi.fn();
const getVenueStatus = vi.fn();
const getSettings = vi.fn();
const signed = vi.hoisted(() => ({
  value: { email: "personel@laffogato.net", role: "staff" } as null | {
    email: string;
    role: string;
  },
}));
const marker = vi.hoisted(() => ({
  read: vi.fn(async (_kind: string): Promise<string | null> => null),
}));
/** The session cookie the request carries. */
const cookie = vi.hoisted(() => ({ value: "signed-token" }));

vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => ({ value: cookie.value }) }),
}));
vi.mock("@/lib/admin/change-marker", () => ({
  readChangeMarker: marker.read,
}));
vi.mock("@/lib/admin/auth", () => ({
  ADMIN_COOKIE_NAME: "laffogato_admin_session",
  getAdminSession,
  readSessionFromCookieValue: (v: string | undefined) =>
    v ? signed.value : null,
}));
vi.mock("@/lib/admin/store", () => ({ getSettings }));
vi.mock("@/lib/mobile/venue", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/mobile/venue")>();
  return { ...real, getVenueStatus };
});

const { venueSignal } = await import("@/lib/admin/venue-signal");
const core = await import("@/lib/admin/venue-quick-core");
const { formatSignalCursor } = await import("@/lib/admin/panel-signal-core");
const { sessionBinding } = await import("@/lib/admin/poll-binding");
const { isCafeOpenNow, isOpenByHours, nextOpenChangeAt } =
  await import("@/lib/mobile/venue");

/** Istanbul is UTC+3 all year: a wall-clock time there as an instant. */
const ist = (local: string) => Date.parse(`${local}+03:00`);

/** Every day 09:00 - 01:00, the house's posted hours (overnight close). */
function lateHours(): WeeklyHours {
  const day = { open: "09:00", close: "01:00", closed: false };
  return {
    mon: { ...day },
    tue: { ...day },
    wed: { ...day },
    thu: { ...day },
    fri: { ...day },
    sat: { ...day },
    sun: { ...day },
  };
}

const ROW = {
  id: "main",
  manualOverride: "auto",
  freeTables: 4,
  totalTables: 12,
  wifi: "slow",
  noise: "high",
  power: false,
  note: "Maç gecesi",
  updatedAt: "2026-10-20T09:00:00.000Z",
};

/** Tuesday 20 Oct 2026, 12:00 in Tuzla: open, the hours turn at 01:00. */
const NOON = ist("2026-10-20T12:00:00");
const CLOSES = ist("2026-10-21T01:00:00");
/** A marker made an hour before noon (settled), as change-marker.ts makes them. */
const M = `${(NOON - 3600_000).toString(36)}-k3j9x0q2`;
const cursorFor = (key: string, m = M, token = "signed-token") =>
  formatSignalCursor(m, key, sessionBinding(token));

beforeEach(() => {
  cookie.value = "signed-token";
  signed.value = { email: "personel@laffogato.net", role: "staff" };
  getAdminSession.mockReset();
  getAdminSession.mockResolvedValue({
    email: "personel@laffogato.net",
    role: "staff",
    expiresAt: 0,
  });
  getVenueStatus.mockReset();
  getVenueStatus.mockResolvedValue({ ...ROW });
  getSettings.mockReset();
  getSettings.mockResolvedValue({
    weeklyHours: lateHours(),
    notificationEmail: "sahip@laffogato.net",
  });
  marker.read.mockReset();
  marker.read.mockResolvedValue(M);
});

describe("venueSignal: the full answer", () => {
  it("re-reads the account and answers the venue's status, with a cursor good until the hours turn", async () => {
    const answer = await venueSignal("", NOON);
    expect(answer).toEqual({
      status: {
        manualOverride: "auto",
        freeTables: 4,
        totalTables: 12,
        isOpen: true,
        saved: true,
      },
      cursor: cursorFor(core.venueSignalKey(CLOSES)),
    });
    expect(getAdminSession).toHaveBeenCalledTimes(1);
    expect(getVenueStatus).toHaveBeenCalledTimes(1);
    expect(marker.read).toHaveBeenCalledWith("venue");
  });

  it("carries the five status fields and nothing about anyone (no PII)", async () => {
    const answer = await venueSignal("", NOON);
    expect("status" in answer && Object.keys(answer.status ?? {})).toEqual([
      ...core.VENUE_QUICK_STATUS_KEYS,
    ]);
    const wire = JSON.stringify(answer);
    // Not the account, not the settings' recipients, not the row's note.
    expect(wire).not.toContain("@");
    expect(wire).not.toContain("Maç gecesi");
    expect(wire).not.toMatch(/wifi|noise|power|note|email|updatedAt/);
  });

  it("reads the marker before the account and the status", async () => {
    await venueSignal("", NOON);
    const first = marker.read.mock.invocationCallOrder[0];
    expect(first).toBeLessThan(getAdminSession.mock.invocationCallOrder[0]);
    expect(first).toBeLessThan(getVenueStatus.mock.invocationCallOrder[0]);
    expect(first).toBeLessThan(getSettings.mock.invocationCallOrder[0]);
  });

  it("says Kapalı by the hours, and an Açık or Kapalı override holds for a day", async () => {
    const night = ist("2026-10-21T03:00:00");
    const closed = await venueSignal("", night);
    expect("status" in closed && closed.status?.isOpen).toBe(false);
    // Closed at 03:00, the hours open the house at 09:00.
    expect("status" in closed && closed.cursor).toBe(
      cursorFor(core.venueSignalKey(ist("2026-10-21T09:00:00"))),
    );

    getVenueStatus.mockResolvedValue({ ...ROW, manualOverride: "open" });
    const open = await venueSignal("", night);
    expect("status" in open && open.status?.isOpen).toBe(true);
    expect("status" in open && open.cursor).toBe(
      cursorFor(core.venueSignalKey(night + core.VENUE_SIGNAL_HORIZON_MS)),
    );
  });

  it("a status nobody saved is not a full room", async () => {
    getVenueStatus.mockResolvedValue({
      ...ROW,
      freeTables: 0,
      totalTables: 20,
      updatedAt: "",
    });
    const answer = await venueSignal("", NOON);
    expect("status" in answer && answer.status).toMatchObject({
      freeTables: 0,
      saved: false,
    });
  });

  it("a marker made moments ago is not vouched for: no cursor yet", async () => {
    marker.read.mockResolvedValue(`${NOON.toString(36)}-fr35h`);
    const answer = await venueSignal("", NOON);
    expect(answer).toMatchObject({ cursor: "" });
    expect("status" in answer && answer.status).not.toBeNull();
  });

  it("no cache (tests, LAF_DATA_CACHE=off, a failing cache): every poll is a full one", async () => {
    marker.read.mockResolvedValue(null);
    const first = await venueSignal("", NOON);
    expect(first).toMatchObject({ cursor: "" });
    await venueSignal(cursorFor(core.venueSignalKey(CLOSES)), NOON);
    expect(getAdminSession).toHaveBeenCalledTimes(2);
  });
});

describe("venueSignal: unchanged, without the database", () => {
  it("a current cursor answers unchanged: no account read, no status read", async () => {
    const first = (await venueSignal("", NOON)) as { cursor: string };
    getAdminSession.mockClear();
    getVenueStatus.mockClear();
    getSettings.mockClear();
    const later = NOON + 30 * 60_000;
    expect(await venueSignal(first.cursor, later)).toEqual({
      unchanged: true,
    });
    expect(getAdminSession).not.toHaveBeenCalled();
    expect(getVenueStatus).not.toHaveBeenCalled();
    expect(getSettings).not.toHaveBeenCalled();
  });

  it("ends when the hours turn: the poll after 01:00 reads again and says Kapalı", async () => {
    const first = (await venueSignal("", NOON)) as { cursor: string };
    expect(await venueSignal(first.cursor, CLOSES - 1)).toEqual({
      unchanged: true,
    });
    getAdminSession.mockClear();
    const after = await venueSignal(first.cursor, CLOSES);
    expect("status" in after && after.status?.isOpen).toBe(false);
    expect(getAdminSession).toHaveBeenCalledTimes(1);
  });

  it("ends with a write: a moved marker (status, hours or an account) reads again", async () => {
    const first = (await venueSignal("", NOON)) as { cursor: string };
    marker.read.mockResolvedValue(`${(NOON - 600_000).toString(36)}-n3w`);
    getVenueStatus.mockResolvedValue({ ...ROW, manualOverride: "closed" });
    const answer = await venueSignal(first.cursor, NOON + 60_000);
    expect("status" in answer && answer.status).toMatchObject({
      manualOverride: "closed",
      isOpen: false,
    });
  });

  it("answers unchanged only to the session the cursor was handed to (rule 30)", async () => {
    const first = (await venueSignal("", NOON)) as { cursor: string };
    getAdminSession.mockClear();
    // Another cookie, validly signed, whose account was deactivated before
    // the current marker was made: the account is read and refuses.
    cookie.value = "another-signed-token";
    getAdminSession.mockResolvedValue(null);
    expect(await venueSignal(first.cursor, NOON + 60_000)).toEqual({
      status: null,
      cursor: "",
    });
    expect(getAdminSession).toHaveBeenCalledTimes(1);
    expect(getVenueStatus).toHaveBeenCalledTimes(1);
  });

  it("junk, an old shape, another poll's cursor or a made-up key reads again", async () => {
    const reads = () => getAdminSession.mock.calls.length;
    for (const sent of [
      "junk",
      42,
      { cursor: "x" },
      `s1.${M}.open`,
      // The orders badge's cursor, same marker shape and session.
      cursorFor("open"),
      // A key past its minute, and one a year out.
      cursorFor(core.venueSignalKey(NOON - 60_000)),
      cursorFor(core.venueSignalKey(NOON + 365 * 86_400_000)),
    ]) {
      const before = reads();
      const answer = await venueSignal(sent, NOON);
      expect("status" in answer, String(sent)).toBe(true);
      expect(reads(), String(sent)).toBe(before + 1);
    }
  });
});

describe("venueSignal: who gets nothing", () => {
  it("signed out or a bad signature: no state, no database, no marker", async () => {
    signed.value = null;
    expect(
      await venueSignal(cursorFor(core.venueSignalKey(CLOSES)), NOON),
    ).toEqual({ status: null, cursor: "" });
    cookie.value = "";
    expect(await venueSignal("", NOON)).toEqual({ status: null, cursor: "" });
    expect(marker.read).not.toHaveBeenCalled();
    expect(getAdminSession).not.toHaveBeenCalled();
    expect(getVenueStatus).not.toHaveBeenCalled();
  });

  it("the cashier: no state, even with a current cursor; the account decides, the status is never read", async () => {
    signed.value = { email: "kasa@laffogato.net", role: "cashier" };
    getAdminSession.mockResolvedValue({
      email: "kasa@laffogato.net",
      role: "cashier",
      expiresAt: 0,
    });
    expect(
      await venueSignal(cursorFor(core.venueSignalKey(CLOSES)), NOON),
    ).toEqual({ status: null, cursor: "" });
    // A cookie without the section never reads the marker (it could not
    // use a cursor) and never answers from one.
    expect(marker.read).not.toHaveBeenCalled();
    expect(getAdminSession).toHaveBeenCalledTimes(1);
    expect(getVenueStatus).not.toHaveBeenCalled();
    expect(getSettings).not.toHaveBeenCalled();
  });

  it("a cashier promoted to Personel gets the status on the next poll, without a sign-in (PR #189 review, F2)", async () => {
    // The cookie still names the old role: its fingerprint covers the
    // password, not the role, so the session stands.
    signed.value = { email: "kasa@laffogato.net", role: "cashier" };
    getAdminSession.mockResolvedValue({
      email: "kasa@laffogato.net",
      role: "staff",
      expiresAt: 0,
    });
    const answer = await venueSignal(
      cursorFor(core.venueSignalKey(CLOSES)),
      NOON,
    );
    expect(answer).toEqual({
      status: {
        manualOverride: "auto",
        freeTables: 4,
        totalTables: 12,
        isOpen: true,
        saved: true,
      },
      // No cursor: the cookie's role could never use one. Every poll of
      // this session is a full one until the next sign-in.
      cursor: "",
    });
    expect(marker.read).not.toHaveBeenCalled();
  });

  it("an account demoted or switched off since sign-in: the account decides", async () => {
    for (const now of [
      null,
      { email: "personel@laffogato.net", role: "cashier", expiresAt: 0 },
    ]) {
      getAdminSession.mockResolvedValue(now);
      expect(await venueSignal("", NOON)).toEqual({
        status: null,
        cursor: "",
      });
    }
    expect(getVenueStatus).not.toHaveBeenCalled();
  });

  it("a status that cannot be read is no state, logged by the error's name only", async () => {
    getVenueStatus.mockRejectedValue(
      Object.assign(new Error("connect ECONNREFUSED personel@laffogato.net"), {
        name: "DbQueryError",
      }),
    );
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await venueSignal("", NOON)).toEqual({ status: null, cursor: "" });
    expect(err).toHaveBeenCalledWith(
      "[admin/venue-signal] köşk durumu okunamadı",
      "DbQueryError",
    );
    err.mockRestore();
  });

  it("an account that cannot be read propagates: the chip keeps what it shows", async () => {
    getAdminSession.mockRejectedValue(new Error("account unreadable"));
    await expect(venueSignal("", NOON)).rejects.toThrow(/unreadable/);
    expect(getVenueStatus).not.toHaveBeenCalled();
  });
});

describe("the action and the module", () => {
  it("venueQuickSignalAction answers through venueSignal and opens no gate of its own it could get wrong", () => {
    const actions = readFileSync(
      "src/app/admin/mobil/canli-durum/actions.ts",
      "utf8",
    );
    const body = actions.slice(
      actions.indexOf("export async function venueQuickSignalAction"),
    );
    expect(body).toMatch(/^[^}]*return venueSignal\(cursor\);\s*}/);
    // The poll's module is not a "use server" file: its exports are not
    // endpoints (rule 27).
    const signal = readFileSync("src/lib/admin/venue-signal.ts", "utf8");
    expect(signal).toMatch(/^import "server-only";/);
    expect(signal).not.toMatch(/^\s*["']use server["'];?\s*$/m);
    // Status and hours live, never from a cache.
    expect(signal).not.toMatch(
      /site-data|presentation|unstable_cache|getSiteSettings|getPublicSettings/,
    );
  });
});

describe("the cursor's key", () => {
  it("names the minute the answer holds until, and holds only before it", () => {
    const key = core.venueSignalKey(CLOSES);
    expect(key).toMatch(/^v[0-9a-z]+$/);
    expect(core.venueKeyHolds(key, CLOSES - 1)).toBe(true);
    expect(core.venueKeyHolds(key, CLOSES)).toBe(false);
    // Rounded up to the minute: never ends early.
    expect(
      core.venueKeyHolds(core.venueSignalKey(CLOSES - 30_000), CLOSES - 30_001),
    ).toBe(true);
  });

  it("never holds for a key from elsewhere or further out than a day", () => {
    for (const key of ["", "open", "2026-10-20", "v", "vZZ", "v-1", "x123"]) {
      expect(core.venueKeyHolds(key, NOON), key).toBe(false);
    }
    const day = core.VENUE_SIGNAL_HORIZON_MS;
    expect(core.venueKeyHolds(core.venueSignalKey(NOON + day), NOON)).toBe(
      true,
    );
    expect(
      core.venueKeyHolds(core.venueSignalKey(NOON + day + 120_000), NOON),
    ).toBe(false);
  });
});

describe("the answer as the browser reads it", () => {
  it("keeps unchanged, a valid status and its cursor; anything else is no state", () => {
    expect(core.readVenueAnswer({ unchanged: true })).toEqual({
      unchanged: true,
    });
    const status = {
      manualOverride: "open",
      freeTables: 2,
      totalTables: 12,
      isOpen: true,
      saved: true,
    };
    expect(core.readVenueAnswer({ status, cursor: "c" })).toEqual({
      status,
      cursor: "c",
    });
    // Unknown fields never reach the chip.
    expect(
      core.readVenueAnswer({
        status: { ...status, email: "a@b.co" },
        cursor: "c",
      }),
    ).toEqual({ status, cursor: "c" });
    for (const junk of [
      null,
      "x",
      { status: { ...status, manualOverride: "busy" } },
      { status: { ...status, freeTables: -1 } },
      { status: { ...status, totalTables: 1000 } },
      { status: { ...status, freeTables: 1.5 } },
      { status: { ...status, isOpen: "yes" } },
      { status: { ...status, saved: 1 } },
    ]) {
      expect(core.readVenueAnswer(junk)).toMatchObject({ status: null });
    }
    expect(core.readVenueAnswer({ status, cursor: 7 })).toEqual({
      status,
      cursor: "",
    });
  });
});

describe("nextOpenChangeAt (when the hours next turn the köşk)", () => {
  const MIN = 60_000;
  const DAY = 86_400_000;

  function week(
    days: Partial<Record<keyof WeeklyHours, [string, string] | "closed">>,
    fallback: [string, string] | "closed" = ["09:00", "01:00"],
  ): WeeklyHours {
    const out = {} as WeeklyHours;
    for (const d of [
      "mon",
      "tue",
      "wed",
      "thu",
      "fri",
      "sat",
      "sun",
    ] as const) {
      const v = days[d] ?? fallback;
      out[d] =
        v === "closed"
          ? { open: "09:00", close: "18:00", closed: true }
          : { open: v[0], close: v[1], closed: false };
    }
    return out;
  }

  const SCHEDULES: Record<string, WeeklyHours> = {
    overnight: week({}),
    daytime: week({}, ["08:30", "22:45"]),
    "24:00 close": week({}, ["10:00", "24:00"]),
    "closed Monday, late Friday": week({
      mon: "closed",
      fri: ["09:00", "03:15"],
      sat: ["11:00", "02:00"],
    }),
    "every day closed": week({}, "closed"),
    "round the clock": week({}, ["00:00", "24:00"]),
  };

  it.each(Object.keys(SCHEDULES))(
    "%s: matches a minute-by-minute scan",
    (name) => {
      const hours = SCHEDULES[name];
      // Two days of irregular instants, seconds included, from a Sunday
      // evening (the week's turn) on; the brute force reads every minute
      // of the three days they can reach, once.
      const from = ist("2026-10-18T20:13:00");
      const base = Math.floor(from / MIN) * MIN;
      const open = Array.from({ length: 3 * 24 * 60 + 1 }, (_, i) =>
        isOpenByHours(hours, new Date(base + i * MIN)),
      );
      const scan = (now: number): number | null => {
        const at = Math.floor((now - base) / MIN);
        for (let i = at + 1; base + i * MIN <= now + DAY; i++) {
          if (open[i] !== open[at]) return base + i * MIN;
        }
        return null;
      };
      for (
        let now = from + 27_000;
        now < from + 2 * DAY;
        now += 97 * MIN + 13_000
      ) {
        const got = nextOpenChangeAt(hours, "auto", new Date(now));
        expect(got?.getTime() ?? null, new Date(now).toISOString()).toBe(
          scan(now),
        );
      }
    },
  );

  it("an Açık or Kapalı override never turns", () => {
    for (const o of ["open", "closed"] as const) {
      expect(nextOpenChangeAt(lateHours(), o, new Date(NOON))).toBeNull();
      expect(isCafeOpenNow(lateHours(), o, new Date(NOON))).toBe(o === "open");
    }
  });

  it("on the minute itself the next turn is the following one", () => {
    const opens = ist("2026-10-21T09:00:00");
    expect(
      nextOpenChangeAt(lateHours(), "auto", new Date(opens))?.getTime(),
    ).toBe(ist("2026-10-22T01:00:00"));
    expect(
      nextOpenChangeAt(lateHours(), "auto", new Date(opens - 1))?.getTime(),
    ).toBe(opens);
  });

  it("looks no further than the horizon", () => {
    const night = ist("2026-10-21T03:00:00");
    expect(
      nextOpenChangeAt(lateHours(), "auto", new Date(night), 60 * MIN),
    ).toBeNull();
  });
});
