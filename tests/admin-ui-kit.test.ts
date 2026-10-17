import { readFileSync } from "node:fs";

import { createElement, type FunctionComponent, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

/**
 * The shared admin kit (src/components/admin/ui, Filament-style): the pure
 * URL, result, toast and flash rules every list and modal leans on, the
 * markup the server-rendered pieces produce, the bulk-selection fix, and the
 * tone colours' contrast.
 */

// A plain anchor and a no-op router: these render tests run without Next's
// app router.
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
  // LinkPending (status tabs, pages, sort headers) reads the link's state.
  useLinkStatus: () => ({ pending: false }),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  unstable_rethrow: vi.fn(),
}));

const {
  filterChips,
  firstParam,
  nextSortDir,
  pageCount,
  pageRangeLabel,
  pageWindow,
  parseFilters,
  parsePage,
  parseSort,
  withParams,
} = await import("@/lib/admin/list-params");
const {
  actionError,
  actionOk,
  fieldErrorsFromIssues,
  noticeSentence,
  okWithNotice,
} = await import("@/lib/admin/action-result");
const { ADMIN_FLASH_COOKIE, clearFlashCookieString, decodeFlash, encodeFlash } =
  await import("@/lib/admin/flash-core");
const {
  ORDER_STATUSES,
  ORDER_STATUS_LABELS,
  ORDER_STATUS_TONES,
  isOrderStatus,
  orderStatusLabel,
} = await import("@/lib/admin/order-ui");
const { ADMIN_TONES } = await import("@/lib/admin/tone");
const {
  MAX_TOASTS,
  addToast,
  toastAutoHideMs,
  toastFromFlash,
  toastFromResult,
} = await import("@/components/admin/ui/toast-core");
const {
  BulkActionBar,
  RowCheckbox,
  SelectAllCheckbox,
  bulkBarSpace,
  selectionReducer,
} = await import("@/components/admin/bulk");
const ui = await import("@/components/admin/ui");
const forms = await import("@/components/admin/forms");

const html = (node: ReturnType<typeof createElement>) =>
  renderToStaticMarkup(node);
/** createElement with children as arguments, for components whose props type requires them. */
const withKids = (
  type: unknown,
  props: Record<string, unknown>,
  ...children: ReactNode[]
) => createElement(type as FunctionComponent, props, ...children);
const read = (path: string) => readFileSync(path, "utf8");

describe("withParams keeps the rest of the URL", () => {
  it("patches one param and keeps every other", () => {
    expect(
      withParams(
        { durum: "paid", q: "ayşe", sayfa: "3" },
        { sirala: "total", yon: "desc", sayfa: null },
        "/admin/siparisler",
      ),
    ).toBe("/admin/siparisler?durum=paid&q=ay%C5%9Fe&sirala=total&yon=desc");
  });

  it("removes a key for null, undefined and the empty string", () => {
    expect(
      withParams(
        { a: "1", b: "2", c: "3" },
        { a: null, b: undefined, c: "" },
        "/x",
      ),
    ).toBe("/x");
  });

  it("replaces a key in place and keeps repeated keys it does not touch", () => {
    expect(
      withParams({ tag: ["a", "b"], durum: "paid" }, { durum: "cancelled" }),
    ).toBe("?tag=a&tag=b&durum=cancelled");
  });

  it("reads URLSearchParams too, without changing the original", () => {
    const sp = new URLSearchParams("q=kahve&sayfa=2");
    expect(withParams(sp, { sayfa: 3 }, "/l")).toBe("/l?q=kahve&sayfa=3");
    expect(sp.toString()).toBe("q=kahve&sayfa=2");
  });

  it("an empty result without a path is '?', which a link reads as 'this page'", () => {
    expect(withParams({ q: "x" }, { q: null })).toBe("?");
    expect(withParams(undefined, {})).toBe("?");
  });

  it("firstParam takes the first of a repeated key", () => {
    expect(firstParam({ q: ["a", "b"] }, "q")).toBe("a");
    expect(firstParam(new URLSearchParams("q=z"), "q")).toBe("z");
    expect(firstParam(null, "q")).toBeUndefined();
  });
});

describe("sort and page params", () => {
  const fallback = { key: "no", dir: "desc" as const };

  it("accepts only allowed columns and a known direction", () => {
    expect(
      parseSort({ sirala: "total", yon: "asc" }, ["no", "total"], fallback),
    ).toEqual({
      key: "total",
      dir: "asc",
    });
    expect(
      parseSort(
        { sirala: "DROP TABLE", yon: "asc" },
        ["no", "total"],
        fallback,
      ),
    ).toEqual(fallback);
    // An odd direction: the fallback's own for its column, asc for others.
    expect(parseSort({ sirala: "no", yon: "x" }, ["no"], fallback).dir).toBe(
      "desc",
    );
    expect(parseSort({ sirala: "total" }, ["no", "total"], fallback).dir).toBe(
      "asc",
    );
    expect(
      parseSort({ s: "total", d: "desc" }, ["total"], fallback, {
        sort: "s",
        dir: "d",
      }),
    ).toEqual({
      key: "total",
      dir: "desc",
    });
  });

  it("a click flips the sorted column and starts another at its first direction", () => {
    expect(nextSortDir({ key: "no", dir: "desc" }, "no")).toBe("asc");
    expect(nextSortDir({ key: "no", dir: "asc" }, "no")).toBe("desc");
    expect(nextSortDir({ key: "no", dir: "asc" }, "total", "desc")).toBe(
      "desc",
    );
    expect(nextSortDir(null, "total")).toBe("asc");
  });

  it("a page is a positive integer, anything else is page 1", () => {
    expect(parsePage({ sayfa: "4" })).toBe(4);
    for (const bad of ["0", "-2", "abc", "1.5", "9999999", ""]) {
      expect(parsePage({ sayfa: bad })).toBe(1);
    }
    expect(parsePage({ p: "2" }, "p")).toBe(2);
  });

  it("counts pages and labels the range as 1-100 / N", () => {
    expect(pageCount(0, 100)).toBe(1);
    expect(pageCount(250, 100)).toBe(3);
    expect(pageRangeLabel(1, 100, 250)).toBe("1-100 / 250");
    expect(pageRangeLabel(3, 100, 250)).toBe("201-250 / 250");
    expect(pageRangeLabel(1, 100, 0)).toBe("0 / 0");
  });

  it("draws first, last and the neighbours, with gaps that are never one page", () => {
    expect(pageWindow(1, 1)).toEqual([1]);
    expect(pageWindow(2, 4)).toEqual([1, 2, 3, 4]);
    expect(pageWindow(6, 20)).toEqual([1, null, 5, 6, 7, null, 20]);
    expect(pageWindow(3, 20)).toEqual([1, 2, 3, 4, null, 20]);
    // Out of range clamps instead of drawing page 99 of 5.
    expect(pageWindow(99, 5)).toEqual([1, null, 4, 5]);
  });
});

describe("filter params", () => {
  const FIELDS = [
    { type: "search", name: "q", label: "Ara", maxLength: 10 },
    {
      type: "select",
      name: "kanal",
      label: "Kanal",
      options: [
        { value: "web", label: "Web" },
        { value: "app", label: "Uygulama" },
      ],
    },
    { type: "date-range", label: "Tarih", from: "bas", to: "bit" },
  ] as const;

  it("keeps only values the page can use", () => {
    expect(
      parseFilters(
        {
          q: "  çay   latte  ",
          kanal: "fax",
          bas: "2026-02-30",
          bit: "2026-10-15",
        },
        FIELDS,
      ),
    ).toEqual({ q: "çay latte", bit: "2026-10-15" });
  });

  it("caps the search box and swaps a backwards date range", () => {
    expect(
      parseFilters(
        {
          q: "1234567890abc",
          kanal: "app",
          bas: "2026-10-20",
          bit: "2026-10-01",
        },
        FIELDS,
      ),
    ).toEqual({
      q: "1234567890",
      kanal: "app",
      bas: "2026-10-01",
      bit: "2026-10-20",
    });
  });

  it("chips name each active filter and remove it with the page", () => {
    const sp = {
      q: "ayşe",
      kanal: "app",
      bas: "2026-10-01",
      durum: "paid",
      sayfa: "2",
    };
    const values = parseFilters(sp, FIELDS);
    const chips = filterChips(FIELDS, values, sp, "/admin/siparisler");
    expect(chips.map((c) => [c.label, c.value])).toEqual([
      ["Ara", "ayşe"],
      ["Kanal", "Uygulama"],
      ["Tarih", "01.10.2026 ve sonrası"],
    ]);
    expect(chips[1].removeHref).toBe(
      "/admin/siparisler?q=ay%C5%9Fe&bas=2026-10-01&durum=paid",
    );
    expect(chips[2].removeHref).toBe(
      "/admin/siparisler?q=ay%C5%9Fe&kanal=app&durum=paid",
    );
    const both = filterChips(
      FIELDS,
      { bas: "2026-10-01", bit: "2026-10-15" },
      {},
      "/x",
    );
    expect(both[0].value).toBe("01.10.2026 - 15.10.2026");
  });
});

describe("ActionResult helpers", () => {
  it("builds both halves", () => {
    expect(actionOk("Kaydedildi.")).toEqual({
      ok: true,
      message: "Kaydedildi.",
      tone: "success",
    });
    expect(actionError("Olmadı.")).toEqual({ ok: false, error: "Olmadı." });
    expect(actionError("Olmadı.", {})).toEqual({ ok: false, error: "Olmadı." });
    expect(actionError("Olmadı.", { reason: "Neden yaz." })).toEqual({
      ok: false,
      error: "Olmadı.",
      fieldErrors: { reason: "Neden yaz." },
    });
  });

  it("takes the first message per field from zod-style issues", () => {
    expect(
      fieldErrorsFromIssues([
        { path: ["reason"], message: "En az 3 karakter." },
        { path: ["reason"], message: "ikinci" },
        { path: ["items", 0, "qty"], message: "Adet" },
        { path: [], message: "kök" },
      ]),
    ).toEqual({ reason: "En az 3 karakter.", items: "Adet" });
  });

  it("says whether the mail went, and turns a failed one into a warning", () => {
    expect(noticeSentence("sent")).toBe("Müşteriye e-posta gönderildi.");
    expect(noticeSentence(true, "üyeye")).toBe("Üyeye e-posta gönderildi.");
    expect(noticeSentence("failed")).toBe(
      "E-posta GÖNDERİLEMEDİ, müşteriye kendin ulaş.",
    );
    expect(noticeSentence(false, "üyeye")).toBe(
      "E-posta GÖNDERİLEMEDİ, üyeye kendin ulaş.",
    );
    expect(noticeSentence("duplicate")).toBe(
      "E-posta daha önce gönderilmişti.",
    );
    expect(noticeSentence("not_due")).toBe("");
    expect(noticeSentence(undefined)).toBe("");
    expect(okWithNotice("Sipariş iptal edildi.", "failed")).toEqual({
      ok: true,
      message:
        "Sipariş iptal edildi. E-posta GÖNDERİLEMEDİ, müşteriye kendin ulaş.",
      tone: "warning",
    });
    expect(okWithNotice("Hazır.", "not_due")).toEqual({
      ok: true,
      message: "Hazır.",
      tone: "success",
    });
  });
});

describe("toasts", () => {
  const t = (id: string, tone: "success" | "info" | "warning" | "danger") => ({
    id,
    tone,
    message: id,
  });

  it("success and info fade after 5 s; warnings and errors wait", () => {
    expect(toastAutoHideMs("success")).toBe(5000);
    expect(toastAutoHideMs("info")).toBe(5000);
    expect(toastAutoHideMs("warning")).toBeNull();
    expect(toastAutoHideMs("danger")).toBeNull();
  });

  it("ignores a repeated id and drops the oldest fading toast past the cap", () => {
    const one = addToast([], t("a", "success"));
    expect(addToast(one, t("a", "success"))).toHaveLength(1);
    let list = [
      t("w1", "warning"),
      t("s1", "success"),
      t("w2", "warning"),
      t("w3", "warning"),
    ];
    expect(list).toHaveLength(MAX_TOASTS);
    list = addToast(list, t("e1", "danger"));
    expect(list.map((x) => x.id)).toEqual(["w1", "w2", "w3", "e1"]);
    // Only sticky ones left: the oldest goes.
    list = addToast(list, t("e2", "danger"));
    expect(list.map((x) => x.id)).toEqual(["w2", "w3", "e1", "e2"]);
  });

  it("reads an ActionResult and a flash", () => {
    expect(toastFromResult({ ok: true, message: "Tamam." })).toEqual({
      message: "Tamam.",
      tone: "success",
    });
    expect(
      toastFromResult({ ok: true, message: "Mail yok.", tone: "warning" }).tone,
    ).toBe("warning");
    expect(toastFromResult({ ok: false, error: "Hata." })).toEqual({
      message: "Hata.",
      tone: "danger",
    });
    expect(
      toastFromFlash({ id: "x1", message: "Oldu.", tone: "info" }),
    ).toEqual({
      id: "flash-x1",
      message: "Oldu.",
      tone: "info",
    });
  });
});

describe("adm_flash cookie", () => {
  it("round-trips a Turkish message in a cookie-safe value", () => {
    const value = encodeFlash({
      id: "abc",
      message: "Sipariş #10023 iptal edildi; ürünler stoğa döndü.",
      tone: "warning",
    });
    expect(value).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(decodeFlash(value)).toEqual({
      id: "abc",
      message: "Sipariş #10023 iptal edildi; ürünler stoğa döndü.",
      tone: "warning",
    });
  });

  it("refuses a missing, foreign or tampered value", () => {
    expect(decodeFlash(undefined)).toBeNull();
    expect(decodeFlash("")).toBeNull();
    expect(decodeFlash("not base64!")).toBeNull();
    expect(
      decodeFlash(Buffer.from('{"i":"x"}').toString("base64url")),
    ).toBeNull();
    expect(decodeFlash(Buffer.from("[1,2]").toString("base64url"))).toBeNull();
    // An unknown tone reads as info rather than failing.
    const odd = Buffer.from('{"i":"x","m":"Selam","t":"party"}').toString(
      "base64url",
    );
    expect(decodeFlash(odd)?.tone).toBe("info");
  });

  it("caps the message and deletes on the same name and path", () => {
    const long = decodeFlash(
      encodeFlash({ id: "l", message: "a".repeat(1000), tone: "success" }),
    );
    expect(long?.message).toHaveLength(300);
    expect(ADMIN_FLASH_COOKIE).toBe("adm_flash");
    expect(clearFlashCookieString()).toBe(
      "adm_flash=; Path=/admin; Max-Age=0; SameSite=Lax",
    );
  });

  it("is set by a server-only helper with a one-minute, /admin, Lax cookie", () => {
    const src = read("src/lib/admin/flash.ts");
    expect(src).toContain('import "server-only"');
    // A plain server module: a "use server" file would make it a public POST.
    expect(src).not.toMatch(/^\s*["']use server["']/m);
    expect(src).toContain("maxAge: ADMIN_FLASH_MAX_AGE");
    expect(src).toContain('sameSite: "lax"');
    expect(src).toContain("path: ADMIN_FLASH_PATH");
  });
});

describe("order status labels in one place", () => {
  it("names a shipped order in its own words", () => {
    const shipped = { status: "shipped" as const };
    expect(orderStatusLabel({ ...shipped, fulfillment: "pickup" })).toBe(
      "Hazır",
    );
    expect(orderStatusLabel({ ...shipped, fulfillment: "delivery" })).toBe(
      "Kuryede",
    );
    expect(orderStatusLabel({ ...shipped, fulfillment: "table" })).toBe(
      "Masada",
    );
    expect(orderStatusLabel(shipped)).toBe("Kargoda");
    expect(orderStatusLabel({ status: "cancelled" })).toBe("İptal edildi");
  });

  it("has a label and a known tone for every status", () => {
    for (const s of ORDER_STATUSES) {
      expect(ORDER_STATUS_LABELS[s]).toBeTruthy();
      expect(ADMIN_TONES).toContain(ORDER_STATUS_TONES[s]);
    }
    expect(isOrderStatus("paid")).toBe(true);
    expect(isOrderStatus("lost")).toBe(false);
  });

  it("the four screens that copied the map now read it", () => {
    for (const path of [
      "src/app/admin/siparisler/page.tsx",
      "src/app/admin/siparisler/[id]/page.tsx",
      "src/app/admin/musteriler/[email]/page.tsx",
      "src/app/admin/page.tsx",
    ]) {
      const src = read(path);
      expect(src, path).not.toMatch(
        /\bSTATUS_TONE\b|\bSTATUS_LABEL\b|\bORDER_STATUS_TONE\b|\bORDER_STATUS_LABEL\b/,
      );
      expect(src, path).not.toContain('pending_payment: "');
    }
    expect(read("src/components/admin/orders-list.tsx")).toContain(
      "<OrderStatusBadge order={r.order} />",
    );
  });
});

describe("bulk selection survives the next tick after a success", () => {
  // The bug: each list cleared the selection in an effect keyed on
  // [state, selection] with a Date.now() "dedupe" key. After one successful
  // bulk action every new tick re-ran it and was wiped at once.
  const empty = { selected: new Set<string>(), resetOn: undefined as unknown };

  it("clears once per new result, never again for the same one", () => {
    const success1 = { op: "set_status", updated: 3 };
    let s = selectionReducer(empty, { type: "toggle", id: "a" });
    s = selectionReducer(s, { type: "toggle", id: "b" });
    s = selectionReducer(s, { type: "result", resetOn: success1 });
    expect([...s.selected]).toEqual([]);
    // The operator ticks again; the same result is seen on every render.
    s = selectionReducer(s, { type: "toggle", id: "c" });
    s = selectionReducer(s, { type: "result", resetOn: success1 });
    s = selectionReducer(s, { type: "toggle", id: "d" });
    s = selectionReducer(s, { type: "result", resetOn: success1 });
    expect([...s.selected]).toEqual(["c", "d"]);
    // An error (no ok) keeps the ticks; the next success clears again.
    s = selectionReducer(s, { type: "result", resetOn: undefined });
    expect([...s.selected]).toEqual(["c", "d"]);
    s = selectionReducer(s, {
      type: "result",
      resetOn: { op: "set_status", updated: 2 },
    });
    expect([...s.selected]).toEqual([]);
  });

  it("clear on an empty selection returns the same state (no render loop)", () => {
    expect(selectionReducer(empty, { type: "clear" })).toBe(empty);
    expect(
      selectionReducer(empty, { type: "result", resetOn: undefined }),
    ).toBe(empty);
  });

  it("the three lists use the shared reset, not their own effect", () => {
    for (const path of [
      "src/components/admin/products-list.tsx",
      "src/components/admin/menu-list.tsx",
      "src/components/admin/orders-list.tsx",
    ]) {
      const src = read(path);
      expect(src, path).toContain("useSelection({ resetOn: state.ok })");
      expect(src, path).not.toContain("Date.now()");
      expect(src, path).not.toContain("selection.clear()");
    }
  });

  it("the bar is fixed to the viewport, so it shows while ticking rows at the top", () => {
    // Each list wraps only the bar in its form, and a sticky element cannot
    // leave its parent: the old "sticky" bar sat below the last row.
    const selection = {
      selected: new Set(["a"]),
      has: () => true,
      toggle: () => {},
      set: () => {},
      clear: () => {},
      count: 1,
      ids: ["a"],
    };
    const out = html(
      withKids(BulkActionBar, { selection, pending: false }, "x"),
    );
    expect(out).toContain("data-admin-bulk-bar");
    expect(out).toMatch(/class="fixed [^"]*bottom-4/);
    expect(out).not.toContain("sticky");
    expect(out).toContain('role="region" aria-label="Toplu işlem"');
    expect(
      html(
        withKids(
          BulkActionBar,
          { selection: { ...selection, count: 0 }, pending: false },
          "x",
        ),
      ),
    ).toBe("");
  });
});

describe("bulk checkboxes and the room under the bar", () => {
  const selection = {
    selected: new Set(["a"]),
    has: (id: string) => id === "a",
    toggle: () => {},
    set: () => {},
    clear: () => {},
    count: 1,
    ids: ["a"],
  };

  it("the row boxes are the panel's 20px espresso box in a 44px hit area", () => {
    // They were 16px browser-blue boxes: @tailwindcss/forms classes with no
    // plugin installed.
    for (const out of [
      html(createElement(RowCheckbox, { id: "a", selection, label: "Latte" })),
      html(createElement(SelectAllCheckbox, { ids: ["a", "b"], selection })),
    ]) {
      expect(out).toMatch(
        /^<label class="-m-3 inline-flex h-11 w-11 [^"]*cursor-pointer/,
      );
      expect(out).toContain(
        'class="h-5 w-5 cursor-pointer accent-[var(--admin-primary)]',
      );
      expect(out).not.toContain("neutral-");
      expect(out).not.toContain("focus:ring");
    }
    expect(
      html(createElement(RowCheckbox, { id: "a", selection, label: "Latte" })),
    ).toContain('aria-label="Latte"');
  });

  it("the space kept free follows the bar's measured height", () => {
    expect(bulkBarSpace(0)).toBe(0);
    // A phone, where the bar wraps to 237px: bar + 1rem offset + 1rem gap.
    expect(bulkBarSpace(237)).toBe(269);
    expect(bulkBarSpace(70.4)).toBe(103);
  });

  it("the spacer goes after the page, not before the pagination", () => {
    // The fixed h-32 spacer sat inside the list, before the page links, so
    // the bar covered them (ORD-06).
    const out = html(
      withKids(BulkActionBar, { selection, pending: false }, "x"),
    );
    expect(out).not.toContain("h-32");
    const src = read("src/components/admin/bulk.tsx");
    expect(src).toContain("new ResizeObserver(");
    expect(src).toMatch(/createPortal\(\s*<div[\s\S]*?data-admin-bulk-spacer/);
    expect(src).toContain("adminPortalRoot");
    // ToastProvider renders that root after the page's own content.
    const toast = read("src/components/admin/ui/toast.tsx");
    expect(toast.indexOf("{children}")).toBeLessThan(
      toast.indexOf("<div data-admin-portal"),
    );
    // The toast stack is lifted by the same measured room, not a fixed
    // 8rem that left it over a two-row phone bar.
    expect(src).toContain("`:root{--admin-bulk-space:${space}px}`");
    expect(toast).toContain(
      "[:root:has([data-admin-bulk-bar])_&]:bottom-[var(--admin-bulk-space,8rem)]",
    );
    expect(toast).not.toContain("bulk-bar])_&]:bottom-32");
  });
});

describe("after a successful action the panel says so (admin:changed)", () => {
  it("fires one window event, and does nothing outside the browser", () => {
    expect(() => ui.announceAdminChange()).not.toThrow();
    const target = new EventTarget();
    let heard = 0;
    target.addEventListener(ui.ADMIN_CHANGED_EVENT, () => {
      heard += 1;
    });
    vi.stubGlobal("window", target);
    try {
      ui.announceAdminChange();
    } finally {
      vi.unstubAllGlobals();
    }
    expect(ui.ADMIN_CHANGED_EVENT).toBe("admin:changed");
    expect(heard).toBe(1);
  });

  it("the kit fires it on a success only (modal, form, one-click button)", () => {
    // The sidebar badges listen for it (shell navigation) instead of
    // waiting up to 60 s.
    const modal = read("src/components/admin/ui/action-modal.tsx");
    expect(modal).toMatch(/if \(result\.ok\) \{[^}]*announceAdminChange\(\);/);
    const form = read("src/components/admin/action-form.tsx");
    expect(form).toMatch(
      /if \(result\.ok\) \{[^}]*announceAdminChange\(\);[^}]*\} else/,
    );
    expect(modal.match(/announceAdminChange\(\)/g)).toHaveLength(1);
    expect(form.match(/announceAdminChange\(\)/g)).toHaveLength(1);
  });
});

describe("codes and amounts line up", () => {
  it("NUMERIC_STYLE is a monospace face with tabular figures; labels keep MONO_STYLE", async () => {
    const { MONO_STYLE } = await import("@/components/admin/ui/styles");
    expect(ui.NUMERIC_STYLE.fontFamily).toMatch(/^ui-monospace, /);
    expect(ui.NUMERIC_STYLE.fontFamily).toMatch(/monospace$/);
    expect(ui.NUMERIC_STYLE.fontVariantNumeric).toBe("tabular-nums");
    // --mono (Poppins) is the panel's label voice; it is not repointed.
    expect(MONO_STYLE).toEqual({ fontFamily: "var(--mono), monospace" });
    expect(read("src/app/admin/layout.tsx")).not.toContain('"--mono"');
  });
});

describe("tone colours clear AA", () => {
  const layout = read("src/app/admin/layout.tsx");
  const token = (name: string) => {
    const m = new RegExp(`"${name}":\\s*"(#[0-9A-Fa-f]{6})"`).exec(layout);
    if (!m) throw new Error(`${name} not in layout.tsx`);
    return m[1];
  };
  const luminance = (hex: string) => {
    const c = (i: number) => {
      const v = parseInt(hex.slice(1 + i, 3 + i), 16) / 255;
      return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
    };
    return 0.2126 * c(0) + 0.7152 * c(2) + 0.0722 * c(4);
  };
  const contrast = (a: string, b: string) => {
    const [x, y] = [luminance(a), luminance(b)];
    return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
  };
  // [ink, soft] per tone, as ui/tone.ts pairs them.
  const PAIRS: Record<string, [string, string]> = {
    neutral: ["--admin-text-soft", "--admin-neutral-soft"],
    primary: ["--admin-primary", "--admin-primary-soft"],
    accent: ["--admin-accent-ink", "--admin-accent-soft"],
    info: ["--admin-info", "--admin-info-soft"],
    success: ["--admin-success", "--admin-success-soft"],
    warning: ["--admin-warning", "--admin-warning-soft"],
    danger: ["--admin-danger-ink", "--admin-danger-soft"],
  };

  it("every tone's ink on its soft ground and on white", () => {
    for (const tone of ADMIN_TONES) {
      const [ink, soft] = PAIRS[tone];
      expect(
        contrast(token(ink), token(soft)),
        `${tone} on soft`,
      ).toBeGreaterThanOrEqual(4.5);
      expect(
        contrast(token(ink), "#FFFFFF"),
        `${tone} on white`,
      ).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("the badge classes use those pairs", async () => {
    const { TONE_SOFT } = await import("@/components/admin/ui/tone");
    for (const tone of ADMIN_TONES) {
      const [ink, soft] = PAIRS[tone];
      expect(TONE_SOFT[tone]).toContain(`bg-[var(${soft})]`);
      expect(TONE_SOFT[tone]).toContain(`text-[var(${ink})]`);
    }
  });

  it("labels, hints, eyebrows and placeholders clear AA on every panel ground", () => {
    // --admin-text-mute was #8A7A64: 4.16:1 on white, 3.70:1 on the page.
    for (const ground of [
      "#FFFFFF",
      token("--admin-bg"),
      token("--admin-surface-2"),
      token("--admin-neutral-soft"),
    ]) {
      expect(
        contrast(token("--admin-text-mute"), ground),
        `mute on ${ground}`,
      ).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("a field's outline clears 3:1 on a white card and on its own fill", () => {
    for (const ground of ["#FFFFFF", token("--admin-surface-2")]) {
      expect(
        contrast(token("--admin-border-field"), ground),
        `field border on ${ground}`,
      ).toBeGreaterThanOrEqual(3);
    }
  });

  it("kit fields use that outline and a full-strength placeholder", async () => {
    const { FIELD_INPUT } = await import("@/components/admin/forms");
    expect(FIELD_INPUT).toContain("border-[var(--admin-border-field)]");
    expect(FIELD_INPUT).toMatch(
      /placeholder:text-\[var\(--admin-text-mute\)\](\s|$)/,
    );
    for (const path of [
      "src/components/admin/forms.tsx",
      "src/components/admin/ui/filter-bar.tsx",
      "src/components/admin/ui/action-modal.tsx",
    ]) {
      const src = read(path);
      expect(src, path).not.toMatch(/admin-text-mute\)\]\/\d/);
      expect(src, path).not.toContain(
        "border-[var(--admin-border)] bg-[var(--admin-surface-2)]",
      );
    }
  });

  it("a toast's close button is a 44px target", () => {
    const out = html(
      withKids(
        ui.ToastProvider,
        { flash: { id: "f1", message: "Kaydedildi.", tone: "success" } },
        "x",
      ),
    );
    expect(out).toMatch(
      /<button type="button" aria-label="Bildirimi kapat" class="[^"]*h-11 w-11/,
    );
  });

  it("the signed-in panel and the login share one ground, and toasts are mounted", () => {
    const code = layout.replace(/^\s*\/\/.*$/gm, "");
    expect(code).not.toContain("admin-shell");
    expect(code).not.toContain("bg-neutral-50");
    expect(layout).toContain("bg-[var(--admin-bg)]");
    expect(layout.match(/<ToastProvider flash=\{flash\}>/g)).toHaveLength(2);
    expect(layout).toContain("readAdminFlash()");
  });
});

describe("server-rendered markup", () => {
  type Row = { id: string; no: number; name: string };
  const rows: Row[] = [
    { id: "o1", no: 10002, name: "Ayşe" },
    { id: "o2", no: 10001, name: "Can" },
  ];
  const columns = [
    {
      key: "no",
      header: "No",
      cell: (r: Row) => `#${r.no}`,
      sortable: true,
      firstDir: "desc" as const,
    },
    { key: "name", header: "Müşteri", cell: (r: Row) => r.name },
    { key: "extra", header: "Ek", cell: () => "x", hideBelow: "lg" as const },
  ];

  it("DataTable: sort links keep the filters, mark the sorted column, link the row", () => {
    const out = html(
      createElement(ui.DataTable<Row>, {
        columns,
        rows,
        rowKey: (r) => r.id,
        rowHref: (r) => `/admin/siparisler/${r.id}`,
        sort: { key: "no", dir: "desc" },
        searchParams: { durum: "paid", sayfa: "2" },
        pathname: "/admin/siparisler",
        caption: "Siparişler",
      }),
    );
    expect(out).toContain('aria-sort="descending"');
    expect(out).toContain(
      'href="/admin/siparisler?durum=paid&amp;sirala=no&amp;yon=asc"',
    );
    expect(out).toContain('href="/admin/siparisler/o1"');
    expect(out).toContain('<caption class="sr-only">Siparişler</caption>');
    expect(out).toContain("hidden lg:table-cell");
    // The phone card leaves out a hideBelow column.
    const card = out.slice(0, out.indexOf("</ul>"));
    expect(card).toContain("Müşteri");
    expect(card).not.toContain(">Ek<");
  });

  it("DataTable: the row menu stays in view while a wide table scrolls", () => {
    const selection = {
      selected: new Set(["o1"]),
      has: (id: string) => id === "o1",
      toggle: () => {},
      set: () => {},
      clear: () => {},
      count: 1,
      ids: ["o1"],
    };
    const out = html(
      createElement(ui.DataTable<Row>, {
        columns,
        rows,
        rowKey: (r) => r.id,
        selection,
        rowActions: (r) => createElement("button", null, `⋯ ${r.no}`),
      }),
    );
    // The scroll box contains the sr-only texts (no sideways page scroll).
    expect(out).toMatch(/<div class="relative hidden overflow-x-auto /);
    const th =
      /<th scope="col" class="([^"]*)"><span class="sr-only">İşlemler/.exec(
        out,
      );
    expect(th?.[1]).toContain(
      "sticky right-0 shadow-[inset_1px_0_0_var(--admin-border)] bg-[var(--admin-surface)]",
    );
    const cells = [...out.matchAll(/<td class="([^"]*sticky right-0[^"]*)">/g)];
    expect(cells).toHaveLength(2);
    // An opaque ground that follows the row: the selection tint as it shows
    // over white for the selected row, white otherwise, the hover ground on
    // hover.
    expect(cells[0][1]).toContain(
      "bg-[color-mix(in_srgb,var(--admin-primary-soft)_50%,var(--admin-surface))]",
    );
    expect(cells[1][1]).toContain("bg-[var(--admin-surface)]");
    for (const [, cls] of cells) {
      expect(cls).toContain("group-hover:bg-[var(--admin-surface-2)]");
    }
    expect(out.match(/<tr class="group /g)).toHaveLength(2);
  });

  it("DataTable: nothing to show is a sentence, not an empty table", () => {
    const out = html(
      createElement(ui.DataTable<Row>, {
        columns,
        rows: [],
        rowKey: (r) => r.id,
      }),
    );
    expect(out).not.toContain("<table");
    expect(out).toContain("Kayıt yok.");
  });

  it("StatusTabs: links keep other params, drop the page, mark the current tab", () => {
    const out = html(
      createElement(ui.StatusTabs, {
        tabs: [
          { value: null, label: "Tümü", count: 12 },
          { value: "paid", label: "Ödendi", count: 3 },
        ],
        current: "paid",
        searchParams: { durum: "paid", q: "can", sayfa: "4" },
        pathname: "/admin/siparisler",
      }),
    );
    expect(out).toContain('href="/admin/siparisler?q=can"');
    expect(out).toMatch(
      /href="\/admin\/siparisler\?durum=paid&amp;q=can"[^>]*aria-current="page"/,
    );
    expect(out).toContain('aria-label="Durum"');
  });

  it("Pagination: range text, numbered pages, page 1 without the param", () => {
    const out = html(
      createElement(ui.Pagination, {
        page: 2,
        pageSize: 100,
        total: 250,
        searchParams: { q: "x", sayfa: "2" },
        pathname: "/l",
      }),
    );
    expect(out).toContain("101-200 / 250");
    expect(out).toContain('href="/l?q=x"');
    expect(out).toMatch(/href="\/l\?q=x&amp;sayfa=2"[^>]*aria-current="page"/);
    expect(out).toContain('href="/l?q=x&amp;sayfa=3"');
  });

  it("tabs, page links and sort headers mark the clicked link while it loads", () => {
    // LinkPending: always there, faded in only while that link navigates.
    const MARK =
      /<span aria-hidden="true" class="pointer-events-none absolute [^"]*opacity-0/g;
    const tabs = html(
      createElement(ui.StatusTabs, {
        tabs: [
          { value: null, label: "Tümü", count: 12 },
          { value: "paid", label: "Ödendi", count: 3 },
        ],
        current: null,
        pathname: "/admin/siparisler",
      }),
    );
    expect(tabs.match(MARK)).toHaveLength(2);
    expect(tabs.match(/<a [^>]*class="relative /g)).toHaveLength(2);
    const pages = html(
      createElement(ui.Pagination, {
        page: 2,
        pageSize: 10,
        total: 50,
        pathname: "/l",
      }),
    );
    const links = pages.match(/<a /g) ?? [];
    expect(links.length).toBeGreaterThan(2);
    expect(pages.match(MARK)).toHaveLength(links.length);
    const table = html(
      createElement(ui.DataTable<Row>, {
        columns,
        rows,
        rowKey: (r) => r.id,
        pathname: "/l",
      }),
    );
    // One sortable column, one mark in its header link.
    expect(table.match(MARK)).toHaveLength(1);
  });

  it("Pagination: page cells are 44px touch targets", () => {
    const out = html(
      createElement(ui.Pagination, {
        page: 1,
        pageSize: 10,
        total: 30,
        pathname: "/l",
      }),
    );
    expect(out).toContain("h-11 min-w-11");
    expect(out).not.toContain("h-10 min-w-10");
  });

  it("FilterBar: a GET search form that carries the tab and drops the page", () => {
    const out = html(
      createElement(ui.FilterBar, {
        fields: [
          { type: "search", name: "q", label: "Ara" },
          { type: "date-range", label: "Tarih", from: "bas", to: "bit" },
        ],
        searchParams: { durum: "paid", q: "çay", sayfa: "3" },
        pathname: "/admin/siparisler",
      }),
    );
    expect(out).toContain('role="search"');
    expect(out).toContain('method="get"');
    expect(out).toContain('<input type="hidden" name="durum" value="paid"/>');
    expect(out).not.toContain('name="sayfa"');
    expect(out).toContain('value="çay"');
    expect(out).toContain('aria-label="Filtreyi kaldır: Ara çay"');
    expect(out).toContain('href="/admin/siparisler?durum=paid"');
  });

  it("Badge and OrderStatusBadge use the shared tone", () => {
    expect(html(withKids(ui.Badge, { tone: "warning" }, "Bekliyor"))).toContain(
      "bg-[var(--admin-warning-soft)]",
    );
    const out = html(
      createElement(ui.OrderStatusBadge, {
        order: { status: "shipped", fulfillment: "pickup" },
      }),
    );
    expect(out).toContain(">Hazır<");
    expect(out).toContain("bg-[var(--admin-primary-soft)]");
  });

  it("KeyValueGrid skips false items and shows a dash for blanks", () => {
    const out = html(
      createElement(ui.KeyValueGrid, {
        items: [
          { label: "Kargo", value: "" },
          false,
          { label: "Not", value: "Kapı kodu 4821", full: true },
        ],
      }),
    );
    expect(out.match(/<dt/g)).toHaveLength(2);
    expect(out).toContain(">-<");
    expect(out).toContain("sm:col-span-full");
  });

  it("Timeline sorts newest first and prints the köşk's clock", () => {
    const out = html(
      createElement(ui.Timeline, {
        items: [
          { id: "a", at: "2026-10-01T07:00:00.000Z", title: "Ödendi" },
          { id: "b", at: "2026-10-02T07:00:00.000Z", title: "Kargoya verildi" },
        ],
      }),
    );
    expect(out.indexOf("Kargoya verildi")).toBeLessThan(out.indexOf("Ödendi"));
    expect(out).toContain("10:00");
  });

  it("a disabled action says why instead of disappearing", () => {
    const action = async () => ({ ok: true as const, message: "" });
    const out = html(
      createElement(ui.ActionModal, {
        action,
        title: "İade",
        trigger: "İade başlat",
        disabledReason: "İade yetkisi gerekiyor",
      }),
    );
    expect(out).toContain('aria-disabled="true"');
    expect(out).toContain("İade yetkisi gerekiyor");
    expect(out).not.toContain("<dialog");
    const menu = html(
      withKids(
        ui.ActionMenu,
        { label: "Sipariş 10023 işlemleri" },
        withKids(
          ui.ActionMenuButton,
          { disabledReason: "Önce ödeme alınmalı" },
          "Hazırlamaya başla",
        ),
      ),
    );
    expect(menu).toContain("<details");
    expect(menu).toContain('aria-label="Sipariş 10023 işlemleri"');
    expect(menu).toContain("Önce ödeme alınmalı");
  });

  it("Field stays a label, so the control inside keeps its name", () => {
    const out = html(
      withKids(
        forms.Field,
        { label: "Kod", hint: "En çok 20 harf" },
        createElement("input", { name: "code" }),
      ),
    );
    expect(out).toMatch(/^<label /);
    expect(out).toContain('<input name="code"/>');
    expect(out).not.toContain("<fieldset");
  });

  it('Field as="fieldset" groups a checkbox without a label around it', () => {
    // A label with no `for` labels its first control: a tap on the caption
    // or the hint flipped the switch ("Online mağaza açık").
    const out = html(
      withKids(
        forms.Field,
        {
          as: "fieldset",
          label: "Mağaza",
          hint: "Yalnızca kargolu mağaza siparişlerini durdurur.",
        },
        createElement(forms.Checkbox, {
          name: "isShopOpen",
          label: "Online mağaza açık",
        }),
      ),
    );
    expect(out).toMatch(/^<fieldset /);
    expect(out).toContain(">Mağaza</legend>");
    // The checkbox keeps its own label; nothing else wraps it.
    expect(out.match(/<label/g)).toHaveLength(1);
    const describedBy = /<fieldset[^>]*aria-describedby="([^"]+)"/.exec(out);
    expect(describedBy).not.toBeNull();
    expect(out).toContain(
      `<span id="${describedBy?.[1]}" class="text-xs text-[var(--admin-text-mute)]">Yalnızca kargolu`,
    );
    // Without a hint there is nothing to describe the group with.
    const bare = html(
      withKids(forms.Field, { as: "fieldset", label: "Bildirim" }, "x"),
    );
    expect(bare).not.toContain("aria-describedby");
  });

  it("an enabled modal renders only its trigger until opened", () => {
    const action = async () => ({ ok: true as const, message: "" });
    const out = html(
      createElement(ui.ConfirmButton, {
        action,
        label: "Sil",
        hidden: { id: "p1" },
      }),
    );
    expect(out).toContain('aria-haspopup="dialog"');
    expect(out).toContain(">Sil<");
    expect(out).not.toContain("<dialog");
  });
});
