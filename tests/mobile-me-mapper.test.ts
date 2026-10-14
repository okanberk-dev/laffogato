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
import { inlineAddressSchema } from "@/lib/mobile/order-schema";

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
  tierLabel: "RUBY",
  ordersLast365: 41,
  badges: [],
};

const invite: InviteSummary = {
  code: "LAF-EDA24",
  invited: 1,
  joined: 1,
  earned: 1,
  people: [
    {
      name: "Selin K.",
      status: "joined",
      at: "2026-06-01T00:00Z",
      rewarded: true,
    },
  ],
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
      neighbourhood: "Postane Mah.",
    });
  });

  // S8-02: the mahalle in its own key, preferred on read.
  it("round-trips a mahalle typed without 'Mah.'", () => {
    const input = {
      title: "Ev",
      fullName: "Eda Mancuso",
      phone: "+90 555 000 00 00",
      city: "İstanbul",
      district: "Tuzla",
      neighbourhood: "Postane",
      line: "Atatürk Cad. No: 28",
      note: "",
      isDefault: false,
    };
    const stored = fromMeAddress(input);
    // The folded line stays complete for the site, the order and the courier.
    expect(stored.line1).toBe("Postane, Atatürk Cad. No: 28");
    expect(stored.neighbourhood).toBe("Postane");
    const back = toMeAddress({ id: "adr-9", ...stored });
    expect(back.neighbourhood).toBe("Postane");
    expect(back.line).toBe("Atatürk Cad. No: 28");
  });

  it("round-trips an empty neighbourhood without splitting the line", () => {
    const stored = fromMeAddress({
      title: "",
      fullName: "Eda Mancuso",
      phone: "05550000000",
      city: "İstanbul",
      district: "",
      neighbourhood: "",
      line: "Aydıntepe Mah., Sahil Yolu 5",
      note: "",
    });
    const back = toMeAddress({ id: "adr-9", ...stored });
    expect(back.neighbourhood).toBe("");
    expect(back.line).toBe("Aydıntepe Mah., Sahil Yolu 5");
  });

  it("keeps the old split for a row without the key", () => {
    expect("neighbourhood" in address).toBe(false);
    expect(toMeAddress(address)).toMatchObject({
      neighbourhood: "Postane Mah.",
      line: "Atatürk Cad. No: 28",
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
    // The same list the site's favourites page renders - one wishlist per
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
    // app could not see the same list. `isActive` stays internal - whether an
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
      cafeOnly: true,
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

  it("says which coupons only a cafe basket can spend (the app reads it)", () => {
    // lafmobil http.ts reads `c.cafeOnly === true` for the "Yalnızca kafe
    // siparişlerinde" label; the server used to omit it, so it was never shown.
    expect(toMeCoupon(coupon).cafeOnly).toBe(true);
    expect(toMeCoupon({ ...coupon, source: "invite" }).cafeOnly).toBe(true);
    expect(toMeCoupon({ ...coupon, source: "welcome" }).cafeOnly).toBe(false);
    expect(toMeCoupon({ ...coupon, source: "manual" }).cafeOnly).toBe(false);
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
    // The shape is not enough: the birthday job looks for a month and a day
    // the calendar has, and a member saved as 13/45 was never greeted.
    expect(mePatchSchema.safeParse({ birthday: "1990-13-45" }).success).toBe(false);
    expect(mePatchSchema.safeParse({ birthday: "1990-02-30" }).success).toBe(false);
    expect(mePatchSchema.safeParse({ birthday: "1992-02-29" }).success).toBe(true);
    expect(mePatchSchema.safeParse({ birthday: "1991-02-29" }).success).toBe(false);
    expect(
      mePatchSchema.safeParse({ usual: { menuItemId: "x", size: "XL" } })
        .success,
    ).toBe(false);
  });
});

describe("phone fields are normalised before validation (W1-04)", () => {
  const addressBody = {
    title: "Ev",
    fullName: "Eda Mancuso",
    city: "İstanbul",
    line: "Atatürk Cad. No: 28",
  };

  it("stores a Turkish mobile in one form, whatever the spelling", () => {
    for (const raw of [
      "0532 123 45 67",
      "+90 (532) 123-45-67",
      "5321234567",
      "905321234567",
    ]) {
      const a = addressInputSchema.safeParse({ ...addressBody, phone: raw });
      expect(a.success && a.data.phone, raw).toBe("+905321234567");
      const p = mePatchSchema.safeParse({ phone: raw });
      expect(p.success && p.data.phone, raw).toBe("+905321234567");
      const o = inlineAddressSchema.safeParse({
        ...addressBody,
        phone: raw,
      });
      expect(o.success && o.data.phone, raw).toBe("+905321234567");
    }
  });

  it("keeps any other number as typed and refuses nothing it used to accept", () => {
    for (const raw of ["0216 123 45 67", "+44 20 7946 0958", "1234567"]) {
      const a = addressInputSchema.safeParse({ ...addressBody, phone: raw });
      expect(a.success && a.data.phone, raw).toBe(raw);
    }
    // Profile phone may still be cleared, and the old floor still holds.
    expect(mePatchSchema.safeParse({ phone: "" }).success).toBe(true);
    expect(
      addressInputSchema.safeParse({ ...addressBody, phone: "12345" }).success,
    ).toBe(false);
  });
});
