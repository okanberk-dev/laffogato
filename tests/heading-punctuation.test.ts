import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * Headlines end without a full stop (operator, 26 Eyl 2026: "cümlelerin
 * sonuna nokta koyma, 404 sayfalarındaki gibi"). The app titles its screens
 * the same way; a trailing dot on a display line reads as a sentence in a
 * paragraph, not a title. Body copy keeps its punctuation - this looks only
 * at h1-h3 and at the accent word (`.script`), which only ever sits in a
 * headline. The registered slogan ("Drink it. Eat the cup.") keeps its own
 * internal full stops; only the last character of a headline is checked.
 */
const ROOTS = [
  "src/app",
  "src/components/laffogato",
  "src/components/uye",
  "src/components/customer",
];

function tsx(dir: string): string[] {
  const out: string[] = [];
  for (const e of readdirSync(join(process.cwd(), dir), {
    withFileTypes: true,
  })) {
    const rel = join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === "admin" || e.name === "api") continue;
      out.push(...tsx(rel));
    } else if (e.name.endsWith(".tsx")) out.push(rel);
  }
  return out;
}

/** The visible text of a JSX fragment: tags, comments and braces dropped. */
function text(jsx: string): string {
  return jsx
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

describe("headlines end without a full stop", () => {
  const files = ROOTS.flatMap(tsx);

  it("finds the customer pages", () => {
    expect(files.length).toBeGreaterThan(40);
  });

  it("no h1-h3 ends with a period", () => {
    const offenders: string[] = [];
    for (const file of files) {
      const src = readFileSync(join(process.cwd(), file), "utf8");
      for (const m of src.matchAll(/<(h[1-3])\b[^>]*>([\s\S]*?)<\/\1>/g)) {
        const t = text(m[2]);
        if (/\.["”’]?$/.test(t) && !t.endsWith("...")) {
          offenders.push(`${file}: ${t.slice(0, 60)}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it("no accent word ends a headline with a period", () => {
    const offenders: string[] = [];
    for (const file of files) {
      const src = readFileSync(join(process.cwd(), file), "utf8");
      for (const m of src.matchAll(
        /className="script">([^<{]*)<\/span>(\s*[”"]?\s*<\/h[1-3]>)?/g,
      )) {
        // "Eat the cup." inside the slogan quote is followed by more text.
        const closesHeadline = m[2] !== undefined;
        if (
          /\.\s*$/.test(m[1]) &&
          (closesHeadline || /^\s*\.\s*$/.test(m[1]))
        ) {
          offenders.push(`${file}: ${m[1].trim()}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it("titles passed as data drop it too", () => {
    const offenders: string[] = [];
    for (const file of files) {
      const src = readFileSync(join(process.cwd(), file), "utf8");
      for (const m of src.matchAll(/title=\{\[([^\]]*)\]\}/g)) {
        const last = [...m[1].matchAll(/"([^"]*)"/g)].pop()?.[1] ?? "";
        if (/\.$/.test(last)) offenders.push(`${file}: ${last}`);
      }
    }
    expect(offenders).toEqual([]);
  });
});
