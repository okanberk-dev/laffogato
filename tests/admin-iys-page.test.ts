import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * /admin/iys renders: the deadlines, the stale-check warning, the file
 * waiting for "İYS'ye yüklendi", each open event masked with its full
 * address inside the row, and İYS's own date format. The store is stubbed;
 * tests/db-integration-iys.test.ts runs it for real.
 */

const h = vi.hoisted(() => ({
  reconcileIys: vi.fn(),
  listOpenIysEvents: vi.fn(),
  listSettledIysEvents: vi.fn(),
  iysCounts: vi.fn(),
  iysCheckNow: vi.fn(),
}));

vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children?: ReactNode }) =>
    createElement("a", { href }, children),
  useLinkStatus: () => ({ pending: false }),
}));
vi.mock("next/navigation", () => ({
  unstable_rethrow: vi.fn(),
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/admin/auth", () => ({
  requireRole: vi.fn(async () => ({ email: "patron@laffogato.net" })),
}));
vi.mock("@/lib/admin/audit", () => ({ safeAudit: vi.fn() }));
vi.mock("@/lib/db", () => ({ getDb: () => ({}), TABLES: {} }));
vi.mock("@/lib/iys/store", () => h);

const { default: IysPage } = await import("@/app/admin/iys/page");

const NOW = Date.now();
const iso = (offsetHours: number) =>
  new Date(NOW + offsetHours * 3_600_000).toISOString();

function event(over: Record<string, unknown>) {
  return {
    id: "1",
    email: "ayse@ornek.com",
    status: "ONAY",
    source: "HS_WEB",
    consentDate: "2026-09-02T07:00:00.000Z",
    dueAt: iso(-48),
    state: "pending",
    exportId: "",
    exportedAt: "",
    settledAt: "",
    settledBy: "",
    note: "",
    legacy: true,
    createdAt: iso(-1),
    ...over,
  };
}

beforeEach(() => {
  for (const fn of Object.values(h)) fn.mockReset();
  h.reconcileIys.mockResolvedValue({ onay: 0, ret: 0, superseded: 0 });
  h.listOpenIysEvents.mockResolvedValue([
    event({}),
    event({
      id: "2",
      email: "mehmet@ornek.com",
      status: "RET",
      source: "HS_EPOSTA",
      consentDate: iso(-2),
      dueAt: iso(70),
      state: "exported",
      exportId: "iys-20261022-1405-ab12",
      exportedAt: iso(-1),
      legacy: false,
    }),
  ]);
  h.listSettledIysEvents.mockResolvedValue([
    event({
      id: "3",
      email: "zeynep@ornek.com",
      state: "rejected",
      note: "H467",
      settledAt: iso(-3),
      settledBy: "patron@laffogato.net",
    }),
  ]);
  h.iysCounts.mockResolvedValue({ registered: 12, rejected: 1 });
  h.iysCheckNow.mockResolvedValue({
    fresh: false,
    lastCheckAt: "",
    expiresAt: "",
    state: {
      launchedAt: "",
      lastCheckAt: "",
      lastCheckBy: "",
      lastCheckKind: "",
      lastImport: {},
      lastReconcileAt: "",
      lastReconcile: {},
    },
  });
});

describe("/admin/iys", () => {
  it("reconciles, then shows the deadlines, the gate and the file to confirm", async () => {
    const html = renderToStaticMarkup(await IysPage());
    expect(h.reconcileIys).toHaveBeenCalledTimes(1);
    expect(html).toContain("<h1");
    expect(html).toContain("İYS");
    // Overdue, legacy, and the gate closed.
    expect(html).toContain("1 kaydın 3 iş günlük süresi geçti.");
    expect(html).toContain("Eski onay");
    expect(html).toContain("Ticari e-posta gönderimi kapalı.");
    expect(html).toContain("İYS&#x27;deki retler hiç kontrol edilmedi.");
    // Masked in the row, the full address inside it.
    expect(html).toContain("ay***@ornek.com");
    expect(html).toContain("ayse@ornek.com");
    // İYS's own consentDate format, on the köşk's clock.
    expect(html).toContain("2026-09-02 10:00:00");
    // The downloaded file and its confirmation.
    expect(html).toContain("iys-20261022-1405-ab12.csv");
    expect(html).toContain("İYS&#x27;ye yüklendi");
    expect(html).toContain("İYS reddetti");
    expect(html).toContain("İYS dosyasını indir (2)");
    // The settled list says why.
    expect(html).toContain("H467");
    // Counts.
    expect(html).toContain(">12<");
  });

  it("still renders, saying so, when the reconcile fails", async () => {
    h.reconcileIys.mockRejectedValue(new Error("down a@b.com"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    const html = renderToStaticMarkup(await IysPage());
    expect(html).toContain("Liste şu an güncellenemedi.");
  });
});
