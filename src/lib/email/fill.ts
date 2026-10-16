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

/**
 * Field names that had no value, collected while filling. The check runs on
 * the TEMPLATE's fields, never on the output: a value is the member's or the
 * operator's own text, and "Şekersiz [OK]" in an order note is not a hole in
 * the message (15 Eki 2026 review).
 */
export type MissingFields = Set<string>;

function substitute(
  source: string,
  vars: TemplateVars,
  escape: (v: string) => string,
  missing?: MissingFields,
): string {
  // One `replace` call: what a value brings in is never scanned again, so a
  // name typed as "[BUTON_URL]" stays those characters instead of becoming
  // the link.
  return source.replace(FIELD, (whole, key: string) => {
    const value = vars[key];
    // An unknown field is left alone and reported, rather than silently
    // becoming an empty gap in a sent message.
    if (value === undefined) {
      missing?.add(whole);
      return whole;
    }
    return escape(value);
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
  missing?: MissingFields,
): string {
  return substitute(resolveFlags(template, flags), vars, raw, missing);
}

function resolveFlags(source: string, flags: Record<string, boolean>) {
  return source.replace(
    /<!--IF:([A-Z0-9_]+)-->([\s\S]*?)<!--\/IF:\1-->/g,
    (_whole, name: string, body: string) => (flags[name] ? body : ""),
  );
}

/** A loop body, or a field outside any loop - matched in one pass. */
const LOOP_OR_FIELD =
  /<!--EACH:([A-Z0-9_]+)-->([\s\S]*?)<!--\/EACH:\1-->|\[([A-Z0-9_]+)\]/g;

/**
 * Flags first, on the template alone, so a value can never open or close a
 * section. Then ONE pass over what is left: a loop body is filled per row
 * (the row's fields win over the global ones of the same name), every other
 * field from `vars`. Nothing a value brings in is scanned again - neither by
 * a later pass nor by the missing-field check - so a member's "[OK]" is text,
 * not a field.
 */
export function fill(
  template: string,
  opts: RenderOptions,
  missing?: MissingFields,
): string {
  const loops = opts.loops ?? {};
  return resolveFlags(template, opts.flags ?? {}).replace(
    LOOP_OR_FIELD,
    (whole, loop: string | undefined, body: string, field: string) => {
      if (loop !== undefined) {
        return (loops[loop] ?? [])
          .map((row) =>
            substitute(body, { ...opts.vars, ...row }, escapeHtml, missing),
          )
          .join("");
      }
      const value = opts.vars[field];
      if (value === undefined) {
        missing?.add(whole);
        return whole;
      }
      return escapeHtml(value);
    },
  );
}

/** Throws if `fill`/`fillText` reported a field without a value. */
export function assertNoneMissing(missing: MissingFields, label: string): void {
  if (missing.size > 0) {
    throw new Error(
      `${label}: doldurulmamış alan - ${[...missing].join(", ")}`,
    );
  }
}

/**
 * Throws if a template still has a `[FIELD]` in it.
 *
 * A mail that goes out reading "Merhaba [AD]" is worse than one that fails
 * loudly in the log. For a rendered message use `assertNoneMissing` with the
 * set `fill` collected instead: run over the OUTPUT, this also trips on a
 * value that merely contains brackets.
 */
export function assertFilled(html: string, label: string): void {
  const left = [...new Set(html.match(FIELD) ?? [])];
  if (left.length > 0) {
    throw new Error(`${label}: doldurulmamış alan - ${left.join(", ")}`);
  }
}
