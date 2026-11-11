import {
  Children,
  createElement,
  isValidElement,
  type CSSProperties,
  type ReactNode,
} from "react";

import { cx } from "./cx";

type Tag = "h1" | "h2" | "h3" | "p" | "span" | "div";

/** One stagger step in ms: the reference's 38 per glyph, 14 per word. */
const STEP = { chars: 38, words: 14 } as const;

const HEADINGS = new Set<Tag>(["h1", "h2", "h3"]);

/**
 * A title that comes up through its own line, glyph by glyph, or a
 * paragraph that comes up word by word (operator, 11 Kas 2026: the site
 * takes the reference page's motion). The split is plain markup, so this
 * renders on the server and ships no script of its own; globals.css
 * ("Masked rise") holds the motion and its two triggers:
 *
 * - `on="load"`: the title at the top of a page plays from the first frame
 *   (a CSS animation, transform only);
 * - `on="view"` (default): the text is painted as usual, and
 *   <RevealMotion> arms it only if it is still below the fold.
 *
 * Either way the words are in the document and visible without script or
 * under prefers-reduced-motion.
 *
 * A screen reader would spell a title split into glyph boxes letter by
 * letter. So in glyph mode the boxes are hidden from it and the element
 * carries the whole line: as the heading's name on h1-h3, as a visually
 * hidden copy elsewhere. Word mode needs neither.
 *
 * Children are text and `<br />` only; anything else is passed through
 * unsplit.
 */
export function RevealText({
  as = "span",
  by = "chars",
  on = "view",
  delay = 0,
  stagger,
  className,
  id,
  children,
}: {
  as?: Tag;
  /** `chars` for a title, `words` for a paragraph. */
  by?: "chars" | "words";
  on?: "load" | "view";
  /** ms before the first box moves. */
  delay?: number;
  /** ms between boxes; defaults to the reference's step for the mode. */
  stagger?: number;
  className?: string;
  id?: string;
  children: ReactNode;
}) {
  const step = stagger ?? STEP[by];
  let n = 0;
  const box = (text: string, key: number, word: boolean) => (
    <span
      key={key}
      className={word ? "rv-item rv-item-word" : "rv-item"}
      style={{ "--rv-d": `${delay + n++ * step}ms` } as CSSProperties}
    >
      {text}
    </span>
  );

  let plain = "";
  const split = Children.toArray(children).map((child, i) => {
    if (typeof child !== "string" && typeof child !== "number") {
      if (isValidElement(child) && child.type === "br") plain += " ";
      return child;
    }
    const text = String(child);
    plain += text;
    return text.split(/(\s+)/).map((part, j) => {
      if (!part) return null;
      if (/^\s+$/.test(part)) return " ";
      return (
        <span key={`${i}-${j}`} className="rv-mask">
          {by === "chars"
            ? [...part].map((glyph, k) => box(glyph, k, false))
            : box(part, 0, true)}
        </span>
      );
    });
  });

  const classes = cx(
    "rv",
    by === "chars" ? "rv-chars" : "rv-words",
    on === "load" && "rv-load",
    className,
  );
  if (by === "words") {
    return createElement(as, { id, className: classes }, split);
  }
  const name = plain.replace(/\s+/g, " ").trim();
  if (HEADINGS.has(as)) {
    return createElement(
      as,
      { id, className: classes, "aria-label": name },
      <span aria-hidden="true">{split}</span>,
    );
  }
  return createElement(
    as,
    { id, className: classes },
    <span className="sr-only">{name}</span>,
    <span aria-hidden="true">{split}</span>,
  );
}
