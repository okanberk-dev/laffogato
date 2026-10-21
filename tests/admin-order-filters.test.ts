import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import {
  OPEN_ORDER_STATUSES,
  ORDER_DEFAULT_SORT,
  ORDER_FILTER_FIELDS,
  escapeLike,
  istanbulDayStartIso,
  parseOrderListParams,
  parseOrderSearch,
  tabStatuses,
  withoutStatuses,
} from "@/lib/admin/order-filters";
import { filterChips } from "@/lib/admin/list-params";

/**
 * The order list's URL is its state (?q durum kanal tur teslimat odeme bas
 * bit dikkat sirala yon sayfa). One parser feeds the page, the FilterBar's
 * chips and the store's SQL, so what is shown and what ran cannot disagree,
 * and nothing raw from the URL reaches the query.
 */
describe("parseOrderListParams", () => {
  it("reads the plain list as the live first page", () => {
    const p = parseOrderListParams({});
    expect(p.narrowed).toBe(false);
    expect(p.page).toBe(1);
    expect(p.sort).toEqual(ORDER_DEFAULT_SORT);
    expect(p.tab).toBeNull();
    expect(p.query).toEqual({
      search: null,
      statuses: null,
      channel: null,
      kind: null,
      fulfillment: null,
      payment: null,
      attention: false,
      fromIso: null,
      beforeIso: null,
    });
  });

  it("maps the Turkish params onto the store's vocabulary", () => {
    const p = parseOrderListParams({
      kanal: "manuel",
      tur: "cafe",
      teslimat: "table",
      odeme: "odenmedi",
      dikkat: "1",
    });
    expect(p.query).toMatchObject({
      channel: "manual",
      kind: "cafe",
      fulfillment: "table",
      payment: "unpaid",
      attention: true,
    });
    expect(p.narrowed).toBe(true);
  });

  it("drops what it does not know instead of passing it on", () => {
    const p = parseOrderListParams({
      kanal: "fax",
      odeme: "maybe",
      durum: "lost",
      bas: "2026-13-01",
      sirala: "secret",
      yon: "sideways",
      sayfa: "-4",
    });
    expect(p.values).toEqual({});
    expect(p.tab).toBeNull();
    expect(p.query.channel).toBeNull();
    expect(p.query.payment).toBeNull();
    expect(p.query.fromIso).toBeNull();
    expect(p.sort).toEqual(ORDER_DEFAULT_SORT);
    expect(p.page).toBe(1);
  });

  it("swaps a backwards date range and reads both ends as Istanbul days", () => {
    const p = parseOrderListParams({ bas: "2026-10-05", bit: "2026-10-01" });
    expect(p.values).toEqual({ bas: "2026-10-01", bit: "2026-10-05" });
    expect(p.query.fromIso).toBe("2026-09-30T21:00:00.000Z");
    // `bit` is inclusive: the query runs to the next Istanbul midnight.
    expect(p.query.beforeIso).toBe("2026-10-05T21:00:00.000Z");
    expect(istanbulDayStartIso("2026-01-01")).toBe("2025-12-31T21:00:00.000Z");
  });

  it("knows the tabs, with Açık covering the parcel on the road", () => {
    expect(tabStatuses("acik")).toEqual([
      "pending_payment",
      "paid",
      "preparing",
      "shipped",
    ]);
    expect(tabStatuses("refunded")).toEqual(["refunded"]);
    expect(tabStatuses(null)).toBeNull();
    const p = parseOrderListParams({ durum: "acik", kanal: "app" });
    expect(withoutStatuses(p.query)).toEqual({ ...p.query, statuses: null });
  });

  it("does not poll on a sorted, paged, filtered or other tab's view", () => {
    expect(parseOrderListParams({ sayfa: "2" }).live).toBeNull();
    expect(parseOrderListParams({ sirala: "tutar" }).live).toBeNull();
    expect(parseOrderListParams({ durum: "paid" }).live).toBeNull();
    expect(parseOrderListParams({ durum: "acik", kanal: "app" }).live).toBeNull();
    expect(parseOrderListParams({ durum: "acik", sayfa: "2" }).live).toBeNull();
    expect(parseOrderListParams({ sirala: "no", yon: "desc" }).live).toBe("all");
    expect(parseOrderListParams({ sayfa: "2" }).narrowed).toBe(true);
    expect(parseOrderListParams({ sirala: "no", yon: "desc" }).narrowed).toBe(false);
  });

  it("polls on the plain Açık tab, where every new order lands (ORD-09)", () => {
    // A shift working from "Açık" got no sound and no "N yeni sipariş".
    const open = parseOrderListParams({ durum: "acik" });
    expect(open.live).toBe("open");
    // Still narrowed: its empty state says the filter, not "no orders yet".
    expect(open.narrowed).toBe(true);
    expect(parseOrderListParams({}).live).toBe("all");
  });
});

describe("one set of open orders (ORD-21)", () => {
  it("the Açık tab is the exported set, the parcel on the road included", () => {
    expect(tabStatuses("acik")).toEqual([...OPEN_ORDER_STATUSES]);
    expect(OPEN_ORDER_STATUSES).toContain("shipped");
  });

  it("the badge, the dashboard and the tab count read it, not their own lists", () => {
    const store = readFileSync("src/lib/admin/store.ts", "utf8");
    expect(store).not.toMatch(/const OPEN_ORDER_STATUSES/);
    expect(store).not.toContain('.in("status", ["pending_payment", "paid", "preparing"])');
    const page = readFileSync("src/app/admin/siparisler/page.tsx", "utf8");
    expect(page).toContain("OPEN_ORDER_STATUSES.reduce(");
  });
});

describe("selection and the URL (ORD-07)", () => {
  it("a tab, filter, sort, page link or new search starts a fresh selection", () => {
    // Next keeps a page's client state across search-param changes: three
    // open orders ticked, the "Tamamlandı" tab clicked, "İptal et" pressed,
    // and three orders nobody could see were cancelled. `view` is the
    // address and the remembered search (lib/admin/list-search.ts).
    const page = readFileSync("src/app/admin/siparisler/page.tsx", "utf8");
    expect(page).toMatch(/<OrdersList\s+key=\{JSON\.stringify\(view\)\}/);
    expect(page).toContain("live={parsed.live}");
  });
});

describe("the search box", () => {
  it("reads an order number with or without #", () => {
    expect(parseOrderSearch("#10023")?.orderNo).toBe(10023);
    expect(parseOrderSearch("10023")?.orderNo).toBe(10023);
    expect(parseOrderSearch("ayşe")?.orderNo).toBeNull();
    expect(parseOrderSearch("  ")).toBeNull();
  });

  it("takes % and _ literally", () => {
    expect(escapeLike("50%_off\\")).toBe("50\\%\\_off\\\\");
    expect(parseOrderSearch("50%")?.pattern).toBe("%50\\%%");
  });

  it("collapses and caps what was typed", () => {
    const p = parseOrderListParams({ q: `  ay   şe ${"x".repeat(200)}` });
    expect(p.values.q.startsWith("ay şe x")).toBe(true);
    expect(p.values.q.length).toBeLessThanOrEqual(80);
  });
});

describe("the chips match the query", () => {
  it("offers a removable chip per active filter, keeping the tab", () => {
    const sp = { q: "ayşe", kanal: "app", durum: "paid", sayfa: "3" };
    const { values } = parseOrderListParams(sp);
    const chips = filterChips(ORDER_FILTER_FIELDS, values, sp, "/admin/siparisler");
    expect(chips.map((c) => c.key)).toEqual(["q", "kanal"]);
    const kanal = chips.find((c) => c.key === "kanal")!;
    expect(kanal.value).toBe("Uygulama");
    expect(kanal.removeHref).toBe("/admin/siparisler?q=ay%C5%9Fe&durum=paid");
  });
});
