/**
 * The page hero every non-home page shares.
 *
 * Cream band, cocoa display type, green disc on the right — the home hero's
 * language at a scale that leads a page rather than selling a product. One
 * component and one rule set on purpose: before this, six pages had grown six
 * near-copies of the same header with six different heading sizes.
 *
 * A server component; there is nothing interactive in it.
 */
export function PageHero({
  eyebrow,
  title,
  lede,
  children,
}: {
  eyebrow: string;
  /**
   * The headline. A tuple is two hand-set lines and the array IS the line
   * break; a plain string wraps on its own.
   *
   * Both, because a tuple alone was wrong in two opposite directions. Pages
   * whose H1 comes from data — a guide's title, a legal document's name, a
   * verification page's state — cannot be hand-split at all, so they were
   * turning the component down. And the pages that DID take it passed a fixed
   * tuple that then repeated across every child route: one `["Bugün ne",
   * "içiyoruz?"]` on all eight menu-category URLs.
   */
  title: string | [string, string];
  lede: string;
  children?: React.ReactNode;
}) {
  return (
    <section className="page-hero">
      <div className="wrap">
        <div className="page-hero-frame">
          <span className="page-hero-disc" aria-hidden="true" />
          <span className="hero-x-watermark" aria-hidden="true" />
          <div className="page-hero-copy">
            <p className="hero-x-kicker">{eyebrow}</p>
            <h1 className="page-hero-title">
              {Array.isArray(title) ? (
                <>
                  <span>{title[0]}</span>
                  <span>{title[1]}</span>
                </>
              ) : (
                title
              )}
            </h1>
            <p className="hero-x-text">{lede}</p>
            {children}
          </div>
        </div>
      </div>
    </section>
  );
}
