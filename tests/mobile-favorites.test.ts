import { describe, expect, it } from "vitest";

import { toMe } from "@/lib/mobile/me-mapper";
import type { PublicCustomer } from "@/lib/customer/store";

const base: PublicCustomer = {
  id: "cst-1",
  email: "eda@example.com",
  name: "Eda Mancuso",
  phone: "",
  birthday: "",
  addresses: [],
  wishlist: ["prd-0001", "prd-0007"],
  notificationPrefs: {
    orderUpdates: true,
    marketing: false,
    newsletter: false,
  },
  emailVerified: true,
  isActive: true,
  createdAt: "2026-05-01T09:00:00.000Z",
  inviteCode: "LAF-EDA0024",
  usual: null,
};
const loyalty = {} as Parameters<typeof toMe>[1];
const invite = {} as Parameters<typeof toMe>[2];

/**
 * One wishlist per member, not one per surface. The site has had a favourites
 * page all along; the mobile payload simply never carried the list, so a
 * product favourited on the web was invisible in the app.
 */
describe("favourites reach the app", () => {
  it("carries the member's wishlist in /me", () => {
    expect(toMe(base, loyalty, invite).customer.wishlist).toEqual([
      "prd-0001",
      "prd-0007",
    ]);
  });

  it("hands out a copy, so a caller cannot rewrite the next response", () => {
    const me = toMe(base, loyalty, invite);
    me.customer.wishlist.push("prd-9999");
    expect(base.wishlist).toEqual(["prd-0001", "prd-0007"]);
  });

  it("an empty wishlist is an empty list, never undefined", () => {
    const me = toMe({ ...base, wishlist: [] }, loyalty, invite);
    expect(me.customer.wishlist).toEqual([]);
  });
});
