import { describe, expect, it } from "vitest";

import { TABLES } from "@/lib/db";
import { ANON_SWEEPS, anonymizedEmail } from "@/lib/mobile/me";

/**
 * `DELETE /me` frees the member's e-mail so the address can register again.
 * Everything keyed on that address must therefore stop pointing at it, or the
 * next person to register it inherits the previous member's data.
 */
describe("account deletion sweeps", () => {
  it("rewrites the e-mail on orders — the row is kept, the address is not", () => {
    const orders = ANON_SWEEPS.find((s) => s.table === TABLES.orders);
    expect(orders).toBeDefined();
    expect(orders!.column).toBe("customerEmail");
    expect(orders!.patch("deleted-cst-1@anon.local")).toEqual({
      customerEmail: "deleted-cst-1@anon.local",
    });
  });

  it("matches orders case-insensitively, the way they are read back", () => {
    // customerOrdersByEmail() prefilters with ilike because checkout stores
    // whatever case it captured. An eq sweep would miss "Ayse@…".
    expect(ANON_SWEEPS.find((s) => s.table === TABLES.orders)?.caseInsensitive).toBe(
      true,
    );
  });

  it("covers every table that stores the member's address", () => {
    const covered = ANON_SWEEPS.map((s) => `${s.table}.${s.column}`);
    for (const target of [
      `${TABLES.orders}.customerEmail`,
      `${TABLES.loyaltyStamps}.customerEmail`,
      `${TABLES.customerCoupons}.customerEmail`,
      `${TABLES.karaokeReservations}.customerEmail`,
      `${TABLES.invites}.inviteeEmail`,
      `${TABLES.invites}.inviterEmail`,
    ]) {
      expect(covered, target).toContain(target);
    }
  });

  it("closes the coupons and drops the karaoke name while it is there", () => {
    const anon = anonymizedEmail("cst-9");
    const coupons = ANON_SWEEPS.find(
      (s) => s.table === TABLES.customerCoupons,
    )!;
    expect(coupons.patch(anon)).toMatchObject({ isActive: false });
    const karaoke = ANON_SWEEPS.find(
      (s) => s.table === TABLES.karaokeReservations,
    )!;
    expect(karaoke.patch(anon)).toMatchObject({ customerName: "" });
  });

  it("gives each closed account its own placeholder, so orders stay groupable", () => {
    expect(anonymizedEmail("cst-1")).toBe("deleted-cst-1@anon.local");
    expect(anonymizedEmail("cst-1")).not.toBe(anonymizedEmail("cst-2"));
  });
});
