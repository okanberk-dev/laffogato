import { cx } from "./cx";
import { RevealText } from "./reveal-text";
import { SCENES, type SceneKey } from "./scenes";
import { ScrambleText } from "./scramble-text";

/** The title's glyphs all start within this long, whatever its length. */
const TITLE_SPREAD_MS = 720;

/**
 * The page hero every non-home page shares.
 *
 * Since 11 Kas 2026 (docs/REDESIGN-ROAST.md) it is the reference's section
 * opener at page scale, not a panel: a decoding kicker, the title in the
 * title face coming up through its own lines, a paragraph coming up word by
 * word, and air, on the cream ground with the leaf shadows; the L'Af mark
 * stands behind as a ghost where a page brings no drawing. One component
 * and one rule set on purpose: before it, six pages had grown six
 * near-copies of the same header with six different heading sizes.
 *
 * A server component; the kicker is its only client child.
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
  /** The page's scene. Its three pigments reach the frame as custom
   *  properties; the opener itself no longer paints a light with them. */
  scene?: SceneKey;
  /**
   * A drawing for the page (an `<Illustration>`), right of the copy where
   * the ghost mark would be; above the copy, smaller, on a phone.
   * Decorative: the wrapper is out of the accessibility tree.
   */
  art?: React.ReactNode;
  children?: React.ReactNode;
}) {
  const s = SCENES[scene];
  const lines = Array.isArray(title) ? title : [title];
  const glyphs = lines.join("").replace(/\s+/g, "").length;
  /* 38 ms a glyph on a short title (the reference's step); a guide's
     sixty-glyph title would take over two seconds at that, so the step
     shrinks until the whole title has started within TITLE_SPREAD_MS. */
  const step = Math.min(
    38,
    Math.max(8, Math.round(TITLE_SPREAD_MS / Math.max(glyphs, 1))),
  );
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
          <span className="page-hero-watermark" aria-hidden="true" />
          <div className="page-hero-copy">
            <ScrambleText
              as="p"
              on="load"
              text={eyebrow}
              className="page-hero-kicker"
            />
            {/* ONE h1. RevealText names it with the plain title and hides
                the glyph boxes from a screen reader, so the title is read
                once; the <br /> is the tuple's line break. */}
            <RevealText
              as="h1"
              on="load"
              delay={150}
              stagger={step}
              className="page-hero-title"
            >
              {lines[0]}
              {lines.length > 1 ? <br /> : null}
              {lines.length > 1 ? lines[1] : null}
            </RevealText>
            <RevealText
              as="p"
              by="words"
              on="load"
              delay={350}
              className="page-hero-lede"
            >
              {lede}
            </RevealText>
            {children != null ? (
              <div className="page-hero-extra">{children}</div>
            ) : null}
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
