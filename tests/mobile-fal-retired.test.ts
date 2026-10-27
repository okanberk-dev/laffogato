import { existsSync, readFileSync } from "node:fs";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { MIGRATION_NAMES, SCHEMA_SQL } from "@/lib/db/schema-sql";
import { DEFAULT_MOBILE_APP_CONFIG } from "@/lib/mobile/app-config";
import {
  FAL_FEATURE,
  falAiEnabled,
  falTransferSafeguardInForce,
} from "@/lib/mobile/fal-core";

/**
 * 27 Oct 2026: App Review refused the iOS app under Guideline 4.3(b) and
 * fA'L, with its AI reading, left the app (lafmobil karar 330; Kahve Modu
 * took its place, the photo never leaves the device). The site retires the
 * AI path without breaking v1 (docs/API-MOBILE.md §20):
 *
 *   - the switch is off in code, not by an environment value;
 *   - the bootstrap says `fal.ai` false and GET /fal/consent `enabled` false;
 *   - POST /fal answers 503 `fal_unavailable` and touches nothing;
 *   - the one function that sent the photo sends nothing;
 *   - the R12 consents still standing are stamped withdrawn, not deleted.
 *
 * Everything is tried in the strongest case the old switch knew: the
 * switch, the provider and its key set, and the standard contract's record
 * filed.
 */

vi.mock("@/lib/mobile/fal-safeguard", () => ({
  FAL_TRANSFER_SAFEGUARD: {
    signedOn: "2026-10-01",
    notifiedOn: "2026-10-02",
    receipt: "TEST-RECEIPT",
  },
}));
const requireMobileCustomer = vi.fn();
vi.mock("@/lib/mobile/auth", () => ({ requireMobileCustomer }));
vi.mock("@/lib/db", () => ({
  getDb: () => {
    throw new Error("no database: the retired paths must not need one");
  },
  TABLES: {
    falReadings: "fal_readings",
    featureConsents: "feature_consents",
    falReports: "fal_reports",
  },
}));
// A member who once said yes: the answer must not depend on it.
vi.mock("@/lib/mobile/fal", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/mobile/fal")>()),
  hasFalConsent: async () => true,
}));
vi.mock("@/lib/admin/store", () => ({
  getSettings: async () => ({
    phone: "+90 536 429 09 19",
    email: "info@nextgenlab.com.tr",
    address: "",
    weeklyHours: Object.fromEntries(
      ["mon", "tue", "wed", "thu", "fri", "sat", "sun"].map((d) => [
        d,
        { open: "09:00", close: "02:00", closed: false },
      ]),
    ),
    courierFeeMinor: 5500,
    isShopOpen: true,
    mobileApp: DEFAULT_MOBILE_APP_CONFIG,
  }),
}));

const { readCupWithAI } = await import("@/lib/mobile/fal");
const { getBootstrap } = await import("@/lib/mobile/menu");
const consentRoute = await import("@/app/api/mobile/v1/fal/consent/route");
const falRoute = await import("@/app/api/mobile/v1/fal/route");

/** Everything the environment could ever do for the old switch. */
const ON = {
  FAL_AI_ENABLED: "true",
  FAL_AI_PROVIDER: "anthropic",
  ANTHROPIC_API_KEY: "test-key-not-real",
  OPENAI_API_KEY: "test-openai-key-not-real",
};
/** A JPEG's first bytes: a photo the old route would have read. */
const PHOTO = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]).toString(
  "base64",
);
const CONTEXT = { tier: "PEARL", visits: "regular", usual: "" } as const;

describe("the AI reading is off in code (27 Oct 2026)", () => {
  beforeEach(() => {
    for (const [name, value] of Object.entries(ON)) vi.stubEnv(name, value);
    requireMobileCustomer.mockResolvedValue({
      ok: true,
      customer: { email: "eda@ornek.com", emailVerified: true },
    });
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("the switch is false with the switch, the key and a filed contract record", () => {
    // The record is in force here, so nothing else is holding it off.
    expect(falTransferSafeguardInForce()).toBe(true);
    expect(falAiEnabled()).toBe(false);
  });

  it("the bootstrap says fal.ai false", async () => {
    expect((await getBootstrap()).app.fal).toEqual({ ai: false });
  });

  it("GET /fal/consent says enabled false, even to a member who said yes", async () => {
    const res = await consentRoute.GET(
      new Request("https://laffogato.net/api/mobile/v1/fal/consent"),
    );
    expect(await res.json()).toMatchObject({ enabled: false, granted: true });
  });

  it("POST /fal is 503 fal_unavailable, needs no database and calls no one", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const res = await falRoute.POST(
      new Request("https://laffogato.net/api/mobile/v1/fal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: PHOTO }),
      }),
    );
    expect(res.status).toBe(503);
    expect((await res.json()).error).toBe("fal_unavailable");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("readCupWithAI sends nothing, even when called directly", async () => {
    const fetcher = vi.fn() as unknown as typeof fetch;
    expect(await readCupWithAI(PHOTO, CONTEXT, ON, fetcher)).toEqual({
      ok: false,
      reason: "failed",
    });
    expect(fetcher).not.toHaveBeenCalled();
  });
});

describe("the R12 consents are closed, not deleted", () => {
  const NAME = "20261027120000_retire_fal_ai_consents.sql";
  const file = readFileSync(`db/migrations/${NAME}`, "utf8");
  /** The statements alone, without the comments that explain them. */
  const sql = file
    .split("\n")
    .filter((line) => !line.trim().startsWith("--"))
    .join("\n");

  it("stamps revokedAt with the retirement day, in the text form a withdrawal writes", () => {
    const stamp = new Date("2026-10-27T00:00:00Z").toISOString();
    expect(stamp).toBe("2026-10-27T00:00:00.000Z");
    expect(sql).toContain("update public.feature_consents");
    expect(sql).toContain(`set "revokedAt" = '${stamp}'`);
  });

  it("only for the fA'L feature, and only where the consent still stands", () => {
    expect(FAL_FEATURE).toBe("fal-ai");
    expect(sql).toContain(`where feature = '${FAL_FEATURE}'`);
    expect(sql).toContain(`("revokedAt" is null or "revokedAt" = '')`);
  });

  it("runs once: a bundle replay must not stamp a later row with this day", () => {
    expect(sql).toContain(`where applied.name = '${NAME}'`);
    expect(sql).toMatch(
      /and not exists \(\s*select 1\s+from public\._migrations/,
    );
  });

  it("deletes nothing and leaves the _migrations record to the runner", () => {
    expect(sql).not.toMatch(/\bdelete\b|\btruncate\b|\bdrop\b/i);
    expect(sql).not.toMatch(/insert\s+into\s+public\._migrations/i);
  });

  it("is in the bundle the app applies itself (npm run db:bundle)", () => {
    expect(MIGRATION_NAMES).toContain(NAME);
    expect(SCHEMA_SQL).toContain(`-- ${NAME}`);
    expect(SCHEMA_SQL).toContain(
      `insert into public._migrations (name) values ('${NAME}')`,
    );
  });
});

describe("the panel", () => {
  it("drops fA'L bildirimleri from the nav and keeps the page for direct links", () => {
    const layout = readFileSync("src/app/admin/layout.tsx", "utf8");
    expect(layout).not.toContain('href: "/admin/mobil/fal-bildirimleri"');
    expect(layout).not.toContain('label: "fA\'L bildirimleri"');
    const page = "src/app/admin/mobil/fal-bildirimleri/page.tsx";
    expect(existsSync(page)).toBe(true);
    const source = readFileSync(page, "utf8");
    expect(source).toContain('await requireRole("mobileApp")');
    expect(source).toContain("menüde yer almaz");
  });
});
