import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { createElement, type FunctionComponent, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { fakeDb, seedRows } from "./_stubs/admin-users-db";

/**
 * Personel lands on the open orders (admin UI v2, decision D2), and a page
 * that refuses a role sends it there with the notice joined to the landing
 * page's own query (`deniedPathFor`). Followed through the real gate
 * (`requireRole`), the sign-in and 2FA steps, the shell's links and the
 * list the role lands on: `${landing}?denied=1` would have read
 * `?durum=acik?denied=1`, and a list link built from the landing page
 * would have carried the notice on to the next click.
 */

const jar = new Map<string, string>();
const twofa = vi.hoisted(() => ({ enrolled: false }));
let pathname = "/admin/siparisler";

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => {
      const value = jar.get(name);
      return value === undefined ? undefined : { name, value };
    },
    set: (arg: string | { name: string; value: string }, value?: string) => {
      if (typeof arg === "string") jar.set(arg, String(value));
      else jar.set(arg.name, arg.value);
    },
    delete: (name: string) => {
      jar.delete(name);
    },
  }),
}));
vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    throw new Error(`NEXT_REDIRECT ${to}`);
  },
  unstable_rethrow: (err: unknown) => {
    if (err instanceof Error && err.message.startsWith("NEXT_REDIRECT")) {
      throw err;
    }
  },
  usePathname: () => pathname,
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
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/db", () => fakeDb());
vi.mock("@/lib/admin/rate-limit", () => ({
  clientIp: async () => "1.2.3.4",
  reserveLoginAttempt: async () => ({
    blocked: false,
    remaining: 4,
    retryAfterSeconds: 0,
  }),
  clearLoginLimit: async () => {},
}));
vi.mock("@/lib/admin/twofa", () => ({
  has2FA: async () => twofa.enrolled,
  verifyToken: async () => true,
  cancelEnrollment: vi.fn(),
  disable2FA: vi.fn(),
  verifyAndEnable: vi.fn(),
}));
vi.mock("@/lib/admin/audit", () => ({
  logAudit: vi.fn(),
  safeAudit: vi.fn(),
}));
vi.mock("@/lib/admin/flash", () => ({
  setAdminFlash: vi.fn(),
  readAdminFlash: async () => null,
}));
// The sidebar's badge polls and the top bar's search: server actions the
// markup only references.
vi.mock("@/app/admin/siparisler/actions", () => ({
  openOrderSignalAction: vi.fn(async () => ({ count: 0, cursor: "" })),
}));
vi.mock("@/app/admin/mobil/karaoke/actions", () => ({
  karaokeTodaySignalAction: vi.fn(async () => ({ count: 0, cursor: "" })),
}));
vi.mock("@/app/admin/ara/actions", () => ({ adminSearchAction: vi.fn() }));

const auth = await import("@/lib/admin/auth");
const { deniedPathFor, landingPathFor } = await import("@/lib/admin/roles");
const { adminNextPath } = await import("@/lib/admin/next-path");
const { loginAction } = await import("@/app/admin/giris/actions");
const AdminLoginPage = (await import("@/app/admin/giris/page")).default;
const { verify2FAAction } = await import("@/app/admin/iki-asama/actions");
const { cancelEnrollAction } = await import("@/app/admin/2fa-kurulum/actions");
const { withParams, toSearchParams } = await import("@/lib/admin/list-params");
const { StatusTabs } = await import("@/components/admin/ui/status-tabs");
const { FilterBar } = await import("@/components/admin/ui/filter-bar");
const { ORDER_FILTER_FIELDS, ORDER_TABS } =
  await import("@/lib/admin/order-filters");
const sidebar = await import("@/components/admin/admin-sidebar");
const { ToastProvider } = await import("@/components/admin/ui/toast");
const { PanelHomeLink, PanelHomeProvider } =
  await import("@/components/admin/panel-home");

const OPEN_ORDERS = "/admin/siparisler?durum=acik";
const ACCOUNTS = {
  staff: { email: "personel@laffogato.net", password: "personelParolasi" },
  manager: { email: "mudur@laffogato.net", password: "mudurParolasi" },
  cashier: { email: "kasa@laffogato.net", password: "kasaParolasi" },
} as const;
type Role = keyof typeof ACCOUNTS;

async function redirectOf(run: () => Promise<unknown>): Promise<string> {
  try {
    await run();
  } catch (err) {
    const m = err instanceof Error && /^NEXT_REDIRECT (.*)$/.exec(err.message);
    if (m) return m[1];
    throw err;
  }
  return "(no redirect)";
}

async function signedIn(role: Role): Promise<void> {
  const { email, password } = ACCOUNTS[role];
  const res = await auth.signInAdmin(email, password);
  expect(res).toMatchObject({ ok: true, role });
}

function form(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
}

beforeEach(() => {
  jar.clear();
  seedRows([]);
  twofa.enrolled = false;
  pathname = "/admin/siparisler";
  process.env.ADMIN_SESSION_SECRET = "test-secret-for-the-landing-tests";
  process.env.ADMIN_USERS = JSON.stringify(
    (Object.keys(ACCOUNTS) as Role[]).map((role) => ({
      ...ACCOUNTS[role],
      role,
    })),
  );
});

describe("requireRole on a refused page", () => {
  it("sends Personel to the open orders with the notice: one `?`", async () => {
    await signedIn("staff");
    const to = await redirectOf(() => auth.requireRole("menu"));
    expect(to).toBe("/admin/siparisler?durum=acik&denied=1");
    expect(to).toBe(deniedPathFor("staff"));
    expect(to).not.toContain("acik?");
  });

  it("keeps the manager on the dashboard and the cashier on the till", async () => {
    await signedIn("manager");
    expect(await redirectOf(() => auth.requireRole("settings"))).toBe(
      "/admin?denied=1",
    );
    jar.clear();
    await signedIn("cashier");
    expect(await redirectOf(() => auth.requireRole("orders"))).toBe(
      "/admin/kasa?denied=1",
    );
  });

  it("lets Personel open the page it lands on", async () => {
    await signedIn("staff");
    await expect(auth.requireRole("orders")).resolves.toMatchObject({
      role: "staff",
    });
  });
});

describe("signing in as Personel", () => {
  it("lands on the open orders, query and all", async () => {
    const to = await redirectOf(() =>
      loginAction({}, form({ ...ACCOUNTS.staff, next: "" })),
    );
    expect(to).toBe(OPEN_ORDERS);
  });

  it("carries the landing page through the 2FA step intact", async () => {
    twofa.enrolled = true;
    const step = await redirectOf(() =>
      loginAction({}, form({ ...ACCOUNTS.staff, next: "" })),
    );
    const url = new URL(step, "https://panel.invalid");
    expect(url.pathname).toBe("/admin/iki-asama");
    // One query on the 2FA address; the landing page's own is inside `next`.
    expect([...url.searchParams.keys()]).toEqual(["next"]);
    const next = adminNextPath(url.searchParams.get("next"));
    expect(next).toBe(OPEN_ORDERS);
    const to = await redirectOf(() =>
      verify2FAAction({}, form({ token: "123456", next: next ?? "" })),
    );
    expect(to).toBe(OPEN_ORDERS);
  });

  it("an open session on the sign-in page goes to the landing page", async () => {
    await signedIn("staff");
    expect(
      await redirectOf(() =>
        AdminLoginPage({ searchParams: Promise.resolve({}) }),
      ),
    ).toBe(OPEN_ORDERS);
  });

  it("leaving 2FA setup returns to the landing page", async () => {
    await signedIn("staff");
    expect(await redirectOf(() => cancelEnrollAction())).toBe(OPEN_ORDERS);
  });
});

describe("the shell on the landing page", () => {
  const groups = [
    {
      title: "Bugün",
      items: [
        { href: "/admin", label: "Genel bakış", section: "dashboard" },
        { href: "/admin/siparisler", label: "Siparişler", section: "orders" },
        { href: "/admin/kasa", label: "Kasa", section: "till" },
      ],
    },
  ];
  const html = () =>
    renderToStaticMarkup(
      createElement(
        ToastProvider,
        null,
        createElement(sidebar.AdminSidebar, {
          groups,
          email: ACCOUNTS.staff.email,
          roleLabel: "Personel",
          landingPath: landingPathFor("staff"),
          logout: () => {},
          canSearch: true,
        }),
      ),
    );

  it("takes the notice off and keeps the Açık tab", () => {
    expect(
      sidebar.withoutDenied(`https://x.test${deniedPathFor("staff")}`),
    ).toBe(OPEN_ORDERS);
  });

  it("links the logo to the open orders and lights Siparişler", () => {
    const markup = html();
    expect(markup).toContain(`href="${OPEN_ORDERS}"`);
    // One lit link per nav: the sidebar's, and the phone's bottom bar's
    // (UI-7), whose Siparişler opens the Açık tab its badge counts.
    const lit = markup.match(/<a[^>]*aria-current="page"[^>]*>/g) ?? [];
    expect(lit).toHaveLength(2);
    expect(lit[0]).toContain('href="/admin/siparisler"');
    expect(lit[1]).toContain(`href="${OPEN_ORDERS}"`);
    const bar = markup.slice(markup.indexOf("data-admin-tabbar"));
    expect(bar.match(/aria-current="page"/g)).toHaveLength(1);
  });

  it("sends Panele dön (error and 404 screens) to the landing page", () => {
    // Both take children only; createElement's overloads want them typed.
    const h = (type: unknown, props: object | null, ...kids: ReactNode[]) =>
      createElement(type as FunctionComponent, props, ...kids);
    const markup = renderToStaticMarkup(
      h(
        PanelHomeProvider,
        { href: landingPathFor("staff") },
        h(PanelHomeLink, null, "Panele dön"),
      ),
    );
    expect(markup).toBe(`<a href="${OPEN_ORDERS}">Panele dön</a>`);
  });
});

describe("the list Personel lands on", () => {
  const landed = { durum: "acik", denied: "1" };

  it("builds no link that carries the notice on", () => {
    expect(withParams(landed, { durum: "paid" }, "/admin/siparisler")).toBe(
      "/admin/siparisler?durum=paid",
    );
    expect(withParams(landed, { sayfa: 2 }, "/admin/siparisler")).toBe(
      "/admin/siparisler?durum=acik&sayfa=2",
    );
    expect([...toSearchParams(new URLSearchParams("denied=1&q=a"))]).toEqual([
      ["q", "a"],
    ]);
  });

  it("draws its tabs and its filter form without `denied`", () => {
    const tabs = renderToStaticMarkup(
      createElement(StatusTabs, {
        tabs: ORDER_TABS,
        current: "acik",
        searchParams: landed,
        pathname: "/admin/siparisler",
      }),
    );
    expect(tabs).toContain('href="/admin/siparisler?durum=paid"');
    expect(tabs).not.toContain("denied");
    const filters = renderToStaticMarkup(
      createElement(FilterBar, {
        fields: ORDER_FILTER_FIELDS,
        searchParams: landed,
        pathname: "/admin/siparisler",
      }),
    );
    expect(filters).toMatch(/<input[^>]*name="durum"[^>]*value="acik"/);
    expect(filters).not.toContain("denied");
  });
});

describe("the denied address", () => {
  function sourceFiles(dir: string): string[] {
    const out: string[] = [];
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const rel = join(dir, entry.name);
      if (entry.isDirectory()) out.push(...sourceFiles(rel));
      else if (/\.(ts|tsx)$/.test(entry.name)) out.push(rel);
    }
    return out;
  }

  it("is built nowhere by hand: the flag goes through deniedPathFor", () => {
    const glued: string[] = [];
    for (const file of sourceFiles("src")) {
      readFileSync(file, "utf8")
        .split("\n")
        .forEach((line, i) => {
          const code = line.trim();
          if (/^(\/\/|\*|\/\*|\{\/\*)/.test(code)) return;
          if (/[?&]denied=/.test(code)) glued.push(`${file}:${i + 1}`);
        });
    }
    expect(glued).toEqual([]);
  });
});
