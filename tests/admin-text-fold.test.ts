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
  /** lower() under the "C" collation: ASCII letters only. */
  const lowerC = (s: string) => s.replace(/[A-Z]/g, (c) => c.toLowerCase());
  const sqlFold = (s: string, lower: (s: string) => string) =>
    lower(translate(s, TR_FOLD_SQL_FROM, TR_FOLD_SQL_TO));
  const WORDS = [
    "İsmail",
    "ISMAIL",
    "ırmak",
    "IRMAK",
    "Fındık",
    "FINDIK",
    "i̇talyan",
    "Çiğdem Öztürk",
    "ÇİĞDEM ÖZTÜRK",
    "Şule Işık",
    "ŞULE IŞIK",
    "GÜNEŞ ÇAY",
    "HÂLÂ",
  ];

  it("lower(translate(x, FROM, TO)) folds like foldTr, whatever the collation", () => {
    for (const word of WORDS) {
      // A Unicode-aware collation (en_US.UTF-8) and the plain "C" one.
      expect(
        sqlFold(word, (s) => s.toLowerCase()),
        word,
      ).toBe(foldTr(word));
      expect(sqlFold(word, lowerC), word).toBe(foldTr(word));
    }
    expect(sqlFold("ÇAY", lowerC)).toBe(sqlFold("çay", lowerC));
  });

  it("pairs letter by letter and drops the combining dot last", () => {
    const from = [...TR_FOLD_SQL_FROM];
    const to = [...TR_FOLD_SQL_TO];
    expect(from).toHaveLength(to.length + 1);
    expect(from.at(-1)).toBe("\u0307");
    for (const [i, ch] of to.entries()) {
      expect(foldTr(from[i]), from[i]).toBe(ch);
    }
  });
});
