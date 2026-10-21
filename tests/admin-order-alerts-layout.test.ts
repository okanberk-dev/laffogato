import { readFileSync } from "node:fs";

import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

/**
 * Where the new-order alert lives: once, in the top bar's `actions` slot,
 * on every signed-in panel page (the till included), for the roles with
 * Siparişler only. A cashier gets no bell: the alert names what was ordered
 * at which table and opens the order, which the till role may not read.
 */

vi.mock("next/navigation", () => ({
  usePathname: () => "/admin/kasa",
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
}));
vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    prefetch: _prefetch,
    ...rest
  }: {
    href: string;
    children?: ReactNode;
    prefetch?: boolean;
  }) => createElement("a", { href, ...rest }, children),
  useLinkStatus: () => ({ pending: false }),
}));
vi.mock("next/font/google", () => ({
  Geist: () => ({ variable: "font-geist-sans", className: "" }),
  Geist_Mono: () => ({ variable: "font-geist-mono", className: "" }),
}));
vi.mock("@/app/admin/siparisler/actions", () => ({
  openOrderSignalAction: vi.fn(async () => ({ count: 0, cursor: "" })),
  transitionOrderAction: vi.fn(),
}));
vi.mock("@/app/admin/mobil/karaoke/actions", () => ({
  karaokeTodaySignalAction: vi.fn(async () => ({ count: 0, cursor: "" })),
}));
vi.mock("@/app/admin/actions", () => ({ logoutAction: vi.fn() }));
const session = vi.hoisted(() => ({ role: "owner" as string | null }));
vi.mock("@/lib/admin/auth", () => ({
  getAdminSession: async () =>
    session.role
      ? { email: "x@laffogato.net", role: session.role, expiresAt: 0 }
      : null,
}));
vi.mock("@/lib/admin/flash", () => ({ readAdminFlash: async () => null }));

const AdminLayout = (await import("@/app/admin/layout")).default;
const { alertMayStartPreparing, orderAlertsFor } =
  await import("@/lib/admin/order-alerts-core");

async function render(role: string | null): Promise<string> {
  session.role = role;
  return renderToStaticMarkup(
    await AdminLayout({ children: createElement("p", null, "PAGE") }),
  );
}

const BELL = 'aria-label="Yeni sipariş sesi"';

describe("the alert in the shell", () => {
  it("sits once in the top bar's actions slot for owner, manager and staff", async () => {
    for (const role of ["owner", "manager", "staff"]) {
      const html = await render(role);
      const slot =
        /<div data-admin-topbar-actions=""[^>]*>[^]*?<\/header>/.exec(
          html,
        )?.[0];
      expect(slot, role).toContain(BELL);
      expect(html.split(BELL), role).toHaveLength(2);
    }
  });

  it("renders nothing for a cashier, and nothing before sign-in", async () => {
    expect(await render("cashier")).not.toContain(BELL);
    expect(await render(null)).not.toContain(BELL);
  });

  it("follows the role matrix and the order rule for Hazırlamaya başla", () => {
    expect(orderAlertsFor("owner")).toBe(true);
    expect(orderAlertsFor("staff")).toBe(true);
    expect(orderAlertsFor("cashier")).toBe(false);
    expect(alertMayStartPreparing("staff")).toBe(true);
    expect(alertMayStartPreparing("cashier")).toBe(false);
  });

  it("starts an order through the existing transition action, not a new one", () => {
    const src = readFileSync("src/components/admin/order-alerts.tsx", "utf8");
    expect(src).toContain(
      'import { transitionOrderAction } from "@/app/admin/siparisler/actions";',
    );
    expect(src).toContain('fd.set("transition", "start_preparing");');
  });
});
