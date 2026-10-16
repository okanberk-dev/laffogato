import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * `GET /admin/masalar/{id}/qr` is a route handler: no `requireRole`, no
 * proxy guard that counts. It must refuse on its own.
 */

const { getAdminSession, getCafeTable } = vi.hoisted(() => ({
  getAdminSession: vi.fn(),
  getCafeTable: vi.fn(),
}));
vi.mock("@/lib/admin/auth", () => ({ getAdminSession }));
vi.mock("@/lib/admin/cafe-tables", () => ({ getCafeTable }));

const { GET } = await import("@/app/admin/masalar/[id]/qr/route");

const call = (id: string) =>
  GET(new Request(`https://laffogato.net/admin/masalar/${id}/qr`), {
    params: Promise.resolve({ id }),
  });

beforeEach(() => {
  getAdminSession.mockReset();
  getCafeTable.mockReset();
  getCafeTable.mockResolvedValue({
    id: "tbl-0003",
    code: "ABCDEFGH23",
    name: "Bahçe 3",
  });
});

describe("QR download", () => {
  it("is 401 without a session", async () => {
    getAdminSession.mockResolvedValue(null);
    expect((await call("tbl-0003")).status).toBe(401);
    expect(getCafeTable).not.toHaveBeenCalled();
  });

  it("is 403 for a role without the tables section", async () => {
    for (const role of ["staff", "cashier"]) {
      getAdminSession.mockResolvedValue({ email: "x@ornek.com", role });
      expect((await call("tbl-0003")).status).toBe(403);
    }
    expect(getCafeTable).not.toHaveBeenCalled();
  });

  it("serves the table URL as an SVG attachment to a manager", async () => {
    getAdminSession.mockResolvedValue({
      email: "m@ornek.com",
      role: "manager",
    });
    const res = await call("tbl-0003");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("image/svg+xml");
    expect(res.headers.get("content-disposition")).toBe(
      'attachment; filename="masa-bahce-3-qr.svg"',
    );
    const svg = await res.text();
    expect(svg.startsWith("<svg")).toBe(true);
    expect(svg).toContain("crispEdges");
  });

  it("is 404 for an id that is not a table", async () => {
    getAdminSession.mockResolvedValue({ email: "m@ornek.com", role: "owner" });
    expect((await call("../etc")).status).toBe(404);
    expect(getCafeTable).not.toHaveBeenCalled();
  });
});
