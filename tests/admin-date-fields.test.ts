import { existsSync, readFileSync, statSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname, join, relative } from "node:path";

import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The list filters' date range (admin UI v2, UI-14): preset links on every
 * list with a date range, drawn on the server, and the native
 * `<input type="date">` boxes kept as the server render, the no-JavaScript
 * path and the touch path. The React Aria widget that may replace the boxes
 * on a laptop is a chunk of its own: here its server render (the names it
 * posts, the Turkish segments) and the fact that the bar never loads it
 * statically. The swap itself (pointer, focus, calendar, keys) is in the
 * PR's browser checklist.
 */

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
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  unstable_rethrow: vi.fn(),
}));

const { FilterBar } = await import("@/components/admin/ui/filter-bar");
const { FIELD_INPUT } = await import("@/components/admin/forms");
const { BUTTON, EYEBROW } = await import("@/components/admin/ui/styles");
const { parseFilters } = await import("@/lib/admin/list-params");
type Fields = Parameters<typeof parseFilters>[1];

const SEARCH = {
  type: "search",
  name: "q",
  label: "Ara",
  placeholder: "No, ad",
} as const;
const SELECT = {
  type: "select",
  name: "kanal",
  label: "Kanal",
  options: [
    { value: "web", label: "Web" },
    { value: "app", label: "Uygulama" },
  ],
} as const;
const DATES = {
  type: "date-range",
  label: "Tarih",
  from: "bas",
  to: "bit",
} as const;
// Fields of the test's own: the markup below is frozen from origin/main's
// bar (f47831d3, before UI-14) and must not move when a list's labels do.
const PLAIN: Fields = [SEARCH, SELECT];
const DATED: Fields = [SEARCH, SELECT, DATES];

const PATH = "/admin/siparisler";
const KIT_CLASSES = [
  ["FIELD_INPUT", FIELD_INPUT],
  ["BUTTON_PRIMARY", BUTTON.primary],
  ["BUTTON_GHOST", BUTTON.ghost],
  ["EYEBROW", EYEBROW],
] as const;

/**
 * The bar's markup as a golden reads it: React's own function-action URL
 * and form-replay script out, and the kit's shared class strings (a field,
 * the two buttons, an eyebrow) as tokens, so a restyle of the kit (the
 * density variants of UI-9 moved them) does not break a test about what the
 * bar draws.
 */
const bar = (
  fields: Fields,
  sp: Record<string, string>,
  remembered?: string,
) => {
  let html = renderToStaticMarkup(
    createElement(FilterBar, {
      fields,
      searchParams: sp,
      values: {
        ...parseFilters(sp, fields),
        ...(remembered ? { q: remembered } : {}),
      },
      pathname: PATH,
      label: "Filtreler",
    }),
  )
    .replace(/action="javascript:[^"]*"/g, 'action="FN"')
    .replace(/<script>[\s\S]*?<\/script>$/, "");
  for (const [token, classes] of KIT_CLASSES) {
    html = html.replaceAll(classes.replaceAll("&", "&amp;"), `{${token}}`);
  }
  return html;
};

const sha = (html: string) => createHash("sha256").update(html).digest("hex");
const PRESET_LIST =
  /<ul aria-label="Tarih: hazır aralıklar"[^>]*>[\s\S]*?<\/ul>/;
const without = (html: string) => html.replace(PRESET_LIST, "");

// 00:30 on 21 Oct in Tuzla, 21:30Z on the 20th: the UTC date is a day behind.
beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-20T21:30:00Z"));
});
afterEach(() => vi.useRealTimers());

describe("lists without a date range", () => {
  // SHA-256 of the bar's markup on origin/main f47831d3 (before UI-14; see `bar`
  // for what is normalised). A
  // changed kit class changes it on purpose: refresh it with the change.
  it("draw the markup they drew before, byte for byte", () => {
    expect(sha(bar(PLAIN, {}))).toBe(
      "561caef9f342a7d2cc57868c64b907c843a03383601fa065524e5a5da3408bbe",
    );
    expect(sha(bar(PLAIN, { durum: "acik", kanal: "app" }, "ayşe"))).toBe(
      "499d5638dc37df843168497ef9e0309e1e0e9ae5c29f8ee90bd0ef13b0a0b385",
    );
    expect(bar(PLAIN, {})).not.toContain("hazır aralıklar");
  });
});

describe("lists with a date range keep their native boxes", () => {
  const OLD_BOXES = (id: string, from: string, to: string) =>
    `<div class="flex items-center gap-2"><label for="${id}-bas" class="sr-only">Tarih: başlangıç</label><input id="${id}-bas" type="date" class="{FIELD_INPUT} min-w-0" name="bas" value="${from}"/><span aria-hidden="true" class="text-[var(--admin-text-soft)]">-</span><label for="${id}-bit" class="sr-only">Tarih: bitiş</label><input id="${id}-bit" type="date" class="{FIELD_INPUT} min-w-0" name="bit" value="${to}"/></div>`;

  it("the bas and bit inputs, their ids, labels and values are the old ones", () => {
    const set = bar(DATED, { bas: "2026-10-01", bit: "2026-10-15" });
    expect(set).toContain(OLD_BOXES("_R_0_", "2026-10-01", "2026-10-15"));
    const empty = bar(DATED, {});
    expect(empty).toContain(OLD_BOXES("_R_0_", "", ""));
    // Not drawn as the widget: no segments, no hidden dates.
    expect(set).not.toContain('role="spinbutton"');
    expect(set).not.toContain('type="hidden" name="bas"');
  });

  it("everything but the added preset links is the old markup, byte for byte", () => {
    // Frozen from origin/main for the same fields and addresses. The links
    // are the whole difference; the fieldset gains no attribute (the hover
    // and focus handlers that load the widget are not markup).
    expect(
      sha(
        without(
          bar(
            DATED,
            {
              kanal: "app",
              durum: "paid",
              sirala: "tutar",
              yon: "asc",
              bas: "2026-10-01",
              bit: "2026-10-15",
              sayfa: "3",
              denied: "1",
            },
            "ayşe",
          ),
        ),
      ),
    ).toBe("98dec12a34ac66445dd4d7a413f41467cea1b7adba7bef643a51a4777c0ece34");
    expect(sha(without(bar(DATED, {})))).toBe(
      "4c7e7be4d1dd2b11832e4eb02903a03bcdb7c5fda0c2100443c55bcf5485694e",
    );
    expect(sha(without(bar(DATED, { bas: "2026-10-01" })))).toBe(
      "a7c168c51a65eef8255e4cf757100aa73412fd3dd3706276d295db56f586f418",
    );
  });

  it("the legend stays first, the links come before the boxes", () => {
    const html = bar(DATED, {});
    const legend = html.indexOf("<legend");
    const links = html.indexOf('<ul aria-label="Tarih: hazır aralıklar"');
    const boxes = html.indexOf('<div class="flex items-center gap-2">');
    expect(legend).toBeGreaterThan(0);
    expect(links).toBeGreaterThan(legend);
    expect(boxes).toBeGreaterThan(links);
  });
});

describe("the preset links", () => {
  const links = (html: string) =>
    [
      ...(PRESET_LIST.exec(html)?.[0] ?? "").matchAll(/<a ([^>]*)>([^<]*)/g),
    ].map((m) => ({
      label: m[2],
      href: /href="([^"]*)"/.exec(m[1])?.[1]?.replaceAll("&amp;", "&"),
      current: /aria-current="true"/.test(m[1]),
    }));

  it("six plain links on the köşk's day, in order, each setting both ends", () => {
    expect(links(bar(DATED, {}))).toEqual([
      {
        label: "Bugün",
        href: `${PATH}?bas=2026-10-21&bit=2026-10-21`,
        current: false,
      },
      {
        label: "Dün",
        href: `${PATH}?bas=2026-10-20&bit=2026-10-20`,
        current: false,
      },
      {
        label: "Son 7 gün",
        href: `${PATH}?bas=2026-10-15&bit=2026-10-21`,
        current: false,
      },
      {
        label: "Son 30 gün",
        href: `${PATH}?bas=2026-09-22&bit=2026-10-21`,
        current: false,
      },
      {
        label: "Bu ay",
        href: `${PATH}?bas=2026-10-01&bit=2026-10-31`,
        current: false,
      },
      {
        label: "Geçen ay",
        href: `${PATH}?bas=2026-09-01&bit=2026-09-30`,
        current: false,
      },
    ]);
  });

  it("keep the tab and the sort, replace the range, drop the page and the one-time notice, never carry a search text", () => {
    const html = bar(
      DATED,
      {
        durum: "paid",
        sirala: "tutar",
        yon: "asc",
        bas: "2026-01-01",
        bit: "2026-01-31",
        sayfa: "3",
        denied: "1",
        q: "ayse@ornek.com",
      },
      "ayşe",
    );
    const hrefs = links(html).map((l) => l.href);
    expect(hrefs[2]).toBe(
      `${PATH}?durum=paid&sirala=tutar&yon=asc&bas=2026-10-15&bit=2026-10-21`,
    );
    for (const href of hrefs) {
      expect(href).not.toMatch(/sayfa|denied|[?&]q=|ayse|ornek/);
    }
    expect(PRESET_LIST.exec(html)![0]).not.toContain("ayse@ornek.com");
  });

  it("mark the one that is the range now, and only when both ends match", () => {
    const month = links(bar(DATED, { bas: "2026-10-01", bit: "2026-10-31" }));
    expect(month.filter((l) => l.current).map((l) => l.label)).toEqual([
      "Bu ay",
    ]);
    expect(
      links(bar(DATED, { bas: "2026-10-01", bit: "2026-10-30" })).some(
        (l) => l.current,
      ),
    ).toBe(false);
    expect(
      links(bar(DATED, { bas: "2026-10-01" })).some((l) => l.current),
    ).toBe(false);
  });

  it("follow the day when it turns", () => {
    vi.setSystemTime(new Date("2026-10-20T20:30:00Z"));
    expect(links(bar(DATED, {}))[0].href).toBe(
      `${PATH}?bas=2026-10-20&bit=2026-10-20`,
    );
  });
});

describe("what the bar loads", () => {
  const ROOT = process.cwd();
  const BAR = "src/components/admin/ui/filter-bar.tsx";
  const read = (p: string) => readFileSync(p, "utf8");
  const valueImportsOf = (src: string) =>
    [
      ...src.matchAll(
        /\b(?:import|export)\s+(?!type\b)(?:[\w$*{}\s,]+?\s+from\s*)?["']([^"']+)["']/g,
      ),
    ].map((m) => m[1]);
  const resolve = (from: string, spec: string): string | null => {
    const base = spec.startsWith("@/")
      ? `src/${spec.slice(2)}`
      : relative(ROOT, join(ROOT, dirname(from), spec));
    for (const cand of [base, `${base}.ts`, `${base}.tsx`]) {
      if (existsSync(join(ROOT, cand)) && statSync(join(ROOT, cand)).isFile()) {
        return cand;
      }
    }
    return null;
  };
  const closure = (entry: string) => {
    const files = new Set<string>();
    const stack = [entry];
    while (stack.length > 0) {
      const file = stack.pop()!;
      if (files.has(file)) continue;
      files.add(file);
      if (
        file !== entry &&
        /^\s*["']use server["']/m.test(read(file).slice(0, 400))
      )
        continue;
      for (const spec of valueImportsOf(read(file))) {
        if (spec.startsWith(".") || spec.startsWith("@/")) {
          const next = resolve(file, spec);
          if (next) stack.push(next);
        }
      }
    }
    return files;
  };

  it("the bar reaches the widget by import() alone, and loads none of its parts", () => {
    expect(read(BAR)).toMatch(/import\("\.\/date-range-field"\)/);
    const files = closure(BAR);
    for (const heavy of [
      "src/components/admin/ui/date-range-field.tsx",
      "src/components/admin/ui/date-time-picker.tsx",
      "src/components/admin/ui/calendar-header.tsx",
      "src/components/admin/ui/date-styles.ts",
      "src/components/admin/ui/overlay.ts",
      "src/components/admin/ui/toast.tsx",
    ]) {
      expect(files.has(heavy), heavy).toBe(false);
    }
    // What it does bring: the presets and the hand-over rules, both pure.
    expect(files.has("src/lib/admin/date-presets.ts")).toBe(true);
    expect(files.has("src/components/admin/ui/widget-loader.ts")).toBe(true);
  });

  it("the widget is the only chunk that wants the libraries, and no kit page file does", () => {
    for (const light of [
      "src/components/admin/ui/widget-loader.ts",
      "src/components/admin/ui/date-time-field.tsx",
      "src/lib/admin/date-presets.ts",
      "src/lib/admin/date-time-local.ts",
    ]) {
      expect(read(light), light).not.toMatch(
        /@internationalized\/date|react-aria-components/,
      );
    }
    expect(read("src/components/admin/ui/date-time-field.tsx")).toMatch(
      /import\("\.\/date-time-picker"\)/,
    );
  });
});

describe("the range widget's server render", () => {
  it("posts both days under the field's own names, in Turkish segments", async () => {
    const { DateRangeField } =
      await import("@/components/admin/ui/date-range-field");
    const html = renderToStaticMarkup(
      createElement(DateRangeField, {
        label: "Tarih",
        fromName: "bas",
        toName: "bit",
        defaultFrom: "2026-10-01",
        defaultTo: "2026-10-15",
      }),
    );
    expect(html).toMatch(
      /<input type="hidden"[^>]*name="bas" value="2026-10-01"\/>/,
    );
    expect(html).toMatch(
      /<input type="hidden"[^>]*name="bit" value="2026-10-15"\/>/,
    );
    expect(html).toContain('aria-label="Tarih"');
    expect(html).toContain('aria-label="Takvim"');
    // Day, month, year in the köşk's order, start and end.
    const segments = [
      ...html.matchAll(/data-type="(day|month|year)"[^>]*>([^<]*)</g),
    ].map((m) => `${m[1]}:${m[2]}`);
    expect(segments).toEqual([
      "day:01",
      "month:10",
      "year:2026",
      "day:15",
      "month:10",
      "year:2026",
    ]);
    // The parts the focus hand-over looks for.
    expect(html).toContain('data-range-part="start"');
    expect(html).toContain('data-range-part="end"');
  });

  it("empty is gg.aa.yyyy, and posts nothing", async () => {
    const { DateRangeField } =
      await import("@/components/admin/ui/date-range-field");
    const html = renderToStaticMarkup(
      createElement(DateRangeField, {
        label: "Tarih",
        fromName: "bas",
        toName: "bit",
        defaultFrom: "",
        defaultTo: "",
      }),
    );
    const placeholders = [
      ...html.matchAll(/data-type="(day|month|year)"[^>]*>([^<]*)</g),
    ].map((m) => m[2]);
    expect(placeholders).toEqual(["gg", "aa", "yyyy", "gg", "aa", "yyyy"]);
    expect(html).toMatch(/name="bas" value=""/);
    expect(html).toMatch(/name="bit" value=""/);
  });
});
