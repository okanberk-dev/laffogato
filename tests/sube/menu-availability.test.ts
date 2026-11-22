import { describe, expect, it } from "vitest";

import {
  itemAtBranch,
  itemsSoldAtBranch,
  laterStamp,
  planAvailabilityWrite,
  soldAtBranch,
  soldOutBranches,
  type BranchAvailability,
} from "@/lib/panel/menu-availability-core";

// src/lib/panel/menu-availability-core.ts: "Satışta / Tükendi" şubeye göre
// (sahibin 4 Kasım 2026 kararı; docs/PANEL-MENU.md "Şube").

const row = (
  branch: string,
  isActive: boolean,
  updatedAt = "2026-11-21T10:00:00.000Z",
): BranchAvailability => ({
  menuItemId: "mnu-0042",
  branch,
  isActive,
  updatedAt,
  updatedBy: "lafpos:Selin",
});

const item = {
  id: "mnu-0042",
  isActive: true,
  updatedAt: "2026-11-20T08:00:00.000Z",
};

describe("bir şubede satılır mı", () => {
  it("satır yoksa menüdeki bayrak, varsa ikisi birden", () => {
    expect(soldAtBranch(item, null)).toBe(true);
    expect(soldAtBranch(item, row("tuzla", false))).toBe(false);
    expect(soldAtBranch({ isActive: false }, row("tuzla", true))).toBe(false);
  });

  it("şubenin görünümü: isActive o şubede, onMenu sitenin bayrağı, damga ikisinin geç olanı", () => {
    expect(itemAtBranch(item, row("marina", false))).toEqual({
      ...item,
      isActive: false,
      onMenu: true,
      updatedAt: "2026-11-21T10:00:00.000Z",
    });
    expect(itemAtBranch(item, undefined)).toEqual({ ...item, onMenu: true });
  });

  it("listeden yalnız o şubede satılanlar kalır", () => {
    const items = [
      { id: "a", isActive: true },
      { id: "b", isActive: true },
      { id: "c", isActive: false },
    ];
    const rows = new Map([["b", { isActive: false }]]);
    expect(itemsSoldAtBranch(items, rows).map((i) => i.id)).toEqual(["a"]);
  });

  it("laterStamp", () => {
    expect(laterStamp("", "b")).toBe("b");
    expect(laterStamp("a", "")).toBe("a");
    expect(
      laterStamp("2026-11-21T10:00:00.000Z", "2026-11-20T10:00:00.000Z"),
    ).toBe("2026-11-21T10:00:00.000Z");
  });
});

describe("planAvailabilityWrite: doğrulayıcının üç senaryosu", () => {
  it("A: Tuzla'nın Tükendi'si yalnız Tuzla'nın satırını yazar (Marina'yı kapatmaz)", () => {
    expect(
      planAvailabilityWrite({ onMenu: true, branchRow: null }, false, "panel"),
    ).toEqual({ kind: "branch", isActive: false });
  });

  it("B: Marina'nın porsiyonu biten ürünü yalnız Marina'nın satırını yazar", () => {
    expect(
      planAvailabilityWrite({ onMenu: true, branchRow: null }, false, "lafpos"),
    ).toEqual({ kind: "branch", isActive: false });
  });

  it("C: LafPOS sitenin menüden kaldırdığını açamaz (409 site_closed)", () => {
    expect(
      planAvailabilityWrite({ onMenu: false, branchRow: null }, true, "lafpos"),
    ).toEqual({ kind: "site_closed" });
  });

  it("panel (sahibin arka ofisi) menüden kalkanı geri koyar: önceki yetkisi", () => {
    expect(
      planAvailabilityWrite({ onMenu: false, branchRow: null }, true, "panel"),
    ).toEqual({ kind: "reopen" });
  });

  it("şubenin kendi Tükendi'si kendi Satışa aç'ıyla açılır", () => {
    for (const caller of ["panel", "lafpos"] as const) {
      expect(
        planAvailabilityWrite(
          { onMenu: true, branchRow: row("marina", false) },
          true,
          caller,
        ),
      ).toEqual({ kind: "branch", isActive: true });
    }
  });

  it("zaten öyleyse hiçbir şey yazılmaz", () => {
    expect(
      planAvailabilityWrite({ onMenu: true, branchRow: null }, true, "lafpos"),
    ).toEqual({ kind: "none" });
    expect(
      planAvailabilityWrite(
        { onMenu: true, branchRow: row("marina", false) },
        false,
        "lafpos",
      ),
    ).toEqual({ kind: "none" });
    expect(
      planAvailabilityWrite(
        { onMenu: false, branchRow: null },
        false,
        "lafpos",
      ),
    ).toEqual({ kind: "none" });
  });
});

describe("soldOutBranches", () => {
  it("Tükendi diyen şubeler, sitenin sırasıyla", () => {
    expect(
      soldOutBranches(
        [row("marina", false), row("tuzla", false), row("kadikoy", true)],
        ["tuzla", "marina"],
      ),
    ).toEqual(["tuzla", "marina"]);
    expect(soldOutBranches([row("zeytin", false)], ["tuzla"])).toEqual([
      "zeytin",
    ]);
  });
});
