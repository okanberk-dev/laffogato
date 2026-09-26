/**
 * Join class names, skipping the empty ones.
 *
 * Not a template literal, on purpose: the repo's prettier-plugin-tailwindcss
 * trims the leading space of a string inside a `className` template, so
 * `nav-link${active ? " active" : ""}` was formatted into
 * `nav-link${active ? "active" : ""}` - the element became `nav-linkactive`
 * and lost both classes. The cart drawer could not open, the header lost its
 * glass on scroll. Joining with a space here is something no formatter can
 * trim away. tests/classname-joins.test.ts keeps the pattern from coming
 * back.
 */
export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}
