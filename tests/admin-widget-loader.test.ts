import { readFileSync } from "node:fs";

import { afterEach, describe, expect, it, vi } from "vitest";

import {
  armWidget,
  createWidgetLoader,
  hasFinePointer,
  rangeFromValues,
  snapshotRange,
} from "@/components/admin/ui/widget-loader";

/**
 * How a native date control hands over to its React Aria widget (admin UI
 * v2, UI-14, design D12). The rules are pure; the swap itself (the dialog,
 * the focus, the keys) is in the PR's browser checklist.
 */

describe("the widget's chunk", () => {
  it("is asked for once, kept, and answered the same to every caller", async () => {
    const importer = vi.fn(async () => "widget");
    const loader = createWidgetLoader(importer);
    expect(loader.peek()).toBeNull();
    expect(importer).not.toHaveBeenCalled();
    const [a, b] = await Promise.all([loader.load(), loader.load()]);
    expect([a, b]).toEqual(["widget", "widget"]);
    expect(await loader.load()).toBe("widget");
    expect(importer).toHaveBeenCalledTimes(1);
    expect(loader.peek()).toBe("widget");
  });

  it("a chunk that cannot be fetched rejects, and the next ask tries again", async () => {
    const importer = vi
      .fn<() => Promise<string | null>>()
      .mockRejectedValueOnce(new Error("ChunkLoadError"))
      .mockResolvedValueOnce("widget");
    const loader = createWidgetLoader(importer);
    await expect(loader.load()).rejects.toThrow("ChunkLoadError");
    expect(loader.peek()).toBeNull();
    expect(await loader.load()).toBe("widget");
    expect(importer).toHaveBeenCalledTimes(2);
  });

  it("the switch: a chunk that answers null is never handed over", async () => {
    const loader = createWidgetLoader(async () => null);
    const onReady = vi.fn();
    armWidget(loader, onReady, () => true);
    await loader.load();
    await Promise.resolve();
    expect(onReady).not.toHaveBeenCalled();
    expect(loader.peek()).toBeNull();
  });
});

describe("arming on the pointer or the focus", () => {
  it("a touch screen (no fine pointer) never asks for the chunk", async () => {
    const importer = vi.fn(async () => "widget");
    const onReady = vi.fn();
    armWidget(createWidgetLoader(importer), onReady, () => false);
    await Promise.resolve();
    expect(importer).not.toHaveBeenCalled();
    expect(onReady).not.toHaveBeenCalled();
  });

  it("a fine pointer asks, and hands the widget over when it is here", async () => {
    const loader = createWidgetLoader(async () => "widget");
    const onReady = vi.fn();
    armWidget(loader, onReady, () => true);
    expect(onReady).not.toHaveBeenCalled();
    await loader.load();
    await Promise.resolve();
    expect(onReady).toHaveBeenCalledWith("widget");
  });

  it("a failed chunk is swallowed here, and asked again at the next entry", async () => {
    const importer = vi
      .fn<() => Promise<string | null>>()
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce("widget");
    const loader = createWidgetLoader(importer);
    const onReady = vi.fn();
    armWidget(loader, onReady, () => true);
    await new Promise((r) => setTimeout(r, 0));
    expect(onReady).not.toHaveBeenCalled();
    armWidget(loader, onReady, () => true);
    await new Promise((r) => setTimeout(r, 0));
    expect(onReady).toHaveBeenCalledWith("widget");
  });

  describe("(pointer: fine)", () => {
    afterEach(() => vi.unstubAllGlobals());

    it("reads the media query, and a browser that throws or has none is not fine", () => {
      const asked: string[] = [];
      expect(
        hasFinePointer({
          matchMedia: (q: string) => {
            asked.push(q);
            return { matches: true } as MediaQueryList;
          },
        }),
      ).toBe(true);
      expect(asked).toEqual(["(pointer: fine)"]);
      expect(
        hasFinePointer({
          matchMedia: () => ({ matches: false }) as MediaQueryList,
        }),
      ).toBe(false);
      expect(
        hasFinePointer({
          matchMedia: () => {
            throw new Error("no");
          },
        }),
      ).toBe(false);
      // The server has no window.
      expect(hasFinePointer()).toBe(false);
    });
  });
});

describe("what the native boxes hold at the swap", () => {
  const box = (value: string) => ({ value });

  it("both whole days travel, and so does which box had focus", () => {
    const from = box("2026-10-01");
    const to = box("2026-10-15");
    expect(snapshotRange(from, to, null)).toEqual({
      from: "2026-10-01",
      to: "2026-10-15",
      focus: null,
    });
    expect(snapshotRange(from, to, from)?.focus).toBe("start");
    expect(snapshotRange(from, to, to)?.focus).toBe("end");
    expect(snapshotRange(from, to, box("2026-10-01"))?.focus).toBeNull();
  });

  it("an empty range swaps too (both boxes empty)", () => {
    expect(snapshotRange(box(""), box(""), null)).toEqual({
      from: "",
      to: "",
      focus: null,
    });
  });

  it("one end only keeps the native boxes: React Aria's range has no half range", () => {
    expect(snapshotRange(box("2026-10-01"), box(""), null)).toBeNull();
    expect(snapshotRange(box(""), box("2026-10-15"), null)).toBeNull();
    // An unfinished native box reads as empty, so it is one end too.
    expect(snapshotRange(box("2026-10-01"), box("2026-10-"), null)).toBeNull();
  });

  it("a backwards range goes over as it is: the list swaps it", () => {
    expect(
      snapshotRange(box("2026-10-15"), box("2026-10-01"), null),
    ).toMatchObject({ from: "2026-10-15", to: "2026-10-01" });
  });

  it("values the page already holds follow the same rule", () => {
    expect(rangeFromValues("2026-10-01", "2026-10-31")).toEqual({
      from: "2026-10-01",
      to: "2026-10-31",
      focus: null,
    });
    expect(rangeFromValues(undefined, undefined)).toEqual({
      from: "",
      to: "",
      focus: null,
    });
    expect(rangeFromValues("2026-10-01", undefined)).toBeNull();
  });
});

describe("overlay.ts: where a pop-over is drawn, and the one switch", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("a field in an open dialog draws its calendar in that dialog, any other in the panel's portal node", async () => {
    const { overlayContainer, popoverPortal } =
      await import("@/components/admin/ui/overlay");
    const portal = { id: "portal" };
    vi.stubGlobal("document", {
      querySelector: (sel: string) =>
        sel === "[data-admin-portal]" ? portal : null,
      body: { id: "body" },
    });
    const dialog = { id: "dialog" };
    const inDialog = {
      closest: (sel: string) => (sel === "dialog[open]" ? dialog : null),
    };
    const onPage = { closest: () => null };
    expect(overlayContainer(inDialog as unknown as Element)).toBe(dialog);
    expect(overlayContainer(onPage as unknown as Element)).toBe(portal);
    expect(overlayContainer(null)).toBe(portal);
    expect(overlayContainer()).toBe(portal);
    // Without a portal node (a test, a page outside the panel): the body.
    vi.stubGlobal("document", {
      querySelector: () => null,
      body: { id: "body" },
    });
    expect(overlayContainer(onPage as unknown as Element)).toEqual({
      id: "body",
    });
    // The Popover prop: nothing until there is a container.
    expect(popoverPortal(undefined)).toEqual({});
    expect(popoverPortal(null)).toEqual({});
    expect(popoverPortal(portal as unknown as Element)).toEqual({
      UNSTABLE_portalContainer: portal,
    });
  });

  it("the widgets are on, and the switch is one exported constant", async () => {
    const { DATE_WIDGETS_ENABLED } =
      await import("@/components/admin/ui/overlay");
    expect(DATE_WIDGETS_ENABLED).toBe(true);
    const src = readFileSync("src/components/admin/ui/overlay.ts", "utf8");
    expect(src).toMatch(/export const DATE_WIDGETS_ENABLED = (true|false);/);
  });
});
