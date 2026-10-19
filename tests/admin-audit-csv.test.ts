import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AdminAuditLog } from "@/lib/admin/audit";

/**
 * Olay kaydı's "CSV indir" (admin audit SYS-09): the page's filters, every
 * page of them up to the cap, formula-safe, for the owner only (the route
 * checks the session and the `audit` role itself), and the export is an
 * event of its own.
 */

const session = vi.hoisted(() => ({
  value: null as null | { email: string; role: string },
}));
vi.mock("@/lib/admin/auth", () => ({
  getAdminSession: vi.fn(async () => session.value),
}));
const listAuditLogs = vi.hoisted(() => vi.fn());
const safeAudit = vi.hoisted(() => vi.fn(async (_input: unknown) => true));
vi.mock("@/lib/admin/audit", () => ({ listAuditLogs, safeAudit }));

const { auditCsv, auditCsvRow, auditCsvStamp, AUDIT_CSV_HEADER } =
  await import("@/lib/admin/audit-csv");

function row(over: Partial<AdminAuditLog> = {}): AdminAuditLog {
  return {
    id: "aud-0000001",
    actor: "patron@laffogato.net",
    action: "update",
    entity: "settings",
    entityId: "general",
    payload: { before: { courierFeeMinor: 5_000 }, after: { courierFeeMinor: 7_500 } },
    createdAt: "2026-10-17T11:05:09.120Z",
    ...over,
  };
}

describe("audit CSV file", () => {
  it("opens in Excel with Turkish letters, one row per event", () => {
    const csv = auditCsv([row()]);
    expect(csv.startsWith("﻿")).toBe(true);
    const [head, line, end] = csv.slice(1).split("\r\n");
    expect(head).toBe(AUDIT_CSV_HEADER.join(";"));
    expect(line).toContain(
      "aud-0000001;2026-10-17 14:05:09;patron@laffogato.net;Güncelleme;Ayarlar;general;",
    );
    // The panel's words and the stored JSON, both whole.
    expect(line).toContain("Önceki · Kurye ücreti: ₺50,00 · Yeni · Kurye ücreti: ₺75,00");
    expect(line).toContain('{""before"":{""courierFeeMinor"":5000}');
    expect(end).toBe("");
  });

  it("defuses a payload value a spreadsheet would run as a formula", () => {
    const cells = auditCsvRow(
      row({
        action: "note",
        entity: "order",
        entityId: "=HYPERLINK(\"x\")",
        payload: { note: "+90 536 000" },
      }),
    );
    const csv = auditCsv([
      row({
        action: "note",
        entity: "order",
        entityId: "=HYPERLINK(\"x\")",
        actor: "@kasa",
        payload: { note: "+90 536 000" },
      }),
    ]);
    const line = csv.slice(1).split("\r\n")[1]!;
    expect(cells[5]).toBe('=HYPERLINK("x")');
    expect(line).toContain(";'@kasa;");
    expect(line).toContain(`;"'=HYPERLINK(""x"")";`);
    // No cell of the line starts with a bare formula character.
    for (const cell of line.split(";")) {
      expect(cell).not.toMatch(/^[=+\-@]/);
    }
  });

  it("does not clip a long value the list would", () => {
    const note = `${"uzun ".repeat(100)}son`;
    const cells = auditCsvRow(row({ action: "note", entity: "order", payload: { note } }));
    expect(cells[6]).toContain("son");
    expect(cells[6]).not.toContain("…");
  });

  it("prints the köşk's clock to the second, and nothing for a bad stamp", () => {
    expect(auditCsvStamp("2026-10-17T21:30:00.000Z")).toBe("2026-10-18 00:30:00");
    expect(auditCsvStamp("")).toBe("");
  });
});

describe("GET /admin/olay-kaydi/csv", () => {
  beforeEach(() => {
    session.value = null;
    listAuditLogs.mockReset();
    safeAudit.mockReset();
    safeAudit.mockResolvedValue(true);
  });

  it("is the owner's: no session 401, any other role 403, nothing read", async () => {
    const { GET } = await import("@/app/admin/olay-kaydi/csv/route");
    const req = new Request("https://laffogato.net/admin/olay-kaydi/csv");
    expect((await GET(req)).status).toBe(401);
    for (const role of ["manager", "staff", "cashier"]) {
      session.value = { email: `${role}@laffogato.net`, role };
      const res = await GET(req);
      expect(res.status).toBe(403);
      expect(res.headers.get("cache-control")).toBe("no-store");
    }
    expect(listAuditLogs).not.toHaveBeenCalled();
    expect(safeAudit).not.toHaveBeenCalled();
  });

  it("exports the filtered log, every page, up to the moment it started", async () => {
    session.value = { email: "patron@laffogato.net", role: "owner" };
    const full = Array.from({ length: 500 }, (_, i) =>
      row({ id: `aud-${String(1000 - i).padStart(7, "0")}` }),
    );
    listAuditLogs
      .mockResolvedValueOnce(full)
      // A row seen on the first page again (a write shifted the pages) is
      // kept once.
      .mockResolvedValueOnce([full[499]!, row({ id: "aud-0000002" })]);
    const { GET } = await import("@/app/admin/olay-kaydi/csv/route");
    const before = new Date().toISOString();
    const res = await GET(
      new Request(
        "https://laffogato.net/admin/olay-kaydi/csv?entity=settings&action=update&bas=2026-10-01&bit=2026-10-17&sayfa=3",
      ),
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("text/csv; charset=utf-8");
    expect(res.headers.get("cache-control")).toBe("private, no-store");
    expect(res.headers.get("content-disposition")).toMatch(
      /^attachment; filename="olay-kaydi-\d{4}-\d{2}-\d{2}\.csv"$/,
    );
    const body = await res.text();
    expect(body.trim().split("\r\n")).toHaveLength(1 + 501);
    expect(listAuditLogs).toHaveBeenCalledTimes(2);
    const first = listAuditLogs.mock.calls[0]![0];
    expect(first).toMatchObject({
      entity: "settings",
      action: "update",
      from: "2026-09-30T21:00:00.000Z",
      // The day range ends before now: its own end is kept.
      to: "2026-10-17T21:00:00.000Z",
      limit: 500,
      offset: 0,
    });
    expect(listAuditLogs.mock.calls[1]![0]).toMatchObject({ offset: 500 });
    expect(safeAudit).toHaveBeenCalledWith({
      action: "export",
      entity: "audit_log",
      actor: "patron@laffogato.net",
      payload: {
        filters: { entity: "settings", action: "update", bas: "2026-10-01", bit: "2026-10-17" },
        rows: 501,
      },
    });
    // Without a day range the file stops at the moment it started.
    listAuditLogs.mockReset();
    listAuditLogs.mockResolvedValueOnce([row()]);
    await GET(new Request("https://laffogato.net/admin/olay-kaydi/csv"));
    const to = listAuditLogs.mock.calls[0]![0].to as string;
    expect(to >= before).toBe(true);
    expect(to <= new Date().toISOString()).toBe(true);
  });

  it("stops at the cap and still sends the file when the audit row fails", async () => {
    session.value = { email: "patron@laffogato.net", role: "owner" };
    safeAudit.mockResolvedValue(false);
    let n = 0;
    listAuditLogs.mockImplementation(async () =>
      Array.from({ length: 500 }, () => row({ id: `aud-${String(n++).padStart(7, "0")}` })),
    );
    const { GET } = await import("@/app/admin/olay-kaydi/csv/route");
    const { AUDIT_CSV_MAX_ROWS } = await import("@/lib/admin/audit-csv");
    const res = await GET(new Request("https://laffogato.net/admin/olay-kaydi/csv"));
    expect(res.status).toBe(200);
    expect((await res.text()).trim().split("\r\n")).toHaveLength(1 + AUDIT_CSV_MAX_ROWS);
    expect(listAuditLogs).toHaveBeenCalledTimes(AUDIT_CSV_MAX_ROWS / 500);
    expect(safeAudit.mock.calls[0]?.[0]).toMatchObject({
      payload: { rows: AUDIT_CSV_MAX_ROWS },
    });
  });
});
