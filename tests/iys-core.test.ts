import { describe, expect, it } from "vitest";

import {
  addIstanbulBusinessDays,
  IYS_EXPORT_COLUMNS,
  IYS_EXPORT_ID_RE,
  IYS_SOURCE_MAP,
  IYS_SOURCES,
  iysCheckFreshness,
  iysConsentDateFormat,
  iysDueAt,
  iysDueLabel,
  iysDueTone,
  iysExcludedAddress,
  iysExportCsv,
  iysImportSentence,
  iysSourceFor,
  iysStaleMessage,
  maskIysEmail,
  newIysExportId,
  parseIysConsentList,
  toIysConsentRequest,
} from "@/lib/iys/iys-core";

/**
 * The İYS rules that need no database (src/lib/iys/iys-core.ts): the
 * conservative three-business-day count on the köşk's clock, the refusal
 * check's freshness, the file for İYS Web in İYS's own format, and the
 * tolerant reader of İYS's consent list. The SQL twin of the day count is
 * held to this one in tests/db-integration-iys.test.ts.
 */

// 2026-10-19 is a Monday; 2026-10-23 a Friday; 24-25 the weekend.
const at = (istanbul: string) => new Date(`${istanbul}+03:00`).toISOString();

describe("addIstanbulBusinessDays: Monday to Friday, holidays not skipped", () => {
  it("Monday 14:00 + 3 = Thursday 14:00", () => {
    expect(addIstanbulBusinessDays(at("2026-10-19T14:00:00"), 3)).toBe(
      at("2026-10-22T14:00:00"),
    );
  });

  it("Friday evening crosses the weekend: Friday 20:00 + 3 = Wednesday 20:00", () => {
    expect(addIstanbulBusinessDays(at("2026-10-23T20:00:00"), 3)).toBe(
      at("2026-10-28T20:00:00"),
    );
  });

  it("a Saturday or Sunday consent counts from Monday: due Wednesday, same clock", () => {
    expect(addIstanbulBusinessDays(at("2026-10-24T10:00:00"), 3)).toBe(
      at("2026-10-28T10:00:00"),
    );
    expect(addIstanbulBusinessDays(at("2026-10-25T23:59:00"), 3)).toBe(
      at("2026-10-28T23:59:00"),
    );
  });

  it("00:00-03:00 in Tuzla is the Istanbul day, not UTC's", () => {
    // 01:30 on Saturday in Tuzla is 22:30 on Friday in UTC. Counted on the
    // server's day it would be Friday + 3 = Wednesday 22:30 UTC; on the
    // köşk's it is Saturday + 3 = Wednesday 01:30 Tuzla, earlier.
    const saturday0130 = "2026-10-23T22:30:00.000Z";
    expect(new Date(saturday0130).getUTCDay()).toBe(5);
    expect(addIstanbulBusinessDays(saturday0130, 3)).toBe(
      "2026-10-27T22:30:00.000Z",
    );
    // And 02:00 on a Monday in Tuzla (Sunday 23:00 UTC) is a Monday.
    expect(addIstanbulBusinessDays("2026-10-25T23:00:00.000Z", 1)).toBe(
      "2026-10-26T23:00:00.000Z",
    );
  });

  it("does not skip public holidays: 29 Ekim counts, so ours is earlier", () => {
    // Tuesday 27 Oct + 3 business days is Friday 30 Oct here; the legal
    // count skips Cumhuriyet Bayramı (Thursday 29 Oct) and lands on Monday.
    expect(addIstanbulBusinessDays(at("2026-10-27T09:00:00"), 3)).toBe(
      at("2026-10-30T09:00:00"),
    );
  });

  it("returns '' for an unreadable instant", () => {
    expect(addIstanbulBusinessDays("dün", 3)).toBe("");
    expect(iysDueAt("")).toBe("");
  });

  it("iysDueAt is consentDate + 3 business days", () => {
    expect(iysDueAt(at("2026-10-22T11:00:00"))).toBe(at("2026-10-27T11:00:00"));
  });
});

describe("the refusal check's freshness", () => {
  it("never checked: stale, with nothing to say when it ran out", () => {
    const f = iysCheckFreshness("", new Date());
    expect(f).toEqual({ fresh: false, lastCheckAt: "", expiresAt: "" });
    expect(iysStaleMessage(f)).toMatch(/hiç yapılmadı/);
  });

  it("is good for three business days, to the minute", () => {
    const checked = at("2026-10-23T18:00:00"); // Friday
    const expires = at("2026-10-28T18:00:00"); // Wednesday
    expect(
      iysCheckFreshness(checked, new Date(Date.parse(expires) - 60_000)),
    ).toEqual({ fresh: true, lastCheckAt: checked, expiresAt: expires });
    const late = iysCheckFreshness(checked, new Date(expires));
    expect(late.fresh).toBe(false);
    expect(iysStaleMessage(late)).toMatch(/güncel değil/);
    expect(iysStaleMessage(late)).toContain("28 Ekim 2026");
  });
});

describe("deadlines for the panel", () => {
  const now = new Date(at("2026-10-22T12:00:00")); // Thursday noon

  it("overdue, due within a business day, or later", () => {
    expect(iysDueTone(at("2026-10-22T11:59:00"), now)).toBe("overdue");
    expect(iysDueTone(at("2026-10-23T11:00:00"), now)).toBe("soon");
    expect(iysDueTone(at("2026-10-26T11:00:00"), now)).toBe("ok");
    expect(iysDueTone("", now)).toBe("overdue");
  });

  it("counts down and up in Turkish", () => {
    expect(iysDueLabel(at("2026-10-24T15:00:00"), now)).toBe(
      "2 gün 3 saat kaldı",
    );
    expect(iysDueLabel(at("2026-10-22T17:00:00"), now)).toBe("5 saat kaldı");
    expect(iysDueLabel(at("2026-10-21T10:00:00"), now)).toBe(
      "1 gün 2 saat gecikti",
    );
  });
});

describe("İYS's source values", () => {
  it("maps every channel to an official İYS source", () => {
    for (const source of Object.values(IYS_SOURCE_MAP)) {
      expect(IYS_SOURCES).toContain(source);
    }
  });

  it("site HS_WEB, app HS_MOBIL, the e-mail's link HS_EPOSTA, our own decision HS_KARAR", () => {
    expect(iysSourceFor("site-signup")).toBe("HS_WEB");
    expect(iysSourceFor("site-account")).toBe("HS_WEB");
    expect(iysSourceFor("subscriber:footer")).toBe("HS_WEB");
    expect(iysSourceFor("app-signup")).toBe("HS_MOBIL");
    expect(iysSourceFor("app-account")).toBe("HS_MOBIL");
    expect(iysSourceFor("unsubscribe-link")).toBe("HS_EPOSTA");
    expect(iysSourceFor("newsletter-unsubscribe")).toBe("HS_EPOSTA");
    expect(iysSourceFor("subscriber-link")).toBe("HS_EPOSTA");
    expect(iysSourceFor("admin")).toBe("HS_KARAR");
    expect(iysSourceFor("account-deletion/admin")).toBe("HS_KARAR");
    expect(iysSourceFor("account-deletion")).toBe("HS_MOBIL");
    expect(iysSourceFor("deletion-request")).toBe("HS_WEB");
    expect(iysSourceFor("unknown-grant")).toBe("HS_WEB");
    expect(iysSourceFor("something-new")).toBe("HS_WEB");
  });

  it("never grants a first ONAY under HS_KARAR (İYS refuses it)", () => {
    const grants = [
      "site-signup",
      "site-account",
      "app-signup",
      "app-account",
      "subscriber:footer",
      "subscriber:register",
      "subscriber:account",
      "unknown-grant",
    ] as const;
    for (const key of grants) expect(IYS_SOURCE_MAP[key]).not.toBe("HS_KARAR");
  });
});

describe("the file for İYS Web", () => {
  it("is İYS's own column order and value format, on the köşk's clock", () => {
    const csv = iysExportCsv([
      {
        email: "ret@ornek.com",
        status: "RET",
        source: "HS_EPOSTA",
        consentDate: "2026-10-21T21:30:05.000Z",
      },
      {
        email: "onay@ornek.com",
        status: "ONAY",
        source: "HS_WEB",
        consentDate: "2026-10-20T07:00:00.000Z",
      },
    ]);
    expect(csv).toBe(
      [
        "type,source,recipient,status,consentDate,recipientType",
        "EPOSTA,HS_WEB,onay@ornek.com,ONAY,2026-10-20 10:00:00,BIREYSEL",
        // 21:30 UTC is 00:30 the next day in Tuzla.
        "EPOSTA,HS_EPOSTA,ret@ornek.com,RET,2026-10-22 00:30:05,BIREYSEL",
        "",
      ].join("\r\n"),
    );
    expect(IYS_EXPORT_COLUMNS.join(",")).toBe(
      "type,source,recipient,status,consentDate,recipientType",
    );
  });

  it("writes an address's ONAY before a later RET for it", () => {
    const csv = iysExportCsv([
      {
        email: "a@ornek.com",
        status: "RET",
        source: "HS_WEB",
        consentDate: "2026-10-21T10:00:00.000Z",
      },
      {
        email: "a@ornek.com",
        status: "ONAY",
        source: "HS_WEB",
        consentDate: "2026-10-20T10:00:00.000Z",
      },
    ]);
    const lines = csv.trim().split("\r\n");
    expect(lines[1]).toContain(",ONAY,");
    expect(lines[2]).toContain(",RET,");
  });

  it("never lets a spreadsheet run an address as a formula", () => {
    const csv = iysExportCsv([
      {
        email: "=cmd@ornek.com",
        status: "ONAY",
        source: "HS_WEB",
        consentDate: "2026-10-20T07:00:00.000Z",
      },
    ]);
    expect(csv).toContain(",'=cmd@ornek.com,");
  });

  it("formats İYS's consentDate as YYYY-MM-DD HH:mm:ss GMT+3", () => {
    expect(iysConsentDateFormat("2026-10-22T08:05:09.123Z")).toBe(
      "2026-10-22 11:05:09",
    );
    expect(iysConsentDateFormat("")).toBe("");
  });

  it("is exactly İYS's consent API body, for an integrator later", () => {
    expect(
      toIysConsentRequest({
        email: "a@ornek.com",
        status: "ONAY",
        source: "HS_MOBIL",
        consentDate: "2026-10-22T08:05:09.000Z",
      }),
    ).toEqual({
      type: "EPOSTA",
      source: "HS_MOBIL",
      recipient: "a@ornek.com",
      status: "ONAY",
      consentDate: "2026-10-22 11:05:09",
      recipientType: "BIREYSEL",
    });
  });

  it("names a batch on the köşk's clock, in a shape the actions accept", () => {
    const id = newIysExportId(new Date("2026-10-22T21:30:00.000Z"), "ab12");
    expect(id).toBe("iys-20261023-0030-ab12");
    expect(IYS_EXPORT_ID_RE.test(id)).toBe(true);
    expect(IYS_EXPORT_ID_RE.test("iys-2026-x")).toBe(false);
  });
});

describe("İYS's consent list, read tolerantly", () => {
  it("finds the address and ONAY/RET wherever they are, any case, any delimiter", () => {
    const text = [
      "Tür;Kaynak;Alıcı;Durum;İzin Tarihi;Alıcı Tipi",
      "EPOSTA;HS_WEB;Ayse@Ornek.com;Onay;2026-10-20 10:00:00;BIREYSEL",
      "EPOSTA;IYS_WEB;mehmet@ornek.com; ret ;2026-10-21 10:00:00;BIREYSEL",
      "MESAJ;HS_WEB;+905551112233;ONAY;2026-10-21 10:00:00;BIREYSEL",
    ].join("\n");
    const r = parseIysConsentList(text);
    expect(r).toEqual({
      ok: true,
      rows: [
        { line: 2, email: "ayse@ornek.com", status: "ONAY" },
        { line: 3, email: "mehmet@ornek.com", status: "RET" },
      ],
      skipped: 2,
      duplicates: 0,
      excluded: 0,
    });
  });

  it("reads tab-separated rows and comma CSV alike", () => {
    const tabs = parseIysConsentList("a@ornek.com\tONAY\nb@ornek.com\tRET\n");
    const commas = parseIysConsentList('"a@ornek.com","ONAY"\r\n');
    expect(tabs.ok && tabs.rows.map((r) => r.status)).toEqual(["ONAY", "RET"]);
    expect(commas.ok && commas.rows).toEqual([
      { line: 1, email: "a@ornek.com", status: "ONAY" },
    ]);
  });

  it("keeps a refusal over an approval listed for the same address", () => {
    const r = parseIysConsentList(
      [
        "a@ornek.com,RET",
        "a@ornek.com,ONAY",
        "b@ornek.com,ONAY",
        "b@ornek.com,RET",
      ].join("\n"),
    );
    expect(r.ok && r.rows.map((x) => [x.email, x.status])).toEqual([
      ["a@ornek.com", "RET"],
      ["b@ornek.com", "RET"],
    ]);
    expect(r.ok && r.duplicates).toBe(2);
  });

  it("ignores the placeholders of closed and test accounts", () => {
    const r = parseIysConsentList(
      "deleted-cst-1@anon.local,RET\ntest@laffogato.local,ONAY\n",
    );
    expect(r).toMatchObject({ ok: true, rows: [], excluded: 2 });
    expect(iysExcludedAddress("x@anon.local")).toBe(true);
    expect(iysExcludedAddress("x@laffogato.net")).toBe(false);
  });

  it("does not take a word that merely contains ONAY for a status", () => {
    const r = parseIysConsentList("a@ornek.com,ONAYLANDI\n");
    expect(r).toMatchObject({ ok: true, rows: [], skipped: 1 });
  });

  it("refuses a file it cannot read, with the line", () => {
    const r = parseIysConsentList('a@ornek.com,"ONAY\n');
    expect(r.ok).toBe(false);
  });
});

describe("small helpers", () => {
  it("masks an address", () => {
    expect(maskIysEmail("ahmet@ornek.com")).toBe("ah***@ornek.com");
    expect(maskIysEmail("garip")).toBe("***");
  });

  it("says what an import did in one sentence", () => {
    expect(
      iysImportSentence({
        onayListed: 10,
        retListed: 2,
        refusalsApplied: 1,
        onayIgnored: 3,
        registered: 4,
        skipped: 1,
      }),
    ).toBe(
      "12 adres okundu: 10 ONAY, 2 RET. 1 adresin İYS'deki reddi sitede de uygulandı; bu adreslere ticari e-posta gitmez. 4 kayıt İYS'de görüldü ve kayıtlı sayıldı. 3 ONAY bizde bir onay izi olmayan adreslere ait; dokunulmadı. 1 satırda adres ya da ONAY/RET bulunamadı, atlandı.",
    );
  });
});
