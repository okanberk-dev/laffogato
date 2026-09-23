/**
 * A redirect target taken from a request (`?next=`, a `back` form field) is
 * whatever the request says. Only a path on this site is followed:
 * "/odeme" and "/karaoke?tarih=2026-09-23" yes; "//evil.example"
 * (protocol-relative), "https://…" and "/\evil.example" (which browsers read
 * as "//") no. Returns `null` for anything else so the caller picks its own
 * default.
 */
export function sameSitePath(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const value = raw.trim();
  if (!value.startsWith("/")) return null;
  if (value.startsWith("//") || value.startsWith("/\\")) return null;
  // Control characters (a smuggled newline or tab) have no place in a path.
  if (/[\u0000-\u001f\u007f]/.test(value)) return null;
  return value.length <= 300 ? value : null;
}
