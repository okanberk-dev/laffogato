/**
 * The footer's night band (owner's brief, 6 Kas 2026: an illustrated band
 * over a dark footer). Two drawings, both decoration only:
 *
 * - `FooterSky` fills the band: a dusk sky over Tuzla, soft stars, a crescent
 *   and a faint milky way.
 * - `FooterKosk` stands on the band's floor, which is the footer's top
 *   edge: the köşk's silhouette (hipped roof, a pedimented bay, arched
 *   windows, some lit) with a cup in front whose steam curls up into that
 *   milky way. Its shapes end at the bottom of the box, so nothing draws a
 *   second horizon.
 *
 * Original drawings, no external image. Every colour is a token, applied
 * from globals.css through the `fn-*` classes, so nothing here carries a hex.
 * The silhouettes are `--night`, the footer's own ground, so the band runs
 * into the footer without a seam. The only motion (a few stars
 * twinkling, the steam drifting) lives in CSS and stops under
 * `prefers-reduced-motion`.
 */

/** [x, y, radius, twinkles]: placed by hand, so server and client agree. */
const STARS: ReadonlyArray<readonly [number, number, number, boolean]> = [
  [64, 52, 1.4, false],
  [142, 128, 1, false],
  [210, 36, 1.6, true],
  [296, 92, 1, false],
  [356, 168, 1.2, false],
  [418, 48, 1, false],
  [488, 118, 1.5, true],
  [560, 30, 1, false],
  [618, 156, 1.2, false],
  [676, 76, 1.8, true],
  [742, 132, 1, false],
  [806, 44, 1.3, false],
  [868, 104, 1, false],
  [924, 26, 1.6, true],
  [986, 150, 1.1, false],
  [1046, 64, 1.4, false],
  [1112, 120, 1, false],
  [1168, 38, 1.2, true],
  [1232, 172, 1, false],
  [1366, 140, 1.5, false],
  [1408, 56, 1, false],
  [96, 214, 1, false],
  [248, 262, 1.2, false],
  [1386, 238, 1.1, true],
  [1300, 300, 1, false],
  // Thicker along the milky way, where the steam ends.
  [700, 214, 1.1, false],
  [764, 190, 1.4, true],
  [826, 238, 1, false],
  [884, 196, 1.2, false],
  [948, 252, 1.6, true],
  [1006, 222, 1, false],
  [1068, 276, 1.3, false],
  [1124, 236, 1, false],
  [1182, 300, 1.2, true],
];

export function FooterSky({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 1440 560"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <linearGradient id="fn-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" className="fn-stop-deep" />
          <stop offset="1" className="fn-stop-horizon" />
        </linearGradient>
        <radialGradient id="fn-glow-haze">
          <stop offset="0" className="fn-stop-haze" stopOpacity="0.2" />
          <stop offset="1" className="fn-stop-haze" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="fn-glow-amber">
          <stop offset="0" className="fn-stop-amber" stopOpacity="0.22" />
          <stop offset="1" className="fn-stop-amber" stopOpacity="0" />
        </radialGradient>
        <mask id="fn-moon-cut">
          <rect width="1440" height="560" fill="white" />
          <circle cx="1309" cy="82" r="21" fill="black" />
        </mask>
      </defs>
      <rect width="1440" height="560" fill="url(#fn-sky)" />
      {/* The milky way: a long cream haze, amber where the steam meets it. */}
      <g transform="rotate(-14 900 240)">
        <ellipse cx="900" cy="240" rx="640" ry="74" fill="url(#fn-glow-haze)" />
        <ellipse
          cx="980"
          cy="250"
          rx="300"
          ry="54"
          fill="url(#fn-glow-amber)"
        />
      </g>
      <circle
        className="fn-moon"
        cx="1296"
        cy="92"
        r="24"
        mask="url(#fn-moon-cut)"
      />
      <g className="fn-stars">
        {STARS.map(([x, y, r, twinkle], i) => (
          <circle
            key={i}
            cx={x}
            cy={y}
            r={r}
            className={twinkle ? "fn-twinkle" : undefined}
            style={
              twinkle
                ? ({
                    animationDelay: `${(i % 5) * 0.9}s`,
                  } as React.CSSProperties)
                : undefined
            }
          />
        ))}
      </g>
    </svg>
  );
}

/** An arched window: left x, arch top y, width w, total height h. */
function arch(x: number, y: number, w: number, h: number): string {
  const r = w / 2;
  return `M${x} ${y + h}V${y + r}a${r} ${r} 0 0 1 ${w} 0V${y + h}Z`;
}

/** [x, y, w, h, lit]: the köşk's windows, two storeys and the bay. */
const WINDOWS: ReadonlyArray<
  readonly [number, number, number, number, boolean]
> = [
  // Upper floor
  [330, 206, 26, 50, true],
  [378, 206, 26, 50, false],
  [480, 192, 40, 62, true],
  [596, 206, 26, 50, false],
  [644, 206, 26, 50, true],
  // Ground floor
  [330, 292, 26, 52, false],
  [378, 292, 26, 52, true],
  [596, 292, 26, 52, true],
  [644, 292, 26, 52, false],
];

export function FooterKosk({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 800 362"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <linearGradient
          id="fn-steam-fade"
          gradientUnits="userSpaceOnUse"
          x1="0"
          y1="300"
          x2="0"
          y2="0"
        >
          <stop offset="0" className="fn-stop-cream" stopOpacity="0.7" />
          <stop offset="0.65" className="fn-stop-cream" stopOpacity="0.28" />
          <stop offset="1" className="fn-stop-cream" stopOpacity="0" />
        </linearGradient>
        <radialGradient id="fn-lamp">
          <stop offset="0" className="fn-stop-amber" stopOpacity="0.55" />
          <stop offset="1" className="fn-stop-amber" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* Trees either side: a cypress, a round linden. */}
      <path
        className="fn-house"
        d="M262 362C246 300 248 214 262 150c14 64 16 150 0 212Z"
      />
      <path
        className="fn-house"
        d="M724 362v-44c-30-4-46-26-42-52 4-30 30-46 56-42 28 4 44 30 38 58-4 22-20 34-40 36v44Z"
      />

      {/* The house: hipped roof, chimneys, two storeys, the pedimented bay. */}
      <g className="fn-house">
        <rect x="378" y="80" width="16" height="36" />
        <rect x="612" y="86" width="16" height="30" />
        <path d="M280 172 360 112h280l80 60Z" />
        <rect x="300" y="170" width="400" height="192" />
        <rect x="452" y="150" width="96" height="212" />
        <path d="M440 152 500 104l60 48Z" />
      </g>
      {/* Moonlight on the roofline, the cornice and the pediment. */}
      <g className="fn-rim">
        <path d="M280 172 360 112h280l80 60" />
        <path d="M440 152 500 104l60 48" />
        <path d="M300 268h152M548 268h152" />
      </g>

      <g>
        {WINDOWS.map(([x, y, w, h, lit], i) => (
          <path
            key={i}
            d={arch(x, y, w, h)}
            className={lit ? "fn-win-lit" : "fn-win-dark"}
          />
        ))}
        {/* The door under the bay, its fanlight lit. */}
        <path d={arch(478, 290, 44, 72)} className="fn-win-dark" />
        <path d="M478 312a22 22 0 0 1 44 0Z" className="fn-win-lit" />
      </g>
      {/* Mullions: one bar down each window. */}
      <g className="fn-mullion">
        {WINDOWS.map(([x, y, w, h], i) => (
          <path key={i} d={`M${x + w / 2} ${y + 2}V${y + h}`} />
        ))}
      </g>

      {/* The garden lamp by the gate. */}
      <circle cx="226" cy="284" r="34" fill="url(#fn-lamp)" />
      <g className="fn-house">
        <rect x="223" y="290" width="6" height="72" />
        <rect x="216" y="276" width="20" height="16" rx="3" />
      </g>
      <rect
        className="fn-lamp-light"
        x="220"
        y="279"
        width="12"
        height="10"
        rx="2"
      />

      {/* The cup in front, its saucer on the band's floor, the steam
          curling up into the sky. */}
      <g transform="translate(-50 -12)">
        <g className="fn-steam" stroke="url(#fn-steam-fade)">
          <path d="M112 300c-18-30 20-46 4-80s-24-52 2-88 30-70 6-132" />
          <path d="M138 296c-14-34 22-52 8-92s-12-74 18-104 24-62 10-100" />
          <path d="M162 302c-8-24 18-36 10-62s-14-48 6-72" />
        </g>
        <g className="fn-house">
          <path d="M70 304h148c0 34-20 58-50 62h-48c-30-4-50-28-50-62Z" />
          <path d="M216 312c22-4 34 10 28 26-5 13-20 18-34 14l2-9c9 3 18 0 21-7 4-9-3-17-15-15Z" />
          <ellipse cx="144" cy="364" rx="98" ry="10" />
        </g>
        <g className="fn-cup-rim">
          <path d="M70 304h148" />
          <path d="M46 364c30 8 166 8 196 0" />
        </g>
        {/* Where the steam turns into stars. */}
        <g className="fn-stars">
          <circle cx="122" cy="40" r="1.6" className="fn-twinkle" />
          <circle cx="168" cy="24" r="1.2" />
          <circle cx="98" cy="86" r="1" />
          <circle cx="186" cy="70" r="1.4" className="fn-twinkle" />
        </g>
      </g>
    </svg>
  );
}
