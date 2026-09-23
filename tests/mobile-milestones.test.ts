import { describe, expect, it } from "vitest";

import {
  giftTitle,
  isGiftable,
  MILESTONE_GIFTS,
  milestoneRoadmap,
  nextMilestone,
  perksByTier,
  pickGift,
  reachedMilestones,
  SURPRISE_TITLE,
  type GiftCandidate,
} from "@/lib/mobile/milestones-core";

const MENU: GiftCandidate[] = [
  { id: "mnu-1", name: "Filtre Kahve", categoryKey: "espresso", priceMinor: 16500, isActive: true },
  { id: "mnu-2", name: "Americano", categoryKey: "espresso", priceMinor: 16500, isActive: true },
  { id: "mnu-3", name: "Tiramisu", categoryKey: "dessert", priceMinor: 22000, isActive: true },
  { id: "mnu-4", name: "Ekstra shot", categoryKey: "extras", priceMinor: 3000, isActive: true },
  { id: "mnu-5", name: "Kurabiye", categoryKey: "snack", priceMinor: 9000, isActive: true },
  { id: "mnu-6", name: "Eski latte", categoryKey: "espresso", priceMinor: 15000, isActive: false },
];

/** Karar 175 - the operator's milestone gifts: 10, 20, 30 and 40 lifetime stamps. */
describe("milestone gifts", () => {
  it("are the operator's four: Filtre Kahve, Americano, then two surprises", () => {
    expect(MILESTONE_GIFTS).toEqual([
      { at: 10, item: "Filtre Kahve" },
      { at: 20, item: "Americano" },
      { at: 30, item: null },
      { at: 40, item: null },
    ]);
  });

  it("are reached by lifetime stamps, in order, and the next one is known", () => {
    expect(reachedMilestones(9)).toEqual([]);
    expect(reachedMilestones(10).map((m) => m.at)).toEqual([10]);
    expect(reachedMilestones(31).map((m) => m.at)).toEqual([10, 20, 30]);
    expect(nextMilestone(12)?.at).toBe(20);
    expect(nextMilestone(40)).toBeNull();
  });

  it("gives the named item when it is on sale", () => {
    expect(pickGift({ at: 10, item: "Filtre Kahve" }, MENU, () => 0)?.id).toBe("mnu-1");
    expect(pickGift({ at: 20, item: "americano" }, MENU, () => 0)?.id).toBe("mnu-2");
  });

  it("gives a random drink or dessert, never an extra, a snack or something off the menu", () => {
    const pool = MENU.filter(isGiftable).map((m) => m.id);
    expect(pool).toEqual(["mnu-1", "mnu-2", "mnu-3"]);
    const picks = new Set([0, 0.34, 0.67, 0.99].map((r) => pickGift({ at: 30, item: null }, MENU, () => r)?.id));
    expect([...picks].every((id) => pool.includes(id!))).toBe(true);
    expect(picks.size).toBe(3);
  });

  it("falls back to a random gift when the named item was renamed or retired", () => {
    expect(pickGift({ at: 10, item: "Yok Böyle Kahve" }, MENU, () => 0.99)?.id).toBe("mnu-3");
    expect(pickGift({ at: 10, item: "Filtre Kahve" }, [], () => 0)).toBeNull();
  });

  it("titles the coupon as the gift it is", () => {
    expect(giftTitle({ name: "Tiramisu" })).toBe("Hediye: Tiramisu");
  });

  it("draws the road map the app shows: reached, given and as what", () => {
    const map = milestoneRoadmap(22, [{ milestone: 10, itemName: "Filtre Kahve" }]);
    expect(map[0]).toEqual({ at: 10, title: "Filtre Kahve", reached: true, given: true, gift: "Filtre Kahve" });
    expect(map[1]).toEqual({ at: 20, title: "Americano", reached: true, given: false, gift: "" });
    expect(map[2]).toEqual({ at: 30, title: SURPRISE_TITLE, reached: false, given: false, gift: "" });
  });
});

describe("tier perks", () => {
  it("name only what the server applies: RUBY's karaoke discount, at the configured rate", () => {
    expect(perksByTier(15)).toEqual({ verde: [], argento: [], oro: ["Karaoke odasında %15 indirim"] });
    expect(perksByTier(0).oro).toEqual([]);
  });
});
