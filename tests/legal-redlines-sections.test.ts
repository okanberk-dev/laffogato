import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * docs/LEGAL-REDLINES-2026-09.md is cited by number from code comments, PR
 * bodies and docs/PAYNKOLAY.md ("LEGAL-REDLINES §21"). Two legal PRs cut
 * from the same base both added "## 21. Y7"; after the merge one of the two
 * citations pointed at the wrong section. Each section number and each Y
 * code is used once, in order, and the checkout pre-information citation
 * lands on the checkout section.
 */

const redlines = readFileSync("docs/LEGAL-REDLINES-2026-09.md", "utf8");

const sections = [...redlines.matchAll(/^## (\d+)\. (.*)$/gm)].map((m) => ({
  n: Number(m[1]),
  title: m[2],
}));

describe("LEGAL-REDLINES section numbers", () => {
  it("every numbered section is used once and they run in order", () => {
    // "## 0." is the reading guide.
    expect(sections.length).toBeGreaterThan(20);
    sections.forEach((s, i) => expect(s.n).toBe(i));
  });

  it("every Y code names one section", () => {
    const codes = sections
      .map((s) => s.title.match(/^Y(\d+) - /)?.[1])
      .filter((c): c is string => c !== undefined)
      .map(Number);
    expect(new Set(codes).size).toBe(codes.length);
    codes.forEach((c, i) => expect(c).toBe(i + 1));
  });

  it("the subsections carry their section's number", () => {
    let current = 0;
    for (const line of redlines.split("\n")) {
      const top = line.match(/^## (\d+)\. /);
      if (top) current = Number(top[1]);
      else if (/^## /.test(line)) current = 0;
      const sub = line.match(/^### (\d+)\.\d+ /);
      if (sub && current) expect(Number(sub[1]), line).toBe(current);
    }
  });

  it("PAYNKOLAY's pre-information citation lands on the checkout section", () => {
    const paynkolay = readFileSync("docs/PAYNKOLAY.md", "utf8");
    const cite = paynkolay.match(
      /dolu bir panelde açılır \(MSY m\.6\/2-a; docs\/LEGAL-REDLINES-2026-09\.md §(\d+)\)/,
    );
    expect(cite).toBeTruthy();
    const target = sections.find((s) => s.n === Number(cite![1]));
    expect(target?.title).toMatch(/Ödeme sayfasında ön bilgilendirme/);
  });
});
