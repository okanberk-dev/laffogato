import { describe, expect, it } from "vitest";

import {
  TABLE_CALL_OPEN_MS,
  TABLE_CALL_REASON_LABELS,
  isTableCallId,
  newTableCallId,
  parseTableCallBody,
  tableCallStatus,
  tableCallsOpenSince,
  tableLabel,
  toMobileTableCall,
  toPanelTableCalls,
  type TableCallRow,
} from "@/lib/admin/table-calls-core";

/**
 * "Garson çağır" (6 Kas 2026): what a call is, when it is open, and what the
 * app and the köşk panel are told about it (docs/API-MOBILE.md §22.1,
 * docs/PANEL-ORDERS.md "Masa çağrıları").
 */

const NOW = Date.parse("2026-11-06T18:00:00.000Z");
const at = (minutesAgo: number) =>
  new Date(NOW - minutesAgo * 60_000).toISOString();

function row(patch: Partial<TableCallRow> = {}): TableCallRow {
  return {
    id: "tcl-0123456789abcdef",
    tableCode: "K7Q2M9X4TB",
    tableName: "Bahçe 3",
    reason: "water",
    customerEmail: "ayse@example.com",
    createdAt: at(2),
    ackedAt: "",
    ackedBy: "",
    ...patch,
  };
}

describe("ids", () => {
  it("are tcl- and sixteen random base32 characters", () => {
    const id = newTableCallId();
    expect(id).toMatch(/^tcl-[0-9a-z]{16}$/);
    expect(isTableCallId(id)).toBe(true);
    expect(newTableCallId()).not.toBe(id);
    expect(newTableCallId(() => new Uint8Array(16))).toBe(
      "tcl-0000000000000000",
    );
    for (const bad of ["tcl-1", "TCL-0123456789ABCDEF", "ord-0042", 7, null]) {
      expect(isTableCallId(bad), String(bad)).toBe(false);
    }
  });
});

describe("status", () => {
  it("is open for fifteen minutes, then expired, and acked once answered", () => {
    expect(tableCallStatus(row(), NOW)).toBe("open");
    expect(tableCallStatus(row({ createdAt: at(14.9) }), NOW)).toBe("open");
    expect(tableCallStatus(row({ createdAt: at(15) }), NOW)).toBe("expired");
    expect(
      tableCallStatus(row({ createdAt: at(40), ackedAt: at(1) }), NOW),
    ).toBe("acked");
    expect(tableCallStatus(row({ createdAt: "junk" }), NOW)).toBe("expired");
    expect(TABLE_CALL_OPEN_MS).toBe(15 * 60_000);
    expect(tableCallsOpenSince(NOW)).toBe(at(15));
  });
});

describe("the body", () => {
  it("takes exactly a known reason", () => {
    expect(parseTableCallBody({ reason: "waiter" })).toEqual({
      ok: true,
      reason: "waiter",
    });
    for (const bad of [
      {},
      { reason: "coffee" },
      { reason: "water", note: "hızlı" },
      { reason: ["water"] },
      [],
      "water",
      null,
    ]) {
      expect(parseTableCallBody(bad).ok, JSON.stringify(bad)).toBe(false);
    }
    const extra = parseTableCallBody({ reason: "water", tableCode: "X" });
    expect(extra.ok === false && extra.message).toContain("tableCode");
  });
});

describe("the app's view", () => {
  it("names the table and the instants, never the member or the staff", () => {
    const call = toMobileTableCall(
      row({ ackedAt: at(1), ackedBy: "panel:Selin" }),
      NOW,
    );
    expect(call).toEqual({
      id: "tcl-0123456789abcdef",
      reason: "water",
      status: "acked",
      createdAt: at(2),
      ackedAt: at(1),
      table: { code: "K7Q2M9X4TB", name: "Bahçe 3" },
    });
    expect(toMobileTableCall(row(), NOW)).toMatchObject({
      status: "open",
      ackedAt: "",
    });
  });
});

describe("the bar screen's calls", () => {
  it("lists open calls only, oldest first, as Masa labels, with no guest", () => {
    const calls = toPanelTableCalls(
      [
        row({ id: "tcl-b", createdAt: at(1), reason: "napkin" }),
        row({ id: "tcl-a", createdAt: at(5), tableName: "4" }),
        row({ id: "tcl-old", createdAt: at(20) }),
        row({ id: "tcl-done", ackedAt: at(1) }),
      ],
      NOW,
    );
    expect(calls).toEqual([
      {
        id: "tcl-a",
        tableCode: "K7Q2M9X4TB",
        label: "Masa 4",
        reason: "water",
        createdAt: at(5),
      },
      {
        id: "tcl-b",
        tableCode: "K7Q2M9X4TB",
        label: "Masa Bahçe 3",
        reason: "napkin",
        createdAt: at(1),
      },
    ]);
    expect(JSON.stringify(calls)).not.toContain("example.com");
  });

  it("prints a table the way the order alert does", () => {
    expect(tableLabel({ code: "K7Q2M9X4TB", name: "Masa 7" })).toBe("Masa 7");
    expect(tableLabel({ code: "K7Q2M9X4TB", name: "12" })).toBe("Masa 12");
    expect(tableLabel({ code: "K7Q2M9X4TB", name: "" })).toBe(
      "Masa K7Q2M9X4TB",
    );
    expect(TABLE_CALL_REASON_LABELS).toEqual({
      waiter: "Garson çağırıyor",
      water: "Su istiyor",
      napkin: "Peçete istiyor",
    });
  });
});
