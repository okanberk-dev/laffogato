import { readFileSync } from "node:fs";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { TAG_KARAOKE, tagsForWrite } from "@/lib/cache/tags";
import {
  SIGNATURE_HEADER,
  TIMESTAMP_HEADER,
  verifySignature,
} from "@/lib/panel/karaoke-sync-core";

/**
 * The ping a karaoke write sends the köşk's panel (src/lib/panel/
 * karaoke-ping.ts, docs/PANEL-KARAOKE.md). What is pinned: it never runs
 * in the write's path (only from `after()`), never throws, sends one signed
 * request for a burst of writes, and stays silent while the link is off.
 * `after()` is a queue the test runs by hand; `fetch` is a stub.
 */

const h = vi.hoisted(() => ({
  tasks: [] as (() => unknown)[],
  refuse: false,
}));
vi.mock("next/server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/server")>()),
  after: (task: () => unknown) => {
    if (h.refuse) throw new Error("`after` was called outside a request scope");
    h.tasks.push(task);
  },
}));

const SECRET = "test-secret-0123456789-abcdefghijklmnop";
const fetchMock = vi.fn<typeof fetch>();

/** A fresh copy of the module: its burst state starts empty each time. */
async function load() {
  vi.resetModules();
  return import("@/lib/panel/karaoke-ping");
}

beforeEach(() => {
  h.tasks.length = 0;
  h.refuse = false;
  fetchMock.mockReset();
  fetchMock.mockResolvedValue(new Response(null, { status: 202 }));
  vi.stubGlobal("fetch", fetchMock);
  vi.stubEnv("KARAOKE_SYNC_SECRET", SECRET);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("scheduling", () => {
  it("does nothing while the link is not configured", async () => {
    vi.stubEnv("KARAOKE_SYNC_SECRET", "");
    const { pingPanelKaraoke } = await load();
    pingPanelKaraoke();
    expect(h.tasks).toHaveLength(0);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("sends nothing in the write's path, only from after()", async () => {
    const { pingPanelKaraoke } = await load();
    pingPanelKaraoke();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(h.tasks).toHaveLength(1);
    await h.tasks[0]();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("lets a burst of writes ride on one scheduled ping", async () => {
    const { pingPanelKaraoke } = await load();
    pingPanelKaraoke();
    pingPanelKaraoke();
    pingPanelKaraoke();
    expect(h.tasks).toHaveLength(1);
    await h.tasks[0]();
    // Once the send has started, the next write schedules its own.
    pingPanelKaraoke();
    expect(h.tasks).toHaveLength(2);
  });

  it("stops waiting on a schedule that never ran after ten seconds", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-21T10:00:00Z"));
    const { pingPanelKaraoke } = await load();
    pingPanelKaraoke();
    vi.setSystemTime(new Date("2026-10-21T10:00:09Z"));
    pingPanelKaraoke();
    expect(h.tasks).toHaveLength(1);
    vi.setSystemTime(new Date("2026-10-21T10:00:10.001Z"));
    pingPanelKaraoke();
    expect(h.tasks).toHaveLength(2);
  });

  it("outside a request does nothing and does not throw", async () => {
    const { pingPanelKaraoke } = await load();
    h.refuse = true;
    expect(() => pingPanelKaraoke()).not.toThrow();
    expect(h.tasks).toHaveLength(0);
    // Nothing was left pending: the next write in a request schedules.
    h.refuse = false;
    pingPanelKaraoke();
    expect(h.tasks).toHaveLength(1);
  });
});

describe("the request", () => {
  it("is a signed POST of no booking at all to the panel", async () => {
    const { pingPanelKaraoke } = await load();
    pingPanelKaraoke();
    await h.tasks[0]();
    const [target, init] = fetchMock.mock.calls[0];
    const url = new URL(String(target));
    expect(url.href).toBe("https://ladmin.laffogato.net/api/karaoke/ping");
    expect(init?.method).toBe("POST");
    expect(init?.cache).toBe("no-store");
    expect(init?.signal).toBeInstanceOf(AbortSignal);
    const headers = init?.headers as Record<string, string>;
    expect(headers["content-type"]).toBe("application/json");
    const body = String(init?.body);
    expect(Object.keys(JSON.parse(body)).sort()).toEqual(["at", "event"]);
    expect(JSON.parse(body).event).toBe("karaoke.changed");
    expect(
      verifySignature(SECRET, {
        method: "POST",
        url,
        body,
        timestamp: headers[TIMESTAMP_HEADER],
        signature: headers[SIGNATURE_HEADER],
      }),
    ).toBe(true);
  });

  it("goes to PANEL_URL when one is set", async () => {
    vi.stubEnv("PANEL_URL", "http://localhost:3000/");
    const { pingPanelKaraoke } = await load();
    pingPanelKaraoke();
    await h.tasks[0]();
    expect(String(fetchMock.mock.calls[0][0])).toBe(
      "http://localhost:3000/api/karaoke/ping",
    );
  });

  it("tries a dropped connection or a 5xx once more, a 4xx never", async () => {
    vi.useFakeTimers();
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const { sendPanelPing } = await load();
    const config = { secret: SECRET, panelUrl: "https://ladmin.laffogato.net" };

    fetchMock.mockReset();
    fetchMock
      .mockResolvedValueOnce(new Response(null, { status: 503 }))
      .mockResolvedValueOnce(new Response(null, { status: 202 }));
    const retried = sendPanelPing(config);
    await vi.advanceTimersByTimeAsync(2_000);
    expect(await retried).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);

    fetchMock.mockReset();
    fetchMock.mockResolvedValue(new Response(null, { status: 401 }));
    expect(await sendPanelPing(config)).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("never throws when the panel cannot be reached, and warns without the secret", async () => {
    vi.useFakeTimers();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    fetchMock.mockReset();
    fetchMock.mockRejectedValue(new TypeError("fetch failed"));
    const { pingPanelKaraoke } = await load();
    pingPanelKaraoke();
    const sent = h.tasks[0]() as Promise<boolean>;
    await vi.advanceTimersByTimeAsync(2_000);
    await expect(sent).resolves.toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(warn).toHaveBeenCalledTimes(1);
    const line = String(warn.mock.calls[0][0]);
    expect(line).toContain("ladmin.laffogato.net");
    expect(line).not.toContain(SECRET);

    // A second failure within minutes adds no second line.
    pingPanelKaraoke();
    const again = h.tasks[1]() as Promise<boolean>;
    await vi.advanceTimersByTimeAsync(2_000);
    await expect(again).resolves.toBe(false);
    expect(warn).toHaveBeenCalledTimes(1);
  });
});

describe("which writes ping", () => {
  it("every write that expires the karaoke tag, and no other", () => {
    expect(tagsForWrite({ table: "karaoke_reservations" })).toContain(
      TAG_KARAOKE,
    );
    expect(tagsForWrite({ fn: "karaoke_give_make_good_hour" })).toContain(
      TAG_KARAOKE,
    );
    expect(tagsForWrite({ fn: "karaoke_reservation_retention" })).toContain(
      TAG_KARAOKE,
    );
    expect(tagsForWrite({ table: "orders" })).not.toContain(TAG_KARAOKE);
    expect(tagsForWrite({ table: "customers" })).not.toContain(TAG_KARAOKE);
  });

  it("is wired once, in getDb's write hook, behind the karaoke tag", () => {
    const src = readFileSync("src/lib/db/index.ts", "utf8");
    expect(src).toMatch(
      // The menu's ping rides beside it (src/lib/panel/menu-ping.ts).
      /onWrite: \(target\) => \{\s*const tags = tagsForWrite\(target\);\s*expireTags\(tags\);\s*if \(tags\.includes\(TAG_KARAOKE\)\) pingPanelKaraoke\(\);\s*if \(tags\.includes\(TAG_MENU\)\) pingPanelMenu\(\);\s*\}/,
    );
    expect(src.match(/pingPanelKaraoke\(/g)).toHaveLength(1);
  });
});
