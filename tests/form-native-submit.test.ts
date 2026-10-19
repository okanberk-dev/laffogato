import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { createElement, type FunctionComponent, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";
import { describe, expect, it, vi } from "vitest";

import { expectReactGuard, formOpenTags } from "./_support/form-guard";

/**
 * No `<form>` under src posts itself the browser's way.
 *
 * A form posted from its onSubmit (useHandPost, ActionForm,
 * ActionModal) has no onSubmit until the page's JavaScript has run. With
 * neither `action` nor `method` an Enter pressed before that is the
 * browser's own submit: a GET to the page with every field in the query
 * string, so in the address bar, the history, a proxy and the request log.
 * The panel's sign-in form did it with the password (fixed in #143,
 * 2c784cd); the panel-user forms did it with a new admin password.
 *
 * The rule: every `<form>` carries an explicit `action` or `method`
 * attribute (a spread cannot be read here, so it does not count). A
 * hand-posted form takes useHandPost's `action` with its `onSubmit`: React
 * then draws its guard (`action="javascript:..."`), an early Enter sends
 * nothing, and after hydration onSubmit prevents the post and React skips
 * the action of a prevented submit, so nothing is reset. A URL action
 * (`action="/admin/ara"`) without `method="post"` is still the browser's
 * GET, to that URL, so it counts as a GET form. A form that GETs on purpose
 * is listed below with why.
 */

/**
 * The forms that GET on purpose: list filters whose state is the address,
 * so a filtered list can be linked, reloaded and gone back to. `forms` is
 * how many such forms the file may hold (at most). A filter whose search
 * box may hold a personal detail says so in `personal`; admin UI v2 takes
 * typed search off the address (POST /admin/ara/sonuc) and these go with it.
 */
const GET_FORMS: Record<
  string,
  { forms: number; why: string; personal?: string }
> = {
  "src/components/admin/ui/filter-bar.tsx": {
    forms: 1,
    why: 'The shared list filter: method="get", action={pathname}.',
    personal:
      "Siparişler searches by e-mail or name, the audit log by actor address.",
  },
  "src/app/admin/urunler/page.tsx": {
    forms: 1,
    why: "Products filter: name, SKU or slug, category, status, sort.",
  },
  "src/app/admin/stok-hareketleri/page.tsx": {
    forms: 1,
    why: "Stock movements filter: a product and a reason, both selects.",
  },
  "src/app/admin/musteriler/page.tsx": {
    forms: 1,
    why: "Customers filter (a server page): search, type and sort.",
    personal: "The search box takes an e-mail, a name or a phone number.",
  },
};

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(join(process.cwd(), dir), {
    withFileTypes: true,
  })) {
    const rel = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...sourceFiles(rel));
    else if (entry.name.endsWith(".tsx")) out.push(rel);
  }
  return out;
}

interface FormTag {
  where: string;
  /** No explicit action and no explicit method. */
  bare: boolean;
  /** method="get" written out, or a URL action with no method. */
  get: boolean;
}

/** A JSX attribute's value when it is a string written out, else null. */
function literalText(init: ts.JsxAttributeValue | undefined): string | null {
  const value = init && ts.isJsxExpression(init) ? init.expression : init;
  if (!value) return null;
  if (ts.isStringLiteral(value) || ts.isNoSubstitutionTemplateLiteral(value)) {
    return value.text;
  }
  // `/admin/${id}`: still a URL, whatever the id.
  if (ts.isTemplateExpression(value)) return value.head.text;
  return null;
}

/** Every JSX `<form>` in `text`, with what decides how it submits natively. */
function formTags(file: string, text: string): FormTag[] {
  const source = ts.createSourceFile(
    file,
    text,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  const out: FormTag[] = [];
  const visit = (node: ts.Node) => {
    if (
      (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) &&
      node.tagName.getText(source) === "form"
    ) {
      let action = false;
      // A string action is a URL: without a method the browser GETs it.
      let urlAction = false;
      let method: string | null = null;
      for (const attr of node.attributes.properties) {
        if (!ts.isJsxAttribute(attr)) continue;
        const name = attr.name.getText(source);
        if (name === "action") {
          action = true;
          urlAction = literalText(attr.initializer) !== null;
        }
        if (name === "method") {
          method =
            literalText(attr.initializer)?.toLowerCase() ?? "(expression)";
        }
      }
      const { line } = source.getLineAndCharacterOfPosition(
        node.getStart(source),
      );
      out.push({
        where: `${file}:${line + 1}`,
        bare: !action && method === null,
        get: method === "get" || (urlAction && method === null),
      });
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return out;
}

const isClientModule = (text: string) => /^\s*["']use client["']/.test(text);

/** The forms that break the rule, as `file:line why`. */
function offenders(files: string[]) {
  const problems: string[] = [];
  let total = 0;
  for (const file of files) {
    const text = readFileSync(file, "utf8");
    if (!text.includes("<form")) continue;
    const tags = formTags(file, text);
    total += tags.length;
    const listed = GET_FORMS[file];
    const getting = tags.filter((t) => t.bare || t.get);
    for (const t of getting) {
      if (!listed) {
        problems.push(
          `${t.where} ${t.bare ? "has neither action nor method" : 'GETs (method="get", or a URL action without a method) and is not in GET_FORMS'}`,
        );
      } else if (t.bare && isClientModule(text)) {
        // A client form may well be posted from onSubmit: it says GET out
        // loud or carries an action.
        problems.push(
          `${t.where} is a client form with neither action nor method`,
        );
      }
    }
    if (listed && getting.length > listed.forms) {
      problems.push(
        `${file} has ${getting.length} GET forms, GET_FORMS allows ${listed.forms}`,
      );
    }
  }
  return { problems, total };
}

describe("no form posts itself as a GET", () => {
  // All of src, not only app and components: a .tsx under lib draws pages
  // too (ui/submit.ts promises every form under src).
  const files = sourceFiles("src");

  it("every <form> under src has an action or a method", () => {
    const { problems, total } = offenders(files);
    // The walk really read the forms (a broken path finds none and passes).
    expect(total).toBeGreaterThan(60);
    expect(problems).toEqual([]);
  });

  it("gives every GET form a reason, and the card pages post", () => {
    for (const [file, entry] of Object.entries(GET_FORMS)) {
      expect(entry.why.length, file).toBeGreaterThan(10);
      expect(entry.forms, file).toBeGreaterThan(0);
    }
    // The card pages are server HTML strings, not JSX: each of their forms
    // is a POST with its own action (rule 28 files, read but never edited).
    const card = readFileSync("src/lib/payment/paynkolay-page.ts", "utf8");
    // (Tags with attributes: a comment there names a bare `<form>`.)
    const cardForms = card.match(/<form\s[^>]*>/g) ?? [];
    expect(cardForms.length).toBeGreaterThan(0);
    for (const tag of cardForms) {
      expect(tag).toMatch(/\bmethod="post"/);
      expect(tag).toMatch(/\baction="/);
    }
  });

  it("catches the shapes that leaked", () => {
    const check = (jsx: string, file = "x.tsx") =>
      formTags(file, `"use client";\nexport const F = () => (${jsx});`)[0];
    // The sign-in form before 2c784cd and the panel-user forms on main.
    expect(
      check("<form onSubmit={onSubmit}><input name='p' /></form>").bare,
    ).toBe(true);
    expect(check("<form className='grid'></form>").bare).toBe(true);
    // A spread is not something this test can read: not an action.
    expect(check("<form {...props} onSubmit={onSubmit}></form>").bare).toBe(
      true,
    );
    // The fixes, and the deliberate GET.
    expect(
      check("<form action={formAction} onSubmit={onSubmit}></form>").bare,
    ).toBe(false);
    expect(check('<form method="post" onSubmit={onSubmit}></form>').bare).toBe(
      false,
    );
    const get = check('<form method="GET" action={pathname}></form>');
    expect(get.bare).toBe(false);
    expect(get.get).toBe(true);
    // A URL action with no method is the browser's GET to that URL, the
    // fields in its query string: a GET form, not a guarded one.
    const url = check(
      '<form action="/admin/ara"><input name="email" /></form>',
    );
    expect(url.bare).toBe(false);
    expect(url.get).toBe(true);
    expect(check("<form action={`/admin/${id}`}></form>").get).toBe(true);
    expect(check("<form method={'get'} action={pathname}></form>").get).toBe(
      true,
    );
    // The card page's form: a URL action that posts.
    expect(
      check('<form method="post" action="/odeme/paynkolay"></form>').get,
    ).toBe(false);
  });
});

/** createElement with children as arguments (the props type requires them). */
const withKids = (
  type: unknown,
  props: Record<string, unknown>,
  ...children: ReactNode[]
) => createElement(type as FunctionComponent, props, ...children);

vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
  notFound: vi.fn(),
  unstable_rethrow: () => {},
  useRouter: () => ({ push() {}, refresh() {}, replace() {} }),
  usePathname: () => "/admin",
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("@/app/admin/siparisler/actions", () => ({
  bulkOrdersAction: vi.fn(),
  cancelOrderAction: vi.fn(),
  checkPosAction: vi.fn(),
  clearAttentionAction: vi.fn(),
  markPaidAction: vi.fn(),
  refundOrderAction: vi.fn(),
  releaseStockAction: vi.fn(),
  saveOrderNoteAction: vi.fn(),
  saveOrderTrackingAction: vi.fn(),
  setItemStatusAction: vi.fn(),
  shipOrderAction: vi.fn(),
  transitionOrderAction: vi.fn(),
}));

describe("the kit's forms carry React's guard", () => {
  it("ActionForm draws its dispatcher as the form's action", async () => {
    const { ActionForm, SubmitButton } =
      await import("@/components/admin/action-form");
    const action = async () => ({ ok: true as const, message: "" });
    const html = renderToStaticMarkup(
      withKids(
        ActionForm,
        { action, className: "grid" },
        createElement("input", { name: "email" }),
        createElement(SubmitButton, null, "Kaydet"),
      ),
    );
    const tags = formOpenTags(html);
    expect(tags).toHaveLength(1);
    expectReactGuard(tags[0]);
    expect(tags[0]).toContain('class="grid"');
  });

  it("ActionForm with a beforeSubmit check too", async () => {
    const { ActionForm } = await import("@/components/admin/action-form");
    const html = renderToStaticMarkup(
      withKids(
        ActionForm,
        {
          action: async () => ({ ok: true as const, message: "" }),
          beforeSubmit: () => false,
        },
        createElement("input", { name: "name" }),
      ),
    );
    expectReactGuard(formOpenTags(html)[0]);
  });

  it("the order's internal note form too (posted from its own onSubmit)", async () => {
    const { OrderNoteForm } =
      await import("@/components/admin/order-actions-ui");
    const html = renderToStaticMarkup(
      createElement(OrderNoteForm, {
        orderId: "ord-0001",
        initial: "Hediye paketi",
      }),
    );
    const tags = formOpenTags(html);
    expect(tags).toHaveLength(1);
    expectReactGuard(tags[0]);
  });

  it("ActionModal's dialog form gives its dispatcher as the action", () => {
    // The dialog mounts only after a click (a portal), so its markup is
    // never drawn on the server: the source is what can be read.
    const src = readFileSync(
      "src/components/admin/ui/action-modal.tsx",
      "utf8",
    );
    expect(src).toMatch(
      /<form\s+action=\{post\.action\}\s+onSubmit=\{post\.onSubmit\}/,
    );
    expect(src).toContain("useHandPost(formAction, pending)");
  });
});
