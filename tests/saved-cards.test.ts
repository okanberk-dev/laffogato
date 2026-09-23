import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { toMe } from "@/lib/mobile/me-mapper";
import type { PublicCustomer } from "@/lib/customer/store";

const read = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

/**
 * Saved cards are a KEY, not a card.
 *
 * The PAN is typed on iyzico's own hosted form and never reaches this
 * codebase - what we store is an opaque identifier that is meaningless
 * without our merchant credentials. These tests pin the two properties that
 * make that arrangement safe: the key never leaves the server, and a closed
 * account keeps none of it.
 */
describe("saved cards", () => {
  it("never puts the card key in the app's /me payload", () => {
    const customer = {
      id: "cst-1",
      email: "eda@example.com",
      name: "Eda",
      phone: "",
      birthday: "",
      addresses: [],
      wishlist: [],
      notificationPrefs: {
        orderUpdates: true,
        marketing: false,
        newsletter: false,
      },
      emailVerified: true,
      isActive: true,
      createdAt: "2026-05-01T09:00:00.000Z",
      inviteCode: "",
      usual: null,
    } satisfies PublicCustomer;
    const me = toMe(
      customer,
      {} as Parameters<typeof toMe>[1],
      {} as Parameters<typeof toMe>[2],
    );
    expect(JSON.stringify(me)).not.toContain("cardUserKey");
  });

  it("is not part of the public customer shape at all", () => {
    // Not merely unmapped - absent from the type the API layer passes around,
    // so it cannot be added to a response by accident.
    const store = read("src/lib/customer/store.ts");
    const shape = store.slice(
      store.indexOf("export interface PublicCustomer"),
      store.indexOf("}", store.indexOf("export interface PublicCustomer")),
    );
    expect(shape).not.toContain("cardUserKey");
  });

  it("is cleared when the account is closed", () => {
    expect(read("src/lib/mobile/me.ts")).toMatch(/cardUserKey:\s*""/);
  });

  it("stores no card data of its own - only the provider's key", () => {
    // Column names only - comments are prose and may well say the words.
    // If any of these ever become a COLUMN, the design has drifted from
    // "the provider holds the card" to "we hold the card".
    const raw = read("db/schema.sql");
    const columns = raw
      .split("\n")
      .filter((line) => !line.trimStart().startsWith("--"))
      .join("\n")
      .toLowerCase();
    for (const forbidden of [
      "cardnumber",
      "cardpan",
      "cvv",
      "cvc",
      "expirymonth",
    ]) {
      expect(columns).not.toContain(forbidden);
    }
    expect(raw).toContain('"cardUserKey"');
  });

  it("no code path accepts card data - the POS's hosted page is the only place it is typed", () => {
    // Operator (23 Eyl 2026): "biz kart bilgilerini saklamıyoruz". PayNkolay
    // also offers endpoints that take the card number server-side
    // (CardStorageCardRegister and friends); calling one would put the PAN
    // through this server and into PCI scope. Comments may name them, code
    // may not.
    const sources = [
      "src/lib/payment/paynkolay.ts",
      "src/lib/payment/provider.ts",
      "src/app/odeme/actions.ts",
      "src/app/odeme/donus/route.ts",
      "src/app/odeme/paynkolay/route.ts",
      "src/lib/mobile/orders.ts",
    ].map((path) =>
      read(path)
        .split("\n")
        .filter((line) => !/^\s*(\/\/|\*|\/\*)/.test(line))
        .join("\n"),
    );
    for (const code of sources) {
      expect(code).not.toMatch(/CardStorage/);
      expect(code).not.toMatch(
        /\b(cardNumber|cvv|cvc|expiryMonth|expireMonth)\b/i,
      );
    }
    // And the one card-storage switch the hosted form has stays off in v1
    // (docs/API-MOBILE.md §15): an empty customerKey saves nothing.
    expect(read("src/lib/payment/paynkolay.ts")).toMatch(
      /const customerKey = "";/,
    );
  });

  it("an absent key never erases a stored one", () => {
    // The buyer not ticking "kartımı kaydet" must not lose the cards they
    // saved on an earlier order.
    const store = read("src/lib/customer/store.ts");
    const fn = store.slice(
      store.indexOf("export async function rememberCardUserKey"),
    );
    expect(fn).toMatch(/if \(!key \|\| !needle\) return;/);
  });
});
