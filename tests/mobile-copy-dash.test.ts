import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import ts from "typescript";
import { describe, expect, it } from "vitest";

/**
 * One dash: the hyphen.
 *
 * The app writes only the hyphen (lafmobil CLAUDE.md, rule 10, operator
 * decision of 22 Sep 2026). This guard started in src/lib/mobile, where the
 * strings this repo writes FOR the app live (timeline labels, notification
 * copy, karaoke slots): a line drawn from the wire next to a line drawn from
 * the app's dictionary would otherwise show two different dashes on one
 * screen. It now covers every string the site and the panel write
 * themselves, across src/.
 *
 * What it reads: string literals, template literal text and JSX text,
 * parsed with the TypeScript compiler. Comments are developer prose and are
 * not read; regex literals (invite-code.ts, format.ts) recognise the long
 * dashes in pasted input and are not strings, so they pass untouched.
 *
 * What it leaves alone, on purpose:
 * - Operator and database text never passes through here at all: product
 *   names and panel-typed hours come from Postgres.
 * - src/lib/legal/**: the legal bodies wait for the lawyer's draft.
 * - src/lib/db/schema-sql.ts: generated from db/migrations, and an applied
 *   migration is never rewritten.
 * - console.* arguments: developer log lines, matched by eye in the
 *   platform logs, not read by customers.
 */
const LONG_DASH = /[\u2013\u2014]/;

const SKIPPED = [/^src\/lib\/legal\//, /^src\/lib\/db\/schema-sql\.ts$/];

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(join(process.cwd(), dir), {
    withFileTypes: true,
  })) {
    const rel = `${dir}/${entry.name}`;
    if (entry.isDirectory()) out.push(...sourceFiles(rel));
    else if (/\.(ts|tsx)$/.test(entry.name)) out.push(rel);
  }
  return out;
}

function inConsoleCall(node: ts.Node, source: ts.SourceFile): boolean {
  for (let p = node.parent; p; p = p.parent) {
    if (
      ts.isCallExpression(p) &&
      /^console\.\w+$/.test(p.expression.getText(source))
    ) {
      return true;
    }
    if (ts.isFunctionLike(p)) return false;
  }
  return false;
}

function offenders(file: string): string[] {
  const text = readFileSync(join(process.cwd(), file), "utf8");
  if (!LONG_DASH.test(text)) return [];
  const source = ts.createSourceFile(
    file,
    text,
    ts.ScriptTarget.Latest,
    true,
    file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  const found: string[] = [];
  const visit = (node: ts.Node) => {
    if (
      (ts.isStringLiteralLike(node) ||
        ts.isTemplateLiteralToken(node) ||
        ts.isJsxText(node)) &&
      LONG_DASH.test(node.text) &&
      !inConsoleCall(node, source)
    ) {
      const { line } = source.getLineAndCharacterOfPosition(
        node.getStart(source),
      );
      found.push(`${file}:${line + 1}: ${node.text.trim().slice(0, 80)}`);
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return found;
}

describe("our copy uses the hyphen", () => {
  const files = sourceFiles("src").filter(
    (f) => !SKIPPED.some((re) => re.test(f)),
  );

  it("reads the whole of src/, not a corner of it", () => {
    expect(files.length).toBeGreaterThan(300);
    expect(files.some((f) => f.startsWith("src/lib/mobile/"))).toBe(true);
    expect(files.some((f) => f.startsWith("src/app/admin/"))).toBe(true);
    expect(files.some((f) => f.startsWith("src/components/"))).toBe(true);
  });

  it("no string, template or JSX text in src/ writes an en or em dash", () => {
    expect(files.flatMap(offenders)).toEqual([]);
  });

  it("still catches one, in each place a dash can hide", () => {
    // A guard that silently reads nothing passes forever; prove it bites.
    const probe = (code: string) => {
      const source = ts.createSourceFile(
        "probe.tsx",
        code,
        ts.ScriptTarget.Latest,
        true,
        ts.ScriptKind.TSX,
      );
      let hits = 0;
      const visit = (node: ts.Node) => {
        if (
          (ts.isStringLiteralLike(node) ||
            ts.isTemplateLiteralToken(node) ||
            ts.isJsxText(node)) &&
          LONG_DASH.test(node.text) &&
          !inConsoleCall(node, source)
        ) {
          hits++;
        }
        ts.forEachChild(node, visit);
      };
      visit(source);
      return hits;
    };
    expect(probe('const a = "x \u2014 y";')).toBe(1);
    expect(probe("const a = `${1}\u2013${2}`;")).toBe(1);
    expect(probe("const a = <p>x \u2014 y</p>;")).toBe(1);
    expect(probe('const a = <input placeholder="\u2014" />;')).toBe(1);
    // Allowed: developer logs and comments.
    expect(probe('console.warn("x \u2014 y");')).toBe(0);
    expect(probe("// x \u2014 y\nconst a = 1;")).toBe(0);
  });
});
