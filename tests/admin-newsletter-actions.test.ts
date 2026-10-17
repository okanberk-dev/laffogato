import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * "Pasifleştir" on a subscriber answered "Abone pasif" whatever the write
 * did: a subscriber deleted in another tab was "made inactive" and got an
 * audit row. The store now says whether a row changed.
 */

const deactivateNewsletterSubscriber = vi.fn();
const logAudit = vi.fn();

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/admin/auth", () => ({
  requireRole: vi.fn(async () => ({ email: "patron@laffogato.net" })),
}));
vi.mock("@/lib/admin/audit", () => ({ logAudit }));
vi.mock("@/lib/newsletter/store", () => ({
  deactivateNewsletterSubscriber,
  deleteNewsletterSubscriber: vi.fn(),
}));

const { deactivateNewsletterAction } =
  await import("@/app/admin/bulten/actions");

function form(id: string): FormData {
  const fd = new FormData();
  fd.set("id", id);
  return fd;
}

beforeEach(() => {
  deactivateNewsletterSubscriber.mockReset();
  logAudit.mockReset();
});

describe("deactivateNewsletterAction", () => {
  it("answers and audits a subscriber it took off the list", async () => {
    deactivateNewsletterSubscriber.mockResolvedValue(true);
    const res = await deactivateNewsletterAction(null, form("nws-0004"));
    expect(res).toMatchObject({ ok: true });
    expect(logAudit).toHaveBeenCalledWith(
      expect.objectContaining({ entityId: "nws-0004" }),
    );
  });

  it("says so when there was no row to change, and logs nothing", async () => {
    deactivateNewsletterSubscriber.mockResolvedValue(false);
    const res = await deactivateNewsletterAction(null, form("nws-0004"));
    expect(res).toEqual({
      ok: false,
      error: "Abone bulunamadı; silinmiş olabilir.",
    });
    expect(logAudit).not.toHaveBeenCalled();
  });
});
