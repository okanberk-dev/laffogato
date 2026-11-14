import type { CSSProperties } from "react";

import styles from "./arc.module.css";

import Link from "@/components/link";

// Arc UI's free `donut-chart` (https://uiarc.dev/r/donut-chart.json), ported
// for the panel: the ring geometry (`sector`, rounded annular sectors with an
// even gap) is Arc's own, the motion is gone (the panel takes no animation
// library; a CSS sweep stands in and stops under reduced motion), and it draws
// on the server. Every legend row may lead to the list it counts. Colour is
// never the only cue: each row names its part, its count and its share.

export interface DonutSlice {
  key: string;
  label: string;
  value: number;
  /** Any CSS colour; the panel's --admin-* tokens. */
  color: string;
  /** The list this part counts. */
  href?: string;
}

const TAU = Math.PI * 2;
/** Room around the ring, the gap between segments and their corner radius, in pixels (Arc's values). */
const MARGIN = 4,
  GAP = 3,
  CORNER = 4;

const n2 = (value: number) => (Math.round(value * 100) / 100).toString();

/**
 * An annular sector between two turns of the ring, clockwise from the top,
 * with rounded corners; its sides run parallel to the radius, so the gap
 * between neighbours is the same width from the inner edge to the outer one.
 * Arc's `sector`, unchanged.
 */
function sector(
  c: number,
  R: number,
  r: number,
  t0: number,
  t1: number,
  gap: number,
  corner: number,
) {
  const turns = t1 - t0;
  if (turns <= 1e-6) return "";
  const at = (radius: number, angle: number) =>
    `${n2(c + radius * Math.cos(angle))} ${n2(c + radius * Math.sin(angle))}`;
  if (turns >= 1 - 1e-6) {
    return `M${at(R, -Math.PI / 2)}A${n2(R)} ${n2(R)} 0 1 1 ${at(R, Math.PI / 2)}A${n2(R)} ${n2(R)} 0 1 1 ${at(R, -Math.PI / 2)}ZM${at(r, -Math.PI / 2)}A${n2(r)} ${n2(r)} 0 1 0 ${at(r, Math.PI / 2)}A${n2(r)} ${n2(r)} 0 1 0 ${at(r, -Math.PI / 2)}Z`;
  }
  const p = Math.min(gap / 2, ((1 - turns) * TAU * R) / 2);
  const a0 = t0 * TAU - Math.PI / 2,
    a1 = t1 * TAU - Math.PI / 2,
    half = (a1 - a0) / 2,
    s = Math.sin(Math.min(half, Math.PI / 2));
  if (s * R <= p + 1e-6) return "";
  const side = (t: number, angle: number, sign: number) =>
    `${n2(c + t * Math.cos(angle) - sign * p * Math.sin(angle))} ${n2(c + t * Math.sin(angle) + sign * p * Math.cos(angle))}`;
  const band = (R - r) / 2;
  const ro = Math.max(
    0,
    Math.min(corner, band, s >= 0.9999 ? Infinity : (s * R - p) / (1 + s)),
  );
  const dO = Math.asin(Math.min(1, (p + ro) / (R - ro))),
    tO = Math.sqrt(Math.max(0, (R - ro) ** 2 - (p + ro) ** 2));
  const bigO = a1 - a0 - 2 * dO > Math.PI ? 1 : 0;
  let d = `M${side(tO, a0, 1)}`;
  if (ro > 0.01) d += `A${n2(ro)} ${n2(ro)} 0 0 1 ${at(R, a0 + dO)}`;
  d += `A${n2(R)} ${n2(R)} 0 ${bigO} 1 ${at(R, a1 - dO)}`;
  if (ro > 0.01) d += `A${n2(ro)} ${n2(ro)} 0 0 1 ${side(tO, a1, -1)}`;
  if (s * r > p + 1e-6 || s >= 0.9999) {
    const ri = Math.max(
      0,
      Math.min(corner, band, s >= 0.9999 ? Infinity : (s * r - p) / (1 - s)),
    );
    const dI = Math.asin(Math.min(1, (p + ri) / (r + ri))),
      tI = Math.sqrt(Math.max(0, (r + ri) ** 2 - (p + ri) ** 2));
    const bigI = a1 - a0 - 2 * dI > Math.PI ? 1 : 0;
    d += `L${side(tI, a1, -1)}`;
    if (ri > 0.01) d += `A${n2(ri)} ${n2(ri)} 0 0 1 ${at(r, a1 - dI)}`;
    d += `A${n2(r)} ${n2(r)} 0 ${bigI} 0 ${at(r, a0 + dI)}`;
    if (ri > 0.01) d += `A${n2(ri)} ${n2(ri)} 0 0 1 ${side(tI, a0, 1)}`;
  } else d += `L${at(p / s, (a0 + a1) / 2)}`;
  return `${d}Z`;
}

const percent = new Intl.NumberFormat("tr-TR", {
  style: "percent",
  maximumFractionDigits: 0,
});
/** "%62"; a sliver under one percent says so instead of "%0". */
export function shareText(share: number): string {
  return share > 0 && share < 0.01 ? "<%1" : percent.format(share);
}

/**
 * A part-of-whole ring with its total in the middle and a legend row per
 * part (only the parts above 0). Server-safe: no hooks, no client code.
 */
export function DonutChart({
  label,
  slices,
  totalLabel = "Toplam",
  emptyLabel = "Henüz veri yok.",
  format = (value: number) => String(value),
  size = 148,
  thickness = 18,
}: {
  /** What the ring shows, for screen readers. */
  label: string;
  slices: readonly DonutSlice[];
  totalLabel?: string;
  emptyLabel?: string;
  format?: (value: number) => string;
  size?: number;
  thickness?: number;
}) {
  const parts = slices.filter((s) => s.value > 0);
  const total = parts.reduce((sum, s) => sum + s.value, 0);
  if (!total)
    return <p className={`${styles.arc} ${styles.empty}`}>{emptyLabel}</p>;
  const c = size / 2;
  const outer = c - MARGIN;
  const inner = outer - thickness;
  // Each part's start and end, in turns of the ring, from the running sum.
  const ends = parts.map((_, i) =>
    parts.slice(0, i + 1).reduce((sum, s) => sum + s.value / total, 0),
  );
  const drawn = parts.map((s, i) => ({
    ...s,
    d: sector(c, outer, inner, i ? ends[i - 1] : 0, ends[i], GAP, CORNER),
  }));
  return (
    <figure className={`${styles.arc} ${styles.donut}`} aria-label={label}>
      <div className={styles.donutGrid}>
        <div
          className={styles.ring}
          style={
            {
              width: size,
              "--inner": `${((inner * 2) / size) * 100}%`,
            } as CSSProperties
          }
        >
          <svg
            className={styles.svg}
            viewBox={`0 0 ${size} ${size}`}
            aria-hidden="true"
            focusable="false"
          >
            <circle
              className={styles.track}
              cx={c}
              cy={c}
              r={(outer + inner) / 2}
              strokeWidth={outer - inner}
            />
            {drawn.map((s, i) => (
              <path
                key={s.key}
                d={s.d}
                className={styles.segment}
                style={{ "--slice": s.color, "--order": i } as CSSProperties}
              />
            ))}
          </svg>
          <div className={styles.center} aria-hidden="true">
            <span className={styles.centerLabel}>{totalLabel}</span>
            <span className={styles.centerValue}>{format(total)}</span>
          </div>
        </div>
        <ul className={styles.legend}>
          {parts.map((s) => {
            const share = shareText(s.value / total);
            const body = (
              <>
                <span className={styles.dot} aria-hidden="true" />
                <span className={styles.rowLabel}>{s.label}</span>
                <span className={styles.rowValue}>{format(s.value)}</span>
                <span className={styles.rowShare}>{share}</span>
              </>
            );
            return (
              <li key={s.key}>
                {s.href ? (
                  <Link
                    href={s.href}
                    className={styles.row}
                    style={{ "--slice": s.color } as CSSProperties}
                  >
                    {body}
                  </Link>
                ) : (
                  <span
                    className={styles.row}
                    style={{ "--slice": s.color } as CSSProperties}
                  >
                    {body}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      </div>
      <figcaption className={styles.srOnly}>
        {label}. {totalLabel} {format(total)}.{" "}
        {parts
          .map(
            (s) =>
              `${s.label} ${format(s.value)}, ${shareText(s.value / total)}`,
          )
          .join(". ")}
        .
      </figcaption>
    </figure>
  );
}
