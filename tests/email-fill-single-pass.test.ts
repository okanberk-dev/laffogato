import { describe, expect, it } from "vitest";

import { fill, fillText, type MissingFields } from "@/lib/email/fill";
import { renderEmail } from "@/lib/email/render";
import { renderOperatorNotice } from "@/lib/email/send";
import { EMAIL_TEXT } from "@/lib/email/text";

/**
 * A value is filled in once and never read as template again. A member's
 * "[OK]" in an order note, an admin's "Kahve [250G]", a name typed as
 * "[BUTON_URL]": all of these used to make the render throw ("doldurulmamış
 * alan") - or, worse, be substituted by a second pass - and the mail they
 * were in never went out.
 */

const notice = (over: Partial<Parameters<typeof renderOperatorNotice>[0]>) =>
  renderOperatorNotice({
    to: "mudur@ornek.com",
    subject: "Yeni sipariş #1",
    summary: "Uygulama · Masa: Bahçe 3",
    label: "SİPARİŞ · ÖDENDİ",
    title: "Yeni sipariş #1",
    subtitle: "Uygulama",
    rows: [{ label: "Müşteri", value: "Eda" }],
    button: {
      label: "SİPARİŞİ AÇ",
      url: "https://laffogato.net/admin/siparisler/ord-1",
    },
    footnote: "Ödeme alındı.",
    ...over,
  });

describe("one pass, values are text", () => {
  it("does not substitute a field name that arrives inside a loop row", () => {
    const out = fill("<!--EACH:R-->[V];<!--/EACH:R-->[URL]", {
      vars: { URL: "https://x" },
      loops: { R: [{ V: "[URL]" }, { V: "b" }] },
    });
    expect(out).toBe("[URL];b;https://x");
  });

  it("still fills a global field written inside a loop body", () => {
    const out = fill("<!--EACH:R-->[V]@[SITE] <!--/EACH:R-->", {
      vars: { SITE: "laffogato.net" },
      loops: { R: [{ V: "a" }, { V: "b" }] },
    });
    expect(out).toBe("a@laffogato.net b@laffogato.net ");
  });

  it("lets a row field win over a global one of the same name", () => {
    expect(
      fill("<!--EACH:R-->[V]<!--/EACH:R-->", {
        vars: { V: "global" },
        loops: { R: [{ V: "row" }] },
      }),
    ).toBe("row");
  });

  it("reports the template's own unfilled fields, not a value's brackets", () => {
    const missing: MissingFields = new Set();
    fill(
      "[A] [B] <!--EACH:R-->[C]<!--/EACH:R-->",
      {
        vars: { A: "[B] [ZZ]" },
        loops: { R: [{}] },
      },
      missing,
    );
    expect([...missing].sort()).toEqual(["[B]", "[C]"]);
    const textMissing: MissingFields = new Set();
    expect(fillText("[A] [B]", { A: "[OK]" }, {}, textMissing)).toBe(
      "[OK] [B]",
    );
    expect([...textMissing]).toEqual(["[B]"]);
  });

  it("never lets a value open or close a section", () => {
    const out = fillText(
      "<!--IF:X-->gizli<!--/IF:X-->[A]",
      { A: "<!--IF:X-->açık<!--/IF:X-->" },
      { X: false },
    );
    expect(out).toBe("<!--IF:X-->açık<!--/IF:X-->");
  });
});

describe("renderEmail with bracketed values", () => {
  it("renders an operator notice whose note, name and items carry brackets", () => {
    const mail = notice({
      rows: [
        { label: "Ürün", value: "1 × Kahve [250G]" },
        { label: "Müşteri", value: "[BUTON_URL]" },
      ],
      note: { label: "MÜŞTERİNİN NOTU", text: "Şekersiz [OK]" },
    });
    expect(mail.text).toContain("Şekersiz [OK]");
    expect(mail.text).toContain("Kahve [250G]");
    expect(mail.html).toContain("Şekersiz [OK]");
    // "[BUTON_URL]" is the name as typed; the button's link appears only
    // where the template puts it.
    expect(mail.html).toContain("[BUTON_URL]");
    expect(mail.subject).toBe("Yeni sipariş #1");
  });

  it("keeps a subject's brackets as typed", () => {
    expect(notice({ subject: "Masa [2] · #1" }).subject).toBe("Masa [2] · #1");
  });

  it("still refuses a message with a field nobody filled", () => {
    expect(() =>
      renderEmail("operasyon-bildirim", {
        vars: {},
        text: EMAIL_TEXT["operasyon-bildirim"],
      }),
    ).toThrow(/doldurulmamış alan - .*\[BILDIRIM_/);
  });
});
