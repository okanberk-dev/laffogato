import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

/**
 * The consent ledger (`customer_consents`, COMP-4.3a) in CI: the pure diff,
 * the row it writes, and a guard that every writer of a member's commercial
 * preferences appends to it. The same writers run against a real Postgres in
 * tests/db-integration-consent-ledger.test.ts.
 */

const inserted: unknown[] = [];
let failInsert = false;
vi.mock("@/lib/db", () => ({
  TABLES: { customerConsents: "customer_consents" },
  getDb: () => ({
    from: (table: string) => ({
      insert: async (rows: unknown[]) => {
        if (failInsert) return { data: null, error: { message: "down" } };
        inserted.push({ table, rows });
        return { data: null, error: null };
      },
    }),
  }),
}));
vi.mock("@/lib/admin/rate-limit", () => ({
  clientIp: async () => "10.0.0.9",
}));
vi.mock("next/headers", () => ({
  headers: async () => new Headers({ "user-agent": "Mozilla/5.0 Test" }),
}));

const {
  appendConsentChanges,
  COMMERCIAL_CONSENT_TEXT_VERSION,
  consentChanges,
} = await import("@/lib/customer/consent-ledger");

afterEach(() => {
  inserted.length = 0;
  failInsert = false;
  vi.restoreAllMocks();
});

describe("consentChanges", () => {
  it("lists only the purposes that flipped, ignoring order updates", () => {
    expect(
      consentChanges(
        { marketing: true, newsletter: false },
        { marketing: true, newsletter: true },
      ),
    ).toEqual([{ purpose: "newsletter", granted: true }]);
    expect(
      consentChanges({ marketing: true }, { marketing: false, newsletter: false }),
    ).toEqual([{ purpose: "marketing", granted: false }]);
  });

  it("treats a missing state as everything off", () => {
    expect(consentChanges(null, { marketing: true, newsletter: true })).toEqual(
      [
        { purpose: "marketing", granted: true },
        { purpose: "newsletter", granted: true },
      ],
    );
    expect(consentChanges(null, { marketing: false })).toEqual([]);
  });
});

describe("appendConsentChanges", () => {
  it("writes one row per change: address, purpose, source, IP, text version", async () => {
    const n = await appendConsentChanges(
      " Uye@Example.com ",
      { marketing: false, newsletter: true },
      { marketing: true, newsletter: false },
      { source: "site-account", now: new Date("2026-09-23T10:00:00.000Z") },
    );
    expect(n).toBe(2);
    expect(inserted).toEqual([
      {
        table: "customer_consents",
        rows: [
          {
            customerEmail: "uye@example.com",
            purpose: "marketing",
            granted: true,
            source: "site-account",
            ip: "10.0.0.9",
            userAgent: "Mozilla/5.0 Test",
            textVersion: COMMERCIAL_CONSENT_TEXT_VERSION,
            createdAt: "2026-09-23T10:00:00.000Z",
          },
          {
            customerEmail: "uye@example.com",
            purpose: "newsletter",
            granted: false,
            source: "site-account",
            ip: "10.0.0.9",
            userAgent: "Mozilla/5.0 Test",
            textVersion: "",
            createdAt: "2026-09-23T10:00:00.000Z",
          },
        ],
      },
    ]);
  });

  it("uses the given IP, even an empty one, over the request's", async () => {
    await appendConsentChanges("a@b.co", null, { marketing: true }, {
      source: "admin",
      ip: "",
    });
    // Not the member's act: neither the IP nor the browser is theirs.
    expect(
      (inserted[0] as { rows: { ip: string; userAgent: string }[] }).rows[0],
    ).toMatchObject({ ip: "", userAgent: "" });
  });

  it("writes nothing when nothing changed", async () => {
    expect(
      await appendConsentChanges(
        "a@b.co",
        { marketing: true },
        { marketing: true },
        { source: "app-account" },
      ),
    ).toBe(0);
    expect(inserted).toEqual([]);
  });

  it("never throws: a withdrawal must not fail on its history; logs the address masked", async () => {
    failInsert = true;
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(
      await appendConsentChanges(
        "uye@example.com",
        { marketing: true },
        { marketing: false },
        { source: "unsubscribe-link" },
      ),
    ).toBe(0);
    const line = String(log.mock.calls[0]?.[0] ?? "");
    expect(line).toContain("unsubscribe-link");
    expect(line).not.toContain("uye@example.com");
  });
});

describe("every writer of a member's commercial preferences appends", () => {
  const read = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

  const WRITERS: Record<string, string[]> = {
    "src/lib/customer/store.ts": ["site-signup", "admin"],
    "src/lib/customer/unsubscribe.ts": [
      "unsubscribe-link",
      "newsletter-unsubscribe",
    ],
    "src/lib/customer/supabase-bridge.ts": ["app-signup"],
    "src/lib/mobile/me.ts": ["app-account", "account-deletion"],
  };

  for (const [file, sources] of Object.entries(WRITERS)) {
    it(`${file} records ${sources.join(", ")}`, () => {
      const src = read(file);
      expect(src).toContain("appendConsentChanges(");
      for (const source of sources) {
        expect(src).toContain(`source: "${source}"`);
      }
    });
  }

  it("the account page's default source is the site's", () => {
    expect(read("src/lib/customer/store.ts")).toContain(
      'consent: { source: ConsentSource; ip?: string } = { source: "site-account" }',
    );
  });

  it("no other file writes those fields on the customers table", () => {
    const files: string[] = [];
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        const full = join(dir, name);
        if (statSync(full).isDirectory()) walk(full);
        else if (/\.(ts|tsx)$/.test(name)) files.push(full);
      }
    };
    walk(join(process.cwd(), "src"));
    const writers = files
      .filter((f) => {
        const src = readFileSync(f, "utf8");
        return (
          src.includes("from(TABLES.customers)") &&
          /(notificationPrefs|marketingConsentAt)\s*:/.test(src)
        );
      })
      .map((f) => f.slice(process.cwd().length + 1))
      .sort();
    // A new file here writes consent without a ledger row: add it to
    // WRITERS above with its own source, and call appendConsentChanges.
    for (const f of writers) {
      expect(Object.keys(WRITERS), f).toContain(f);
    }
  });
});
