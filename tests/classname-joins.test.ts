import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import ts from "typescript";
import { describe, expect, it } from "vitest";

import { cx } from "@/components/laffogato/cx";

/**
 * The repo formats with prettier-plugin-tailwindcss, and that plugin trims
 * the leading space of a string inside a `className` template. So
 *
 *   className={`nav-link${active ? " active" : ""}`}
 *
 * is rewritten on the next `npm run format` into `nav-link${active ?
 * "active" : ""}` - the element renders as `nav-linkactive` and loses both
 * classes. On 26 Eyl 2026 that shipped: the cart drawer could not open, the
 * mobile menu sheet stayed shut and the header lost its glass on scroll.
 * TypeScript, the build and every other test were green.
 *
 * The rule: a conditional inside a className template must follow a space
 * (`nav-link ${active ? "active" : ""}`) - or, better, use cx().
 */
function tsxFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(join(process.cwd(), dir), {
    withFileTypes: true,
  })) {
    const rel = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...tsxFiles(rel));
    else if (entry.name.endsWith(".tsx")) out.push(rel);
  }
  return out;
}

function gluedConditionals(file: string): string[] {
  const text = readFileSync(join(process.cwd(), file), "utf8");
  const source = ts.createSourceFile(
    file,
    text,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  const found: string[] = [];
  const isConditional = (e: ts.Expression): boolean =>
    ts.isConditionalExpression(e) ||
    (ts.isBinaryExpression(e) &&
      (e.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken ||
        e.operatorToken.kind === ts.SyntaxKind.BarBarToken)) ||
    (ts.isParenthesizedExpression(e) && isConditional(e.expression));
  const visit = (node: ts.Node) => {
    if (
      ts.isJsxAttribute(node) &&
      node.name.getText(source) === "className" &&
      node.initializer &&
      ts.isJsxExpression(node.initializer) &&
      node.initializer.expression &&
      ts.isTemplateExpression(node.initializer.expression)
    ) {
      const tpl = node.initializer.expression;
      let before = tpl.head.text;
      for (const span of tpl.templateSpans) {
        if (isConditional(span.expression) && /\S$/.test(before)) {
          const { line } = source.getLineAndCharacterOfPosition(
            span.getStart(source),
          );
          found.push(`${file}:${line + 1} ${tpl.getText(source)}`);
        }
        before = span.literal.text;
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return found;
}

describe("className joins survive the formatter", () => {
  it("no conditional is glued to the class before it", () => {
    const files = tsxFiles("src");
    expect(files.length).toBeGreaterThan(100);
    expect(files.flatMap(gluedConditionals)).toEqual([]);
  });

  it("cx joins with single spaces and skips the empty parts", () => {
    expect(cx("nav-link", true && "active", false, null, undefined, "")).toBe(
      "nav-link active",
    );
    expect(cx("tab-item", false && "active")).toBe("tab-item");
  });
});
