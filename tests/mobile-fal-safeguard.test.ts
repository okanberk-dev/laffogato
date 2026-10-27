import { readFileSync } from "node:fs";

import { beforeEach, describe, expect, it, vi } from "vitest";

import { DEFAULT_MOBILE_APP_CONFIG } from "@/lib/mobile/app-config";
import {
  FAL_TRANSFER_SAFEGUARD,
  falAiEnabled,
  falTransferSafeguardInForce,
} from "@/lib/mobile/fal-core";

/**
 * OP-FAL-OFF (18 Eki 2026): the fA'L photo goes to Anthropic, PBC (USA) with
 * every reading, so the transfer is not incidental and R12's consent cannot
 * carry it alone (KVKK m.9/4-c, m.9/6-a; Yönetmelik m.16/1). R12 promises
 * that no photo is sent before the Board's standard contract is signed and
 * notified to the Kurum. This file holds the code to that promise with the
 * record as shipped: empty, so the AI reading is off whatever the
 * environment says - the switch and the key included.
 *
 * Since 27 Oct 2026 the reading is retired outright (App Review 4.3(b),
 * lafmobil karar 330; tests/mobile-fal-retired.test.ts): the switch no
 * longer reads the record, and the record stays as the sender's second lock.
 */

const requireMobileCustomer = vi.fn();
vi.mock("@/lib/mobile/auth", () => ({ requireMobileCustomer }));
vi.mock("@/lib/db", () => ({
  getDb: () => {
    throw new Error("no database in this test");
  },
  TABLES: {
    falReadings: "fal_readings",
    featureConsents: "feature_consents",
    falReports: "fal_reports",
  },
}));
// The consent route reads the member's answer from the database; the real
// sender stays (it is what this file is about).
vi.mock("@/lib/mobile/fal", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/mobile/fal")>()),
  hasFalConsent: async () => false,
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

/** Switched on and keyed: everything the environment can do. */
const ON = {
  FAL_AI_ENABLED: "true",
  FAL_AI_PROVIDER: "anthropic",
  ANTHROPIC_API_KEY: "test-key-not-real",
};
const PHOTO = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]).toString(
  "base64",
);
const CONTEXT = { tier: "PEARL", visits: "regular", usual: "" } as const;

/** A filed contract, for the pure check only. */
const FILED = {
  signedOn: "2026-10-20",
  notifiedOn: "2026-10-24",
  receipt: "SS-2026-0001",
};

describe("the shipped record: no contract yet, so no photo leaves", () => {
  beforeEach(() => {
    for (const [name, value] of Object.entries(ON)) vi.stubEnv(name, value);
    vi.stubEnv("OPENAI_API_KEY", "");
    requireMobileCustomer.mockResolvedValue({
      ok: true,
      customer: { email: "eda@ornek.com", emailVerified: true },
    });
  });

  it("is empty and frozen", () => {
    // Filling it is the enabling PR's job, with the signing and filing days
    // and the receipt from the KVKK folder (docs/LEGAL-REDLINES-2026-09.md §15.5).
    expect(FAL_TRANSFER_SAFEGUARD).toEqual({
      signedOn: "",
      notifiedOn: "",
      receipt: "",
    });
    expect(Object.isFrozen(FAL_TRANSFER_SAFEGUARD)).toBe(true);
    expect(falTransferSafeguardInForce()).toBe(false);
  });

  it("keeps the switch off with FAL_AI_ENABLED=true and the key", () => {
    expect(falAiEnabled()).toBe(false);
  });

  it("the bootstrap says fal.ai false", async () => {
    expect((await getBootstrap()).app.fal.ai).toBe(false);
  });

  it("GET /fal/consent says enabled false", async () => {
    const res = await consentRoute.GET(
      new Request("https://laffogato.net/api/mobile/v1/fal/consent"),
    );
    expect((await res.json()).enabled).toBe(false);
  });

  it("POST /fal is 503 fal_unavailable before any consent or photo", async () => {
    const res = await falRoute.POST(
      new Request("https://laffogato.net/api/mobile/v1/fal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: PHOTO }),
      }),
    );
    expect(res.status).toBe(503);
    expect((await res.json()).error).toBe("fal_unavailable");
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

describe("falTransferSafeguardInForce: signed, filed, receipted, and filed by today", () => {
  const at = (iso: string) => new Date(iso);

  it("is in force from the filing day on", () => {
    expect(falTransferSafeguardInForce(at("2026-10-24T09:00:00Z"), FILED)).toBe(
      true,
    );
    expect(falTransferSafeguardInForce(at("2027-03-01T09:00:00Z"), FILED)).toBe(
      true,
    );
  });

  it("is not in force while the filing day is still ahead", () => {
    expect(falTransferSafeguardInForce(at("2026-10-23T09:00:00Z"), FILED)).toBe(
      false,
    );
  });

  it("counts the day on the Istanbul calendar, not the server's UTC one", () => {
    // 21:30 UTC on the 23rd is 00:30 on the 24th in Istanbul (kural 22).
    expect(falTransferSafeguardInForce(at("2026-10-23T21:30:00Z"), FILED)).toBe(
      true,
    );
    expect(falTransferSafeguardInForce(at("2026-10-23T20:30:00Z"), FILED)).toBe(
      false,
    );
  });

  it("wants every field: a receipt, both days, and a signature before the filing", () => {
    const now = at("2026-11-01T09:00:00Z");
    expect(falTransferSafeguardInForce(now, { ...FILED, receipt: "" })).toBe(
      false,
    );
    expect(falTransferSafeguardInForce(now, { ...FILED, receipt: "   " })).toBe(
      false,
    );
    expect(falTransferSafeguardInForce(now, { ...FILED, signedOn: "" })).toBe(
      false,
    );
    expect(falTransferSafeguardInForce(now, { ...FILED, notifiedOn: "" })).toBe(
      false,
    );
    expect(
      falTransferSafeguardInForce(now, { ...FILED, signedOn: "2026-10-25" }),
    ).toBe(false);
  });

  it("refuses a day that is not a calendar day or not written YYYY-MM-DD", () => {
    const now = at("2027-01-01T09:00:00Z");
    for (const notifiedOn of [
      "2026-02-30",
      "2026-13-01",
      "24.10.2026",
      "2026-10-24T00:00:00Z",
      " 2026-10-24",
    ]) {
      expect(
        falTransferSafeguardInForce(now, {
          ...FILED,
          signedOn: "2026-01-01",
          notifiedOn,
        }),
        notifiedOn,
      ).toBe(false);
    }
  });

  it("the sender asks the retired switch first and the record second; the switch is a plain false", () => {
    const core = readFileSync("src/lib/mobile/fal-core.ts", "utf8");
    const enabled = core.slice(core.indexOf("export function falAiEnabled"));
    expect(enabled.split("\n")[1]).toBe("  return false;");
    const fal = readFileSync("src/lib/mobile/fal.ts", "utf8");
    const send = fal.slice(fal.indexOf("export async function readCupWithAI"));
    const before = send.slice(0, send.indexOf("const provider"));
    const gate = 'if (!falAiEnabled()) return { ok: false, reason: "failed" };';
    const record =
      'if (!falTransferSafeguardInForce(now)) return { ok: false, reason: "failed" };';
    expect(before).toContain(gate);
    expect(before).toContain(record);
    expect(before.indexOf(gate)).toBeLessThan(before.indexOf(record));
  });
});
