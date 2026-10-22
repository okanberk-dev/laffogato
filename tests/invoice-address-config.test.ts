import { describe, expect, it } from "vitest";

import {
  parseDistrictCity,
  provinceOf,
  PROVINCES,
  stripPhones,
} from "@/lib/invoice/address-core";
import { earsivConfig, earsivConfigStatus } from "@/lib/invoice/config";

/**
 * The billing province and district read out of an order's address text
 * (src/lib/invoice/address-core.ts), the phone numbers taken out of it, and
 * the e-Arşiv settings (src/lib/invoice/config.ts): off by default, nothing
 * at all without EARSIV_START_AT.
 */

describe("the 81 provinces", () => {
  it("lists each once, in the official spelling, and reads the everyday names", () => {
    expect(PROVINCES).toHaveLength(81);
    expect(new Set(PROVINCES).size).toBe(81);
    expect(provinceOf("ISTANBUL")).toBe("İstanbul");
    expect(provinceOf("istanbul")).toBe("İstanbul");
    expect(provinceOf("izmir")).toBe("İzmir");
    expect(provinceOf("Hakkari")).toBe("Hakkâri");
    expect(provinceOf("Afyon")).toBe("Afyonkarahisar");
    expect(provinceOf("Urfa")).toBe("Şanlıurfa");
    expect(provinceOf("Maraş")).toBe("Kahramanmaraş");
    expect(provinceOf("Tuzla")).toBeNull();
  });
});

describe("district and province out of an address text", () => {
  it.each([
    [
      "Ev - Eda Mancuso, +90 532 123 45 67\nPostane Mah., Atatürk Cad. No 28\nTuzla / İstanbul 34940",
      "Tuzla",
      "İstanbul",
    ],
    ["Kadıköy/İstanbul", "Kadıköy", "İstanbul"],
    ["Bağdat Cad. No 5 Kadıköy İstanbul", "Kadıköy", "İstanbul"],
    ["Moda Mah. 12. Sok No 3 D 4, Kadıköy, İSTANBUL", "Kadıköy", "İstanbul"],
    ["Atatürk Mah. Kadıköy - İstanbul", "Kadıköy", "İstanbul"],
    ["Çankaya/Ankara 06690 Türkiye", "Çankaya", "Ankara"],
    ["Alsancak Mah.\nkonak / izmir", "Konak", "İzmir"],
  ])("%s", (text, district, city) => {
    expect(parseDistrictCity(text)).toEqual({ district, city });
  });

  it.each([
    ["no province", "Bağdat Cad. No 5 Kadıköy"],
    ["a street word where the district goes", "Bağdat Cad. İstanbul"],
    ["a number where the district goes", "Sokak 5 Ankara"],
    ["two places", "Bornova / İzmir\nKadıköy / İstanbul"],
    ["nothing", ""],
  ])("refuses to guess: %s", (_why, text) => {
    expect(parseDistrictCity(text)).toBeNull();
  });
});

describe("phone numbers out of the address (KVKK: no phone on the invoice)", () => {
  it("takes out mobile and landline numbers, keeps house numbers and postcodes", () => {
    expect(
      stripPhones(
        "Ev - Eda Mancuso, +90 532 123 45 67\nPostane Mah. No 28\nTuzla / İstanbul 34940",
      ),
    ).toBe("Ev - Eda Mancuso\nPostane Mah. No 28\nTuzla / İstanbul 34940");
    expect(stripPhones("Ali, 05321234567, Kat 3 No: 12")).toBe(
      "Ali, Kat 3 No: 12",
    );
    expect(stripPhones("Tel (0212) 555 55 55 Bağdat Cad. 123")).not.toMatch(
      /555/,
    );
    expect(stripPhones("5321234567")).toBe("");
  });
});

describe("EARSIV_* settings", () => {
  const PARASUT = {
    PARASUT_CLIENT_ID: "id",
    PARASUT_CLIENT_SECRET: "secret",
    PARASUT_USERNAME: "site@laffogato.net",
    PARASUT_PASSWORD: " pass ",
    PARASUT_COMPANY_ID: "123",
  };

  it("is off when unset or off, and says nothing is wrong", () => {
    expect(earsivConfigStatus({})).toEqual({
      mode: "off",
      config: null,
      missing: [],
      errors: [],
    });
    expect(
      earsivConfigStatus({ EARSIV_MODE: "off", ...PARASUT }).config,
    ).toBeNull();
  });

  it("refuses an unknown mode and treats it as off", () => {
    const s = earsivConfigStatus({ EARSIV_MODE: "yes", ...PARASUT });
    expect(s.mode).toBe("off");
    expect(s.errors[0]).toContain("tanınmıyor");
  });

  it("does nothing without EARSIV_START_AT or a Paraşüt value, and names what is missing", () => {
    const s = earsivConfigStatus({
      EARSIV_MODE: "live",
      PARASUT_CLIENT_ID: "id",
    });
    expect(s.mode).toBe("live");
    expect(s.config).toBeNull();
    expect(s.missing).toEqual([
      "PARASUT_CLIENT_SECRET",
      "PARASUT_USERNAME",
      "PARASUT_PASSWORD",
      "PARASUT_COMPANY_ID",
      "EARSIV_START_AT",
    ]);
    // Names only, never a value.
    expect(JSON.stringify(s)).not.toContain('"id"');
  });

  it("wants EARSIV_START_AT as an instant with its zone", () => {
    expect(
      earsivConfig({
        EARSIV_MODE: "draft",
        EARSIV_START_AT: "2026-10-23",
        ...PARASUT,
      }),
    ).toBeNull();
    const cfg = earsivConfig({
      EARSIV_MODE: "draft",
      EARSIV_START_AT: "2026-10-23T00:00:00+03:00",
      ...PARASUT,
    })!;
    expect(cfg.mode).toBe("draft");
    expect(cfg.startAt).toBe("2026-10-22T21:00:00.000Z");
    expect(cfg.parasut).toMatchObject({
      baseUrl: "https://api.parasut.com",
      password: " pass ",
      companyId: "123",
    });
    expect(cfg.paymentAccountId).toBeNull();
  });

  it("reads the payment account and an https base URL only", () => {
    const env = {
      EARSIV_MODE: "live",
      EARSIV_START_AT: "2026-10-23T00:00:00+03:00",
      ...PARASUT,
    };
    expect(
      earsivConfig({ ...env, EARSIV_PAYMENT_ACCOUNT_ID: "4567" })!
        .paymentAccountId,
    ).toBe(4567);
    expect(
      earsivConfig({ ...env, EARSIV_PAYMENT_ACCOUNT_ID: "kasa" }),
    ).toBeNull();
    expect(
      earsivConfig({ ...env, PARASUT_BASE_URL: "http://api.parasut.com" }),
    ).toBeNull();
    expect(
      earsivConfig({
        ...env,
        PARASUT_BASE_URL: "https://api.heroku-staging.parasut.com/",
      })!.parasut.baseUrl,
    ).toBe("https://api.heroku-staging.parasut.com");
  });
});
