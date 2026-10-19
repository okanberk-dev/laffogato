import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { NextRequest } from "next/server";
import { createElement, type FunctionComponent, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * A panel list's search box no longer writes what was typed into the
 * address (list-search-no-url, after the shell-nav review of #142): the
 * box posts to listSearchAction, which keeps the text in a short-lived,
 * httpOnly, sameSite=lax cookie scoped to the list's path and redirects to
 * the list without it; the page reads it from there. A customer's e-mail
 * or phone in `?q=` sat in the address bar, the history, a proxy and the
 * Vercel request log (CLAUDE.md rule 9). An old link with `?q=` is moved
 * into the cookie by the proxy and reloaded without it.
 */

process.env.ADMIN_SESSION_SECRET = "x".repeat(40);
process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "pk";

interface SetCookie {
  name: string;
  value: string;
  [key: string]: unknown;
}

const h = vi.hoisted(() => ({
  /** What the request sent. */
  jar: {} as Record<string, string>,
  set: [] as SetCookie[],
  deleted: [] as Array<{ name: string; path?: string }>,
  session: null as null | { email: string; role: string },
}));

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) =>
      name in h.jar ? { name, value: h.jar[name] } : undefined,
    set: (cookie: SetCookie) => {
      h.set.push(cookie);
    },
    delete: (cookie: string | { name: string; path?: string }) => {
      h.deleted.push(typeof cookie === "string" ? { name: cookie } : cookie);
    },
  }),
  headers: async () => new Headers(),
}));
vi.mock("next/navigation", () => ({
  redirect: vi.fn((to: string) => {
    throw Object.assign(new Error(`NEXT_REDIRECT ${to}`), { to });
  }),
  unstable_rethrow: vi.fn(),
  useRouter: () => ({ push: vi.fn() }),
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
vi.mock("@/lib/admin/auth", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/admin/auth")>()),
  getAdminSession: vi.fn(async () => h.session),
}));

const core = await import("@/lib/admin/list-search-core");
const server = await import("@/lib/admin/list-search");
const { listSearchAction } = await import("@/app/admin/liste-arama/actions");
const { FilterBar } = await import("@/components/admin/ui/filter-bar");
const { ListSearchButton, EmptyListActionLink, listSearchHiddenFields } =
  await import("@/components/admin/ui/list-search-button");
const { deniedPathFor, landingPathFor } = await import("@/lib/admin/roles");

const { ORDER_FILTER_FIELDS } = await import("@/lib/admin/order-filters");
const { CUSTOMER_FILTER_FIELDS } =
  await import("@/lib/admin/customer-list-core");
const { productFilterFields } = await import("@/lib/admin/products-panel");
const { menuFilterFields } = await import("@/lib/admin/menu-panel");
const { KARAOKE_FILTER_FIELDS } = await import("@/lib/admin/karaoke-panel");
const { SUBSCRIBER_FILTER_FIELDS } =
  await import("@/lib/admin/newsletter-list");
const { CAMPAIGN_SEND_FILTER_FIELDS } =
  await import("@/lib/admin/campaign-sends-core");
const { PROMO_FILTER_FIELDS } = await import("@/lib/admin/promo-list");
const { CAFE_TABLE_FILTER_FIELDS } =
  await import("@/lib/admin/cafe-tables-panel");
const { AUDIT_FILTER_FIELDS } = await import("@/lib/admin/audit-view");
const { stockFilterFields } = await import("@/lib/admin/stock-moves-panel");

type Fields = readonly { type: string; name?: string; maxLength?: number }[];

/**
 * Every FilterBar in src: the file that draws it, the list it is, the
 * fields it draws and the page whose requireRole guards it. A new
 * FilterBar fails "every FilterBar usage is listed" until it is here.
 */
const LISTS: Array<{
  key: string;
  file: string;
  page: string;
  path: string;
  fields: Fields;
}> = [
  {
    key: "orders",
    file: "src/app/admin/siparisler/page.tsx",
    page: "src/app/admin/siparisler/page.tsx",
    path: "/admin/siparisler",
    fields: ORDER_FILTER_FIELDS,
  },
  {
    key: "customers",
    file: "src/app/admin/musteriler/page.tsx",
    page: "src/app/admin/musteriler/page.tsx",
    path: "/admin/musteriler",
    fields: CUSTOMER_FILTER_FIELDS,
  },
  {
    key: "products",
    file: "src/app/admin/urunler/page.tsx",
    page: "src/app/admin/urunler/page.tsx",
    path: "/admin/urunler",
    fields: productFilterFields([]),
  },
  {
    key: "menu",
    file: "src/app/admin/menu/page.tsx",
    page: "src/app/admin/menu/page.tsx",
    path: "/admin/menu",
    fields: menuFilterFields([]),
  },
  {
    key: "karaoke",
    file: "src/app/admin/mobil/karaoke/page.tsx",
    page: "src/app/admin/mobil/karaoke/page.tsx",
    path: "/admin/mobil/karaoke",
    fields: KARAOKE_FILTER_FIELDS,
  },
  {
    key: "newsletter",
    file: "src/app/admin/bulten/page.tsx",
    page: "src/app/admin/bulten/page.tsx",
    path: "/admin/bulten",
    fields: SUBSCRIBER_FILTER_FIELDS,
  },
  {
    key: "campaign",
    file: "src/components/admin/campaign-send-log.tsx",
    page: "src/app/admin/bulten/kampanya/[id]/page.tsx",
    path: "/admin/bulten/kampanya/cmail-1760000000000-a1b2c3",
    fields: CAMPAIGN_SEND_FILTER_FIELDS,
  },
  {
    key: "promos",
    file: "src/app/admin/promosyon/page.tsx",
    page: "src/app/admin/promosyon/page.tsx",
    path: "/admin/promosyon",
    fields: PROMO_FILTER_FIELDS,
  },
  {
    key: "tables",
    file: "src/app/admin/masalar/page.tsx",
    page: "src/app/admin/masalar/page.tsx",
    path: "/admin/masalar",
    fields: CAFE_TABLE_FILTER_FIELDS,
  },
  {
    key: "audit",
    file: "src/app/admin/olay-kaydi/page.tsx",
    page: "src/app/admin/olay-kaydi/page.tsx",
    path: "/admin/olay-kaydi",
    fields: AUDIT_FILTER_FIELDS,
  },
  {
    key: "stock",
    file: "src/app/admin/stok-hareketleri/page.tsx",
    page: "src/app/admin/stok-hareketleri/page.tsx",
    path: "/admin/stok-hareketleri",
    fields: stockFilterFields([]),
  },
];

const listOf = (key: string) => {
  const list = core.LIST_SEARCHES.find((l) => l.key === key);
  if (!list) throw new Error(`no list ${key}`);
  return list;
};

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(join(process.cwd(), dir), {
    withFileTypes: true,
  })) {
    const rel = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...sourceFiles(rel));
    else if (/\.(ts|tsx)$/.test(entry.name)) out.push(rel);
  }
  return out;
}

/** The search boxes' names across the lists (q, actor, entityId). */
const BOX_NAMES = [
  ...new Set(core.LIST_SEARCHES.flatMap((l) => l.params.map((p) => p.name))),
];

/**
 * Lines that put a search box's text into an address: a `{ q: … }` patch
 * with a link builder (`withParams(`, `href=`) on that line or the three
 * before it, or a `?q=${…}` template; ListSearchButton's `terms` (the
 * post's body) aside. 1-based.
 */
function linkedSearchLines(text: string): number[] {
  const names = BOX_NAMES.join("|");
  const patch = new RegExp(`\\b(?:${names}):\\s*[A-Za-z_]`);
  const template = new RegExp(`[?&](?:${names})=\\$\\{`);
  const lines = text.split("\n");
  const out: number[] = [];
  lines.forEach((raw, i) => {
    const line = raw.trim();
    if (/^(\/\/|\*|\/\*|\{\/\*)/.test(line)) return;
    // ListSearchButton's `terms` is the post's body, not the link.
    if (/^terms=\{\{/.test(line)) return;
    const near = lines.slice(Math.max(0, i - 3), i + 1).join("\n");
    if (
      (patch.test(line) && /withParams\(|href=/.test(near)) ||
      template.test(line)
    ) {
      out.push(i + 1);
    }
  });
  return out;
}

/** createElement with children as arguments (the props type requires them). */
const withKids = (
  type: unknown,
  props: Record<string, unknown>,
  ...children: ReactNode[]
) => createElement(type as FunctionComponent, props, ...children);

function form(entries: Array<[string, string]>): FormData {
  const fd = new FormData();
  for (const [k, v] of entries) fd.append(k, v);
  return fd;
}

/** Runs the action; returns where it redirected. */
async function post(entries: Array<[string, string]>): Promise<string> {
  try {
    await listSearchAction(form(entries));
  } catch (err) {
    const to = (err as { to?: string }).to;
    if (to) return to;
    throw err;
  }
  throw new Error("the action did not redirect");
}

beforeEach(() => {
  h.jar = {};
  h.set = [];
  h.deleted = [];
  h.session = { email: "patron@laffogato.net", role: "owner" };
});

describe("the lists", () => {
  it("every FilterBar usage is listed, with the list it draws", () => {
    const users = sourceFiles("src")
      .filter((f) => !f.endsWith("ui/filter-bar.tsx"))
      .filter((f) => /<FilterBar\b/.test(readFileSync(f, "utf8")))
      .sort();
    expect(users).toEqual(LISTS.map((l) => l.file).sort());
    expect(core.LIST_SEARCHES.map((l) => l.key).sort()).toEqual(
      LISTS.map((l) => l.key).sort(),
    );
  });

  it.each(LISTS)(
    "$key: the registry keeps exactly the list's search boxes, at their lengths",
    ({ key, path, fields }) => {
      const list = listOf(key);
      expect(core.listSearchAt(path)).toBe(list);
      const boxes = fields
        .filter((f) => f.type === "search")
        .map((f) => ({ name: f.name, maxLength: f.maxLength ?? 100 }));
      expect(list.params).toEqual(boxes);
      // FilterBar's own check accepts the list's fields as drawn.
      expect(core.listSearchFor(path, fields)).toBe(list);
    },
  );

  it.each(LISTS)(
    "$key: who may search is who may open the page",
    ({ key, page }) => {
      const text = readFileSync(page, "utf8");
      expect(text).toContain(`requireRole("${listOf(key).section}")`);
    },
  );

  it.each(LISTS.filter((l) => l.key !== "stock"))(
    "$key: the list reads the text from its cookie and builds no link from it",
    ({ file }) => {
      const text = readFileSync(file, "utf8");
      expect(text).toMatch(/await listSearchView\(/);
      // Links, tabs, pages and the bar are drawn from the address only.
      expect(text).not.toMatch(/searchParams=\{view\}/);
      expect(text).not.toMatch(/withParams\(\s*view\b/);
    },
  );

  it("matches the list itself, not a page under it or a look-alike", () => {
    expect(core.listSearchAt("/admin/siparisler")?.key).toBe("orders");
    expect(core.listSearchAt("/admin/siparisler/10023")).toBeNull();
    expect(core.listSearchAt("/admin/siparislerx")).toBeNull();
    expect(core.listSearchAt("/admin/bulten")?.key).toBe("newsletter");
    expect(core.listSearchAt("/admin/bulten/kampanya/cmail-17-ab")?.key).toBe(
      "campaign",
    );
    expect(core.listSearchAt("/admin/bulten/kampanya/a/b")).toBeNull();
    expect(core.listSearchAt("/admin/bulten/kampanya/..")).toBeNull();
    expect(core.listSearchAt("/admin/bulten/kampanya/.x")).toBeNull();
    expect(core.listSearchAt("/admin/kullanicilar")).toBeNull();
  });

  it("refuses a FilterBar path or search box it does not know", () => {
    expect(() => core.listSearchFor("/admin/raporlar")).toThrow(
      /not in LIST_SEARCHES/,
    );
    expect(() =>
      core.listSearchFor("/admin/siparisler", [
        { type: "search", name: "email" },
      ]),
    ).toThrow(/"email"/);
    expect(() =>
      core.listSearchFor("/admin/stok-hareketleri", [
        { type: "search", name: "q" },
      ]),
    ).toThrow();
  });

  it("no panel code links a search text into an address any more", () => {
    const files = [
      ...sourceFiles("src/app/admin"),
      ...sourceFiles("src/components/admin"),
      ...sourceFiles("src/lib/admin"),
    ];
    const leaks = files.flatMap((file) =>
      linkedSearchLines(readFileSync(file, "utf8")).map((n) => `${file}:${n}`),
    );
    expect(leaks).toEqual([]);
  });

  it("the check catches the shapes that leaked", () => {
    // The customer's "Siparişleri" and "Tümünü gör" (`?q=<e-mail>`), the
    // audit log's "Geçmişi" (`?entityId=<e-mail>`), as they were on main.
    expect(
      linkedSearchLines(
        'href={withParams({}, { q: row.email }, "/admin/siparisler")}',
      ),
    ).toEqual([1]);
    expect(
      linkedSearchLines(
        [
          "<Link",
          "  href={withParams(",
          "    {},",
          "    { entity: row.entity, entityId: row.entityId },",
          "    AUDIT_LOG_PATH,",
          "  )}",
        ].join("\n"),
      ),
    ).toEqual([4]);
    expect(linkedSearchLines("const href = `/admin/menu?q=${text}`;")).toEqual([
      1,
    ]);
    // An audit row's id is not a link; the kind alone in a link is fine.
    expect(
      linkedSearchLines(
        [
          'await logAudit({ action: "delete", entity: "coupon", entityId: id });',
          "href={withParams({}, { entity: row.entity }, AUDIT_LOG_PATH)}",
          "terms={{ entityId: row.entityId }}",
        ].join("\n"),
      ),
    ).toEqual([]);
  });
});

describe("the cookie", () => {
  it("is short-lived, httpOnly, lax and scoped to the list", () => {
    expect(core.listSearchCookieName(listOf("orders"))).toBe("adm_q_orders");
    expect(core.listSearchCookieOptions("/admin/siparisler", true)).toEqual({
      httpOnly: true,
      sameSite: "lax",
      secure: true,
      path: "/admin/siparisler",
      maxAge: 600,
    });
  });

  it("round-trips the texts and drops what is not the list's", () => {
    const audit = listOf("audit");
    const raw = core.encodeListSearch({
      actor: "ali@laffogato.net",
      entityId: "eda@ornek.com",
    });
    expect(core.decodeListSearch(raw, audit)).toEqual({
      actor: "ali@laffogato.net",
      entityId: "eda@ornek.com",
    });
    expect(
      core.decodeListSearch("q=x&entity=product&actor=%20%20a%20%20b ", audit),
    ).toEqual({ actor: "a b" });
    expect(core.decodeListSearch("", audit)).toEqual({});
    expect(core.decodeListSearch(undefined, audit)).toEqual({});
    // Capped at the box's own length.
    const promos = listOf("promos");
    expect(core.decodeListSearch(`q=${"A".repeat(60)}`, promos).q).toHaveLength(
      40,
    );
  });

  it("signing out forgets every list's search", () => {
    const gone: Array<{ name: string; path: string }> = [];
    core.forgetListSearches({ delete: (c) => gone.push(c) });
    expect(gone).toContainEqual({
      name: "adm_q_orders",
      path: "/admin/siparisler",
    });
    expect(gone).toContainEqual({
      name: "adm_q_audit",
      path: "/admin/olay-kaydi",
    });
    // Stok has no box; the campaign's cookie is per campaign page.
    expect(gone.map((c) => c.name)).not.toContain("adm_q_stock");
    expect(gone.map((c) => c.name)).not.toContain("adm_q_campaign");
    const auth = readFileSync("src/lib/admin/auth.ts", "utf8");
    expect(auth).toMatch(
      /cookieStore\.delete\(COOKIE_NAME\);[\s\S]{0,200}forgetListSearches\(cookieStore\)/,
    );
  });
});

describe("the page reads the term", () => {
  it("from the cookie, never from the address", async () => {
    h.jar = { adm_q_orders: "q=eda%40ornek.com" };
    const { url, view } = await server.listSearchView("/admin/siparisler", {
      durum: "paid",
      q: "ayse@ornek.com",
      sayfa: "2",
    });
    expect(url).toEqual({ durum: "paid", sayfa: "2" });
    expect(view).toEqual({ durum: "paid", sayfa: "2", q: "eda@ornek.com" });
  });

  it("a list with no box reads no cookie; an unknown path is an error", async () => {
    h.jar = { adm_q_stock: "q=x" };
    const { view } = await server.listSearchView("/admin/stok-hareketleri", {
      reason: "sale",
    });
    expect(view).toEqual({ reason: "sale" });
    await expect(
      server.listSearchView("/admin/raporlar", {}),
    ).rejects.toThrow();
  });
});

describe("listSearchAction", () => {
  it("keeps the text in the cookie and lands on the list without it", async () => {
    const to = await post([
      ["$ACTION_ID_abc", ""],
      ["_path", "/admin/siparisler"],
      ["durum", "paid"],
      ["q", "  eda@ornek.com  "],
      ["kanal", "web"],
      ["tur", ""],
      ["sayfa", "4"],
    ]);
    expect(to).toBe("/admin/siparisler?durum=paid&kanal=web");
    expect(to).not.toContain("eda");
    expect(h.set).toEqual([
      {
        name: "adm_q_orders",
        value: "q=eda%40ornek.com",
        httpOnly: true,
        sameSite: "lax",
        secure: false,
        path: "/admin/siparisler",
        maxAge: 600,
      },
    ]);
    expect(h.deleted).toEqual([]);
  });

  it("an emptied box forgets the search", async () => {
    const to = await post([
      ["_path", "/admin/musteriler"],
      ["q", "   "],
      ["filter", "guests"],
    ]);
    expect(to).toBe("/admin/musteriler?filter=guests");
    expect(h.set).toEqual([]);
    expect(h.deleted).toEqual([
      { name: "adm_q_customers", path: "/admin/musteriler" },
    ]);
  });

  it("Sıfırla forgets it; a chip's × forgets only its own box", async () => {
    expect(
      await post([
        ["_path", "/admin/siparisler"],
        ["_do", "reset"],
        ["durum", "acik"],
      ]),
    ).toBe("/admin/siparisler?durum=acik");
    expect(h.deleted).toEqual([
      { name: "adm_q_orders", path: "/admin/siparisler" },
    ]);
    h.deleted = [];
    h.jar = {
      adm_q_audit: core.encodeListSearch({
        actor: "ali@laffogato.net",
        entityId: "prd-0001",
      }),
    };
    expect(
      await post([
        ["_path", "/admin/olay-kaydi"],
        ["_do", "clear"],
        ["_clear", "actor"],
        ["entity", "product"],
      ]),
    ).toBe("/admin/olay-kaydi?entity=product");
    expect(h.set).toMatchObject([
      {
        name: "adm_q_audit",
        value: "entityId=prd-0001",
        path: "/admin/olay-kaydi",
      },
    ]);
  });

  it("a campaign's search is its own page's", async () => {
    const path = "/admin/bulten/kampanya/cmail-1760000000000-a1b2c3";
    expect(
      await post([
        ["_path", path],
        ["q", "eda@ornek.com"],
        ["durum", "failed"],
      ]),
    ).toBe(`${path}?durum=failed`);
    expect(h.set).toMatchObject([{ name: "adm_q_campaign", path }]);
  });

  it("checks the session and the list's section before any cookie", async () => {
    h.session = null;
    expect(
      await post([
        ["_path", "/admin/siparisler"],
        ["q", "eda@ornek.com"],
      ]),
    ).toBe("/admin/giris");
    // Personel opens orders but not customers or the audit log.
    h.session = { email: "personel@laffogato.net", role: "staff" };
    expect(
      await post([
        ["_path", "/admin/musteriler"],
        ["q", "eda@ornek.com"],
      ]),
    ).toBe(deniedPathFor("staff"));
    expect(
      await post([
        ["_path", "/admin/olay-kaydi"],
        ["actor", "ali@laffogato.net"],
      ]),
    ).toBe(deniedPathFor("staff"));
    expect(h.set).toEqual([]);
    expect(h.deleted).toEqual([]);
    // A list it may open.
    expect(
      await post([
        ["_path", "/admin/siparisler"],
        ["q", "10023"],
      ]),
    ).toBe("/admin/siparisler");
    expect(h.set).toHaveLength(1);
  });

  it("a post the panel never draws goes to the role's landing page", async () => {
    for (const entries of [
      [["q", "x"]],
      [["_path", "/admin/raporlar"]],
      [["_path", "https://evil.example/admin/siparisler"]],
      [["_path", "/admin/siparisler/10023"]],
      [
        ["_path", "/admin/siparisler"],
        ["_do", "drop-table"],
      ],
    ] as Array<Array<[string, string]>>) {
      expect(await post(entries)).toBe(landingPathFor("owner"));
    }
    expect(h.set).toEqual([]);
  });

  it("the redirect carries only short, plain params", async () => {
    const to = await post([
      ["_path", "/admin/siparisler"],
      ["durum", "paid"],
      ["odd name", "x"],
      ["__proto__", "x"],
      ["kanal", "x".repeat(201)],
      ["_clear", "q"],
    ]);
    expect(to).toBe("/admin/siparisler?durum=paid");
  });

  it("logs nothing of what was typed", async () => {
    const spies = (["log", "info", "warn", "error"] as const).map((m) =>
      vi.spyOn(console, m).mockImplementation(() => {}),
    );
    try {
      await post([
        ["_path", "/admin/siparisler"],
        ["q", "eda@ornek.com"],
      ]);
      for (const spy of spies) {
        for (const call of spy.mock.calls) {
          expect(JSON.stringify(call)).not.toContain("eda@ornek.com");
        }
      }
    } finally {
      for (const spy of spies) spy.mockRestore();
    }
  });
});

describe("the FilterBar", () => {
  const render = (
    sp: Record<string, string>,
    values: Record<string, string> = {},
  ) =>
    renderToStaticMarkup(
      createElement(FilterBar, {
        fields: ORDER_FILTER_FIELDS,
        searchParams: sp,
        values,
        pathname: "/admin/siparisler",
        label: "Sipariş filtreleri",
      }),
    );

  it("has no GET form and no text field named q in an address", () => {
    const html = render(
      { durum: "paid" },
      { q: "eda@ornek.com", kanal: "web" },
    );
    const forms = html.match(/<form\b[^>]*>/g) ?? [];
    // The bar, its reset form and the search chip's ×.
    expect(forms.length).toBe(3);
    for (const tag of forms) {
      expect(tag).not.toMatch(/method="get"/i);
      // A function action (here React's guard; a Server Action's post in
      // the app), never a URL the browser would GET with the fields.
      expect(tag).not.toMatch(/\saction="\//);
    }
    // The box shows the remembered text, the chip names it; no hidden
    // field and no link carries it.
    expect(html).toMatch(
      /<input[^>]*type="search"[^>]*name="q"[^>]*value="eda@ornek\.com"/,
    );
    expect(html).not.toMatch(/type="hidden"[^>]*value="[^"]*eda/);
    expect(html).not.toMatch(/href="[^"]*eda/);
    expect(html).toContain(
      '<input type="hidden" name="_path" value="/admin/siparisler"/>',
    );
  });

  it("ignores a text in the address it is handed", () => {
    // A page that passed its `view` (or an address the proxy missed): the
    // dropdown chip's link and the reset form are built without it.
    const html = render(
      { durum: "paid", q: "ayse@ornek.com", sayfa: "2" },
      { kanal: "web" },
    );
    expect(html).not.toContain("ayse@ornek.com");
    expect(html).toContain('href="/admin/siparisler?durum=paid"');
    expect(html).toContain('<input type="hidden" name="durum" value="paid"/>');
    expect(html).not.toContain('name="sayfa"');
  });

  it("Sıfırla submits its own form; Enter in the box is still Uygula", () => {
    const html = render({ durum: "paid" }, { kanal: "web" });
    const reset =
      /<button type="submit" form="([^"]+)"[^>]*>Sıfırla<\/button>/.exec(html);
    expect(reset).not.toBeNull();
    const target = new RegExp(
      `<form id="${reset![1].replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}" hidden=""[^>]*>(.*?)</form>`,
    ).exec(html);
    expect(target?.[1]).toBe(
      '<input type="hidden" name="_path" value="/admin/siparisler"/><input type="hidden" name="_do" value="reset"/><input type="hidden" name="durum" value="paid"/>',
    );
    // The bar's first own submit button is Uygula (Sıfırla belongs to the
    // other form), so Enter applies.
    const bar = html.slice(0, html.indexOf("</form>"));
    const own = bar.match(/<button type="submit"(?! form=)[^>]*>[^<]*/g) ?? [];
    expect(own[0]).toMatch(/>Uygula$/);
    // A dropdown's chip stays a link, without the page param.
    expect(html).toContain('href="/admin/siparisler?durum=paid"');
  });
});

describe("ListSearchButton", () => {
  it("posts the list's address and the text, never a link", () => {
    const html = renderToStaticMarkup(
      withKids(
        ListSearchButton,
        {
          href: "/admin/siparisler?durum=acik",
          terms: { q: "eda@ornek.com" },
          className: "x",
        },
        "Siparişleri",
      ),
    );
    expect(html).toMatch(/^<form [^>]*class="contents"/);
    expect(html).not.toContain("href=");
    expect(html).toContain(
      '<input type="hidden" name="_path" value="/admin/siparisler"/><input type="hidden" name="_do" value="apply"/><input type="hidden" name="durum" value="acik"/><input type="hidden" name="q" value="eda@ornek.com"/><button type="submit" class="x">Siparişleri</button>',
    );
  });

  it("drops a text that rode in the href, and refuses a page that is not a list", () => {
    expect(
      listSearchHiddenFields("/admin/siparisler?q=eda%40ornek.com&kanal=web"),
    ).toEqual([
      ["_path", "/admin/siparisler"],
      ["_do", "apply"],
      ["kanal", "web"],
    ]);
    expect(() => listSearchHiddenFields("/admin/siparisler/10023")).toThrow();
  });

  it("an empty list's way out forgets the search when asked to", () => {
    const reset = renderToStaticMarkup(
      createElement(EmptyListActionLink, {
        action: {
          href: "/admin/urunler?durum=pasif",
          label: "Filtreleri temizle",
          clearsSearch: true,
        },
      }),
    );
    expect(reset).toContain(
      '<input type="hidden" name="_do" value="reset"/><input type="hidden" name="durum" value="pasif"/><button type="submit">Filtreleri temizle</button>',
    );
    const link = renderToStaticMarkup(
      createElement(EmptyListActionLink, {
        action: { href: "/admin/urunler/yeni", label: "+ Yeni ürün" },
      }),
    );
    expect(link).toBe('<a href="/admin/urunler/yeni">+ Yeni ürün</a>');
  });
});

describe("an old link with the text in its address", () => {
  it("is moved into the cookie and reloaded without it, signed in or not", async () => {
    const { proxy } = await import("@/proxy");
    const res = await proxy(
      new NextRequest(
        "https://site.test/admin/siparisler?durum=acik&q=ayse%40example.com&sayfa=2",
      ),
    );
    expect(res.status).toBe(303);
    const to = new URL(res.headers.get("location")!);
    expect(to.pathname).toBe("/admin/siparisler");
    expect(to.search).toBe("?durum=acik&sayfa=2");
    expect(res.headers.get("location")).not.toMatch(/ayse/);
    expect(res.cookies.get("adm_q_orders")).toMatchObject({
      value: "q=ayse%40example.com",
      path: "/admin/siparisler",
      httpOnly: true,
      sameSite: "lax",
      maxAge: 600,
    });
    // The reload then meets the sign-in, whose `next` has no text.
    const again = await proxy(new NextRequest(to.href));
    expect(again.status).toBe(307);
    const signIn = new URL(again.headers.get("location")!);
    expect(signIn.searchParams.get("next")).toBe(
      "/admin/siparisler?durum=acik&sayfa=2",
    );
  });

  it("moves every box of the list, and an empty one forgets", async () => {
    const { proxy } = await import("@/proxy");
    const res = await proxy(
      new NextRequest(
        "https://site.test/admin/olay-kaydi?entity=customer&entityId=eda%40ornek.com",
      ),
    );
    expect(res.headers.get("location")).toBe(
      "https://site.test/admin/olay-kaydi?entity=customer",
    );
    expect(res.cookies.get("adm_q_audit")?.value).toBe(
      "entityId=eda%40ornek.com",
    );
    const empty = await proxy(
      new NextRequest("https://site.test/admin/musteriler?q="),
    );
    expect(empty.status).toBe(303);
    expect(empty.headers.get("location")).toBe(
      "https://site.test/admin/musteriler",
    );
    expect(empty.headers.get("set-cookie")).toMatch(
      /adm_q_customers=;.*Path=\/admin\/musteriler/,
    );
  });

  it("leaves posts, pages under a list and other pages alone", async () => {
    const { proxy } = await import("@/proxy");
    // The list's own form posting to it (a Server Action): never moved.
    const action = await proxy(
      new NextRequest("https://site.test/admin/siparisler?q=x", {
        method: "POST",
      }),
    );
    expect(action.status).not.toBe(303);
    for (const url of [
      "https://site.test/admin/siparisler/10023?q=x",
      "https://site.test/admin/siparislerx?q=x",
      "https://site.test/admin/stok-hareketleri?productId=prd-0001",
    ]) {
      const res = await proxy(new NextRequest(url));
      expect(res.status, url).not.toBe(303);
      expect(
        res.cookies.getAll().map((c) => c.name),
        url,
      ).not.toContain("adm_q_orders");
    }
  });
});
