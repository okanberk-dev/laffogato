/**
 * A CSS `url()` for a URL the panel typed or uploaded.
 *
 * The shop hero used to write `url(${imageUrl})` unquoted: a space, a quote
 * or a bracket in the address broke the image, and an address ending in
 * `);position:fixed;...;(` added its own declarations to the storefront's
 * style attribute (CAT-27). Quoted, the whole address is one CSS string, so
 * brackets, spaces and semicolons inside it are only characters; the two
 * characters that can end a string early (the quote and the backslash) and
 * the line breaks a string may not hold are written as CSS escapes.
 *
 * Pure and directive-free on purpose: the storefront slider (a client
 * module) and the panel's server pages both call it, and a function exported
 * from a "use client" file cannot be called on the server.
 */
export function cssUrl(url: string): string {
  // A hex escape ends at the first non-hex character or one space; the
  // trailing space is always written so the next character cannot extend it.
  const escaped = url.replace(/[\u0000-\u001f\u007f"\\]/g, (c) =>
    c === "\u0000" ? "\\fffd " : `\\${c.charCodeAt(0).toString(16)} `,
  );
  return `url("${escaped}")`;
}
