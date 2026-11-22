import { describe, expect, it } from "vitest";

import {
  buildPanelSales,
  type PanelSalesOrderRow,
} from "@/lib/panel/sales-export-core";
import { planPanelTables } from "@/lib/panel/tables-link-core";

// Masa listesi şubeye göre (PUT /api/panel/tables) ve online satışın şube
// kırılımı (GET /api/panel/sales).

describe("planPanelTables şubeyle", () => {
  const wanted = [
    { code: "K7Q2M9X4TB", name: "S4", active: true },
    { code: "ABCDEFGH23", name: "Bahçe 1", active: true },
    { code: "NEWCODE234", name: "Yeni", active: true },
  ];

  it("başka şubenin masası listeyi bütünüyle reddettirir (ilk yeri söylenir)", () => {
    const plan = planPanelTables(
      [
        // Şubesiz eski satır: Tuzla'nın (köşkün panelinden eklenmiş).
        { code: "K7Q2M9X4TB", name: "S4", isActive: true },
        {
          code: "ABCDEFGH23",
          name: "Bahçe 1",
          isActive: true,
          branch: "tuzla",
        },
      ],
      wanted,
      "marina",
    );
    expect(plan.wrongBranch).toEqual({ index: 0, code: "K7Q2M9X4TB" });
  });

  it("aynı şubenin masası eskisi gibi güncellenir, yenisi eklenir", () => {
    const plan = planPanelTables(
      [
        { code: "K7Q2M9X4TB", name: "S-4", isActive: true, branch: "marina" },
        {
          code: "ABCDEFGH23",
          name: "Bahçe 1",
          isActive: true,
          branch: "marina",
        },
      ],
      wanted,
      "marina",
    );
    expect(plan).toEqual({
      create: [wanted[2]],
      update: [{ code: "K7Q2M9X4TB", fields: { name: "S4" } }],
      unchanged: 1,
      wrongBranch: null,
    });
  });

  it("şube verilmezse eski plan (şube denetimi yok)", () => {
    const plan = planPanelTables(
      [{ code: "K7Q2M9X4TB", name: "S4", isActive: true, branch: "tuzla" }],
      wanted.slice(0, 1),
    );
    expect(plan.wrongBranch).toBeNull();
    expect(plan.unchanged).toBe(1);
  });
});

describe("buildPanelSales şube kırılımı", () => {
  const range = { from: "2026-11-01", to: "2026-11-30" };
  const order = (
    over: Partial<PanelSalesOrderRow> & { orderNo: number },
  ): PanelSalesOrderRow => ({
    id: `ord-${over.orderNo}`,
    status: "completed",
    kind: "cafe",
    source: "",
    createdAt: "2026-11-10T09:00:00.000Z",
    totalMinor: 10000,
    subtotalMinor: 10000,
    discountMinor: 0,
    shippingMinor: 0,
    items: [
      {
        productName: "Latte",
        qty: 1,
        unitPriceMinor: 10000,
        menuItemId: "mnu-0011",
        size: "M",
        taxRatePct: 10,
      },
    ],
    ...over,
  });
  const orders = [
    order({ orderNo: 1 }), // şubesiz: Tuzla
    order({ orderNo: 2, branch: "tuzla" }),
    order({ orderNo: 3, branch: "marina", totalMinor: 20000 }),
    order({ orderNo: 4, kind: "shop", branch: "tuzla", totalMinor: 50000 }),
    order({ orderNo: 5, source: "manual", branch: "marina" }),
  ];
  const bookings = [
    {
      paymentStatus: "paid",
      paidMinor: 40000,
      paidAt: "2026-11-12T18:00:00.000Z",
      createdAt: "2026-11-12T17:00:00.000Z",
      taxRatePct: 20,
    },
  ];
  const input = {
    range,
    now: new Date("2026-12-02T00:00:00.000Z"),
    orders,
    bookings,
    couponSourceOf: () => null,
    paymentsOf: () => [],
  };

  it("süzgeçsiz: toplamlar her şubenin (eskisi gibi), byBranch yanında", () => {
    const all = buildPanelSales(input);
    expect(all.branch).toBeNull();
    expect(all.cafe.orders).toBe(3);
    expect(all.cafe.grossMinor).toBe(40000);
    expect(all.shop.orders).toBe(1);
    expect(all.manual.orders).toBe(1);
    expect(all.karaoke.collectedMinor).toBe(40000);
    expect(all.byBranch.tuzla.cafe).toMatchObject({
      orders: 2,
      grossMinor: 20000,
    });
    expect(all.byBranch.marina.cafe).toMatchObject({
      orders: 1,
      grossMinor: 20000,
    });
    expect(all.byBranch.marina.manual.orders).toBe(1);
  });

  it("?branch=marina: yalnız Marina'nın siparişleri; mağaza ve oda Tuzla'nın", () => {
    const marina = buildPanelSales({ ...input, branch: "marina" });
    expect(marina.branch).toBe("marina");
    expect(marina.cafe.orders).toBe(1);
    expect(marina.cafe.grossMinor).toBe(20000);
    expect(marina.cafe.lines).toHaveLength(1);
    expect(marina.shop.orders).toBe(0);
    expect(marina.karaoke.collectedMinor).toBe(0);
    expect(Object.keys(marina.byBranch)).toEqual(["marina"]);
  });

  it("?branch=tuzla: Marina'nın masa siparişi Tuzla'nın cirosuna girmez", () => {
    const tuzla = buildPanelSales({ ...input, branch: "tuzla" });
    expect(tuzla.cafe.orders).toBe(2);
    expect(tuzla.cafe.grossMinor).toBe(20000);
    expect(tuzla.shop.orders).toBe(1);
    expect(tuzla.manual.orders).toBe(0);
    expect(tuzla.karaoke.collectedMinor).toBe(40000);
  });
});
