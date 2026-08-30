import { describe, expect, it } from "vitest";

import type { CustomerCoupon } from "@/lib/customer/coupon-utils";
import type { CustomerAddress, PublicCustomer } from "@/lib/customer/store";
import type { LoyaltyView } from "@/lib/mobile/loyalty-core";
import {
  couponBody,
  fromMeAddress,
  joinNeighbourhood,
  splitNeighbourhood,
  toMe,
  toMeAddress,
  toMeCoupon,
  type InviteSummary,
} from "@/lib/mobile/me-mapper";
import { addressInputSchema, mePatchSchema } from "@/lib/mobile/me-schema";

const address: CustomerAddress = {
  id: "adr-1",
  label: "Evim",
  recipientName: "Eda Mancuso",
  phone: "+90 555 000 00 00",
  line1: "Postane Mah., Atatürk Cad. No: 28",
  line2: "Kapı kodu 4821",
  district: "Tuzla",
  city: "İstanbul",
  zip: "34940",
  isDefault: true,
};

const customer: PublicCustomer = {
  id: "cst-1",
  email: "eda@example.com",
  name: "Eda Mancuso",
  phone: "+90 555 000 00 00",
  birthday: "1994-03-02",
  addresses: [address],
  wishlist: ["prd-0001"],
  notificationPrefs: { orderUpdates: true, marketing: false, newsletter: true },
  emailVerified: true,
  isActive: true,
  createdAt: "2026-05-01T09:00:00.000Z",
  inviteCode: "LAF-EDA24",
  usual: { menuItemId: "mnu-0007", size: "M", options: { milk: "oat" } },
};

const loyalty: LoyaltyView = {
  stamps: 4,
  stampTarget: 6,
  rewardsReady: 1,
  lifetimeStamps: 22,
  tier: "oro",
  tierLabel: "ORO",
  ordersLast365: 41,
  badges: [],
};

const invite: InviteSummary = {
  code: "LAF-EDA24",
  invited: 1,
  joined: 1,
  earned: 1,
  people: [{ name: "Selin K.", status: "joined", at: "2026-06-01T00:00Z" }],
};

describe("neighbourhood folding", () => {
  it("splits a leading mahalle back out of line1", () => {
    expect(splitNeighbourhood("Postane Mah., Atatürk Cad. No: 28")).toEqual({
      neighbourhood: "Postane Mah.",
      line: "Atatürk Cad. No: 28",
    });
    expect(splitNeighbourhood("Aydıntepe Mahallesi, Sahil Yolu 5")).toEqual({
      neighbourhood: "Aydıntepe Mahallesi",
      line: "Sahil Yolu 5",
    });
  });

  it("leaves a site-typed address without a mahalle intact", () => {
    expect(splitNeighbourhood("Atatürk Cad. No: 28 D:1")).toEqual({
      neighbourhood: "",
      line: "Atatürk Cad. No: 28 D:1",
    });
  });

  it("round-trips through join → split", () => {
    const line1 = joinNeighbourhood("Postane Mah.", "Atatürk Cad. No: 28");
    expect(line1).toBe("Postane Mah., Atatürk Cad. No: 28");
    expect(splitNeighbourhood(line1)).toEqual({
      neighbourhood: "Postane Mah.",
      line: "Atatürk Cad. No: 28",
    });
    expect(joinNeighbourhood("", "Sahil Yolu 5")).toBe("Sahil Yolu 5");
    expect(joinNeighbourhood("Postane Mah.", "")).toBe("Postane Mah.");
  });
});

describe("toMeAddress / fromMeAddress", () => {
  it("maps the store record to the contract shape (§4)", () => {
    expect(toMeAddress(address)).toEqual({
      id: "adr-1",
      title: "Evim",
      fullName: "Eda Mancuso",
      phone: "+90 555 000 00 00",
      city: "İstanbul",
      district: "Tuzla",
      neighbourhood: "Postane Mah.",
      line: "Atatürk Cad. No: 28",
      note: "Kapı kodu 4821",
      isDefault: true,
    });
  });

  it("maps an app address to the store input, zip left empty", () => {
    expect(
      fromMeAddress({
        title: "Ofis",
        fullName: "Eda Mancuso",
        phone: "+90 555 000 00 00",
        city: "İstanbul",
        district: "Tuzla",
        neighbourhood: "Postane Mah.",
        line: "Atatürk Cad. No: 28",
        note: "",
        isDefault: true,
      }),
    ).toEqual({
      label: "Ofis",
      recipientName: "Eda Mancuso",
      phone: "+90 555 000 00 00",
      line1: "Postane Mah., Atatürk Cad. No: 28",
      line2: "",
      district: "Tuzla",
      city: "İstanbul",
      zip: "",
      isDefault: true,
    });
  });

  it("isDefault defaults to false", () => {
    const parsed = addressInputSchema.parse({
      fullName: "Eda Mancuso",
      phone: "5550000000",
      city: "İstanbul",
      line: "Atatürk Cad. No: 28",
    });
    expect(fromMeAddress(parsed).isDefault).toBe(false);
    expect(parsed.title).toBe("");
    expect(parsed.neighbourhood).toBe("");
  });
});

describe("toMe", () => {
  it("emits exactly the contract fields and nothing from the row", () => {
    const me = toMe(customer, loyalty, invite);
    expect(Object.keys(me).sort()).toEqual([
      "customer",
      "invite",
      "loyalty",
      "usual",
    ]);
    expect(Object.keys(me.customer).sort()).toEqual(
      [
        "id",
        "email",
        "name",
        "phone",
        "emailVerified",
        "birthday",
        "memberSince",
        "notificationPrefs",
        "addresses",
        "wishlist",
      ].sort(),
    );
    expect(me.customer.memberSince).toBe("2026-05-01T09:00:00.000Z");
    expect(me.customer.addresses[0].neighbourhood).toBe("Postane Mah.");
    // The same list the site's favourites page renders — one wishlist per
    // member, not one per surface.
    expect(me.customer.wishlist).toEqual(customer.wishlist);
    expect(me.customer.wishlist).not.toBe(customer.wishlist);
    expect(me.usual).toEqual({
      menuItemId: "mnu-0007",
      size: "M",
      options: { milk: "oat" },
    });
    expect(me.loyalty).toBe(loyalty);
    expect(me.invite).toBe(invite);
    // `wishlist` used to be withheld here as an internal column. It is now a
    // deliberate part of the contract: the site has a favourites page and the
    // app could not see the same list. `isActive` stays internal — whether an
    // account is closed is not the app's business to render.
    expect(JSON.stringify(me)).not.toContain("isActive");
    expect(JSON.stringify(me)).not.toContain("passwordHash");
  });
});

describe("toMeCoupon", () => {
  const coupon: CustomerCoupon = {
    id: "cpn-0001",
    customerEmail: "eda@example.com",
    code: "SD-ABCDEF",
    title: "Ücretsiz içecek",
    kind: "fixed",
    value: 28000,
    minSubtotalMinor: 0,
    source: "loyalty",
    expiresAt: "",
    redeemedAt: "",
    redeemedOrderNo: 0,
    isActive: true,
    createdAt: "2026-08-01T00:00:00.000Z",
    updatedAt: "2026-08-01T00:00:00.000Z",
  };

  it("maps to the §5 shape with nulls for empty dates", () => {
    expect(toMeCoupon(coupon)).toEqual({
      id: "cpn-0001",
      code: "SD-ABCDEF",
      title: "Ücretsiz içecek",
      body: "280 ₺ indirim",
      kind: "fixed",
      value: 28000,
      minSpendMinor: 0,
      expiresAt: null,
      usedAt: null,
    });
    expect(
      toMeCoupon({
        ...coupon,
        expiresAt: "2026-11-01T00:00:00.000Z",
        redeemedAt: "2026-09-01T00:00:00.000Z",
      }),
    ).toMatchObject({
      expiresAt: "2026-11-01T00:00:00.000Z",
      usedAt: "2026-09-01T00:00:00.000Z",
    });
  });

  it("body describes pct coupons with their minimum", () => {
    expect(
      couponBody({ kind: "pct", value: 15, minSubtotalMinor: 20000 }),
    ).toBe("%15 indirim · 200 ₺ ve üzeri");
    expect(
      couponBody({ kind: "fixed", value: 2550, minSubtotalMinor: 0 }),
    ).toBe("25,50 ₺ indirim");
  });
});

describe("mePatchSchema", () => {
  it("accepts a partial patch and rejects an empty or unknown one", () => {
    expect(mePatchSchema.safeParse({ name: "Eda" }).success).toBe(true);
    expect(mePatchSchema.safeParse({ usual: null }).success).toBe(true);
    expect(
      mePatchSchema.safeParse({
        usual: { menuItemId: "mnu-0007", size: "L", options: {} },
      }).success,
    ).toBe(true);
    expect(mePatchSchema.safeParse({}).success).toBe(false);
    expect(mePatchSchema.safeParse({ email: "x@y.z" }).success).toBe(false);
    expect(mePatchSchema.safeParse({ birthday: "02.03.1994" }).success).toBe(
      false,
    );
    expect(mePatchSchema.safeParse({ birthday: "" }).success).toBe(true);
    expect(
      mePatchSchema.safeParse({ usual: { menuItemId: "x", size: "XL" } })
        .success,
    ).toBe(false);
  });
});
