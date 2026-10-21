import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import ts from "typescript";
import { describe, expect, it } from "vitest";

/**
 * A server page may hand a client form a Server Action, never a plain
 * function. `(prev, formData) => updatePromoAction(id, prev, formData)` is
 * an ordinary closure: React's Flight serializer refuses it ("Functions
 * cannot be passed directly to Client Components"), so the page died on
 * every open. The promo edit page and the member's address edit page did,
 * for weeks, with typecheck, build and every test green. The fix is
 * `updatePromoAction.bind(null, id)`, which stays a server reference.
 *
 * The rule: in a module with no "use client" / "use server" directive (a
 * server component), no function takes a FormData unless its body opens
 * with "use server". A form handler written there is meant for a form, and
 * the only way to reach a form from a server component is as a prop.
 */

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(join(process.cwd(), dir), {
    withFileTypes: true,
  })) {
    const rel = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...sourceFiles(rel));
    else if (/\.(ts|tsx)$/.test(entry.name)) out.push(rel);
  }
  return out;
}

function directiveOf(source: ts.SourceFile): string {
  const first = source.statements[0];
  return first &&
    ts.isExpressionStatement(first) &&
    ts.isStringLiteral(first.expression)
    ? first.expression.text
    : "";
}

function opensWithUseServer(body: ts.ConciseBody | undefined): boolean {
  if (!body || !ts.isBlock(body)) return false;
  const first = body.statements[0];
  return Boolean(
    first &&
    ts.isExpressionStatement(first) &&
    ts.isStringLiteral(first.expression) &&
    first.expression.text === "use server",
  );
}

/** A `.ts` module that opens with `import "server-only"`. */
function isServerOnlyHelper(file: string, source: ts.SourceFile): boolean {
  if (!file.endsWith(".ts")) return false;
  return source.statements.some(
    (s) =>
      ts.isImportDeclaration(s) &&
      !s.importClause &&
      ts.isStringLiteral(s.moduleSpecifier) &&
      s.moduleSpecifier.text === "server-only",
  );
}

/** `file:line` of every FormData handler that is not a Server Action. */
function formClosures(file: string, text: string): string[] {
  const source = ts.createSourceFile(
    file,
    text,
    ts.ScriptTarget.Latest,
    true,
    file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  const directive = directiveOf(source);
  if (directive === "use client" || directive === "use server") return [];
  // A server-only helper module (.ts, no JSX) renders no form: a function
  // there that reads a FormData is called by actions, never handed to a
  // client component as a prop (e.g. ayarlar/action-helpers.ts askToConfirm).
  if (isServerOnlyHelper(file, source)) return [];
  const found: string[] = [];
  const visit = (node: ts.Node) => {
    if (
      (ts.isArrowFunction(node) ||
        ts.isFunctionExpression(node) ||
        ts.isFunctionDeclaration(node) ||
        ts.isMethodDeclaration(node)) &&
      node.parameters.some(
        (p) =>
          p.type?.getText(source) === "FormData" ||
          p.name.getText(source) === "formData",
      ) &&
      !opensWithUseServer(node.body)
    ) {
      const { line } = source.getLineAndCharacterOfPosition(
        node.getStart(source),
      );
      found.push(`${file}:${line + 1}`);
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return found;
}

describe("server pages hand client forms a Server Action, not a closure", () => {
  it("finds no FormData closure in a server component", () => {
    const offenders = [
      ...sourceFiles("src/app"),
      ...sourceFiles("src/components"),
    ].flatMap((file) =>
      formClosures(file, readFileSync(join(process.cwd(), file), "utf8")),
    );
    // Bind the action instead: `someAction.bind(null, id)`.
    expect(offenders).toEqual([]);
  });

  it("catches the closure the promo edit page shipped", () => {
    const page = `
      import { updatePromoAction, type PromoActionState } from "../../actions";
      export default async function Page({ id }: { id: string }) {
        const action = (prev: PromoActionState, formData: FormData) =>
          updatePromoAction(id, prev, formData);
        return <PromoForm action={action} />;
      }`;
    expect(formClosures("page.tsx", page)).toEqual(["page.tsx:4"]);
    const address = `
      export default async function Page({ id }: { id: string }) {
        const boundAction = async (prev: AddressFormState, formData: FormData) =>
          updateAddressAction(id, prev, formData);
        return <AddressForm action={boundAction} />;
      }`;
    expect(formClosures("page.tsx", address)).toEqual(["page.tsx:3"]);
  });

  it("lets a bound action, a client form and an inline Server Action pass", () => {
    const bound = `
      export default async function Page({ id }: { id: string }) {
        const action = updatePromoAction.bind(null, id);
        return <PromoForm action={action} />;
      }`;
    expect(formClosures("page.tsx", bound)).toEqual([]);
    const client = `"use client";
      export function Form() {
        const onSubmit = (formData: FormData) => save(formData);
        return <form action={onSubmit} />;
      }`;
    expect(formClosures("form.tsx", client)).toEqual([]);
    const inline = `
      export default function Page() {
        async function save(formData: FormData) {
          "use server";
          await write(formData);
        }
        return <form action={save} />;
      }`;
    expect(formClosures("page.tsx", inline)).toEqual([]);
  });

  it("skips a server-only helper module but not a server-only page", () => {
    const helper = `import "server-only";
      export function askToConfirm(formData: FormData) {
        return formData.getAll("confirmed");
      }`;
    expect(formClosures("action-helpers.ts", helper)).toEqual([]);
    const page = `import "server-only";
      export default async function Page({ id }: { id: string }) {
        const action = (prev: State, formData: FormData) => save(id, prev, formData);
        return <Form action={action} />;
      }`;
    expect(formClosures("page.tsx", page)).toEqual(["page.tsx:3"]);
  });
});
