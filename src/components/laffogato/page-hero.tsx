import { cx } from "./cx";
import { SCENES, type SceneKey } from "./scenes";

/**
 * The page hero every non-home page shares.
 *
 * A porcelain panel with the page's own light in one corner - the app's
 * scene halo (DESIGN-GLASS §6: light comes from the thing on the page) - and
 * the L'Af mark as a watermark. It replaced a solid green disc that, on a
 * narrow frame, slid under the headline and swallowed it (/magaza drew
 * "Köşkün mağazası" on top of a green circle). One component and one rule
 * set on purpose: before it, six pages had grown six near-copies of the same
 * header with six different heading sizes.
 *
 * A server component; there is nothing interactive in it.
 */
export function PageHero({
  eyebrow,
  title,
  lede,
  scene = "house",
  art,
  children,
}: {
  eyebrow: string;
  /**
   * The headline. A tuple is two hand-set lines and the array IS the line
   * break; a plain string wraps on its own.
   *
   * Both, because a tuple alone was wrong in two opposite directions. Pages
   * whose H1 comes from data - a guide's title, a legal document's name, a
   * verification page's state - cannot be hand-split at all, so they were
   * turning the component down. And the pages that DID take it passed a fixed
   * tuple that then repeated across every child route: one `["Bugün ne",
   * "içiyoruz?"]` on all eight menu-category URLs.
   */
  title: string | [string, string];
  lede: string;
  /** Whose light fills the corner. `house` is the L'Af green. */
  scene?: SceneKey;
  /**
   * A drawing for the page (an `<Illustration>`), set in the light's corner
   * where the watermark would be; above the copy, smaller, on a phone.
   * Decorative: the wrapper is out of the accessibility tree.
   */
  art?: React.ReactNode;
  children?: React.ReactNode;
}) {
  const s = SCENES[scene];
  return (
    <section className="page-hero">
      <div className="wrap">
        <div
          className={cx("page-hero-frame", art != null && "has-art")}
          style={
            {
              "--scene-core": s.core,
              "--scene-mid": s.mid,
              "--scene-edge": s.edge,
            } as React.CSSProperties
          }
        >
          <span className="page-hero-light" aria-hidden="true" />
          <span className="page-hero-watermark" aria-hidden="true" />
          <div className="page-hero-copy">
            <p className="page-hero-kicker">{eyebrow}</p>
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
            <p className="page-hero-lede">{lede}</p>
            {children}
          </div>
          {art != null ? (
            <div className="page-hero-art" aria-hidden="true">
              {art}
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
