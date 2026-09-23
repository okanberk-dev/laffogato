import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it, vi } from "vitest";

const customerOrdersByEmail = vi.fn(async () => [{ id: "ord-0001" }]);
vi.mock("@/lib/admin/store", () => ({ customerOrdersByEmail }));

const { memberOrders } = await import("@/lib/customer/member-orders");

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    return statSync(path).isDirectory() ? files(path) : [path];
  });
}

/**
 * Registration signs the visitor in before the address is verified, and
 * orders match by e-mail alone - so registering the address on an order an
 * admin typed in by hand showed that stranger's name, phone and address.
 */
describe("a member's order history", () => {
  it("is empty until the e-mail is verified", async () => {
    expect(
      await memberOrders({ email: "a@b.co", emailVerified: false }),
    ).toEqual([]);
    expect(customerOrdersByEmail).not.toHaveBeenCalled();
  });

  it("is the e-mail's orders once it is", async () => {
    expect(
      await memberOrders({ email: "a@b.co", emailVerified: true }),
    ).toEqual([{ id: "ord-0001" }]);
  });

  it("is never read around the gate by an /uye page", () => {
    const offenders = files("src/app/uye").filter((f) =>
      readFileSync(f, "utf8").includes("customerOrdersByEmail("),
    );
    expect(offenders).toEqual([]);
  });
});
