import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { compile } from "tailwindcss";
import { describe, expect, it, vi } from "vitest";

/**
 * A row's small controls (operator, 21 Oct 2026: "ok çubuklarını daha ufak
 * minimalist yap ... responsive"): the ↑ / ↓ stepper, the ⋯ on its own and
 * a row's text action. 44 px on a touch screen, 28-32 px where the pointer
 * can aim, at most a hairline, and none of "Sıkı görünüm"'s classes (they
 * are already below its 36 px).
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
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  unstable_rethrow: vi.fn(),
}));
vi.mock("@/app/admin/menu/actions", () => ({
  bulkMenuAction: vi.fn(async () => ({})),
  deleteMenuItemAction: vi.fn(async () => ({ ok: true })),
  moveMenuItemAction: vi.fn(async () => ({ ok: true })),
  setMenuItemActiveAction: vi.fn(async () => ({ ok: true })),
}));

const { MoveButtons } = await import("@/components/admin/move-buttons");
const { ROW_CONTROL } = await import("@/components/admin/ui/styles");
const { MenuList } = await import("@/components/admin/menu-list");

const move = vi.fn(async () => ({ ok: true as const, message: "" }));
const stepper = (index: number, count: number) =>
  renderToStaticMarkup(
    createElement(MoveButtons, {
      action: move,
      id: "x-1",
      index,
      count,
      label: "Sonbahar",
    }),
  );
const buttons = (html: string) => html.match(/<button[^>]*>/g) ?? [];

describe("MoveButtons: one stepper", () => {
  it("a middle row has both chevrons, each a button named for the row", () => {
    const html = stepper(1, 3);
    const found = buttons(html);
    expect(found).toHaveLength(2);
    expect(found[0]).toContain('aria-label="Öne al: Sonbahar"');
    expect(found[1]).toContain('aria-label="Geriye al: Sonbahar"');
    for (const b of found) {
      expect(b).toContain('type="submit"');
      expect(b).toContain(`class="${ROW_CONTROL.step}"`);
    }
    expect(html).toContain("lucide-chevron-up");
    expect(html).toContain("lucide-chevron-down");
    expect(html).toContain('name="direction" value="up"');
    expect(html).toContain('name="direction" value="down"');
    expect(html).toContain("2. sırada, toplam 3");
  });

  it("an edge draws its chevron faint and not as a button, so every row has the same shape", () => {
    const first = stepper(0, 3);
    expect(buttons(first)).toHaveLength(1);
    expect(buttons(first)[0]).toContain('aria-label="Geriye al: Sonbahar"');
    expect(first).toContain(
      `<span aria-hidden="true" class="${ROW_CONTROL.stepIdle}">`,
    );
    const last = stepper(2, 3);
    expect(buttons(last)).toHaveLength(1);
    expect(buttons(last)[0]).toContain('aria-label="Öne al: Sonbahar"');
  });

  it("a list of one has nothing to order", () => {
    expect(stepper(0, 1)).toBe("");
  });
});

describe("ROW_CONTROL", () => {
  const compact = (cls: string) =>
    cls.split(/\s+/).filter((t) => t.includes("data-admin-density"));

  it("keeps the 44 px target on a touch screen and is small where the pointer can aim", () => {
    for (const key of ["step", "stepIdle"] as const) {
      expect(ROW_CONTROL[key]).toContain("h-11 w-11");
      expect(ROW_CONTROL[key]).toContain("pointer-fine:h-7 pointer-fine:w-7");
    }
    expect(ROW_CONTROL.more).toContain("min-h-[44px] min-w-[44px]");
    expect(ROW_CONTROL.more).toContain(
      "pointer-fine:min-h-8 pointer-fine:min-w-8",
    );
    for (const key of ["text", "textStrong"] as const) {
      expect(ROW_CONTROL[key]).toContain("min-h-[44px]");
      expect(ROW_CONTROL[key]).toContain("pointer-fine:min-h-8");
    }
    for (const value of Object.values(ROW_CONTROL)) {
      expect(compact(value), value).toEqual([]);
    }
  });

  it("compiles: the small sizes only under pointer: fine, and the open ⋯ keeps its ground", async () => {
    const compiler = await compile(
      "@theme { --spacing: 0.25rem; } @tailwind utilities;",
      {},
    );
    const css = compiler
      .build([...ROW_CONTROL.step.split(" "), ...ROW_CONTROL.more.split(" ")])
      .replace(/\s+/g, " ");
    const fine = /@media \(pointer: fine\) \{(.*?)\} \}/.exec(css)?.[1] ?? "";
    expect(fine).toContain("height: calc(var(--spacing) * 7)");
    expect(fine).toContain("min-height: calc(var(--spacing) * 8)");
    expect(css).toMatch(
      /\[open\] > \.[^{]+\{ background-color: var\(--admin-panel\); \}/,
    );
  });
});

describe("the menu list's ↑ / ↓ on every screen", () => {
  const item = (id: string, name: string) => ({
    id,
    categoryKey: "matcha",
    name,
    desc: "",
    priceMinor: 24_500,
    priceMinorL: 0,
    hue: "rose",
    image: "",
    tags: [],
    isActive: true,
    sortOrder: 0,
    updatedAt: "2026-10-21T10:00:00.000Z",
  });
  const render = (reorderable: boolean) =>
    renderToStaticMarkup(
      createElement(MenuList, {
        groups: [
          {
            key: "matcha",
            rows: [item("mnu-0001", "Latte"), item("mnu-0002", "Affogato")],
          },
        ],
        categoryKeys: ["matcha"],
        categoryLabels: { matcha: "Matcha bar" },
        reorderable,
      } as never),
    );

  it("draws them on the phone card and in the table from md (not only from xl)", () => {
    const html = render(true);
    const cards = /<ul class="flex flex-col gap-3 md:hidden">[^]*?<\/ul>/.exec(
      html,
    )![0];
    expect(cards).toContain('aria-label="Geriye al: Latte"');
    expect(cards).toContain('aria-label="Öne al: Affogato"');
    const table = /<table[^]*<\/table>/.exec(html)![0];
    expect(table).toContain('aria-label="Geriye al: Latte"');
    const head = /<th[^>]*>Sıra<\/th>/.exec(table)![0];
    expect(head).not.toContain("hidden");
  });

  it("shows the number from xl, and no ↑ / ↓, while the list is filtered", () => {
    const html = render(false);
    expect(html).not.toContain("Geriye al:");
    const head = /<th[^>]*>Sıra<\/th>/.exec(html)![0];
    expect(head).toContain("hidden xl:table-cell");
  });
});
