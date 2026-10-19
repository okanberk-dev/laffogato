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

describe("the signal cursor", () => {
  it("round-trips, and refuses junk and oversized input", () => {
    const raw = formatSignalCursor(M, "2026-10-19");
    expect(parseSignalCursor(raw)).toEqual({ marker: M, key: "2026-10-19" });
    expect(parseSignalCursor(formatSignalCursor(M, "1042-open"))).toEqual({
      marker: M,
      key: "1042-open",
    });
    for (const junk of [
      "",
      null,
      42,
      "s1",
      `s2.${M}.open`,
      `s1.${M}.OPEN`,
      `s1.${M}.open.extra`,
      `s1.not a marker.open`,
      `s1.${M}.${"a".repeat(40)}`,
      raw + "x".repeat(100),
    ]) {
      expect(parseSignalCursor(junk), String(junk)).toBeNull();
    }
    // Nothing a bad marker or key would make.
    expect(formatSignalCursor("nope", "open")).toBe("");
    expect(formatSignalCursor(M, "")).toBe("");
  });

  it("answers unchanged only for the same marker and the same key", () => {
    const c = parseSignalCursor(formatSignalCursor(M, "open"));
    expect(signalUnchanged(c, M, "open")).toBe(true);
    expect(signalUnchanged(c, markerAt(NOW), "open")).toBe(false);
    expect(signalUnchanged(c, null, "open")).toBe(false);
    expect(signalUnchanged(c, M, "1042-open")).toBe(false);
    expect(signalUnchanged(null, M, "open")).toBe(false);
  });

  it("the karaoke day rolls over at midnight in Tuzla and forces a read", () => {
    const yesterday = parseSignalCursor(
      formatSignalCursor(M, karaokeSignalKey("2026-10-19")),
    );
    expect(signalUnchanged(yesterday, M, karaokeSignalKey("2026-10-19"))).toBe(
      true,
    );
    expect(signalUnchanged(yesterday, M, karaokeSignalKey("2026-10-20"))).toBe(
      false,
    );
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
    expect(signalCursorFor(fresh, "open", NOW)).toBe("");
    expect(
      signalCursorFor(fresh, "open", NOW - 1000 + ORDER_ALERT_MARKER_SETTLE_MS),
    ).toBe(formatSignalCursor(fresh, "open"));
    expect(signalCursorFor(null, "open", NOW)).toBe("");
    expect(signalCursorFor(M, "open", NOW)).toBe(formatSignalCursor(M, "open"));
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
