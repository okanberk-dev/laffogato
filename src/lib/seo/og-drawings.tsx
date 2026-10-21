import {
  LAF_BEAN_PATH,
  LAF_LETTERS_PATH,
  LAF_VIEWBOX,
} from "@/components/laffogato/laf-paths";

import { OG_INK } from "./og-card";

/**
 * The two drawings the link-preview cards use where the site has no
 * photograph of its own: the shop's coffee bag and the campaigns' tickets.
 *
 * Plain shapes only. next/og hands an <svg> to resvg, which has no fonts,
 * so a drawing never carries <text>: the label on the bag is the L'Af mark
 * and two bars.
 */

/**
 * The pieces below are plain functions, called, not rendered as components:
 * next/og accepts only intrinsic elements inside an <svg>.
 */

/** The L'Af mark placed at (x, y), `width` wide. */
function markAt(x: number, y: number, width: number) {
  const scale = width / LAF_VIEWBOX.width;
  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`}>
      <path fillRule="evenodd" fill={OG_INK.cream} d={LAF_LETTERS_PATH} />
      <path fillRule="evenodd" fill={OG_INK.brass} d={LAF_BEAN_PATH} />
    </g>
  );
}

/** A four-point sparkle centred on (x, y). */
function sparkle(x: number, y: number, r: number, fill: string = OG_INK.brass) {
  const k = r * 0.22;
  return (
    <path
      fill={fill}
      d={`M${x} ${y - r}Q${x + k} ${y - k} ${x + r} ${y}Q${x + k} ${y + k} ${x} ${y + r}Q${x - k} ${y + k} ${x - r} ${y}Q${x - k} ${y - k} ${x} ${y - r}Z`}
    />
  );
}

/** A roasted bean, `rotate` degrees, centred on (x, y). */
function bean(x: number, y: number, rotate: number) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${rotate})`}>
      <ellipse cx={0} cy={0} rx={24} ry={16} fill={OG_INK.gold} />
      <path
        d="M-16 3Q-4 -9 6 1T17 -2"
        fill="none"
        stroke={OG_INK.greenDeep}
        strokeOpacity={0.55}
        strokeWidth={3}
        strokeLinecap="round"
      />
    </g>
  );
}

export const OG_BAG_SIZE = { width: 420, height: 470 };

/** A coffee bag with the house label, a brass tin tie and three beans. */
export function OgCoffeeBag() {
  const { width, height } = OG_BAG_SIZE;
  // The crimped top edge: a zig-zag across the bag's mouth.
  const teeth = Array.from({ length: 10 }, (_, i) => {
    const x = 95 + i * 23;
    return `L${x + 11.5} 78L${x + 23} 86`;
  }).join("");
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <ellipse
        cx={210}
        cy={448}
        rx={160}
        ry={14}
        fill={OG_INK.greenDeep}
        fillOpacity={0.55}
      />
      <path
        fill={OG_INK.cream}
        d={`M95 124L95 86${teeth}L325 124L338 428Q339 444 323 444L97 444Q81 444 82 428Z`}
      />
      <path
        d="M118 132L110 436M302 132L310 436"
        stroke={OG_INK.greenDeep}
        strokeOpacity={0.1}
        strokeWidth={4}
        strokeLinecap="round"
      />
      <path
        d="M95 124L325 124"
        stroke={OG_INK.greenDeep}
        strokeOpacity={0.18}
        strokeWidth={3}
      />
      <rect
        x={78}
        y={98}
        width={264}
        height={11}
        rx={5.5}
        fill={OG_INK.brass}
      />
      <circle
        cx={292}
        cy={160}
        r={10}
        fill="none"
        stroke={OG_INK.greenDeep}
        strokeOpacity={0.3}
        strokeWidth={3}
      />
      <circle
        cx={292}
        cy={160}
        r={3}
        fill={OG_INK.greenDeep}
        fillOpacity={0.3}
      />
      <rect
        x={126}
        y={192}
        width={168}
        height={182}
        rx={16}
        fill={OG_INK.green}
      />
      {markAt(150, 212, 120)}
      <rect
        x={160}
        y={330}
        width={100}
        height={7}
        rx={3.5}
        fill={OG_INK.cream}
        fillOpacity={0.75}
      />
      <rect
        x={178}
        y={347}
        width={64}
        height={6}
        rx={3}
        fill={OG_INK.brass}
        fillOpacity={0.8}
      />
      {bean(52, 420, -24)}
      {bean(372, 430, 28)}
      {bean(392, 392, -48)}
      {sparkle(48, 150, 16)}
      {sparkle(378, 214, 11, OG_INK.mint)}
      {sparkle(366, 76, 8)}
    </svg>
  );
}

/**
 * A ticket outline: `w` x `h` from (x, y), with a round notch of radius `r`
 * halfway down each short side.
 */
function ticketPath(x: number, y: number, w: number, h: number, r: number) {
  const mid = y + h / 2;
  const right = x + w;
  const bottom = y + h;
  return (
    `M${x + 18} ${y}H${right - 18}Q${right} ${y} ${right} ${y + 18}` +
    `V${mid - r}A${r} ${r} 0 0 0 ${right} ${mid + r}` +
    `V${bottom - 18}Q${right} ${bottom} ${right - 18} ${bottom}` +
    `H${x + 18}Q${x} ${bottom} ${x} ${bottom - 18}` +
    `V${mid + r}A${r} ${r} 0 0 0 ${x} ${mid - r}` +
    `V${y + 18}Q${x} ${y} ${x + 18} ${y}Z`
  );
}

/** A five-point star centred on (x, y). */
function star(x: number, y: number, outer: number, inner: number): string {
  const points: string[] = [];
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const a = (Math.PI / 5) * i - Math.PI / 2;
    points.push(
      `${(x + r * Math.cos(a)).toFixed(1)} ${(y + r * Math.sin(a)).toFixed(1)}`,
    );
  }
  return `M${points.join("L")}Z`;
}

export const OG_TICKETS_SIZE = { width: 440, height: 430 };

/** Two tickets, one for an offer and one for an evening, and confetti. */
export function OgTickets() {
  const { width, height } = OG_TICKETS_SIZE;
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <g transform="rotate(10 220 200)">
        <path fill={OG_INK.mint} d={ticketPath(70, 96, 320, 170, 18)} />
        <path
          d="M300 112V250"
          stroke={OG_INK.greenDeep}
          strokeOpacity={0.25}
          strokeWidth={3}
          strokeDasharray="6 9"
        />
        <rect
          x={104}
          y={142}
          width={150}
          height={10}
          rx={5}
          fill={OG_INK.green}
          fillOpacity={0.5}
        />
        <rect
          x={104}
          y={166}
          width={104}
          height={8}
          rx={4}
          fill={OG_INK.green}
          fillOpacity={0.3}
        />
      </g>
      <g transform="rotate(-7 220 250)">
        <ellipse
          cx={220}
          cy={372}
          rx={150}
          ry={12}
          fill={OG_INK.greenDeep}
          fillOpacity={0.45}
        />
        <path fill={OG_INK.cream} d={ticketPath(52, 178, 336, 180, 20)} />
        <path
          d="M286 196V340"
          stroke={OG_INK.greenDeep}
          strokeOpacity={0.3}
          strokeWidth={3}
          strokeDasharray="6 9"
        />
        <path fill={OG_INK.brass} d={star(140, 250, 38, 16)} />
        <rect
          x={96}
          y={302}
          width={150}
          height={10}
          rx={5}
          fill={OG_INK.green}
        />
        <rect
          x={96}
          y={324}
          width={96}
          height={8}
          rx={4}
          fill={OG_INK.green}
          fillOpacity={0.45}
        />
        {/* The stub: a percent sign. */}
        <circle
          cx={322}
          cy={244}
          r={11}
          fill="none"
          stroke={OG_INK.green}
          strokeWidth={6}
        />
        <circle
          cx={354}
          cy={296}
          r={11}
          fill="none"
          stroke={OG_INK.green}
          strokeWidth={6}
        />
        <path
          d="M360 234L316 306"
          stroke={OG_INK.green}
          strokeWidth={6}
          strokeLinecap="round"
        />
      </g>
      {sparkle(70, 92, 16)}
      {sparkle(392, 84, 10, OG_INK.mint)}
      {sparkle(406, 330, 13)}
      <rect
        x={36}
        y={190}
        width={12}
        height={12}
        rx={2}
        fill={OG_INK.rose}
        transform="rotate(20 42 196)"
      />
      <rect
        x={196}
        y={44}
        width={10}
        height={10}
        rx={2}
        fill={OG_INK.brass}
        transform="rotate(-15 201 49)"
      />
      <circle cx={30} cy={330} r={6} fill={OG_INK.mint} />
      <circle cx={268} cy={30} r={5} fill={OG_INK.rose} />
    </svg>
  );
}
