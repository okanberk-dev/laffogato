import { describe, expect, it } from "vitest";

import { ORDER_ALERT_MARKER_SETTLE_MS } from "@/lib/admin/order-alerts-core";
import {
  formatSignalCursor,
  karaokeSignalKey,
  orderListSignalKey,
  parseSignalCursor,
  readSignalAnswer,
  signalCursorFor,
  signalUnchanged,
} from "@/lib/admin/panel-signal-core";

/**
 * The panel's background counts (nav badges, the order list's count) carry
 * a cursor: the change marker they were read under and what they counted.
 * Same marker and same key: "unchanged", no database. Anything else: read.
 */

const NOW = Date.parse("2026-10-19T20:00:00.000Z");
const markerAt = (at: number) => `${at.toString(36)}-k3j9x0q2`;
const M = markerAt(NOW - 3600_000);
/** The session, as poll-binding.ts makes it. */
const S = "0123456789ab";

describe("the signal cursor", () => {
  it("round-trips, and refuses junk and oversized input", () => {
    const raw = formatSignalCursor(M, "2026-10-19", S);
    expect(parseSignalCursor(raw)).toEqual({
      marker: M,
      key: "2026-10-19",
      session: S,
    });
    expect(parseSignalCursor(formatSignalCursor(M, "1042-open", S))).toEqual({
      marker: M,
      key: "1042-open",
      session: S,
    });
    for (const junk of [
      "",
      null,
      42,
      "s2",
      // The shape from before the session binding.
      `s1.${M}.open`,
      `s2.${M}.open`,
      `s2.${M}.OPEN.${S}`,
      `s2.${M}.open.${S}.extra`,
      `s2.${M}.open.0123456789AB`,
      `s2.not a marker.open.${S}`,
      `s2.${M}.${"a".repeat(40)}.${S}`,
      raw + "x".repeat(100),
    ]) {
      expect(parseSignalCursor(junk), String(junk)).toBeNull();
    }
    // Nothing a bad marker, key or session would make.
    expect(formatSignalCursor("nope", "open", S)).toBe("");
    expect(formatSignalCursor(M, "", S)).toBe("");
    expect(formatSignalCursor(M, "open", "")).toBe("");
  });

  it("the longest cursor it makes still parses", () => {
    const longest = formatSignalCursor(
      `${"z".repeat(12)}-${"z".repeat(24)}`,
      "z".repeat(32),
      S,
    );
    expect(parseSignalCursor(longest)).not.toBeNull();
  });

  it("answers unchanged only for the same marker, the same key and the same session", () => {
    const c = parseSignalCursor(formatSignalCursor(M, "open", S));
    expect(signalUnchanged(c, M, "open", S)).toBe(true);
    expect(signalUnchanged(c, markerAt(NOW), "open", S)).toBe(false);
    expect(signalUnchanged(c, null, "open", S)).toBe(false);
    expect(signalUnchanged(c, M, "1042-open", S)).toBe(false);
    expect(signalUnchanged(null, M, "open", S)).toBe(false);
    // Another session's cookie with this cursor: the account decides.
    expect(signalUnchanged(c, M, "open", "ba9876543210")).toBe(false);
    expect(signalUnchanged(c, M, "open", "")).toBe(false);
  });

  it("the karaoke day rolls over at midnight in Tuzla and forces a read", () => {
    const yesterday = parseSignalCursor(
      formatSignalCursor(M, karaokeSignalKey("2026-10-19"), S),
    );
    expect(
      signalUnchanged(yesterday, M, karaokeSignalKey("2026-10-19"), S),
    ).toBe(true);
    expect(
      signalUnchanged(yesterday, M, karaokeSignalKey("2026-10-20"), S),
    ).toBe(false);
    expect(karaokeSignalKey("not a date!")).toBe("");
  });

  it("the order list's key names what it counted", () => {
    expect(orderListSignalKey(1042, "open")).toBe("1042-open");
    expect(orderListSignalKey(1042, "everything; drop table")).toBe("1042-all");
    expect(orderListSignalKey(Number.NaN, "open")).toBe("0-open");
    expect(orderListSignalKey(-5.7, "all")).toBe("0-all");
  });

  it("does not vouch for a marker made moments ago", () => {
    const fresh = markerAt(NOW - 1000);
    expect(signalCursorFor(fresh, "open", S, NOW)).toBe("");
    expect(
      signalCursorFor(
        fresh,
        "open",
        S,
        NOW - 1000 + ORDER_ALERT_MARKER_SETTLE_MS,
      ),
    ).toBe(formatSignalCursor(fresh, "open", S));
    expect(signalCursorFor(null, "open", S, NOW)).toBe("");
    expect(signalCursorFor(M, "open", S, NOW)).toBe(
      formatSignalCursor(M, "open", S),
    );
  });

  it("reads an answer defensively", () => {
    expect(readSignalAnswer({ unchanged: true })).toEqual({ unchanged: true });
    expect(readSignalAnswer({ count: 3, cursor: "s1.x" })).toEqual({
      count: 3,
      cursor: "s1.x",
    });
    expect(readSignalAnswer({ count: "3" })).toEqual({
      count: null,
      cursor: "",
    });
    expect(readSignalAnswer(null)).toEqual({ count: null, cursor: "" });
    expect(readSignalAnswer({ unchanged: "yes", count: 2 })).toEqual({
      count: 2,
      cursor: "",
    });
  });
});
