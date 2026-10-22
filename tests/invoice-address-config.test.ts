import { describe, expect, it } from "vitest";

import {
  parseDistrictCity,
  provinceOf,
  PROVINCES,
  stripPhones,
} from "@/lib/invoice/address-core";
import {
  earsivConfig,
  earsivConfigStatus,
  parasutReadConfig,
} from "@/lib/invoice/config";

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

  it("reads EARSIV_START_AT on the köşk's clock: a day is its Istanbul midnight", () => {
    const start = (startAt: string) =>
      earsivConfig({
        EARSIV_MODE: "draft",
        EARSIV_START_AT: startAt,
        ...PARASUT,
      })?.startAt ?? null;
    // A day alone, either way the operator writes it: Istanbul midnight,
    // never UTC midnight (three hours late).
    expect(start("2026-10-23")).toBe("2026-10-22T21:00:00.000Z");
    expect(start("23.10.2026")).toBe("2026-10-22T21:00:00.000Z");
    expect(start(" 3.11.2026 ")).toBe("2026-11-02T21:00:00.000Z");
    // A time without a zone is Istanbul's too, not the server's.
    expect(start("2026-10-23 09:30")).toBe("2026-10-23T06:30:00.000Z");
    expect(start("2026-10-23T00:00")).toBe("2026-10-22T21:00:00.000Z");
    expect(start("23.10.2026 09:30:15")).toBe("2026-10-23T06:30:15.000Z");
    // A value with its own zone is taken as written.
    expect(start("2026-10-22T21:00:00Z")).toBe("2026-10-22T21:00:00.000Z");
    expect(start("2026-10-23T00:00:00+03:00")).toBe("2026-10-22T21:00:00.000Z");
    // Not a day: refused, so nothing is invoiced until it is fixed.
    for (const bad of [
      "31.02.2026",
      "2026-02-30",
      "2026-02-30T00:00:00+03:00",
      "2026-13-01",
      "2026-10-23 24:00",
      "23/10/2026",
      "yarın",
      "10.23.2026",
    ]) {
      expect({ bad, start: start(bad) }).toEqual({ bad, start: null });
    }
    expect(
      earsivConfigStatus({
        EARSIV_MODE: "draft",
        EARSIV_START_AT: "31.02.2026",
        ...PARASUT,
      }).errors.join(" "),
    ).toContain("EARSIV_START_AT bir gün olmalı");
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

// Post-merge review (22 Ekim 2026): an invoice issued while the automation
// was on stays downloadable after EARSIV_MODE goes back to off, or after a
// mistake in EARSIV_START_AT; reading needs Paraşüt's credentials only.
describe("reading issued invoices back from Paraşüt", () => {
  const PARASUT = {
    PARASUT_CLIENT_ID: "cid",
    PARASUT_CLIENT_SECRET: "cs",
    PARASUT_USERNAME: "site@laffogato.net",
    PARASUT_PASSWORD: "pw",
    PARASUT_COMPANY_ID: "123",
  };
  it("needs the credentials only, whatever EARSIV_MODE says", () => {
    expect(parasutReadConfig({ EARSIV_MODE: "off", ...PARASUT })).toMatchObject(
      {
        companyId: PARASUT.PARASUT_COMPANY_ID,
        baseUrl: "https://api.parasut.com",
      },
    );
    expect(
      parasutReadConfig({
        EARSIV_MODE: "live",
        EARSIV_START_AT: "dün",
        ...PARASUT,
      }),
    ).not.toBeNull();
  });

  it("is null when a credential is missing or the base URL is not https", () => {
    expect(parasutReadConfig({})).toBeNull();
    expect(parasutReadConfig({ ...PARASUT, PARASUT_PASSWORD: "" })).toBeNull();
    expect(
      parasutReadConfig({
        ...PARASUT,
        PARASUT_BASE_URL: "http://api.parasut.com",
      }),
    ).toBeNull();
  });
});
