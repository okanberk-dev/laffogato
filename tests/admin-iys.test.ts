import { readFileSync } from "node:fs";

import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * /admin/iys: every export of its "use server" file is a public POST
 * endpoint (CLAUDE.md rule 27), so each action asks for the `newsletter`
 * role itself; the file download is a route handler, which is behind
 * neither `requireRole` nor the proxy, so it refuses on its own. Audit rows
 * carry counts, never an address.
 */

const h = vi.hoisted(() => ({
  requireRole: vi.fn(),
  getAdminSession: vi.fn(),
  safeAudit: vi.fn(),
  revalidatePath: vi.fn(),
  reconcileIys: vi.fn(),
  exportIysEvents: vi.fn(),
  settleIysExport: vi.fn(),
  rejectIysEvent: vi.fn(),
  attestIysCheck: vi.fn(),
  importIysConsentList: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: h.revalidatePath }));
vi.mock("@/lib/admin/auth", () => ({
  requireRole: h.requireRole,
  getAdminSession: h.getAdminSession,
}));
vi.mock("@/lib/admin/audit", () => ({ safeAudit: h.safeAudit }));
vi.mock("@/lib/iys/store", () => ({
  reconcileIys: h.reconcileIys,
  exportIysEvents: h.exportIysEvents,
  settleIysExport: h.settleIysExport,
  rejectIysEvent: h.rejectIysEvent,
  attestIysCheck: h.attestIysCheck,
  importIysConsentList: h.importIysConsentList,
}));
// readImportFile lives beside the product import, which reads the catalogue.
vi.mock("@/lib/db", () => ({ getDb: () => ({}), TABLES: {} }));

const actions = await import("@/app/admin/iys/actions");
const { POST } = await import("@/app/admin/iys/dosya/route");

const OWNER = { email: "patron@laffogato.net", role: "owner" };
const DENIED = new Error("NEXT_REDIRECT /admin?denied=1");

function fd(entries: Record<string, string | File>): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(entries)) f.set(k, v);
  return f;
}

function auditPayloads(): string {
  return JSON.stringify(h.safeAudit.mock.calls);
}

beforeEach(() => {
  for (const fn of Object.values(h)) fn.mockReset();
  h.requireRole.mockResolvedValue(OWNER);
  h.reconcileIys.mockResolvedValue({ onay: 0, ret: 0, superseded: 0 });
  h.safeAudit.mockResolvedValue(true);
});

describe("the actions file", () => {
  it("exports only the four actions (rule 27)", () => {
    expect(Object.keys(actions).sort()).toEqual([
      "attestIysCheckAction",
      "importIysListAction",
      "rejectIysEventAction",
      "settleIysExportAction",
    ]);
    const src = readFileSync("src/app/admin/iys/actions.ts", "utf8");
    expect(src.startsWith('"use server";')).toBe(true);
    // Each one asks for the role first.
    expect(src.match(/await requireRole\("newsletter"\)/g)).toHaveLength(4);
  });

  it("every action stops at a denied role before writing", async () => {
    h.requireRole.mockRejectedValue(DENIED);
    const calls = [
      actions.settleIysExportAction(
        null,
        fd({ exportId: "iys-20261022-1405-ab12" }),
      ),
      actions.rejectIysEventAction(null, fd({ id: "12" })),
      actions.attestIysCheckAction(null, fd({})),
      actions.importIysListAction(null, fd({})),
    ];
    for (const call of calls) await expect(call).rejects.toBe(DENIED);
    expect(h.requireRole.mock.calls.every((c) => c[0] === "newsletter")).toBe(
      true,
    );
    expect(h.settleIysExport).not.toHaveBeenCalled();
    expect(h.rejectIysEvent).not.toHaveBeenCalled();
    expect(h.attestIysCheck).not.toHaveBeenCalled();
    expect(h.importIysConsentList).not.toHaveBeenCalled();
  });
});

describe("settleIysExportAction", () => {
  it("refuses a batch id it did not make", async () => {
    const res = await actions.settleIysExportAction(
      null,
      fd({ exportId: "../../etc" }),
    );
    expect(res).toMatchObject({ ok: false });
    expect(h.settleIysExport).not.toHaveBeenCalled();
  });

  it("registers the file's events and audits the count", async () => {
    h.settleIysExport.mockResolvedValue(7);
    const res = await actions.settleIysExportAction(
      null,
      fd({ exportId: "iys-20261022-1405-ab12" }),
    );
    expect(res).toMatchObject({ ok: true });
    expect(h.settleIysExport).toHaveBeenCalledWith(
      "iys-20261022-1405-ab12",
      OWNER.email,
    );
    expect(h.safeAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        entity: "iys",
        payload: { op: "registered", events: 7 },
      }),
    );
    expect(h.revalidatePath).toHaveBeenCalledWith("/admin/iys");
  });

  it("says so when nothing was left to settle", async () => {
    h.settleIysExport.mockResolvedValue(0);
    const res = await actions.settleIysExportAction(
      null,
      fd({ exportId: "iys-20261022-1405-ab12" }),
    );
    expect(res).toMatchObject({ ok: false });
    expect(h.safeAudit).not.toHaveBeenCalled();
  });
});

describe("rejectIysEventAction", () => {
  it("records İYS's code and keeps the address out of the log", async () => {
    h.rejectIysEvent.mockResolvedValue({
      id: "12",
      email: "gizli@ornek.com",
      status: "ONAY",
      legacy: true,
    });
    const res = await actions.rejectIysEventAction(
      null,
      fd({ id: "12", note: " H467 " }),
    );
    expect(res).toMatchObject({ ok: true });
    expect(h.rejectIysEvent).toHaveBeenCalledWith("12", "H467", OWNER.email);
    expect(auditPayloads()).toContain("H467");
    expect(auditPayloads()).not.toContain("gizli@ornek.com");
  });

  it("refuses a malformed id", async () => {
    const res = await actions.rejectIysEventAction(null, fd({ id: "1 or 1" }));
    expect(res).toMatchObject({ ok: false });
    expect(h.rejectIysEvent).not.toHaveBeenCalled();
  });
});

describe("importIysListAction", () => {
  const file = (text: string, name = "iys.csv") =>
    new File([text], name, { type: "text/csv" });

  it("applies the list, reconciles before and after, audits counts only", async () => {
    h.importIysConsentList.mockResolvedValue({
      onayListed: 1,
      onayIgnored: 0,
      retListed: 1,
      refusalsApplied: 1,
      registered: 1,
      superseded: 0,
    });
    const res = await actions.importIysListAction(
      null,
      fd({
        file: file("alici,durum\nayse@ornek.com,ONAY\nali@ornek.com,RET\n"),
      }),
    );
    expect(res).toMatchObject({ ok: true, tone: "warning" });
    expect(h.reconcileIys).toHaveBeenCalledTimes(2);
    const [rows, meta] = h.importIysConsentList.mock.calls[0];
    expect(rows).toEqual([
      { line: 2, email: "ayse@ornek.com", status: "ONAY" },
      { line: 3, email: "ali@ornek.com", status: "RET" },
    ]);
    expect(meta).toMatchObject({ by: OWNER.email, skipped: 1 });
    expect(auditPayloads()).not.toMatch(/@ornek\.com/);
  });

  it("refuses a file with no address and status in it", async () => {
    const res = await actions.importIysListAction(
      null,
      fd({ file: file("sadece,başlık\n") }),
    );
    expect(res).toMatchObject({ ok: false });
    expect(h.importIysConsentList).not.toHaveBeenCalled();
  });
});

describe("attestIysCheckAction", () => {
  it("records the check under the operator's name", async () => {
    const res = await actions.attestIysCheckAction(null, fd({}));
    expect(res).toMatchObject({ ok: true });
    expect(h.attestIysCheck).toHaveBeenCalledWith(
      OWNER.email,
      expect.any(Date),
    );
    expect(h.safeAudit).toHaveBeenCalledWith(
      expect.objectContaining({ entity: "iys", entityId: "attest" }),
    );
  });
});

describe("POST /admin/iys/dosya", () => {
  const post = (headers: Record<string, string> = {}) =>
    POST(
      new Request("https://laffogato.net/admin/iys/dosya", {
        method: "POST",
        headers: { "sec-fetch-site": "same-origin", ...headers },
      }),
    );

  it("is 403 from another site, before reading the session", async () => {
    expect((await post({ "sec-fetch-site": "cross-site" })).status).toBe(403);
    expect(h.getAdminSession).not.toHaveBeenCalled();
  });

  it("is 401 without a session and 403 for staff and the till", async () => {
    h.getAdminSession.mockResolvedValue(null);
    expect((await post()).status).toBe(401);
    for (const role of ["staff", "cashier"]) {
      h.getAdminSession.mockResolvedValue({ email: "x@ornek.com", role });
      expect((await post()).status).toBe(403);
    }
    expect(h.exportIysEvents).not.toHaveBeenCalled();
  });

  it("is 409 when there is nothing to upload", async () => {
    h.getAdminSession.mockResolvedValue({
      email: "m@ornek.com",
      role: "manager",
    });
    h.exportIysEvents.mockResolvedValue({
      exportId: "iys-20261022-1405-ab12",
      events: [],
    });
    expect((await post()).status).toBe(409);
    expect(h.safeAudit).not.toHaveBeenCalled();
  });

  it("reconciles, then hands a manager İYS's file and audits counts only", async () => {
    h.getAdminSession.mockResolvedValue({
      email: "m@ornek.com",
      role: "manager",
    });
    h.exportIysEvents.mockResolvedValue({
      exportId: "iys-20261022-1405-ab12",
      events: [
        {
          id: "1",
          email: "ayse@ornek.com",
          status: "ONAY",
          source: "HS_WEB",
          consentDate: "2026-10-22T07:00:00.000Z",
          legacy: false,
        },
      ],
    });
    const res = await post();
    expect(res.status).toBe(200);
    expect(h.reconcileIys.mock.invocationCallOrder[0]).toBeLessThan(
      h.exportIysEvents.mock.invocationCallOrder[0],
    );
    expect(res.headers.get("content-disposition")).toBe(
      'attachment; filename="iys-20261022-1405-ab12.csv"',
    );
    expect(res.headers.get("cache-control")).toContain("no-store");
    expect(await res.text()).toBe(
      "type,source,recipient,status,consentDate,recipientType\r\nEPOSTA,HS_WEB,ayse@ornek.com,ONAY,2026-10-22 10:00:00,BIREYSEL\r\n",
    );
    expect(h.safeAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "export",
        entity: "iys",
        payload: { events: 1, onay: 1, ret: 0, legacy: 0 },
      }),
    );
    expect(auditPayloads()).not.toContain("ayse@ornek.com");
  });
});
