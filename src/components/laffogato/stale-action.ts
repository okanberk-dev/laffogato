/**
 * A Server Action call that failed because the server no longer knows the
 * action: the page was loaded before a deploy, and every deploy can give the
 * actions new ids (node_modules/next/dist/docs/01-app/02-guides/
 * server-actions.md, "Deployment considerations"). The server answers 404
 * with `x-nextjs-action-not-found: 1` and the client router throws an
 * `UnrecognizedActionError`; Next does not reload the page by itself, and
 * trying again from the same page fails the same way. Only a reload, which
 * fetches the new build, gets the customer going again. The cart lives in
 * localStorage (`laffogato_cart_v1`) and survives it.
 *
 * Matched by name, not `instanceof`: Next sets the name in the class's
 * constructor, so it survives minification and a second copy of the module
 * (tests/stale-action.test.ts pins it against Next's own class).
 */
export function isStaleActionError(error: unknown): boolean {
  return (
    error instanceof Error &&
    (error as { name?: unknown }).name === "UnrecognizedActionError"
  );
}

/** What the customer is told: the site changed, reload, nothing is lost. */
export const STALE_ACTION_MESSAGE =
  "Sayfa bu arada güncellendi. Sayfayı yenileyip kaldığın yerden devam edebilirsin; sepetin duruyor.";
