import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { KaraokeReservation } from "@/lib/mobile/karaoke-core";
import {
  PANEL_MAX_ROWS,
  SIGNATURE_HEADER,
  signedHeaders,
  TIMESTAMP_HEADER,
} from "@/lib/panel/karaoke-sync-core";

/**
 * `GET /api/panel/karaoke` - the köşk's panel reading a window of karaoke
 * bookings (docs/PANEL-KARAOKE.md). A route handler with no cookie session:
 * the shared-secret signature is the only gate, so every way of failing it
 * is pinned here, before the read is ever made. The read itself is a stub
 * (`listReservationsForAdmin` has its own tests).
 */

const listReservationsForAdmin = vi.hoisted(() => vi.fn());
vi.mock("@/lib/mobile/karaoke", () => ({ listReservationsForAdmin }));

const { GET } = await import("@/app/api/panel/karaoke/route");

const SECRET = "test-secret-0123456789-abcdefghijklmnop";
const BASE = "https://laffogato.net/api/panel/karaoke";

function booking(over: Partial<KaraokeReservation> = {}): KaraokeReservation {
  return {
    id: "krk-0001",
    customerEmail: "ayse@example.com",
    customerName: "Ayşe Yılmaz",
    date: "2026-10-24",
    startHour: 20,
    hours: 2,
    guests: 4,
    status: "confirmed",
    priceMinor: 200000,
    discountMinor: 0,
    totalMinor: 200000,
    note: "",
    createdAt: "2026-10-20T09:00:00.000Z",
    updatedAt: "2026-10-20T09:05:00.000Z",
    contactPhone: "+905551112233",
    paymentStatus: "paid",
    paymentRef: "PNK-1",
    channel: "web",
    ...over,
  } as KaraokeReservation;
}

/** A request the panel would send, signed `at` (now by default). */
function signed(query = "", at = Date.now(), secret = SECRET): Request {
  const url = new URL(`${BASE}${query}`);
  return new Request(url, {
    headers: signedHeaders(secret, "GET", url, "", at),
  });
}

beforeEach(() => {
  vi.stubEnv("KARAOKE_SYNC_SECRET", SECRET);
  // The panel's side alone; LafPOS's key on this route is pinned in
  // tests/panel-lafpos-key.test.ts.
  vi.stubEnv("LAFPOS_SYNC_SECRET", "");
  listReservationsForAdmin.mockReset();
  listReservationsForAdmin.mockResolvedValue([]);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("the gate", () => {
  it("is shut with 503 while the link is not configured", async () => {
    vi.stubEnv("KARAOKE_SYNC_SECRET", "");
    const res = await GET(signed());
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ error: "not_configured" });
    expect(listReservationsForAdmin).not.toHaveBeenCalled();
  });

  it("answers 401 to an unsigned, forged, replayed or retargeted request", async () => {
    const tries: Request[] = [
      new Request(BASE),
      signed("", Date.now(), `${SECRET}-other`),
      signed("", Date.now() - 6 * 60_000),
      new Request(BASE, {
        headers: {
          [TIMESTAMP_HEADER]: "1760000000",
          [SIGNATURE_HEADER]: "v1=",
        },
      }),
    ];
    // A signature for one window does not open another.
    const url = new URL(`${BASE}?from=2026-10-20`);
    tries.push(
      new Request(`${BASE}?from=2025-01-01`, {
        headers: signedHeaders(SECRET, "GET", url, ""),
      }),
    );
    for (const req of tries) {
      const res = await GET(req);
      expect(res.status).toBe(401);
      expect(await res.json()).toEqual({ error: "unauthorized" });
      expect(res.headers.get("cache-control")).toBe("no-store");
    }
    expect(listReservationsForAdmin).not.toHaveBeenCalled();
  });

  it("answers 400 to a signed request for a window it will not read", async () => {
    for (const query of [
      "?from=2026-02-30",
      "?from=2026-10-20&to=2026-10-19",
      "?from=2026-01-01&to=2027-12-31",
    ]) {
      const res = await GET(signed(query));
      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ error: "invalid_range" });
    }
    expect(listReservationsForAdmin).not.toHaveBeenCalled();
  });
});

describe("a signed read", () => {
  it("returns the window's bookings, earliest first, in the panel's shape", async () => {
    listReservationsForAdmin.mockResolvedValue([
      booking({ id: "krk-0003", date: "2026-10-25", startHour: 18 }),
      booking({ id: "krk-0002", date: "2026-10-24", startHour: 22, hours: 1 }),
      booking({ id: "krk-0001" }),
    ]);
    const res = await GET(signed("?from=2026-10-20&to=2026-10-31"));
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(listReservationsForAdmin).toHaveBeenCalledWith({
      from: "2026-10-20",
      to: "2026-10-31",
      limit: PANEL_MAX_ROWS + 1,
      ascending: true,
    });
    const body = await res.json();
    expect(body.from).toBe("2026-10-20");
    expect(body.to).toBe("2026-10-31");
    expect(body.complete).toBe(true);
    expect(Date.parse(body.now)).not.toBeNaN();
    expect(body.reservations.map((r: { id: string }) => r.id)).toEqual([
      "krk-0001",
      "krk-0002",
      "krk-0003",
    ]);
    expect(Object.keys(body.reservations[0]).sort()).toEqual(
      [
        "channel",
        "createdAt",
        "date",
        "endsAt",
        "firstName",
        "guests",
        "hours",
        "id",
        "note",
        "paymentStatus",
        "startHour",
        "startsAt",
        "status",
        "totalMinor",
        "updatedAt",
      ].sort(),
    );
    const text = JSON.stringify(body);
    expect(text).not.toContain("ayse@example.com");
    expect(text).not.toContain("+905551112233");
    expect(text).not.toContain("Yılmaz");
    expect(text).not.toContain("PNK-1");
  });

  it("reads yesterday to ninety days on when no window is named", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-20T22:30:00Z"));
    try {
      const res = await GET(signed());
      expect(res.status).toBe(200);
      expect(listReservationsForAdmin).toHaveBeenCalledWith({
        from: "2026-10-20",
        to: "2027-01-18",
        limit: PANEL_MAX_ROWS + 1,
        ascending: true,
      });
    } finally {
      vi.useRealTimers();
    }
  });

  it("says when the list was cut at the cap", async () => {
    listReservationsForAdmin.mockResolvedValue(
      Array.from({ length: PANEL_MAX_ROWS + 1 }, (_, i) =>
        booking({ id: `krk-${String(i).padStart(5, "0")}` }),
      ),
    );
    const body = await (await GET(signed())).json();
    expect(body.complete).toBe(false);
    expect(body.reservations).toHaveLength(PANEL_MAX_ROWS);
  });

  it("keeps the nearest days when the window is cut, and drops the far end", async () => {
    // The database's side of the read: the window's rows in the order the
    // route asks for, cut at its limit. Six bookings a day from 20 Oct on,
    // two days more than the cap holds.
    const pool = Array.from({ length: PANEL_MAX_ROWS + 12 }, (_, i) => {
      const day = new Date(Date.UTC(2026, 9, 20 + Math.floor(i / 6)));
      return booking({
        id: `krk-${String(i).padStart(5, "0")}`,
        date: day.toISOString().slice(0, 10),
        startHour: 12 + 2 * (i % 6),
      });
    });
    listReservationsForAdmin.mockImplementation(
      async (opts: { limit: number; ascending?: boolean }) => {
        const sorted = [...pool].sort(
          (a, b) =>
            (a.date < b.date ? -1 : a.date > b.date ? 1 : 0) ||
            a.startHour - b.startHour,
        );
        if (!opts.ascending) sorted.reverse();
        return sorted.slice(0, opts.limit);
      },
    );
    const body = await (
      await GET(signed("?from=2026-10-20&to=2027-11-20"))
    ).json();
    expect(body.complete).toBe(false);
    expect(body.reservations).toHaveLength(PANEL_MAX_ROWS);
    expect(body.reservations[0]).toMatchObject({
      id: "krk-00000",
      date: "2026-10-20",
      startHour: 12,
    });
    expect(body.reservations[1].id).toBe("krk-00001");
    // The rows past the cap are the latest ones of the window.
    const id = (i: number) => `krk-${String(i).padStart(5, "0")}`;
    expect(body.reservations.at(-1).id).toBe(id(PANEL_MAX_ROWS - 1));
  });

  it("drops a row it cannot place in time and keeps the rest", async () => {
    listReservationsForAdmin.mockResolvedValue([
      booking({ id: "krk-bad", date: "bozuk" }),
      booking({ id: "krk-good" }),
    ]);
    const body = await (await GET(signed())).json();
    expect(body.reservations.map((r: { id: string }) => r.id)).toEqual([
      "krk-good",
    ]);
  });

  it("answers 503 without detail when the bookings cannot be read", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    listReservationsForAdmin.mockRejectedValue(
      new Error("connect ECONNREFUSED"),
    );
    const res = await GET(signed());
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ error: "unavailable" });
    expect(error).toHaveBeenCalled();
  });
});
