/**
 * The L'Af mark - the brand's logo (operator, 25 Eyl 2026: "logomuz L'Af").
 *
 * The letterforms are the app icon's master (lafmobil
 * assets/brand/logo-mark-icon.png: L + the coffee-bean apostrophe + A + f),
 * traced to vector in public/brand. Two masks, not one image, because the
 * bean is its own colour on the app icon - brass on the house green - and the
 * site shows it the same way wherever the mark has room to carry a second
 * colour.
 *
 * Masks rather than an <img> so the mark takes any ink from CSS (the way the
 * app tints its alpha masks: `tintColor`, never the raw file) and stays one
 * cached 5 KB file across every page. No "use client": it renders in server
 * and client trees alike.
 *
 * Tones:
 * - `ink`   espresso letters and bean (the quiet default on porcelain)
 * - `duo`   espresso letters, brass bean (the header, the 404)
 * - `green` house-green letters, brass bean (the app's logo.tintOnNeutral)
 * - `cream` cream letters, brass bean - on the green blocks, exactly the
 *           app icon
 */
import { cx } from "./cx";

export type LafTone = "ink" | "duo" | "green" | "cream";

export function LafMark({
  tone = "ink",
  height,
  label,
  className,
}: {
  tone?: LafTone;
  /** Rendered height in px; the width follows the mark's 1035 × 846 box. */
  height?: number;
  /** Accessible name. Omit when the surrounding link or heading names it. */
  label?: string;
  className?: string;
}) {
  return (
    <span
      className={cx("laf-mark", `laf-mark--${tone}`, className)}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      style={
        height
          ? ({ "--laf-h": `${height}px` } as React.CSSProperties)
          : undefined
      }
    >
      <span className="laf-mark-letters" />
      <span className="laf-mark-bean" />
    </span>
  );
}
