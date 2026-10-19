import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  FAL_CONSENT_VERSION,
  FAL_DISCLOSED_PROVIDER,
  FAL_FEATURE,
  falConsentVersionFor,
} from "@/lib/mobile/fal-core";

/**
 * Karar 177, 17 Eki 2026: the R12 recipient changed from OpenAI to
 * Anthropic, so a yes given for one is not a yes for the other. The app asks
 * again when GET /fal/consent says `granted: false` at a version it has not
 * seen declined (lafmobil `src/app/fal.tsx`, `askable`), and the server says
 * so because `hasFalConsent` counts only a row at `FAL_CONSENT_VERSION`.
 * Here over an in-memory `feature_consents` with the real fal.ts and routes.
 */

type Row = {
  customerEmail: string;
  feature: string;
  version: string;
  grantedAt: string;
  revokedAt: string;
};
let rows: Row[] = [];

function matches(row: Row, filters: Record<string, unknown>) {
  return Object.entries(filters).every(([k, v]) => (row as Record<string, unknown>)[k] === v);
}

// The standard contract's record as the enabling PR will fill it: these
// tests are about a reading that is switched on. With the shipped, empty
// record nothing is sent at all (tests/mobile-fal-safeguard.test.ts).
vi.mock("@/lib/mobile/fal-safeguard", () => ({
  FAL_TRANSFER_SAFEGUARD: { signedOn: "2026-10-01", notifiedOn: "2026-10-02", receipt: "TEST-RECEIPT" },
}));

vi.mock("@/lib/db", () => ({
  getDb: () => ({
    from: (table: string) => {
      expect(table).toBe("feature_consents");
      const filters: Record<string, unknown> = {};
      let patch: Partial<Row> | null = null;
      const query = {
        select: () => query,
        eq: (column: string, value: unknown) => {
          filters[column] = value;
          return query;
        },
        maybeSingle: async () => ({ data: rows.find((r) => matches(r, filters)) ?? null, error: null }),
        upsert: async (row: Row) => {
          rows = [...rows.filter((r) => !(r.customerEmail === row.customerEmail && r.feature === row.feature)), row];
          return { error: null };
        },
        update: (values: Partial<Row>) => {
          patch = values;
          return query;
        },
        then: (resolve: (value: { error: null }) => void) => {
          rows = rows.map((r) => (patch && matches(r, filters) ? { ...r, ...patch } : r));
          resolve({ error: null });
        },
      };
      return query;
    },
  }),
  TABLES: { featureConsents: "feature_consents", falReadings: "fal_readings", falReports: "fal_reports" },
}));

const requireMobileCustomer = vi.fn();
vi.mock("@/lib/mobile/auth", () => ({ requireMobileCustomer }));

const { grantFalConsent, hasFalConsent, revokeFalConsent } = await import("@/lib/mobile/fal");
const consentRoute = await import("@/app/api/mobile/v1/fal/consent/route");

const EDA = "eda@ornek.com";

function consentRow(version: string, patch: Partial<Row> = {}): Row {
  return { customerEmail: EDA, feature: FAL_FEATURE, version, grantedAt: "2026-09-25T10:00:00.000Z", revokedAt: "", ...patch };
}

describe("the R12 version names the recipient", () => {
  it("is a different version for each provider, and the current one names the disclosed provider", () => {
    expect(falConsentVersionFor("anthropic")).toBe("2026-10-17-anthropic");
    expect(falConsentVersionFor("openai")).toBe("2026-10-17-openai");
    expect(FAL_CONSENT_VERSION).toBe(falConsentVersionFor(FAL_DISCLOSED_PROVIDER));
  });
});

describe("hasFalConsent after the recipient changed", () => {
  beforeEach(() => {
    rows = [];
  });

  it("does not count a consent given to the 23 Eyl text, which named OpenAI", async () => {
    rows = [consentRow("2026-09-23")];
    expect(await hasFalConsent(EDA)).toBe(false);
  });

  it("does not count a consent for another recipient, even of the same day's text", async () => {
    rows = [consentRow(falConsentVersionFor("openai"))];
    expect(await hasFalConsent(EDA)).toBe(false);
  });

  it("counts a consent to the text in force, and only until it is taken back", async () => {
    rows = [consentRow(FAL_CONSENT_VERSION)];
    expect(await hasFalConsent(" Eda@Ornek.com ")).toBe(true);
    await revokeFalConsent(EDA, new Date("2026-10-18T09:00:00Z"));
    expect(rows[0]!.revokedAt).toBe("2026-10-18T09:00:00.000Z");
    expect(await hasFalConsent(EDA)).toBe(false);
  });

  it("records a new yes at the version naming Anthropic", async () => {
    rows = [consentRow("2026-09-23")];
    await grantFalConsent(EDA, new Date("2026-10-18T09:00:00Z"));
    expect(rows.find((r) => r.customerEmail === EDA)).toEqual({
      customerEmail: EDA,
      feature: FAL_FEATURE,
      version: "2026-10-17-anthropic",
      grantedAt: "2026-10-18T09:00:00.000Z",
      revokedAt: "",
    });
    expect(await hasFalConsent(EDA)).toBe(true);
  });
});

describe("GET /fal/consent tells the app to ask again", () => {
  beforeEach(() => {
    rows = [consentRow("2026-09-23")];
    requireMobileCustomer.mockResolvedValue({ ok: true, customer: { email: EDA, emailVerified: true } });
    vi.stubEnv("FAL_AI_PROVIDER", "");
    vi.stubEnv("ANTHROPIC_API_KEY", "test-key");
    vi.stubEnv("OPENAI_API_KEY", "");
    vi.stubEnv("FAL_AI_ENABLED", "true");
  });

  it("answers on, not granted, at the new version: the old yes is not carried over", async () => {
    const res = await consentRoute.GET(new Request("https://laffogato.net/api/mobile/v1/fal/consent"));
    expect(await res.json()).toEqual({ enabled: true, version: "2026-10-17-anthropic", granted: false, doc: "acik-riza-metni" });
  });

  it("refuses the old version, then takes the new one", async () => {
    const post = (version: string) =>
      consentRoute.POST(
        new Request("https://laffogato.net/api/mobile/v1/fal/consent", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ version }),
        }),
      );
    expect((await post("2026-09-23")).status).toBe(409);
    expect(rows[0]!.version).toBe("2026-09-23");
    const ok = await post(FAL_CONSENT_VERSION);
    expect(await ok.json()).toEqual({ granted: true, version: "2026-10-17-anthropic" });
    const after = await consentRoute.GET(new Request("https://laffogato.net/api/mobile/v1/fal/consent"));
    expect((await after.json()).granted).toBe(true);
  });
});
