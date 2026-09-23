import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { planCustomerLink } from "@/lib/customer/supabase-link-plan";

/**
 * One `customers` read per authenticated mobile request, not two.
 *
 * `requireMobileCustomer` runs on all 18 bearer routes and funnels into
 * `reconcile()`. It read the row (`fetchRaw`), planned against it, and then
 * - even when the plan was "nothing to do", which is the steady state -
 * issued the identical `select * from customers where email = $1` again via
 * `getCustomerByEmail`. The pool is `max: 1` (src/lib/db/index.ts), so the
 * two could not even overlap: the app's cold-open round of /me, /orders,
 * /notifications and /coupons paid four serialised extra queries.
 */

const bridge = readFileSync(
  join(process.cwd(), "src/lib/customer/supabase-bridge.ts"),
  "utf8",
);

const reconcile = bridge.slice(
  bridge.indexOf("async function reconcile("),
  bridge.indexOf("export interface LinkByPasswordInput"),
);

function user(over: Record<string, unknown> = {}) {
  return {
    id: "sup-1",
    email: "eda@example.com",
    email_confirmed_at: "2026-09-01T10:00:00.000Z",
    user_metadata: {},
    ...over,
  } as Parameters<typeof planCustomerLink>[1];
}

function row(over: Record<string, unknown> = {}) {
  return {
    id: "cst-1",
    email: "eda@example.com",
    name: "Eda",
    phone: "+905551112233",
    isActive: true,
    emailVerified: true,
    verifiedAt: "2026-09-01T10:00:00.000Z",
    supabaseUserId: "sup-1",
    ...over,
  } as Parameters<typeof planCustomerLink>[0];
}

describe("the steady state this optimisation depends on", () => {
  it("is 'none' for a linked, confirmed, active member", () => {
    const plan = planCustomerLink(
      row(),
      user(),
      "2026-09-16T08:00:00.000Z",
      undefined,
      false,
    );
    expect(plan.action).toBe("none");
  });

  it("is still a write when anything actually differs", () => {
    const plan = planCustomerLink(
      row({ supabaseUserId: "" }),
      user(),
      "2026-09-16T08:00:00.000Z",
      undefined,
      false,
    );
    expect(plan.action).toBe("update");
  });
});

describe("reconcile()", () => {
  it("returns the row it already read when there is nothing to write", () => {
    expect(reconcile).toContain('if (plan.action === "none" && existing)');
    expect(reconcile).toContain("toPublicCustomer(existing)");
  });

  it("takes the no-write shortcut before the insert/update branches", () => {
    expect(
      reconcile.indexOf('plan.action === "none" && existing'),
    ).toBeLessThan(reconcile.indexOf('plan.action === "create"'));
  });

  it("still reads back after a write, where the row really changed", () => {
    expect(reconcile).toContain("await getCustomerByEmail(email)");
    expect(reconcile.match(/getCustomerByEmail\(/g)).toHaveLength(1);
  });

  it("keeps the disabled and unconfirmed refusals ahead of the shortcut", () => {
    // The shortcut skips the read-back's own `isActive` guard, so those two
    // answers have to have been given already.
    for (const guard of ['"account_disabled"', '"email_unconfirmed"']) {
      expect(reconcile.indexOf(guard)).toBeLessThan(
        reconcile.indexOf('plan.action === "none" && existing'),
      );
    }
  });
});
