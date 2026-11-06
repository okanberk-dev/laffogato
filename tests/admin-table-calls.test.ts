import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * "Gördüm" on a table call from this site's panel (6 Kas 2026): the
 * server action behind the alert card and the "Masa çağrıları" list, and
 * the list itself.
 */

const h = vi.hoisted(() => ({
  ack: vi.fn(),
  requireRole: vi.fn(async () => ({
    email: "okan@laffogato.net",
    role: "staff",
  })),
  revalidatePath: vi.fn(),
}));
vi.mock("next/cache", () => ({ revalidatePath: h.revalidatePath }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
}));
vi.mock("@/lib/admin/auth", () => ({ requireRole: h.requireRole }));
vi.mock("@/lib/admin/table-calls", () => ({ ackTableCallAsAdmin: h.ack }));

const { ackTableCallAction } =
  await import("@/app/admin/siparisler/call-actions");
const { TableCallList } = await import("@/components/admin/table-call-list");

const ID = "tcl-0123456789abcdef";

function form(id: string): FormData {
  const fd = new FormData();
  fd.set("id", id);
  return fd;
}

beforeEach(() => {
  h.ack.mockReset();
  h.requireRole.mockClear();
  h.revalidatePath.mockClear();
});

describe("ackTableCallAction", () => {
  it("answers the call as the signed-in admin, behind the Siparişler role", async () => {
    h.ack.mockResolvedValue({ ok: true, call: { id: ID }, already: false });
    const res = await ackTableCallAction(null, form(ID));
    expect(res).toEqual({
      ok: true,
      message: "Çağrı görüldü.",
      tone: "success",
    });
    expect(h.requireRole).toHaveBeenCalledWith("orders");
    expect(h.ack).toHaveBeenCalledWith(ID, "okan@laffogato.net");
    expect(h.revalidatePath).toHaveBeenCalledWith("/admin/siparisler");
  });

  it("says so when it was already answered, and refuses an unknown or malformed id", async () => {
    h.ack.mockResolvedValue({ ok: true, call: { id: ID }, already: true });
    expect(await ackTableCallAction(null, form(ID))).toMatchObject({
      ok: true,
      message: "Bu çağrı zaten görülmüştü.",
    });
    h.ack.mockResolvedValue({ ok: false, reason: "not_found" });
    expect(await ackTableCallAction(null, form(ID))).toEqual({
      ok: false,
      error: "Çağrı bulunamadı.",
    });
    h.ack.mockClear();
    expect(await ackTableCallAction(null, form("ord-0042"))).toEqual({
      ok: false,
      error: "Geçersiz çağrı.",
    });
    expect(h.ack).not.toHaveBeenCalled();
  });
});

describe("TableCallList", () => {
  it("lists each open call with Gördüm, and nothing at all when none is open", () => {
    const html = renderToStaticMarkup(
      createElement(TableCallList, {
        calls: [
          {
            id: ID,
            label: "Masa 4",
            reason: "water",
            createdAt: new Date().toISOString(),
          },
          {
            id: "tcl-aaaaaaaaaaaaaaaa",
            label: "Masa Bahçe 2",
            reason: "napkin",
            createdAt: new Date().toISOString(),
          },
        ],
      }),
    );
    expect(html).toContain('aria-label="Masa çağrıları"');
    expect(html).toContain("Masa çağrıları");
    expect(html).toContain("Masa 4");
    expect(html).toContain("Su istiyor");
    expect(html).toContain("Peçete istiyor");
    expect(html.match(/>Gördüm</g)).toHaveLength(2);
    expect(
      renderToStaticMarkup(createElement(TableCallList, { calls: [] })),
    ).toBe("");
  });
});
