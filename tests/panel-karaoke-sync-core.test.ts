import { describe, expect, it } from "vitest";

import type { KaraokeReservation } from "@/lib/mobile/karaoke-core";
import {
  canonicalQuery,
  canonicalString,
  DEFAULT_PANEL_URL,
  firstNameOf,
  istanbulDayOf,
  MAX_SKEW_SECONDS,
  PANEL_FIRST_NAME_MAX,
  PANEL_NOTE_MAX,
  panelSyncConfig,
  parsePanelRange,
  sign,
  SIGNATURE_HEADER,
  signedHeaders,
  sortForPanel,
  TIMESTAMP_HEADER,
  toPanelReservation,
  verifySignature,
  withinLafposKaraokeReach,
} from "@/lib/panel/karaoke-sync-core";

/**
 * The karaoke link with the köşk's panel (docs/PANEL-KARAOKE.md): the
 * signature both projects compute, the pull's window and the whitelisted
 * shape a booking leaves this site in.
 *
 * The two vectors below are pinned in the panel project's tests too: change
 * the canonical string here and the panel's requests start failing with 401,
 * so a change has to land on both sides at once.
 */

const SECRET = "test-secret-0123456789-abcdefghijklmnop";
const TS = 1760000000;
const AT = TS * 1000;

const PULL_URL = new URL(
  "https://laffogato.net/api/panel/karaoke?to=2026-12-31&from=2026-10-20",
);
const PING_URL = new URL("https://ladmin.laffogato.net/api/karaoke/ping");
const PING_BODY = JSON.stringify({
  event: "karaoke.changed",
  at: "2026-10-21T10:00:00.000Z",
});

describe("signature", () => {
  it("matches the vectors both projects pin", () => {
    expect(
      sign(SECRET, { timestamp: TS, method: "GET", url: PULL_URL, body: "" }),
    ).toBe("13a147fac8db7d7012e86b1a83c230ac4c2a5d15bef73877e3ebe1e6d668a1e4");
    expect(
      sign(SECRET, {
        timestamp: TS,
        method: "POST",
        url: PING_URL,
        body: PING_BODY,
      }),
    ).toBe("1d993513ad228ef2b3c43bc4c32c76d792a20aa4563d31001320cc95cfbd9c69");
  });

  it("matches the panel's three menu vectors (lafmaliyet tests/site-menusu.test.ts)", () => {
    // The menu link signs the same way (docs/PANEL-MENU.md): the panel pins
    // these for its ping, its read and its write; a change on either side
    // turns every menu request into a 401.
    const ping = new URL("https://ladmin.laffogato.net/api/menu/ping");
    const pingBody = JSON.stringify({
      event: "menu.changed",
      at: "2026-10-21T10:00:00.000Z",
    });
    expect(
      sign(SECRET, {
        timestamp: TS,
        method: "POST",
        url: ping,
        body: pingBody,
      }),
    ).toBe("42befa28874811a2862675ebb3a0950867b1542efe400fdea0cf2875b57c234f");
    const menu = new URL("https://laffogato.net/api/panel/menu");
    expect(
      sign(SECRET, { timestamp: TS, method: "GET", url: menu, body: "" }),
    ).toBe("68f8ceecb77b7f07754d5fa3ee46340cd3e19b3db03e61b0ea97c55479fa7737");
    const write = JSON.stringify({
      id: "mnu-0011",
      priceMinor: 14500,
      actor: "Selin",
    });
    expect(
      sign(SECRET, { timestamp: TS, method: "POST", url: menu, body: write }),
    ).toBe("41bf0fb6897f703c2364405b7afac695fa55c5ac736d955683fc42f74470e610");
  });

  it("matches the order and sales vectors the panel is to pin (senkron plan P2)", () => {
    // The bar screen's read, this site's ping, the one-tap stage and the
    // month's sales sign the same way (docs/PANEL-ORDERS.md,
    // docs/PANEL-SALES.md). Same secret and instant as above; the bodies are
    // the bytes each side builds: `createPanelPing`'s `{event, at}` and the
    // panel's `buildStageBody` order `{id, action, from, actor}`. The panel
    // is to pin these four in its own tests (lafmaliyet, senkron plan P2):
    // until then only this side guards them, and a change on either side
    // turns those requests into a 401.
    const orders = new URL("https://laffogato.net/api/panel/orders");
    expect(
      sign(SECRET, { timestamp: TS, method: "GET", url: orders, body: "" }),
    ).toBe("a2664bca1515711b3d757f1a9359c4866c7b864a51e6c547f779c8f8d1676401");
    const ping = new URL("https://ladmin.laffogato.net/api/orders/ping");
    const pingBody = JSON.stringify({
      event: "orders.changed",
      at: "2026-10-21T10:00:00.000Z",
    });
    expect(pingBody).toBe(
      '{"event":"orders.changed","at":"2026-10-21T10:00:00.000Z"}',
    );
    expect(
      sign(SECRET, {
        timestamp: TS,
        method: "POST",
        url: ping,
        body: pingBody,
      }),
    ).toBe("1f746949b11c4a3adbe74ac4e26ade3d82e05057f9ed61c864647e1e39b758b5");
    const stage = new URL("https://laffogato.net/api/panel/orders/stage");
    const tap = JSON.stringify({
      id: "ord-0042",
      action: "ready",
      from: "new",
      actor: "Selin",
    });
    expect(tap).toBe(
      '{"id":"ord-0042","action":"ready","from":"new","actor":"Selin"}',
    );
    expect(
      sign(SECRET, { timestamp: TS, method: "POST", url: stage, body: tap }),
    ).toBe("61bdc771bae90abcf187561a6657da487035c209f14553ecb7e66cb53c963ba3");
    const sales = new URL(
      "https://laffogato.net/api/panel/sales?month=2026-10",
    );
    expect(
      sign(SECRET, { timestamp: TS, method: "GET", url: sales, body: "" }),
    ).toBe("cc20c85f8eebb2ea76b79c12e3e0b7e327fbca21ebd519148231ee6a9bb69f89");
  });

  it("matches the table-call ack vector the panel is to pin (6 Kas 2026)", () => {
    // The bar screen's "Gördüm" on a table call (docs/PANEL-ORDERS.md "Masa
    // çağrıları"), signed like the stage tap: same secret and instant, the
    // body the bytes the panel builds, `{id, actor}` in that order. The
    // panel (lafmaliyet) pins the same value; a change on either side turns
    // every ack into a 401.
    const ack = new URL("https://laffogato.net/api/panel/calls/ack");
    const body = JSON.stringify({ id: "tcl-3f9a0c4b7d2e1a68", actor: "Selin" });
    expect(body).toBe('{"id":"tcl-3f9a0c4b7d2e1a68","actor":"Selin"}');
    expect(
      sign(SECRET, { timestamp: TS, method: "POST", url: ack, body }),
    ).toBe("cdda6260245ebae291a8a93e3e691144b393b3fb970335a1133e2b439df6d19a");
  });

  it("signs the instant, method, path, sorted query and body hash, not the host", () => {
    expect(
      canonicalString({
        timestamp: TS,
        method: "get",
        url: PULL_URL,
        body: "",
      }),
    ).toBe(
      [
        "1760000000",
        "GET",
        "/api/panel/karaoke",
        "from=2026-10-20&to=2026-12-31",
        "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
      ].join("\n"),
    );
    const www = new URL(PULL_URL);
    www.host = "www.laffogato.net";
    expect(
      sign(SECRET, { timestamp: TS, method: "GET", url: www, body: "" }),
    ).toBe(
      sign(SECRET, { timestamp: TS, method: "GET", url: PULL_URL, body: "" }),
    );
  });

  it("orders the query whatever order it was written in, and encodes it", () => {
    expect(
      canonicalQuery(new URLSearchParams("to=2026-12-31&from=2026-10-20")),
    ).toBe(
      canonicalQuery(new URLSearchParams("from=2026-10-20&to=2026-12-31")),
    );
    expect(canonicalQuery(new URLSearchParams("b=2&a=2&a=1"))).toBe(
      "a=1&a=2&b=2",
    );
    expect(canonicalQuery(new URLSearchParams("q=a b&ç=ş"))).toBe(
      "q=a%20b&%C3%A7=%C5%9F",
    );
    expect(canonicalQuery(new URLSearchParams())).toBe("");
  });

  it("verifies its own headers", () => {
    const headers = signedHeaders(SECRET, "POST", PING_URL, PING_BODY, AT);
    expect(headers[TIMESTAMP_HEADER]).toBe(String(TS));
    expect(headers[SIGNATURE_HEADER]).toBe(
      "v1=1d993513ad228ef2b3c43bc4c32c76d792a20aa4563d31001320cc95cfbd9c69",
    );
    expect(
      verifySignature(SECRET, {
        method: "POST",
        url: PING_URL,
        body: PING_BODY,
        timestamp: headers[TIMESTAMP_HEADER],
        signature: headers[SIGNATURE_HEADER],
        nowMs: AT,
      }),
    ).toBe(true);
  });

  describe("refuses", () => {
    const good = signedHeaders(SECRET, "GET", PULL_URL, "", AT);
    const check = (
      over: Partial<{
        secret: string;
        method: string;
        url: URL;
        body: string;
        timestamp: string | null;
        signature: string | null;
        nowMs: number;
      }> = {},
    ) =>
      verifySignature(over.secret ?? SECRET, {
        method: over.method ?? "GET",
        url: over.url ?? PULL_URL,
        body: over.body ?? "",
        timestamp:
          "timestamp" in over ? over.timestamp! : good[TIMESTAMP_HEADER],
        signature:
          "signature" in over ? over.signature! : good[SIGNATURE_HEADER],
        nowMs: over.nowMs ?? AT,
      });

    it("nothing, as long as nothing changed", () => {
      expect(check()).toBe(true);
    });

    it("a changed body, path, query or method", () => {
      expect(check({ body: "{}" })).toBe(false);
      expect(
        check({
          url: new URL(
            "https://laffogato.net/api/panel/other?to=2026-12-31&from=2026-10-20",
          ),
        }),
      ).toBe(false);
      expect(
        check({
          url: new URL(
            "https://laffogato.net/api/panel/karaoke?to=2027-12-31&from=2026-10-20",
          ),
        }),
      ).toBe(false);
      expect(
        check({ url: new URL("https://laffogato.net/api/panel/karaoke") }),
      ).toBe(false);
      expect(check({ method: "POST" })).toBe(false);
    });

    it("another secret", () => {
      expect(check({ secret: `${SECRET}x` })).toBe(false);
    });

    it("a stale or early request, past five minutes either way", () => {
      expect(check({ nowMs: AT + MAX_SKEW_SECONDS * 1000 })).toBe(true);
      expect(check({ nowMs: AT + (MAX_SKEW_SECONDS + 1) * 1000 })).toBe(false);
      expect(check({ nowMs: AT - (MAX_SKEW_SECONDS + 1) * 1000 })).toBe(false);
    });

    it("missing or malformed headers", () => {
      expect(check({ timestamp: null })).toBe(false);
      expect(check({ signature: null })).toBe(false);
      expect(check({ timestamp: "" })).toBe(false);
      expect(check({ timestamp: "1760000000.5" })).toBe(false);
      expect(check({ timestamp: "-1760000000" })).toBe(false);
      const hex = good[SIGNATURE_HEADER].slice(3);
      expect(check({ signature: hex })).toBe(false);
      expect(check({ signature: `v2=${hex}` })).toBe(false);
      expect(check({ signature: `v1=${hex.toUpperCase()}` })).toBe(false);
      expect(check({ signature: `v1=${hex.slice(0, 63)}` })).toBe(false);
      expect(check({ signature: `v1=${hex}00` })).toBe(false);
    });
  });
});

describe("configuration", () => {
  const secret = "s".repeat(32);

  it("is off without a secret, or with one too short to be one", () => {
    expect(panelSyncConfig({})).toBeNull();
    expect(panelSyncConfig({ KARAOKE_SYNC_SECRET: "" })).toBeNull();
    expect(panelSyncConfig({ KARAOKE_SYNC_SECRET: "s".repeat(31) })).toBeNull();
    expect(
      panelSyncConfig({ KARAOKE_SYNC_SECRET: `  ${"s".repeat(31)}  ` }),
    ).toBeNull();
  });

  it("defaults to the panel's address and trims what is pasted", () => {
    expect(panelSyncConfig({ KARAOKE_SYNC_SECRET: ` ${secret}\n` })).toEqual({
      secret,
      panelUrl: DEFAULT_PANEL_URL,
    });
    expect(
      panelSyncConfig({
        KARAOKE_SYNC_SECRET: secret,
        PANEL_URL: " https://panel.example.com// ",
      }),
    ).toEqual({ secret, panelUrl: "https://panel.example.com" });
  });

  it("accepts https, and plain http only on this machine", () => {
    const at = (PANEL_URL: string) =>
      panelSyncConfig({ KARAOKE_SYNC_SECRET: secret, PANEL_URL })?.panelUrl ??
      null;
    expect(at("http://localhost:3000")).toBe("http://localhost:3000");
    expect(at("http://127.0.0.1:3000")).toBe("http://127.0.0.1:3000");
    expect(at("http://ladmin.laffogato.net")).toBeNull();
    expect(at("ftp://ladmin.laffogato.net")).toBeNull();
    expect(at("not a url")).toBeNull();
  });
});

describe("the pull's window", () => {
  const range = (query: string, now = new Date("2026-10-21T12:00:00Z")) =>
    parsePanelRange(new URLSearchParams(query), now);

  it("defaults to yesterday in Istanbul and ninety days on", () => {
    expect(range("")).toEqual({ from: "2026-10-20", to: "2027-01-18" });
    // 22:30 UTC is already the next day in Tuzla (rule 22).
    expect(range("", new Date("2026-10-20T22:30:00Z"))).toEqual({
      from: "2026-10-20",
      to: "2027-01-18",
    });
    expect(istanbulDayOf(new Date("2026-10-20T20:59:59Z"))).toBe("2026-10-20");
    expect(istanbulDayOf(new Date("2026-10-20T21:00:00Z"))).toBe("2026-10-21");
    expect(range("from=2026-11-01")).toEqual({
      from: "2026-11-01",
      to: "2027-01-30",
    });
  });

  it("takes both ends as written, inclusive, up to 400 days", () => {
    expect(range("from=2026-10-20&to=2026-10-20")).toEqual({
      from: "2026-10-20",
      to: "2026-10-20",
    });
    expect(range("from=2026-01-01&to=2027-02-05")).toEqual({
      from: "2026-01-01",
      to: "2027-02-05",
    });
  });

  it("refuses a malformed day, a backwards window and a wider one", () => {
    expect(range("from=2026-02-30")).toBeNull();
    expect(range("from=2026-10-2")).toBeNull();
    expect(range("from=")).toBeNull();
    expect(range("to=yarın")).toBeNull();
    expect(range("from=2026-10-20&to=2026-10-19")).toBeNull();
    expect(range("from=2026-01-01&to=2027-02-06")).toBeNull();
  });
});

describe("what LafPOS's key may read", () => {
  // 00:30 on 27 October in Tuzla, still 26 October in UTC (rule 22).
  const night = new Date("2026-10-26T21:30:00Z");
  const reach = (from: string, to: string, now = night) =>
    withinLafposKaraokeReach({ from, to }, now);

  it("is Istanbul yesterday to tomorrow, both inclusive", () => {
    expect(reach("2026-10-27", "2026-10-27")).toBe(true);
    expect(reach("2026-10-26", "2026-10-28")).toBe(true);
    // The till's business day runs to 05:00: at 00:30 it still asks for
    // the 26th.
    expect(reach("2026-10-26", "2026-10-26")).toBe(true);
    expect(reach("2026-10-28", "2026-10-28")).toBe(true);
  });

  it("is not a day further either way", () => {
    expect(reach("2026-10-25", "2026-10-27")).toBe(false);
    expect(reach("2026-10-27", "2026-10-29")).toBe(false);
    expect(reach("2025-10-01", "2026-10-27")).toBe(false);
  });

  it("turns with Tuzla's midnight, not UTC's", () => {
    const evening = new Date("2026-10-26T20:59:59Z"); // 23:59:59 on the 26th
    expect(reach("2026-10-25", "2026-10-27", evening)).toBe(true);
    expect(reach("2026-10-28", "2026-10-28", evening)).toBe(false);
    expect(reach("2026-10-28", "2026-10-28", night)).toBe(true);
    expect(reach("2026-10-25", "2026-10-25", night)).toBe(false);
  });

  it("refuses the window a request with no query gets (yesterday, ninety days on)", () => {
    const fallback = parsePanelRange(new URLSearchParams(""), night);
    expect(fallback).toEqual({ from: "2026-10-26", to: "2027-01-24" });
    expect(withinLafposKaraokeReach(fallback!, night)).toBe(false);
  });
});

describe("what leaves the site", () => {
  const row: KaraokeReservation = {
    id: "krk-0042",
    customerEmail: "ayse.yilmaz@example.com",
    customerName: "  Ayşe Nur Yılmaz ",
    date: "2026-10-24",
    startHour: 20,
    hours: 2,
    guests: 5,
    status: "confirmed",
    priceMinor: 200000,
    discountMinor: 0,
    totalMinor: 200000,
    note: " Doğum günü; pasta getireceğiz ",
    createdAt: "2026-10-20T09:00:00.000Z",
    updatedAt: "2026-10-20T09:05:00.000Z",
    contactEmail: "ayse@example.com",
    contactPhone: "+905551112233",
    contactConsentAt: "2026-10-20T09:00:00.000Z",
    paymentStatus: "paid",
    paymentDueAt: "2026-10-20T09:30:00.000Z",
    paidAt: "2026-10-20T09:05:00.000Z",
    paidMinor: 200000,
    paymentRef: "PNK-123456",
    channel: "web",
    guest: true,
  } as KaraokeReservation;

  it("is the whitelist and nothing else", () => {
    expect(toPanelReservation(row)).toEqual({
      id: "krk-0042",
      date: "2026-10-24",
      startHour: 20,
      hours: 2,
      // 20:00 in Tuzla is 17:00 UTC.
      startsAt: "2026-10-24T17:00:00.000Z",
      endsAt: "2026-10-24T19:00:00.000Z",
      guests: 5,
      status: "confirmed",
      paymentStatus: "paid",
      firstName: "Ayşe",
      note: "Doğum günü; pasta getireceğiz",
      totalMinor: 200000,
      channel: "web",
      createdAt: "2026-10-20T09:00:00.000Z",
      updatedAt: "2026-10-20T09:05:00.000Z",
      // A live booking has nothing going back.
      refundMinor: null,
    });
    const sent = JSON.stringify(toPanelReservation(row));
    for (const secret of [
      "ayse.yilmaz@example.com",
      "ayse@example.com",
      "+905551112233",
      "Yılmaz",
      "Nur",
      "PNK-123456",
    ]) {
      expect(sent).not.toContain(secret);
    }
  });

  it("names what a cancelled booking refunded, so the bar screen never says 'iade edildi' for nothing (29 Eki 2026)", () => {
    const cancelled = { ...row, status: "cancelled" as const };
    // A late guest request under a 0 % rule: refunded, nothing went back.
    expect(
      toPanelReservation({
        ...cancelled,
        paymentStatus: "refunded",
        refundMinor: 0,
      })!.refundMinor,
    ).toBe(0);
    // A late share or a resold hour's part.
    expect(
      toPanelReservation({
        ...cancelled,
        paymentStatus: "refunding",
        refundMinor: 100000,
      })!.refundMinor,
    ).toBe(100000);
    // The whole payment back.
    expect(
      toPanelReservation({
        ...cancelled,
        paymentStatus: "refunded",
        refundMinor: null,
      })!.refundMinor,
    ).toBeNull();
    // Never on a live booking, nor a value that is not a whole kuruş.
    expect(
      toPanelReservation({ ...row, refundMinor: 5 })!.refundMinor,
    ).toBeNull();
    expect(
      toPanelReservation({ ...cancelled, refundMinor: -1 })!.refundMinor,
    ).toBeNull();
    expect(
      toPanelReservation({ ...cancelled, refundMinor: 1.5 })!.refundMinor,
    ).toBeNull();
  });

  it("ends a midnight block on the next day", () => {
    const late = toPanelReservation({ ...row, startHour: 24, hours: 1 })!;
    expect(late.startsAt).toBe("2026-10-24T21:00:00.000Z");
    expect(late.endsAt).toBe("2026-10-24T22:00:00.000Z");
    const past = toPanelReservation({ ...row, startHour: 23, hours: 2 })!;
    expect(past.endsAt).toBe("2026-10-24T22:00:00.000Z");
  });

  it("clips the name and the note without breaking an emoji", () => {
    const long = toPanelReservation({
      ...row,
      customerName: `${"Ç".repeat(60)} Soyadı`,
      note: `${"a".repeat(PANEL_NOTE_MAX - 1)}🎤🎤`,
    })!;
    expect(Array.from(long.firstName)).toHaveLength(PANEL_FIRST_NAME_MAX);
    expect(Array.from(long.note)).toHaveLength(PANEL_NOTE_MAX);
    expect(long.note.endsWith("a🎤")).toBe(true);
    expect(firstNameOf("")).toBe("");
    expect(firstNameOf(undefined)).toBe("");
    expect(firstNameOf("Mehmet")).toBe("Mehmet");
  });

  it("reads an unknown state as the safe one", () => {
    const odd = toPanelReservation({
      ...row,
      status: "archived" as KaraokeReservation["status"],
      paymentStatus: "chargeback" as KaraokeReservation["paymentStatus"],
      channel: "kiosk",
    })!;
    expect(odd.status).toBe("requested");
    expect(odd.paymentStatus).toBe("none");
    expect(odd.channel).toBe("");
    const old = toPanelReservation({
      ...row,
      paymentStatus: undefined,
      channel: undefined,
    })!;
    expect(old.paymentStatus).toBe("none");
    expect(old.channel).toBe("");
  });

  it("drops a row it cannot place in time instead of failing the pull", () => {
    expect(toPanelReservation({ ...row, date: "24.10.2026" })).toBeNull();
    expect(toPanelReservation({ ...row, startHour: Number.NaN })).toBeNull();
    expect(toPanelReservation({ ...row, hours: 0 })).toBeNull();
  });

  it("sorts earliest first", () => {
    const at = (id: string, date: string, startHour: number) =>
      toPanelReservation({ ...row, id, date, startHour, hours: 1 })!;
    expect(
      sortForPanel([
        at("c", "2026-10-25", 18),
        at("b", "2026-10-24", 22),
        at("a", "2026-10-24", 18),
      ]).map((r) => r.id),
    ).toEqual(["a", "b", "c"]);
  });
});
