/**
 * Whether next/image may resize this source.
 *
 * Only the site's own static files: a path on this origin that is not a
 * route (/gorsel serves panel uploads through a handler of its own) and not
 * protocol-relative. An admin-entered URL on some other host stays a plain
 * <img> - next/image would need a wildcard remotePattern to take it.
 */
export function isLocalStatic(src: string | undefined | null): src is string {
  return (
    typeof src === "string" &&
    src.startsWith("/") &&
    !src.startsWith("//") &&
    !src.startsWith("/gorsel/") &&
    !src.startsWith("/api/")
  );
}
