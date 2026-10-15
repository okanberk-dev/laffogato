import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { toMe } from "@/lib/mobile/me-mapper";
import type { PublicCustomer } from "@/lib/customer/store";

const read = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

/**
 * No card is stored - anywhere.
 *
 * The card passes through the payment page once, on its way to the POS
 * (docs/PAYNKOLAY.md §15), and is kept by nobody: not the database, not the
 * logs, not the POS (card storage is off, `customerKey` is empty). The only
 * card-shaped thing the schema knows is `cardUserKey`, an opaque provider key
 * that is never filled while card storage is off. These tests pin that the
 * key never leaves the server, a closed account keeps none of it, and the
 * card itself has exactly one path through the code.
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

  /**
   * Operator, 23 Eyl 2026: "biz kart bilgilerini saklamıyoruz". Operator,
   * 15 Eki 2026: the card is typed on the site's own payment page and the
   * customer goes straight to the bank's 3D screen (docs/PAYNKOLAY.md §15) -
   * "kart bilgilerini saklamıyoruz onu bil". So the card now passes through
   * this server, and these tests pin the only shape that is allowed: in at
   * the payment page, out to the POS in the same request, nowhere else.
   */
  const CARD_PATH = [
    "src/lib/payment/paynkolay-card.ts",
    "src/lib/payment/paynkolay.ts",
    "src/lib/payment/paynkolay-page.ts",
    "src/app/odeme/paynkolay/route.ts",
  ];
  // The real form field names (cardCvv, cardExpiry …) and the module's own
  // identifiers, not just four English words: an earlier version of this
  // list missed `form.get("cardCvv")` because of its word boundaries.
  const CARD_WORDS =
    /cardNumber|cardCvv|cardExpiry|cardHolderName|\bcvv\b|\bcvc\b|expiryMonth|expireMonth|CARD_FORM_FIELDS|parseCardForm|CardInput|paynkolay-card/i;
  const codeOnly = (text: string) =>
    text
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .split("\n")
      .filter((line) => !/^\s*\/\//.test(line))
      .join("\n");

  function sourceFiles(dir: string): string[] {
    const out: string[] = [];
    for (const entry of readdirSync(join(process.cwd(), dir), {
      withFileTypes: true,
    })) {
      const rel = join(dir, entry.name);
      if (entry.isDirectory()) out.push(...sourceFiles(rel));
      else if (/\.(ts|tsx)$/.test(entry.name)) out.push(rel);
    }
    return out;
  }

  it("card fields appear only on the payment page's own path", () => {
    // Prose and generated SQL say "CVV" as words: the legal texts, and the
    // bundled migrations (their columns are pinned by the schema test above).
    const PROSE = ["src/lib/legal/content.ts", "src/lib/db/schema-sql.ts"];
    const offenders = sourceFiles("src").filter(
      (file) =>
        !CARD_PATH.includes(file) &&
        !PROSE.includes(file) &&
        CARD_WORDS.test(codeOnly(read(file))),
    );
    expect(offenders).toEqual([]);
  });

  it("the card path cannot persist a card - no database, no store", () => {
    // Directly. route.ts does import rate-limit, which writes to Postgres,
    // but hands it only the client address and the order reference.
    for (const file of CARD_PATH) {
      const code = codeOnly(read(file));
      expect(code, file).not.toMatch(/from "@\/lib\/db/);
      expect(code, file).not.toMatch(/from "@\/lib\/[\w/-]*store"/);
      expect(code, file).not.toMatch(/from "node:fs"|from "fs"/);
    }
  });

  /**
   * The identifiers a console call in the card path may print. Anything else
   * - an aliased card, the form, the request - fails here, whatever it is
   * called. String and template text is ignored; `${...}` is not.
   */
  const LOGGABLE = new Set([
    "err",
    "instanceof",
    "Error",
    "message",
    "orderRef",
    "orderId",
    "result",
    "code",
    "post",
    "fields",
    "clientRefCode",
  ]);
  function identifiersIn(args: string): string[] {
    const expressions: string[] = [];
    const withoutTemplates = args.replace(/`(?:[^`\\]|\\.)*`/g, (t) => {
      for (const m of t.matchAll(/\$\{([^}]*)\}/g)) expressions.push(m[1]);
      return " ";
    });
    const withoutStrings = withoutTemplates.replace(
      /"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'/g,
      " ",
    );
    return [
      ...`${withoutStrings} ${expressions.join(" ")}`.matchAll(
        /[A-Za-z_$][\w$]*/g,
      ),
    ].map((m) => m[0]);
  }

  it("the card path never logs the card", () => {
    for (const file of CARD_PATH) {
      const code = codeOnly(read(file));
      for (const call of code.matchAll(/console\.\w+\(([\s\S]*?)\);/g)) {
        for (const name of identifiersIn(call[1])) {
          expect(LOGGABLE.has(name), `${file}: console prints ${name}`).toBe(
            true,
          );
        }
      }
    }
  });

  it("the POS's card-storage endpoints are never called", () => {
    // PayNkolay's CardStorageCardRegister and friends keep the card at the
    // POS against a key; the operator's decision is that no card is kept
    // anywhere. Comments may name them, code may not.
    for (const file of sourceFiles("src")) {
      expect(codeOnly(read(file)), file).not.toMatch(/\bCardStorage/);
    }
    // And the one card-storage switch the payment form has stays off
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
