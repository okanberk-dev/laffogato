import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * `deriveNotifications` reads five sources (docs/API-MOBILE.md §8). The two
 * added on 23 Eyl 2026 - the karaoke book and the milestone table - are
 * matched by e-mail alone, so an unverified member must not see them, and a
 * failure in either must cost the inbox those rows only, not the whole list.
 */

const store = {
  customerOrdersByEmail: vi.fn(),
  listActiveAppAnnouncements: vi.fn(),
  orderFulfillment: vi.fn(() => "shipping"),
};
const karaoke = {
  listReservationDecisions: vi.fn(),
  formatReservationDate: (d: string) => d,
  formatReservationTime: (h: number, n: number) => `${h}:00 - ${h + n}:00`,
};
const milestones = { listMilestoneGrants: vi.fn() };

vi.mock("@/lib/admin/store", () => store);
vi.mock("@/lib/mobile/karaoke", () => karaoke);
vi.mock("@/lib/mobile/milestones", () => milestones);
vi.mock("@/lib/mobile/loyalty", () => ({
  getRewardStatus: vi.fn(async () => ({ rewardsReady: 0, readyAt: null })),
}));

const { deriveNotifications } = await import("@/lib/mobile/notifications");

const NOW = new Date("2026-09-23T12:00:00.000Z");

const CONFIRMED = {
  id: "krk-00042",
  date: "2026-09-26",
  startHour: 20,
  hours: 2,
  guests: 4,
  status: "confirmed",
  updatedAt: "2026-09-22T10:00:00.000Z",
};
const GIFT = {
  milestone: 10,
  couponId: "cpn-0001",
  itemName: "Filtre Kahve",
  createdAt: "2026-09-21T08:00:00.000Z",
};

describe("deriveNotifications: karaoke and milestone sources", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    store.customerOrdersByEmail.mockReset().mockResolvedValue([]);
    store.listActiveAppAnnouncements.mockReset().mockResolvedValue([]);
    karaoke.listReservationDecisions.mockReset().mockResolvedValue([CONFIRMED]);
    milestones.listMilestoneGrants.mockReset().mockResolvedValue([GIFT]);
  });

  it("asks the karaoke book for decisions inside the 30-day window", async () => {
    const items = await deriveNotifications("eda@ornek.com", NOW);
    expect(karaoke.listReservationDecisions).toHaveBeenCalledWith(
      "eda@ornek.com",
      "2026-08-24T12:00:00.000Z",
    );
    expect(items.map((i) => i.id)).toEqual([
      "karaoke-krk-00042-confirmed",
      "milestone-10",
    ]);
  });

  it("leaves every e-mail-matched row out for an unverified member", async () => {
    const items = await deriveNotifications("eda@ornek.com", NOW, undefined, {
      withOrders: false,
    });
    expect(items).toEqual([]);
    expect(karaoke.listReservationDecisions).not.toHaveBeenCalled();
    expect(milestones.listMilestoneGrants).not.toHaveBeenCalled();
    expect(store.customerOrdersByEmail).not.toHaveBeenCalled();
  });

  it("loses only the failing source's rows", async () => {
    karaoke.listReservationDecisions.mockRejectedValue(
      new Error('relation "karaoke_reservations" does not exist'),
    );
    const items = await deriveNotifications("eda@ornek.com", NOW);
    expect(items.map((i) => i.id)).toEqual(["milestone-10"]);
  });

  it("still fails the call when the orders cannot be read", async () => {
    store.customerOrdersByEmail.mockRejectedValue(new Error("db down"));
    await expect(deriveNotifications("eda@ornek.com", NOW)).rejects.toThrow(
      "db down",
    );
  });
});
