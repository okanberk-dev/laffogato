/**
 * How the two download routes answer (the member's order page and the
 * karaoke booking's signed link): the confirmed contract as a file, or one
 * and the same 404 for everything else - no session, another member's
 * order, an unknown number, a forged or expired link, a record with no
 * stored copy. Nothing in the answer tells those apart.
 *
 * Pure: no I/O, no "server-only".
 */

/** The file can never run or fetch anything, even if a browser renders it. */
const FILE_CSP =
  "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; sandbox";

const PRIVATE = {
  "Cache-Control": "private, no-store",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
} as const;

/**
 * A name safe in a `Content-Disposition` header: ASCII letters, digits, dot,
 * hyphen and underscore only (no quote, no CR/LF, no path), ending in .html.
 */
export function safeDownloadName(name: string): string {
  const base = name
    .normalize("NFKD")
    .replace(/[^A-Za-z0-9._-]+/g, "-")
    .replace(/^[.-]+/, "")
    .replace(/-{2,}/g, "-")
    .slice(0, 100);
  const stem = base.replace(/\.html$/i, "") || "sozlesme";
  return `${stem}.html`;
}

/** The confirmed contract as an attachment download. */
export function durableCopyResponse(copy: {
  filename: string;
  html: string;
}): Response {
  return new Response(copy.html, {
    status: 200,
    headers: {
      ...PRIVATE,
      "Content-Type": "text/html; charset=utf-8",
      "Content-Disposition": `attachment; filename="${safeDownloadName(copy.filename)}"`,
      "Content-Security-Policy": FILE_CSP,
    },
  });
}

/** The one answer for every request that does not get the file. */
export function durableCopyNotFound(): Response {
  return new Response("Bulunamadı.", {
    status: 404,
    headers: { ...PRIVATE, "Content-Type": "text/plain; charset=utf-8" },
  });
}
