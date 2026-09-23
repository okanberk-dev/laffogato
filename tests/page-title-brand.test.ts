import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, sep } from "node:path";

import ts from "typescript";
import { describe, expect, it } from "vitest";

/**
 * A page title must carry the brand once.
 *
 * The root layout sets `title.template: "%s · L'Affogato"`. Next applies the
 * template a page inherits to that page's string title, so a page whose own
 * string already ends in "· L'Affogato" rendered the brand twice in the tab
 * and in search results - measured on `next start` for /odeme, /bulten/onay,
 * /bulten/cikis and /magaza/urun/<slug> ("Ödeme · L'Affogato · L'Affogato").
 * Such a page says `title: { absolute: ... }`.
 *
 * Which template a page inherits (as measured): the one in effect after the
 * layouts of its STRICT ancestor folders. A layout with `title.template` sets
 * it, a layout with a plain string title clears it (so the /uye pages, below
 * a layout titled "Üyelik", are not templated), a layout without a title
 * leaves it alone. A layout in the page's own folder does not count.
 */

const APP = "src/app";
const BRAND = "L'Affogato";

function pages(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) {
      return name === "admin" ? [] : pages(path);
    }
    return name === "page.tsx" ? [path] : [];
  });
}

function source(path: string): ts.SourceFile {
  return ts.createSourceFile(
    path,
    readFileSync(path, "utf8"),
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
}

/** The `title` initialisers of `export const metadata` and of generateMetadata's returns. */
function titleInitializers(sf: ts.SourceFile): ts.Expression[] {
  const out: ts.Expression[] = [];
  const fromObject = (obj: ts.Expression | undefined) => {
    if (!obj || !ts.isObjectLiteralExpression(obj)) return;
    for (const prop of obj.properties) {
      if (
        ts.isPropertyAssignment(prop) &&
        ts.isIdentifier(prop.name) &&
        prop.name.text === "title"
      ) {
        out.push(prop.initializer);
      }
    }
  };
  const visit = (node: ts.Node, inGenerate: boolean) => {
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.name.text === "metadata"
    ) {
      fromObject(node.initializer);
    }
    const isGenerate =
      ts.isFunctionDeclaration(node) && node.name?.text === "generateMetadata";
    if ((inGenerate || isGenerate) && ts.isReturnStatement(node)) {
      fromObject(node.expression);
    }
    ts.forEachChild(node, (child) => visit(child, inGenerate || isGenerate));
  };
  visit(sf, false);
  return out;
}

type LayoutTitle = "template" | "plain" | "none";

function layoutTitle(dir: string): LayoutTitle {
  const path = join(dir, "layout.tsx");
  if (!existsSync(path)) return "none";
  const [init] = titleInitializers(source(path));
  if (!init) return "none";
  if (ts.isObjectLiteralExpression(init)) {
    const hasTemplate = init.properties.some(
      (p) => p.name && ts.isIdentifier(p.name) && p.name.text === "template",
    );
    return hasTemplate ? "template" : "none";
  }
  return "plain";
}

/** Is a template in effect for a page in `pageDir`? */
function inheritsTemplate(pageDir: string): boolean {
  const parts = relative(APP, pageDir).split(sep).filter(Boolean);
  // Strict ancestors: src/app itself, then each folder above pageDir.
  let templated = false;
  for (let depth = 0; depth < parts.length + 1; depth++) {
    const dir = join(APP, ...parts.slice(0, depth));
    if (dir === pageDir) break;
    const kind = layoutTitle(dir);
    if (kind === "template") templated = true;
    else if (kind === "plain") templated = false;
  }
  return templated;
}

function literalText(expr: ts.Expression): string | null {
  if (ts.isStringLiteral(expr) || ts.isNoSubstitutionTemplateLiteral(expr)) {
    return expr.text;
  }
  return null;
}

describe("page titles carry the brand once", () => {
  it("the root layout still appends the brand (the premise of this test)", () => {
    expect(layoutTitle(APP)).toBe("template");
    expect(readFileSync(join(APP, "layout.tsx"), "utf8")).toContain(
      "template: `%s · ${SITE.name}`",
    );
  });

  it("no templated page spells the brand in a plain string title", () => {
    const offenders: string[] = [];
    for (const page of pages(APP)) {
      if (!inheritsTemplate(dirname(page))) continue;
      for (const init of titleInitializers(source(page))) {
        const text = literalText(init);
        if (text !== null && text.trimEnd().endsWith(BRAND)) {
          offenders.push(`${page}: "${text}"`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it("knows which folders are templated", () => {
    // Pinned from `next start`: doubled before the fix, single after.
    expect(inheritsTemplate(join(APP, "odeme"))).toBe(true);
    expect(inheritsTemplate(join(APP, "bulten", "onay"))).toBe(true);
    expect(inheritsTemplate(join(APP, "magaza", "urun", "[slug]"))).toBe(true);
    // Single in the tab: below a layout with a plain title.
    expect(inheritsTemplate(join(APP, "uye", "giris"))).toBe(false);
  });

  it("the product page's computed title is absolute", () => {
    // Built to 60 characters WITH " · L'Affogato" (or the operator's own SEO
    // title, whose placeholder already ends in the brand), so the template
    // must not touch it.
    const src = readFileSync(join(APP, "magaza", "urun", "[slug]", "page.tsx"), "utf8");
    expect(src).toContain("title: { absolute: title }");
    expect(src).toContain('title: { absolute: "Ürün bulunamadı · L\'Affogato" }');
  });
});
