import { describe, expect, it } from "vitest";

import { TABLES } from "@/lib/db";
import {
  ANON_SWEEPS,
  anonymizedEmail,
  IN_PROGRESS_ORDER_STATUSES,
  redactedPayload,
} from "@/lib/mobile/me";

/**
 * `DELETE /me` frees the member's e-mail so the address can register again.
 * Everything keyed on that address must therefore stop pointing at it, or the
 * next person to register it inherits the previous member's data.
 */
describe("account deletion sweeps", () => {
  it("rewrites the e-mail on orders - the row is kept, the address is not", () => {
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
    expect(
      ANON_SWEEPS.find((s) => s.table === TABLES.orders)?.caseInsensitive,
    ).toBe(true);
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
      // Every app order writes the buyer's address as the actor of its stock
      // moves, so /admin/stok-hareketleri kept naming a closed account.
      `${TABLES.stockMoves}.actor`,
      // The bulletin list held the address, the name and the consent evidence
      // of a member who is gone.
      `${TABLES.newsletterSubscribers}.email`,
      // Till QR tokens kept the address (and an unexpired one still scanned)
      // until an unrelated till scan happened to purge them.
      `${TABLES.counterTokens}.customerEmail`,
      // Milestone gifts are read back by address in /me and the inbox; the
      // next holder of the address was told about the closed account's gift.
      `${TABLES.customerMilestoneRewards}.customerEmail`,
      // fA'L reports keep the reported words, not the reporter.
      `${TABLES.falReports}.customerEmail`,
      `${TABLES.featureConsents}.customerEmail`,
      `${TABLES.falReadings}.customerEmail`,
      // A barista grant would pass to the next holder of the address.
      `${TABLES.staffMembers}.email`,
      // "Garson çağır" (6 Kas 2026): the call stays, the address goes.
      `${TABLES.tableCalls}.customerEmail`,
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

  it("matches the stock-move actor case-insensitively too", () => {
    const moves = ANON_SWEEPS.find((s) => s.table === TABLES.stockMoves)!;
    expect(moves.caseInsensitive).toBe(true);
    expect(moves.patch(anonymizedEmail("cst-3"))).toEqual({
      actor: "deleted-cst-3@anon.local",
    });
  });
});

describe("what a closed account leaves behind", () => {
  it("deletes the newsletter row rather than anonymising it", () => {
    // An anonymised subscription is a subscription nobody owns; the row has
    // no fiscal purpose, so it goes.
    const news = ANON_SWEEPS.find(
      (s) => s.table === TABLES.newsletterSubscribers,
    )!;
    expect(news.op).toBe("delete");
    expect(news.caseInsensitive).toBe(true);
  });

  it("does not hand fA'L's consent or daily count to the address's next owner (karar 177)", () => {
    const consent = ANON_SWEEPS.find((s) => s.table === TABLES.featureConsents)!;
    const patched = consent.patch("deleted-cst-1@anon.local");
    expect(patched.customerEmail).toBe("deleted-cst-1@anon.local");
    // Closing the account is a withdrawal: the proof's three years start now.
    expect(typeof patched.revokedAt).toBe("string");
    expect(String(patched.revokedAt)).not.toBe("");
    const readings = ANON_SWEEPS.find((s) => s.table === TABLES.falReadings)!;
    expect(readings.patch("deleted-cst-1@anon.local")).toEqual({ customerEmail: "deleted-cst-1@anon.local" });
  });

  it("keeps every other sweep an anonymising update", () => {
    for (const sweep of ANON_SWEEPS) {
      if (sweep.table === TABLES.newsletterSubscribers) continue;
      // A barista grant is a permission, not a book entry: anonymised, it
      // would be a till nobody holds; the audit log keeps the history.
      if (sweep.table === TABLES.staffMembers) continue;
      expect(sweep.op ?? "update", sweep.table).toBe("update");
      expect(
        Object.keys(sweep.patch("deleted-cst-1@anon.local")).length,
      ).toBeGreaterThan(0);
    }
  });

  it("deletes the barista grant so the next holder of the address has no till", () => {
    const staff = ANON_SWEEPS.find((s) => s.table === TABLES.staffMembers)!;
    expect(staff.op).toBe("delete");
    expect(staff.caseInsensitive).toBe(true);
  });

  it("empties the provider payload but keeps the row", () => {
    // payment_transactions.raw is the POS callback verbatim - buyer name,
    // address, masked card. Reconciliation needs provider/ref/status/amount,
    // none of which this touches.
    const redacted = redactedPayload("2026-09-05T12:00:00.000Z");
    expect(redacted).toEqual({
      redacted: true,
      redactedAt: "2026-09-05T12:00:00.000Z",
    });
  });
});

/**
 * Üyelik Sözleşmesi §14: the closure waits for an order in flight, and the
 * `hesap-silme` document repeats it. DELETE /me answers 409 instead of
 * anonymising the buyer of an order the kitchen is about to hand over.
 */
describe("orders that block a closure", () => {
  it("covers every status an order can still be running in", () => {
    expect([...IN_PROGRESS_ORDER_STATUSES].sort()).toEqual([
      "paid",
      "pending_payment",
      "preparing",
      "shipped",
    ]);
  });

  it("lets a finished or cancelled order through", () => {
    for (const status of ["completed", "cancelled", "refunded"] as const) {
      expect(IN_PROGRESS_ORDER_STATUSES).not.toContain(status);
    }
  });
});
