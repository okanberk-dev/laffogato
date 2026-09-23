import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * The app writes one dash, the hyphen (lafmobil CLAUDE.md, rule 10, operator
 * decision of 22 Sep 2026). The strings this repo's mobile layer writes for
 * it (timeline labels, notification copy, karaoke slots, panel messages)
 * are our text, not operator data, so they follow the same rule: a line
 * drawn from the wire next to a line drawn from the app's dictionary would
 * otherwise show two different dashes on one screen.
 *
 * Code lines only: comments are prose for developers. Operator-authored
 * text (product names, hours typed into the panel) comes from the database
 * and never passes through here.
 */
const DIR = "src/lib/mobile";
const LONG_DASH = /[\u2013\u2014]/;

/** Lines that must keep the character: they recognise it in input. */
const ALLOWED: Record<string, RegExp> = {
  // An invite code pasted from a chat app arrives with typographic dashes.
  "invite-code.ts": /\.replace\(\/\[/,
};

function isComment(line: string): boolean {
  const t = line.trim();
  return t.startsWith("//") || t.startsWith("*") || t.startsWith("/*");
}

describe("mobile copy uses the hyphen", () => {
  it("no code line in src/lib/mobile writes an en or em dash", () => {
    const offenders: string[] = [];
    for (const file of readdirSync(DIR).filter((f) => f.endsWith(".ts"))) {
      const lines = readFileSync(join(DIR, file), "utf8").split("\n");
      lines.forEach((line, i) => {
        if (!LONG_DASH.test(line) || isComment(line)) return;
        if (ALLOWED[file]?.test(line)) return;
        offenders.push(`${file}:${i + 1}: ${line.trim()}`);
      });
    }
    expect(offenders).toEqual([]);
  });
});
