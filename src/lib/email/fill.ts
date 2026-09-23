/**
 * The three things the mail templates need from a template engine, and
 * nothing else.
 *
 *   `[FIELD]`                              - a value
 *   `<!--IF:FLAG-->…<!--/IF:FLAG-->`       - a section that may not apply
 *   `<!--EACH:ROWS-->…<!--/EACH:ROWS-->`   - a row repeated per item
 *
 * The templates are e-mail HTML: tables, inline styles, no scripts. A real
 * template engine would parse and re-serialise that, and every pass through
 * risks a client-specific attribute (`mso-line-height-rule`, conditional
 * comments) being "helpfully" normalised away. So this stays textual.
 *
 * Deliberately NO "server-only" - the render tests import it directly.
 */

/** `[FIELD]` - uppercase, digits and underscores, which is what the design used. */
const FIELD = /\[([A-Z0-9_]+)\]/g;

const HTML_ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

/**
 * Every value is escaped, including the ones that land in `href`.
 *
 * `[AD]` is whatever the customer typed at signup and `[KUPON_KODU]` comes
 * from the database, so neither can be pasted into markup raw. Escaping `&`
 * is also what an `href` needs - `?a=1&b=2` is `&amp;` in HTML.
 */
export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (c) => HTML_ESCAPES[c] ?? c);
}

export type TemplateVars = Record<string, string>;

export interface RenderOptions {
  /** `[FIELD]` values. */
  vars: TemplateVars;
  /** `<!--IF:FLAG-->` sections; a flag that is absent counts as false. */
  flags?: Record<string, boolean>;
  /** `<!--EACH:ROWS-->` bodies, one pass per entry. */
  loops?: Record<string, TemplateVars[]>;
}

function substitute(
  source: string,
  vars: TemplateVars,
  escape: (v: string) => string,
): string {
  return source.replace(FIELD, (whole, key: string) => {
    const value = vars[key];
    // An unknown field is left alone so `assertFilled` can name it, rather
    // than silently becoming an empty gap in a sent message.
    return value === undefined ? whole : escape(value);
  });
}

const raw = (v: string) => v;

/**
 * The same substitution with no escaping, for the two places that are not
 * HTML: the subject line and the plain-text part. `&` has to stay `&` in a
 * subject - `&amp;` there is a visible bug in every inbox.
 */
export function fillText(
  template: string,
  vars: TemplateVars,
  flags: Record<string, boolean> = {},
): string {
  return substitute(resolveFlags(template, flags), vars, raw);
}

function expandLoops(source: string, loops: Record<string, TemplateVars[]>) {
  return source.replace(
    /<!--EACH:([A-Z0-9_]+)-->([\s\S]*?)<!--\/EACH:\1-->/g,
    (_whole, name: string, body: string) =>
      (loops[name] ?? [])
        .map((row) => substitute(body, row, escapeHtml))
        .join(""),
  );
}

function resolveFlags(source: string, flags: Record<string, boolean>) {
  return source.replace(
    /<!--IF:([A-Z0-9_]+)-->([\s\S]*?)<!--\/IF:\1-->/g,
    (_whole, name: string, body: string) => (flags[name] ? body : ""),
  );
}

/**
 * Loops first: a row body may carry `[FIELD]`s of its own, and expanding it
 * before the global pass is what keeps per-row and global fields apart.
 */
export function fill(template: string, opts: RenderOptions): string {
  let out = expandLoops(template, opts.loops ?? {});
  out = resolveFlags(out, opts.flags ?? {});
  return substitute(out, opts.vars, escapeHtml);
}

/**
 * Throws if anything is still unfilled.
 *
 * A mail that goes out reading "Merhaba [AD]" is worse than one that fails
 * loudly in the log, so the send path calls this before handing anything to
 * the provider.
 */
export function assertFilled(html: string, label: string): void {
  const left = [...new Set(html.match(FIELD) ?? [])];
  if (left.length > 0) {
    throw new Error(`${label}: doldurulmamış alan - ${left.join(", ")}`);
  }
}
