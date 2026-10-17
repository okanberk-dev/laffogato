import { describe, expect, it } from "vitest";

import {
  TR_FOLD_SQL_FROM,
  TR_FOLD_SQL_TO,
  foldTr,
  includesTr,
} from "@/lib/admin/text-fold";

/**
 * lib/admin/text-fold.ts: the panel's search boxes missed Turkish names
 * that start with İ or hold I / ı (admin audit PEO-05, CAT-19).
 */

describe("foldTr", () => {
  it.each([
    ["İsmail Yılmaz", "ismail"],
    ["İsmail Yılmaz", "İSMAİL"],
    ["IRMAK Çekirdek", "ırmak"],
    ["IRMAK Çekirdek", "irmak"],
    ["Fındık Kreması", "FINDIK"],
    ["Fındık Kreması", "findik"],
    ["İtalyan Kavrum Espresso", "italyan"],
    ["italyan kavrum", "İtalyan"],
  ])("%s is found by %s", (haystack, needle) => {
    expect(includesTr(haystack, needle)).toBe(true);
  });

  it("reads every spelling of the I family as i", () => {
    expect(foldTr("İIıi")).toBe("iiii");
    // What a locale-free toLowerCase() leaves behind: i + U+0307.
    expect("İ".toLowerCase()).toBe("i̇");
    expect(foldTr("İ".toLowerCase())).toBe("i");
    expect(foldTr("i̇talyan")).toBe("italyan");
  });

  it("keeps the other Turkish letters, so çay is not cay", () => {
    expect(foldTr("ÇAY ŞEKER ĞÖÜ")).toBe("çay şeker ğöü");
    expect(includesTr("Çay", "cay")).toBe(false);
  });

  it("an empty query matches everything, a different word nothing", () => {
    expect(includesTr("Latte", "")).toBe(true);
    expect(includesTr("Latte", "mocha")).toBe(false);
  });
});

describe("the SQL twin", () => {
  /** Postgres translate(): each FROM char to its TO partner, or dropped. */
  const translate = (s: string, from: string, to: string) =>
    [...s]
      .map((ch) => {
        const i = [...from].indexOf(ch);
        return i < 0 ? ch : ([...to][i] ?? "");
      })
      .join("");
  const sqlFold = (s: string) =>
    translate(s, TR_FOLD_SQL_FROM, TR_FOLD_SQL_TO).toLowerCase();

  it("lower(translate(x, FROM, TO)) folds like foldTr", () => {
    for (const word of [
      "İsmail",
      "ISMAIL",
      "ırmak",
      "IRMAK",
      "Fındık",
      "FINDIK",
      "i̇talyan",
      "Çiğdem Öztürk",
      "Şule Işık",
    ]) {
      expect(sqlFold(word), word).toBe(foldTr(word));
    }
  });

  it("drops the combining dot: it has no partner", () => {
    expect([...TR_FOLD_SQL_FROM]).toHaveLength(4);
    expect([...TR_FOLD_SQL_TO]).toHaveLength(3);
    expect([...TR_FOLD_SQL_FROM][3]).toBe("̇");
  });
});
