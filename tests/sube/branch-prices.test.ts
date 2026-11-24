import { describe, expect, it } from "vitest";

import {
  BRANCH_PRICE_MAX_AHEAD_MS,
  branchPriceTimeProblem,
  branchPricesByItem,
  nextPriceAt,
  normalizeInstant,
  parseBranchPriceWrite,
  priceAtBranch,
  priceEpoch,
  sameBranchPrice,
  toPanelBranchPrice,
  withBranchPrice,
  type BranchPriceRow,
} from "@/lib/panel/branch-prices-core";

// src/lib/panel/branch-prices-core.ts: şubenin satış fiyatı (sahibin 23 Kasım
// 2026 onayı; docs/PANEL-MENU.md "Şube fiyatı"). Satırlar eklenir, silinmez:
// en son yürürlüğe girmiş satır geçerlidir, `priceMinor: null` tabana döner.

const row = (
  effectiveFrom: string,
  priceMinor: number | null,
  priceMinorL = 0,
  menuItemId = "mnu-0007",
): BranchPriceRow => ({
  menuItemId,
  branch: "marina",
  priceMinor,
  priceMinorL,
  effectiveFrom,
  createdAt: "2026-11-23T10:00:00.000Z",
  createdBy: "panel:Ayşe",
});

const latte = { priceMinor: 13000, priceMinorL: 15000 };
const cake = { priceMinor: 18000, priceMinorL: 0 };
const NOW = new Date("2026-11-24T09:00:00.000Z");

describe("priceAtBranch", () => {
  it("satır yoksa taban fiyat, `from` null", () => {
    expect(priceAtBranch(latte, [], NOW)).toEqual({
      priceMinor: 13000,
      priceMinorL: 15000,
      from: null,
    });
    expect(priceAtBranch(latte, undefined, NOW)).toEqual({
      priceMinor: 13000,
      priceMinorL: 15000,
      from: null,
    });
  });

  it("yürürlüğe girmiş en son satır geçerli; gelecektekine bakılmaz", () => {
    const rows = [
      row("2026-11-20T02:00:00.000Z", 14000, 16000),
      row("2026-11-24T02:00:00.000Z", 14500, 16500),
      row("2026-11-25T02:00:00.000Z", 15000, 17000),
    ];
    expect(priceAtBranch(latte, rows, NOW)).toEqual({
      priceMinor: 14500,
      priceMinorL: 16500,
      from: "2026-11-24T02:00:00.000Z",
    });
    // Sıra önemli değil; tam anında yürürlükte.
    expect(
      priceAtBranch(
        latte,
        [...rows].reverse(),
        new Date(rows[2].effectiveFrom),
      ),
    ).toEqual({
      priceMinor: 15000,
      priceMinorL: 17000,
      from: "2026-11-25T02:00:00.000Z",
    });
    expect(
      priceAtBranch(latte, rows, new Date("2026-11-19T00:00:00.000Z")),
    ).toEqual({ priceMinor: 13000, priceMinorL: 15000, from: null });
  });

  it("`priceMinor: null` tabana döner (o andan sonra şube sitenin fiyatını izler)", () => {
    const rows = [
      row("2026-11-20T02:00:00.000Z", 14000, 16000),
      row("2026-11-23T02:00:00.000Z", null),
    ];
    expect(priceAtBranch(latte, rows, NOW)).toEqual({
      priceMinor: 13000,
      priceMinorL: 15000,
      from: null,
    });
  });

  it("site L boyunu kapattıysa şubede de L yok; şube satırında L yoksa taban L", () => {
    expect(
      priceAtBranch(cake, [row("2026-11-20T02:00:00.000Z", 19000, 21000)], NOW),
    ).toEqual({
      priceMinor: 19000,
      priceMinorL: 0,
      from: "2026-11-20T02:00:00.000Z",
    });
    expect(
      priceAtBranch(latte, [row("2026-11-20T02:00:00.000Z", 14000, 0)], NOW),
    ).toEqual({
      priceMinor: 14000,
      priceMinorL: 15000,
      from: "2026-11-20T02:00:00.000Z",
    });
    // Tabanın negatif / bozuk L'si 0 okunur (okumadaki gibi).
    expect(
      priceAtBranch({ priceMinor: 100, priceMinorL: -1 }, [], NOW),
    ).toMatchObject({ priceMinorL: 0 });
  });
});

describe("nextPriceAt ve priceEpoch", () => {
  const rows = [
    row("2026-11-20T02:00:00.000Z", 14000),
    row("2026-11-26T02:00:00.000Z", 15000, 0, "mnu-0011"),
    row("2026-11-25T02:00:00.000Z", 14500),
  ];

  it("şubenin bir sonraki fiyat anı: en erken gelecek satır, yoksa null", () => {
    expect(nextPriceAt(rows, NOW)).toBe("2026-11-25T02:00:00.000Z");
    expect(nextPriceAt(rows, new Date("2026-11-27T00:00:00.000Z"))).toBeNull();
    expect(nextPriceAt([], NOW)).toBeNull();
    // Tam anında artık "sonraki" değildir.
    expect(nextPriceAt(rows, new Date("2026-11-25T02:00:00.000Z"))).toBe(
      "2026-11-26T02:00:00.000Z",
    );
  });

  it("dönem: yürürlüğe girmiş son an; önbellek anahtarı o an geçince değişir", () => {
    expect(priceEpoch(rows, NOW)).toBe("2026-11-20T02:00:00.000Z");
    expect(priceEpoch(rows, new Date("2026-11-25T02:00:00.000Z"))).toBe(
      "2026-11-25T02:00:00.000Z",
    );
    expect(priceEpoch([], NOW)).toBe("");
  });

  it("kaleme göre grup", () => {
    const by = branchPricesByItem(rows);
    expect(by.get("mnu-0007")?.length).toBe(2);
    expect(by.get("mnu-0011")?.length).toBe(1);
  });
});

describe("withBranchPrice: şubenin okumasındaki kalem", () => {
  it("fiyat şubede şu an geçerli olan; taban ve başlangıç yanında", () => {
    const item = { id: "mnu-0007", name: "Latte", ...latte };
    expect(
      withBranchPrice(
        item,
        [row("2026-11-24T02:00:00.000Z", 14500, 16500)],
        NOW,
      ),
    ).toEqual({
      id: "mnu-0007",
      name: "Latte",
      priceMinor: 14500,
      priceMinorL: 16500,
      basePriceMinor: 13000,
      basePriceMinorL: 15000,
      priceFrom: "2026-11-24T02:00:00.000Z",
    });
    expect(withBranchPrice(item, [], NOW)).toEqual({
      ...item,
      basePriceMinor: 13000,
      basePriceMinorL: 15000,
      priceFrom: null,
    });
  });
});

describe("zaman: biçim ve pencere", () => {
  it("saat dilimli ISO anı UTC'ye çevrilir; dilimsiz ya da bozuk değer reddedilir", () => {
    expect(normalizeInstant("2026-11-25T05:00:00+03:00")).toBe(
      "2026-11-25T02:00:00.000Z",
    );
    expect(normalizeInstant("2026-11-25T02:00:00Z")).toBe(
      "2026-11-25T02:00:00.000Z",
    );
    expect(normalizeInstant("2026-11-25T02:00:00.000Z")).toBe(
      "2026-11-25T02:00:00.000Z",
    );
    expect(normalizeInstant("2026-11-25T05:00:00")).toBeNull();
    expect(normalizeInstant("2026-11-25")).toBeNull();
    expect(normalizeInstant("2026-02-30T05:00:00Z")).toBeNull();
    expect(normalizeInstant("yarın")).toBeNull();
  });

  it("yeni satır: en çok 5 dakika geçmiş, en çok 90 gün ileri", () => {
    const at = (ms: number) => new Date(NOW.getTime() + ms).toISOString();
    expect(branchPriceTimeProblem(at(-4 * 60_000), NOW, false)).toBeNull();
    expect(branchPriceTimeProblem(at(-6 * 60_000), NOW, false)).toBe("past");
    expect(
      branchPriceTimeProblem(at(BRANCH_PRICE_MAX_AHEAD_MS), NOW, false),
    ).toBeNull();
    expect(
      branchPriceTimeProblem(at(BRANCH_PRICE_MAX_AHEAD_MS + 1), NOW, false),
    ).toBe("too_far");
  });

  it("iptal: yalnız henüz yürürlüğe girmemiş satır", () => {
    const at = (ms: number) => new Date(NOW.getTime() + ms).toISOString();
    expect(branchPriceTimeProblem(at(1), NOW, true)).toBeNull();
    expect(branchPriceTimeProblem(at(0), NOW, true)).toBe("in_effect");
    expect(branchPriceTimeProblem(at(-60_000), NOW, true)).toBe("in_effect");
  });
});

describe("parseBranchPriceWrite", () => {
  it("yeni fiyat: M, L ve an; an UTC'ye çevrilir, L yoksa 0", () => {
    expect(
      parseBranchPriceWrite({
        priceMinor: 14500,
        priceMinorL: 16500,
        effectiveFrom: "2026-11-25T05:00:00+03:00",
      }),
    ).toEqual({
      ok: true,
      write: {
        cancel: false,
        priceMinor: 14500,
        priceMinorL: 16500,
        effectiveFrom: "2026-11-25T02:00:00.000Z",
      },
    });
    expect(
      parseBranchPriceWrite({
        priceMinor: null,
        effectiveFrom: "2026-11-25T02:00:00Z",
      }),
    ).toEqual({
      ok: true,
      write: {
        cancel: false,
        priceMinor: null,
        priceMinorL: 0,
        effectiveFrom: "2026-11-25T02:00:00.000Z",
      },
    });
  });

  it("iptal: yalnız an", () => {
    expect(
      parseBranchPriceWrite({
        effectiveFrom: "2026-11-25T02:00:00.000Z",
        cancel: true,
      }),
    ).toEqual({
      ok: true,
      write: { cancel: true, effectiveFrom: "2026-11-25T02:00:00.000Z" },
    });
  });

  it("ret: hangi alanın bozuk olduğu söylenir", () => {
    const at = "2026-11-25T02:00:00.000Z";
    const field = (raw: unknown) => {
      const r = parseBranchPriceWrite(raw);
      return r.ok ? null : r.field;
    };
    expect(field("x")).toBe("branchPrice");
    expect(field({ effectiveFrom: at })).toBe("branchPrice.priceMinor");
    expect(field({ priceMinor: 0, effectiveFrom: at })).toBe(
      "branchPrice.priceMinor",
    );
    expect(field({ priceMinor: 100.5, effectiveFrom: at })).toBe(
      "branchPrice.priceMinor",
    );
    expect(field({ priceMinor: 100, priceMinorL: -1, effectiveFrom: at })).toBe(
      "branchPrice.priceMinorL",
    );
    // Tabana dönen satır L taşımaz.
    expect(
      field({ priceMinor: null, priceMinorL: 100, effectiveFrom: at }),
    ).toBe("branchPrice.priceMinorL");
    expect(field({ priceMinor: 100, effectiveFrom: "2026-11-25" })).toBe(
      "branchPrice.effectiveFrom",
    );
    expect(field({ priceMinor: 100, effectiveFrom: at, cancel: true })).toBe(
      "branchPrice.cancel",
    );
    expect(field({ effectiveFrom: at, cancel: false })).toBe(
      "branchPrice.cancel",
    );
    expect(field({ priceMinor: 100, effectiveFrom: at, note: "x" })).toBe(
      "branchPrice",
    );
  });
});

describe("toPanelBranchPrice: panelin gördüğü satır (beyaz liste)", () => {
  it("kalem, şube, fiyatlar, an ve yazıldığı an; yazanın adı gitmez", () => {
    expect(
      toPanelBranchPrice(row("2026-11-25T02:00:00.000Z", 14500, 16500)),
    ).toEqual({
      id: "mnu-0007",
      branch: "marina",
      priceMinor: 14500,
      priceMinorL: 16500,
      effectiveFrom: "2026-11-25T02:00:00.000Z",
      createdAt: "2026-11-23T10:00:00.000Z",
    });
  });
});

describe("sameBranchPrice: yeniden gönderilen yazım", () => {
  const at = "2026-11-25T02:00:00.000Z";
  const write = (priceMinor: number | null, priceMinorL = 0) => ({
    cancel: false as const,
    priceMinor,
    priceMinorL,
    effectiveFrom: at,
  });

  it("aynı an, aynı M ve L: aynı yazım (yanıtı kaybolmuş istek)", () => {
    expect(sameBranchPrice(row(at, 14500, 16500), write(14500, 16500))).toBe(
      true,
    );
    expect(sameBranchPrice(row(at, null), write(null))).toBe(true);
  });

  it("fiyatı, L'si ya da anı farklı satır başka bir yazımdır", () => {
    expect(sameBranchPrice(row(at, 14500, 16500), write(15000, 16500))).toBe(
      false,
    );
    expect(sameBranchPrice(row(at, 14500, 16500), write(14500, 0))).toBe(false);
    expect(sameBranchPrice(row(at, 14500), write(null))).toBe(false);
    expect(
      sameBranchPrice(row("2026-11-26T02:00:00.000Z", 14500), write(14500)),
    ).toBe(false);
  });
});
