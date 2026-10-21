import { readFileSync } from "node:fs";

import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The köşk chip (admin UI v2, UI-13, decision D3): "Köşk: Açık" in the top
 * bar for the roles with `venue`, a popover with Otomatik / Açık / Yoğun /
 * Kapalı and the free-table stepper, saved through saveVenueQuickAction
 * (two columns, one UPDATE). Its rules are pure (venue-quick-core.ts); the
 * markup is checked server-rendered; the browser pass is in the PR.
 */

vi.mock("next/navigation", () => ({
  usePathname: () => "/admin/siparisler",
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  unstable_rethrow: vi.fn(),
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
vi.mock("@/components/admin/admin-search", () => ({
  TopBarSearch: () => createElement("div", { id: "search" }),
}));
vi.mock("@/app/admin/siparisler/actions", () => ({
  openOrderSignalAction: vi.fn(async () => ({ count: null, cursor: "" })),
  transitionOrderAction: vi.fn(),
}));
vi.mock("@/app/admin/mobil/karaoke/actions", () => ({
  karaokeTodaySignalAction: vi.fn(async () => ({ count: null, cursor: "" })),
}));
const venueActions = vi.hoisted(() => ({
  signal: vi.fn(async () => ({ status: null, cursor: "" })),
  save: vi.fn(),
}));
vi.mock("@/app/admin/mobil/canli-durum/actions", () => ({
  venueQuickSignalAction: venueActions.signal,
  saveVenueQuickAction: venueActions.save,
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

const core = await import("@/lib/admin/venue-quick-core");
const { VenueQuick, startVenuePoll } =
  await import("@/components/admin/venue-quick");
const { ADMIN_CHANGED_EVENT } =
  await import("@/components/admin/ui/admin-changed");
const AdminLayout = (await import("@/app/admin/layout")).default;

type Status = import("@/lib/admin/venue-quick-core").VenueQuickStatus;
const status = (over: Partial<Status> = {}): Status => ({
  manualOverride: "auto",
  freeTables: 4,
  totalTables: 20,
  isOpen: true,
  saved: true,
  ...over,
});

describe("the chip's rules", () => {
  it("opens the popover where the chip's word is: Yoğun for an open köşk with no free table, in either mode", () => {
    expect(core.quickChoiceOf(status())).toBe("auto");
    expect(core.quickChoiceOf(status({ freeTables: 0 }))).toBe("busy");
    // Never saved: 0 is the default, not a full room.
    expect(core.quickChoiceOf(status({ freeTables: 0, saved: false }))).toBe(
      "auto",
    );
    // An Açık night with no free table: the chip says Yoğun, so does the
    // popover (PR #189 review, F1).
    const full = status({ manualOverride: "open", freeTables: 0 });
    expect(core.venueChipState(full).label).toBe("Yoğun");
    expect(core.quickChoiceOf(full)).toBe("busy");
    expect(core.quickChoiceOf(status({ manualOverride: "open" }))).toBe("open");
    // Closed by the hours: the chip says Kapalı, the mode is Otomatik.
    expect(core.quickChoiceOf(status({ isOpen: false, freeTables: 0 }))).toBe(
      "auto",
    );
    expect(
      core.quickChoiceOf(
        status({ manualOverride: "closed", isOpen: false, freeTables: 0 }),
      ),
    ).toBe("closed");
    for (const s of [
      status(),
      full,
      status({ freeTables: 0 }),
      status({ manualOverride: "open" }),
    ]) {
      const word = core.venueChipState(s).label;
      expect(core.quickChoiceOf(s) === "busy", JSON.stringify(s)).toBe(
        word === "Yoğun",
      );
    }
  });

  it("Yoğun writes the free tables alone: the open/closed stays as it is (F1)", () => {
    expect(core.quickPatchFor("busy", 7)).toEqual({ freeTables: 0 });
    expect(core.quickPatchFor("busy", 0)).toEqual({ freeTables: 0 });
    expect(core.quickPatchFor("open", 3)).toEqual({
      manualOverride: "open",
      freeTables: 3,
    });
    expect(core.quickPatchFor("auto", 2)).toEqual({
      manualOverride: "auto",
      freeTables: 2,
    });
    expect(core.quickPatchFor("closed", 5)).toEqual({
      manualOverride: "closed",
      freeTables: 5,
    });
    for (const c of core.VENUE_QUICK_CHOICES) {
      expect(Object.keys(core.quickPatchFor(c, 1)).sort()).toEqual(
        c === "busy" ? ["freeTables"] : ["freeTables", "manualOverride"],
      );
    }
  });

  it("names the room as the app does: Kapalı, Yoğun or Açık, never by colour alone", () => {
    expect(core.venueChipState(status())).toEqual({
      label: "Açık",
      tone: "success",
    });
    expect(core.venueChipState(status({ freeTables: 0 }))).toEqual({
      label: "Yoğun",
      tone: "warning",
    });
    expect(
      core.venueChipState(status({ freeTables: 0, saved: false })),
    ).toEqual({ label: "Açık", tone: "success" });
    expect(
      core.venueChipState(status({ isOpen: false, freeTables: 0 })),
    ).toEqual({ label: "Kapalı", tone: "neutral" });
    expect(core.venueChipTitle(status())).toBe(
      "Köşk durumu: Otomatik, saatlere göre, boş masa 4 / 20",
    );
    expect(core.venueChipTitle(status({ manualOverride: "closed" }))).toBe(
      "Köşk durumu: Elle kapalı, boş masa 4 / 20",
    );
    expect(core.venueChipTitle(status({ saved: false }))).toMatch(
      /boş masa henüz girilmedi$/,
    );
  });

  it("steps the free tables between 0 and the table count", () => {
    expect(core.stepFreeTables(0, -1, 20)).toBe(0);
    expect(core.stepFreeTables(19, 1, 20)).toBe(20);
    expect(core.stepFreeTables(20, 1, 20)).toBe(20);
    expect(core.stepFreeTables(5, 1, 0)).toBe(0);
    // A stored count above a lowered total opens at the total.
    expect(core.stepFreeTables(25, 0, 20)).toBe(20);
  });

  it("a free table ends Yoğun on the mode the köşk is in, never on Otomatik; a picked mode stays", () => {
    // An Açık night: + from Yoğun goes back to Açık, which keeps the köşk
    // open past the hours (Otomatik would close it).
    expect(core.choiceAfterStep("busy", 1, "open")).toBe("open");
    expect(core.choiceAfterStep("busy", 1, "auto")).toBe("auto");
    expect(core.choiceAfterStep("busy", 1, "closed")).toBe("closed");
    expect(core.choiceAfterStep("busy", 0, "open")).toBe("busy");
    // A mode the operator picked is saved as picked, 0 included.
    expect(core.choiceAfterStep("auto", 0, "open")).toBe("auto");
    expect(core.choiceAfterStep("open", 0, "auto")).toBe("open");
    expect(core.choiceAfterStep("closed", 3, "auto")).toBe("closed");
  });
});

describe("the chip's poll", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  type Answer = import("@/lib/admin/venue-quick-core").VenueSignalAnswer;

  const setup = (
    visible = true,
    answer: (cursor: string) => Answer = (cursor) =>
      cursor === "c1"
        ? { unchanged: true }
        : { status: status(), cursor: "c1" },
  ) => {
    const target = new EventTarget();
    const read = vi.fn(async (cursor: string) => answer(cursor));
    const onStatus = vi.fn();
    let isVisible = visible;
    const stop = startVenuePoll({
      read,
      onStatus,
      target,
      isVisible: () => isVisible,
      intervalMs: 60_000,
    });
    return {
      target,
      read,
      onStatus,
      stop,
      show: (v: boolean) => {
        isVisible = v;
      },
    };
  };

  it("reads at once, then once a minute, sending back the cursor it was handed", async () => {
    const { read, onStatus, stop } = setup();
    await vi.advanceTimersByTimeAsync(0);
    expect(read).toHaveBeenCalledTimes(1);
    expect(read).toHaveBeenLastCalledWith("");
    expect(onStatus).toHaveBeenLastCalledWith(status());
    await vi.advanceTimersByTimeAsync(60_000);
    expect(read).toHaveBeenCalledTimes(2);
    expect(read).toHaveBeenLastCalledWith("c1");
    stop();
    await vi.advanceTimersByTimeAsync(120_000);
    expect(read).toHaveBeenCalledTimes(2);
  });

  it("keeps the status on `unchanged` (the read without the database)", async () => {
    const { read, onStatus, stop } = setup();
    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(3 * 60_000);
    expect(read).toHaveBeenCalledTimes(4);
    // Only the first answer carried a status; three were `unchanged`.
    expect(onStatus).toHaveBeenCalledTimes(1);
    stop();
  });

  it("reads again on admin:changed (a save anywhere in the panel), in full: the cursor is dropped", async () => {
    const { target, read, stop } = setup();
    await vi.advanceTimersByTimeAsync(0);
    target.dispatchEvent(new Event(ADMIN_CHANGED_EVENT));
    await vi.advanceTimersByTimeAsync(0);
    expect(read).toHaveBeenCalledTimes(2);
    expect(read).toHaveBeenLastCalledWith("");
    stop();
  });

  it("a change while a read is out is read again in full once that read is back", async () => {
    let release: (a: Answer) => void = () => {};
    const target = new EventTarget();
    const read = vi
      .fn<(cursor: string) => Promise<Answer>>()
      .mockImplementationOnce(
        () =>
          new Promise<Answer>((resolve) => {
            release = resolve;
          }),
      )
      .mockResolvedValue({ status: status({ freeTables: 1 }), cursor: "c2" });
    const onStatus = vi.fn();
    const stop = startVenuePoll({
      read,
      onStatus,
      target,
      isVisible: () => true,
    });
    await vi.advanceTimersByTimeAsync(0);
    target.dispatchEvent(new Event(ADMIN_CHANGED_EVENT));
    release({ status: status(), cursor: "c1" });
    await vi.advanceTimersByTimeAsync(0);
    expect(read).toHaveBeenCalledTimes(2);
    // Not "c1": that answer may predate the change.
    expect(read).toHaveBeenLastCalledWith("");
    expect(onStatus).toHaveBeenLastCalledWith(status({ freeTables: 1 }));
    stop();
  });

  it("does not read while the tab is hidden", async () => {
    const { read, show, stop } = setup(false);
    await vi.advanceTimersByTimeAsync(120_000);
    expect(read).not.toHaveBeenCalled();
    show(true);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(read).toHaveBeenCalledTimes(1);
    stop();
  });

  it("keeps what it showed when a read throws", async () => {
    const target = new EventTarget();
    const onStatus = vi.fn();
    const stop = startVenuePoll({
      read: async () => {
        throw new Error("network");
      },
      onStatus,
      target,
      isVisible: () => true,
    });
    await vi.advanceTimersByTimeAsync(0);
    expect(onStatus).not.toHaveBeenCalled();
    stop();
  });

  it("trusts nothing in the answer: junk reads as no state", async () => {
    const { onStatus, stop } = setup(
      true,
      () =>
        ({
          status: { manualOverride: "busy" },
          cursor: 1,
        }) as unknown as Answer,
    );
    await vi.advanceTimersByTimeAsync(0);
    expect(onStatus).toHaveBeenLastCalledWith(null);
    stop();
  });
});

const render = (
  props: { initialStatus?: Status | null; initialOpen?: boolean } = {},
) =>
  renderToStaticMarkup(
    createElement(VenueQuick, {
      initialStatus: null,
      initialOpen: false,
      ...props,
    }),
  );

describe("the chip's markup", () => {
  it("is a native disclosure with a 44 px summary, saying Köşk until the first answer", () => {
    const html = render();
    expect(html).toMatch(/^<details data-admin-venue-quick=""/);
    const summary = /<summary[^>]*>[^]*?<\/summary>/.exec(html)?.[0] ?? "";
    expect(summary).toContain("min-h-11");
    expect(summary).toContain("<span>Köşk</span>");
    // Before hydration a tap still opens it, onto the page's link.
    expect(html).toContain("Durum okunuyor…");
    expect(html).toContain('href="/admin/mobil/canli-durum"');
    expect(html).not.toContain("<form");
  });

  it("names the state in words, with Köşk: kept for screen readers on a phone", () => {
    const html = render({ initialStatus: status({ freeTables: 0 }) });
    const summary = /<summary[^>]*>[^]*?<\/summary>/.exec(html)?.[0] ?? "";
    expect(summary).toContain(
      '<span class="max-sm:sr-only">Köşk: </span><span class="font-medium">Yoğun</span>',
    );
    expect(summary).toContain("bg-[var(--admin-warning)]");
    expect(summary).toContain(
      'title="Köşk durumu: Otomatik, saatlere göre, boş masa 0 / 20"',
    );
  });

  it("opens on four radios, the stepper and Kaydet, posted by hand", () => {
    const html = render({ initialStatus: status(), initialOpen: true });
    expect(html).toMatch(/^<details[^>]*\sopen=""/);
    const radios = html.match(
      /<input type="radio"[^>]*name="status"[^>]*value="(\w+)"/g,
    );
    expect(radios?.map((r) => /value="(\w+)"/.exec(r)?.[1])).toEqual([
      "auto",
      "open",
      "busy",
      "closed",
    ]);
    for (const label of ["Otomatik", "Açık", "Yoğun", "Kapalı"]) {
      expect(html).toContain(`<span class="block font-medium">${label}</span>`);
    }
    expect(html).toMatch(/<input type="radio"[^>]*checked=""[^>]*value="auto"/);
    expect(html.match(/checked=""/g)).toHaveLength(1);
    expect(html).toContain(
      '<input type="hidden" name="freeTables" value="4"/>',
    );
    expect(html).toMatch(
      /<output[^>]*>4(<!-- -->)? \/ (<!-- -->)?20<\/output>/,
    );
    // 44 px targets: radio rows and the icon buttons.
    expect(html.match(/<label class="flex min-h-11/g)).toHaveLength(4);
    for (const name of ["Bir boş masa az", "Bir boş masa fazla"]) {
      const button = new RegExp(
        `<button type="button" class="[^"]*h-11 w-11[^"]*" aria-label="${name}"`,
      );
      expect(html, name).toMatch(button);
    }
    expect(html).toMatch(/<button type="submit"[^>]*>Kaydet<\/button>/);
    // React's guard, not a URL: an Enter before hydration posts nothing.
    expect(html).toMatch(/<form [^>]*action="javascript:/);
    expect(html).not.toContain("$ACTION");
  });

  it("disables the step that would leave 0..total", () => {
    const empty = render({
      initialStatus: status({ freeTables: 0 }),
      initialOpen: true,
    });
    expect(empty).toMatch(/aria-label="Bir boş masa az"[^>]*disabled=""/);
    expect(empty).toMatch(/checked=""[^>]*value="busy"/);
    const full = render({
      initialStatus: status({ freeTables: 20 }),
      initialOpen: true,
    });
    expect(full).toMatch(/aria-label="Bir boş masa fazla"[^>]*disabled=""/);
  });

  it("stays out of the bundle's way: no library, no database, no kit barrel", () => {
    const src = readFileSync("src/components/admin/venue-quick.tsx", "utf8");
    expect(src).toMatch(/^"use client";/);
    const imports = src.match(/from "[^"]+"/g) ?? [];
    for (const banned of [
      "lucide-react",
      "react-aria",
      "@/lib/db",
      "@/lib/mobile/venue",
      "@/lib/admin/venue-signal",
      "@/lib/cache",
      '@/components/admin/ui"',
      './ui"',
      "action-form",
    ]) {
      expect(imports.join(" "), banned).not.toContain(banned);
    }
    // Two columns only: the patch, never the whole form.
    expect(src).toContain('name="status"');
    expect(src).toContain('name="freeTables"');
    for (const field of ["wifi", "noise", "power", "note", "totalTables"]) {
      expect(src, field).not.toContain(`name="${field}"`);
    }
  });
});

async function renderLayout(role: string | null): Promise<string> {
  session.role = role;
  return renderToStaticMarkup(
    await AdminLayout({ children: createElement("p", null, "PAGE") }),
  );
}

describe("the chip in the shell", () => {
  const CHIP = "data-admin-venue-quick";

  it("sits once in the top bar's actions slot, before the bell, for owner, manager and Personel", async () => {
    for (const role of ["owner", "manager", "staff"]) {
      const html = await renderLayout(role);
      const slot =
        /<div data-admin-topbar-actions=""[^>]*>[^]*?<\/header>/.exec(
          html,
        )?.[0] ?? "";
      expect(slot, role).toContain(CHIP);
      expect(html.split(CHIP), role).toHaveLength(2);
      expect(slot.indexOf(CHIP), role).toBeLessThan(
        slot.indexOf('aria-label="Yeni sipariş sesi"'),
      );
    }
  });

  it("is not drawn for the cashier, nor before sign-in", async () => {
    expect(await renderLayout("cashier")).not.toContain(CHIP);
    expect(await renderLayout(null)).not.toContain(CHIP);
  });

  it("reads nothing in the layout: the status comes from the chip's poll", () => {
    const src = readFileSync("src/app/admin/layout.tsx", "utf8");
    expect(src).not.toMatch(
      /getVenueStatus|@\/lib\/mobile\/venue|venueQuickSignalAction|venueSignal|venue-signal/,
    );
    // The chip is drawn with no status: nothing is handed down from here.
    expect(src).toContain("{venueChip ? <VenueQuick /> : null}");
    expect(src).toContain('canAccess("venue", session.role)');
    expect(src).toMatch(
      /href: "\/admin\/mobil\/canli-durum",\s+label: "Canlı durum",\s+section: "venue",/,
    );
  });
});
