/**
 * Drawn menu visuals — the half of the menu the original set never covered.
 *
 * `visuals.tsx` draws the signature items (edible cup, matcha glass, espresso,
 * gelato). Everything else — lemonade, tea, salep, frappé, smoothie, cheesecake,
 * a sandwich — fell through to `EspressoCup`, so a soda and a brownie both
 * rendered as a hot coffee. These components close that gap.
 *
 * Conventions, kept identical to `visuals.tsx` so the two sets read as one hand:
 *  - `aria-hidden` + `focusable="false"`: the item name beside the art is the
 *    accessible label, so the drawing must not be announced twice.
 *  - a ground shadow ellipse, a `#14100B` outline, and a white sheen line.
 *  - gradient ids are suffixed with the variant key, because several differently
 *    coloured instances of one component share a page and identical ids would
 *    make the first one win for all of them.
 */

/** Liquid palettes, keyed by the drink family the router resolves to. */
const LIQUIDS: Record<string, { from: string; to: string; foam?: string }> = {
  coffee: { from: "#6F4A2A", to: "#2E1D11", foam: "#D9BE94" },
  mocha: { from: "#5A3720", to: "#22140C", foam: "#E2CBA6" },
  caramel: { from: "#C98B44", to: "#8A5623", foam: "#F0D6A8" },
  milk: { from: "#F6ECD8", to: "#E4D2AE", foam: "#FFF8EA" },
  matcha: { from: "#A8C980", to: "#6A8A4A", foam: "#E6F0D2" },
  lime: { from: "#E7F0C6", to: "#BBD183", foam: "#F4F9E4" },
  lemon: { from: "#FBEBB4", to: "#EBD070", foam: "#FEF7DC" },
  peach: { from: "#FBD9B4", to: "#EFB279", foam: "#FEEEDC" },
  chai: { from: "#E0BB8C", to: "#B07F4D", foam: "#F6E3C8" },
  chocolate: { from: "#7A4B2C", to: "#3A2114", foam: "#E8D2B4" },
  salep: { from: "#FBF1E0", to: "#EEDCC0", foam: "#FFFBF2" },
  berry: { from: "#C86A93", to: "#8E3D63", foam: "#F1CBDC" },
  mango: { from: "#FBCB6E", to: "#E29A25", foam: "#FDEBC2" },
  apple: { from: "#DDEBB6", to: "#A9C972", foam: "#F0F6DE" },
  strawberry: { from: "#EE8FA0", to: "#C5435A", foam: "#FBD8DE" },
  raspberry: { from: "#E0708F", to: "#A82F53", foam: "#F6CBD8" },
  passion: { from: "#F7C765", to: "#D98A1E", foam: "#FCE7B4" },
  pineapple: { from: "#F7E08B", to: "#DDB33C", foam: "#FDF3CE" },
  water: { from: "#E3F0F5", to: "#BCD8E4", foam: "#F4FAFC" },
  protein: { from: "#D8C6AA", to: "#A98A63", foam: "#EFE4D0" },
};

function liquid(tone: string) {
  return LIQUIDS[tone] ?? LIQUIDS.coffee;
}

/* ─────────────────────────────────────────────────────────────
   Tall iced glass — iced coffee, cold brew, ice tea, lemonade, frappé
   ───────────────────────────────────────────────────────────── */

export function IcedDrink({
  tone = "coffee",
  size = "100%",
  whipped = false,
  ice = true,
  straw = true,
  layered = false,
}: {
  tone?: string;
  size?: number | string;
  /** Frappé and blended drinks carry a cream dome. */
  whipped?: boolean;
  ice?: boolean;
  straw?: boolean;
  /** Two-tone pour — milk under, coffee over. */
  layered?: boolean;
}) {
  const l = liquid(tone);
  const id = `ic-${tone}`;
  const top = whipped ? 118 : 96;
  return (
    <svg
      viewBox="0 0 220 320"
      style={{ width: size, height: size }}
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={l.from} />
          <stop offset="1" stopColor={l.to} />
        </linearGradient>
        <linearGradient id={`${id}-milk`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#FBF3DF" />
          <stop offset="1" stopColor="#EFDFBB" />
        </linearGradient>
      </defs>

      <ellipse cx="110" cy="296" rx="66" ry="5" fill="#000" opacity="0.16" />

      {/* Glass body — a slight taper reads as a real tumbler. */}
      <path
        d="M 58 68 L 162 68 L 154 290 L 66 290 Z"
        fill="rgba(255,255,255,0.10)"
        stroke="#14100B"
        strokeWidth="1.4"
      />

      {layered ? (
        <>
          <path
            d="M 62 196 L 158 196 L 154 288 L 66 288 Z"
            fill={`url(#${id}-milk)`}
          />
          <path
            d={`M 60 ${top} L 160 ${top} L 158 196 L 62 196 Z`}
            fill={`url(#${id})`}
          />
        </>
      ) : (
        <path
          d={`M 60 ${top} L 160 ${top} L 154 288 L 66 288 Z`}
          fill={`url(#${id})`}
        />
      )}

      {/* Surface meniscus, so the liquid has a top rather than a flat cut. */}
      <ellipse
        cx="110"
        cy={top}
        rx="50"
        ry="5"
        fill={l.foam ?? "#FFF"}
        opacity="0.55"
      />

      {ice && (
        <g opacity="0.5">
          <rect
            x="76"
            y={top + 18}
            width="26"
            height="24"
            rx="5"
            fill="#FFF"
            transform={`rotate(-14 89 ${top + 30})`}
          />
          <rect
            x="112"
            y={top + 40}
            width="24"
            height="22"
            rx="5"
            fill="#FFF"
            transform={`rotate(12 124 ${top + 51})`}
          />
          <rect
            x="84"
            y={top + 70}
            width="22"
            height="20"
            rx="5"
            fill="#FFF"
            transform={`rotate(6 95 ${top + 80})`}
          />
        </g>
      )}

      {whipped && (
        <g>
          <path
            d="M 62 118 Q 66 78 92 82 Q 100 56 120 66 Q 146 60 148 90 Q 162 96 158 118 Z"
            fill="#FFF9EC"
            stroke="#E4D3B4"
            strokeWidth="1.2"
          />
          <ellipse cx="110" cy="74" rx="9" ry="6" fill="#FFF9EC" />
          <path
            d="M 92 96 Q 110 88 130 98"
            stroke="#C89A5E"
            strokeWidth="2.4"
            fill="none"
            strokeLinecap="round"
            opacity="0.7"
          />
        </g>
      )}

      {/* Sheen down the left wall. */}
      <line
        x1="70"
        y1="84"
        x2="70"
        y2="272"
        stroke="#FFF"
        strokeWidth="1.6"
        opacity="0.45"
      />

      {straw && (
        <rect
          x="136"
          y="34"
          width="5"
          height={whipped ? 70 : 92}
          rx="2.5"
          fill="#14100B"
          transform="rotate(9 138 76)"
        />
      )}
    </svg>
  );
}

/* ─────────────────────────────────────────────────────────────
   Smoothie / frozen — opaque, thick, fruit-forward
   ───────────────────────────────────────────────────────────── */

export function SmoothieGlass({
  tone = "berry",
  size = "100%",
  frozen = false,
}: {
  tone?: string;
  size?: number | string;
  /** Frozen drinks get a slush dome instead of a flat surface. */
  frozen?: boolean;
}) {
  const l = liquid(tone);
  const id = `sm-${tone}${frozen ? "-f" : ""}`;
  return (
    <svg
      viewBox="0 0 220 320"
      style={{ width: size, height: size }}
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={l.from} />
          <stop offset="1" stopColor={l.to} />
        </linearGradient>
      </defs>

      <ellipse cx="110" cy="296" rx="62" ry="5" fill="#000" opacity="0.16" />

      {/* A rounder, belled glass separates a smoothie from an iced coffee. */}
      <path
        d="M 62 88 Q 58 210 74 288 L 146 288 Q 162 210 158 88 Z"
        fill="rgba(255,255,255,0.10)"
        stroke="#14100B"
        strokeWidth="1.4"
      />
      <path
        d="M 64 104 Q 60 208 76 286 L 144 286 Q 160 208 156 104 Z"
        fill={`url(#${id})`}
      />

      {frozen ? (
        <path
          d="M 64 104 Q 78 84 92 100 Q 106 76 120 98 Q 136 82 156 104 Z"
          fill={l.foam ?? "#FFF"}
          opacity="0.9"
        />
      ) : (
        <ellipse
          cx="110"
          cy="104"
          rx="46"
          ry="6"
          fill={l.foam ?? "#FFF"}
          opacity="0.6"
        />
      )}

      <line
        x1="74"
        y1="118"
        x2="80"
        y2="268"
        stroke="#FFF"
        strokeWidth="1.8"
        opacity="0.4"
      />
      <rect
        x="134"
        y="40"
        width="6"
        height="80"
        rx="3"
        fill="#14100B"
        transform="rotate(10 137 80)"
      />
    </svg>
  );
}

/* ─────────────────────────────────────────────────────────────
   Turkish tea — tulip glass on a saucer
   ───────────────────────────────────────────────────────────── */

export function TeaGlass({ size = "100%" }: { size?: number | string }) {
  return (
    <svg
      viewBox="0 0 220 320"
      style={{ width: size, height: size }}
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <linearGradient id="tg-tea" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#C9581F" />
          <stop offset="1" stopColor="#7A2E0C" />
        </linearGradient>
      </defs>

      <ellipse cx="110" cy="288" rx="76" ry="7" fill="#000" opacity="0.16" />
      {/* Saucer */}
      <ellipse cx="110" cy="278" rx="74" ry="14" fill="#F3E9D6" />
      <ellipse cx="110" cy="274" rx="60" ry="10" fill="#E3D4B8" />

      {/* Tulip silhouette — the waist is what makes it read as çay bardağı. */}
      <path
        d="M 78 92 Q 62 150 92 186 Q 74 222 96 264 L 124 264 Q 146 222 128 186 Q 158 150 142 92 Z"
        fill="rgba(255,255,255,0.12)"
        stroke="#14100B"
        strokeWidth="1.4"
      />
      <path
        d="M 80 112 Q 65 152 93 186 Q 76 220 97 262 L 123 262 Q 144 220 127 186 Q 155 152 140 112 Z"
        fill="url(#tg-tea)"
      />
      <ellipse
        cx="110"
        cy="112"
        rx="30"
        ry="4.5"
        fill="#E08A4C"
        opacity="0.7"
      />
      <line
        x1="86"
        y1="126"
        x2="98"
        y2="248"
        stroke="#FFF"
        strokeWidth="1.6"
        opacity="0.35"
      />

      {/* Steam */}
      <g
        stroke="#14100B"
        strokeWidth="2"
        fill="none"
        opacity="0.25"
        strokeLinecap="round"
      >
        <path d="M 96 74 Q 88 60 96 46" />
        <path d="M 124 74 Q 132 60 124 46" />
      </g>
    </svg>
  );
}

/* ─────────────────────────────────────────────────────────────
   Hot mug — chocolate, chai latte, salep
   ───────────────────────────────────────────────────────────── */

export function HotMug({
  tone = "chocolate",
  size = "100%",
  topping = "none",
}: {
  tone?: string;
  size?: number | string;
  /** Cinnamon dust for salep, cream for chocolate, none for a plain pour. */
  topping?: "none" | "cream" | "cinnamon";
}) {
  const l = liquid(tone);
  const id = `hm-${tone}`;
  return (
    <svg
      viewBox="0 0 280 260"
      style={{ width: size, height: size }}
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={l.from} />
          <stop offset="1" stopColor={l.to} />
        </linearGradient>
        <radialGradient id={`${id}-body`} cx="0.42" cy="0.3" r="0.75">
          <stop offset="0" stopColor="#FAF5EC" />
          <stop offset="1" stopColor="#DFCBA6" />
        </radialGradient>
      </defs>

      <ellipse cx="140" cy="232" rx="104" ry="12" fill="#000" opacity="0.16" />

      {/* Mug body — taller and straighter than the espresso cup. */}
      <path
        d="M 78 104 L 202 104 L 192 222 Q 140 234 88 222 Z"
        fill={`url(#${id}-body)`}
        stroke="#14100B"
        strokeWidth="1.2"
      />
      <path
        d="M 202 128 Q 240 128 240 166 Q 240 202 200 200"
        fill="none"
        stroke="#DFCBA6"
        strokeWidth="9"
        strokeLinecap="round"
      />
      <path
        d="M 202 128 Q 240 128 240 166 Q 240 202 200 200"
        fill="none"
        stroke="#14100B"
        strokeWidth="1.2"
        opacity="0.5"
      />

      <ellipse
        cx="140"
        cy="104"
        rx="62"
        ry="10"
        fill="#14100B"
        opacity="0.85"
      />
      <ellipse cx="140" cy="104" rx="56" ry="8" fill={`url(#${id})`} />

      {topping === "cream" && (
        <>
          <ellipse cx="140" cy="100" rx="34" ry="7" fill="#FFF9EC" />
          <path
            d="M 118 98 Q 140 88 162 98"
            stroke="#C89A5E"
            strokeWidth="2.4"
            fill="none"
            strokeLinecap="round"
            opacity="0.75"
          />
        </>
      )}
      {topping === "cinnamon" && (
        <g opacity="0.65">
          {[
            [122, 102],
            [136, 99],
            [150, 104],
            [130, 107],
            [156, 99],
            [144, 108],
          ].map(([cx, cy], i) => (
            <circle key={i} cx={cx} cy={cy} r="1.8" fill="#8A4A1E" />
          ))}
        </g>
      )}

      <ellipse cx="118" cy="102" rx="12" ry="2.6" fill="#FFF" opacity="0.35" />

      <g
        stroke="#14100B"
        strokeWidth="2.2"
        fill="none"
        opacity="0.22"
        strokeLinecap="round"
      >
        <path d="M 122 84 Q 112 66 122 48" />
        <path d="M 158 84 Q 168 66 158 48" />
      </g>
    </svg>
  );
}

/* ─────────────────────────────────────────────────────────────
   Cake slice — cheesecake, magnolia, brownie, tiramisù, marlenka
   ───────────────────────────────────────────────────────────── */

export function CakeSlice({
  tone = "cream",
  size = "100%",
  layers = 3,
  crumb = "#C9A06A",
  glaze,
}: {
  tone?: string;
  size?: number | string;
  layers?: number;
  /** Base / biscuit colour. */
  crumb?: string;
  /** Optional sauce over the top. */
  glaze?: string;
}) {
  const l = liquid(tone);
  const id = `ck-${tone}`;
  const bodyTop = 108;
  const bodyBottom = 206;
  const band = (bodyBottom - bodyTop) / Math.max(1, layers);
  return (
    <svg
      viewBox="0 0 280 260"
      style={{ width: size, height: size }}
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={l.from} />
          <stop offset="1" stopColor={l.to} />
        </linearGradient>
      </defs>

      <ellipse cx="140" cy="234" rx="106" ry="12" fill="#000" opacity="0.16" />
      {/* Plate */}
      <ellipse cx="140" cy="224" rx="104" ry="18" fill="#F3E9D6" />
      <ellipse cx="140" cy="220" rx="86" ry="13" fill="#E6D7BB" />

      {/* Wedge front face — a slice, not a whole cake. */}
      <path
        d={`M 76 ${bodyTop} L 204 ${bodyTop} L 190 ${bodyBottom} L 90 ${bodyBottom} Z`}
        fill={`url(#${id})`}
        stroke="#14100B"
        strokeWidth="1.2"
      />

      {/* Interior layers read as sponge / cream alternation. */}
      {Array.from({ length: Math.max(0, layers - 1) }, (_, i) => (
        <line
          key={i}
          x1={78 + i * 2}
          y1={bodyTop + band * (i + 1)}
          x2={202 - i * 2}
          y2={bodyTop + band * (i + 1)}
          stroke="#FFF"
          strokeWidth="4"
          opacity="0.35"
        />
      ))}

      {/* Biscuit base */}
      <path
        d={`M 88 ${bodyBottom - 16} L 192 ${bodyBottom - 16} L 190 ${bodyBottom} L 90 ${bodyBottom} Z`}
        fill={crumb}
      />

      {/* Top face, tilted — gives the wedge depth. */}
      <path
        d={`M 76 ${bodyTop} L 204 ${bodyTop} L 186 ${bodyTop - 18} L 94 ${bodyTop - 18} Z`}
        fill={l.foam ?? "#FFF"}
        opacity="0.9"
      />
      {glaze && (
        <path
          d={`M 94 ${bodyTop - 14} Q 140 ${bodyTop - 26} 186 ${bodyTop - 14} Q 176 ${bodyTop + 6} 140 ${bodyTop + 2} Q 108 ${bodyTop + 8} 94 ${bodyTop - 14} Z`}
          fill={glaze}
          opacity="0.85"
        />
      )}
      <ellipse
        cx="112"
        cy={bodyTop - 10}
        rx="16"
        ry="4"
        fill="#FFF"
        opacity="0.35"
      />
    </svg>
  );
}

/* ─────────────────────────────────────────────────────────────
   Snack — simit, sandwich, bar
   ───────────────────────────────────────────────────────────── */

export function SnackPlate({
  kind = "bar",
  size = "100%",
  tone = "#C98B44",
}: {
  kind?: "simit" | "sandwich" | "bar" | "nuts";
  size?: number | string;
  tone?: string;
}) {
  return (
    <svg
      viewBox="0 0 280 260"
      style={{ width: size, height: size }}
      aria-hidden="true"
      focusable="false"
    >
      <ellipse cx="140" cy="228" rx="102" ry="12" fill="#000" opacity="0.16" />
      <ellipse cx="140" cy="218" rx="100" ry="18" fill="#F3E9D6" />
      <ellipse cx="140" cy="214" rx="82" ry="13" fill="#E6D7BB" />

      {kind === "simit" && (
        <g>
          <circle
            cx="140"
            cy="150"
            r="66"
            fill="#B9762F"
            stroke="#14100B"
            strokeWidth="1.2"
          />
          <circle cx="140" cy="150" r="62" fill="#CE8B40" />
          <circle cx="140" cy="150" r="22" fill="#F3E9D6" />
          <circle cx="140" cy="150" r="19" fill="#E6D7BB" />
          {/* Sesame */}
          {Array.from({ length: 26 }, (_, i) => {
            const a = (i / 26) * Math.PI * 2;
            const r = 34 + (i % 3) * 9;
            return (
              <ellipse
                key={i}
                cx={140 + Math.cos(a) * r}
                cy={150 + Math.sin(a) * r * 0.96}
                rx="3.4"
                ry="2.2"
                fill="#F6E7C6"
                opacity="0.9"
                transform={`rotate(${(a * 180) / Math.PI} ${140 + Math.cos(a) * r} ${150 + Math.sin(a) * r * 0.96})`}
              />
            );
          })}
        </g>
      )}

      {kind === "sandwich" && (
        <g stroke="#14100B" strokeWidth="1.2">
          <path d="M 62 176 L 218 176 L 210 198 L 70 198 Z" fill="#D8A45E" />
          <path d="M 66 158 L 214 158 L 218 176 L 62 176 Z" fill="#8FB26A" />
          <path d="M 70 140 L 210 140 L 214 158 L 66 158 Z" fill={tone} />
          <path
            d="M 74 118 Q 140 100 206 118 L 210 140 L 70 140 Z"
            fill="#E3B66E"
          />
          <path d="M 74 118 Q 140 100 206 118" fill="none" />
          {[96, 124, 152, 180].map((x) => (
            <circle
              key={x}
              cx={x}
              cy="114"
              r="2.4"
              fill="#F6E7C6"
              stroke="none"
            />
          ))}
        </g>
      )}

      {kind === "bar" && (
        <g stroke="#14100B" strokeWidth="1.2">
          <rect x="72" y="132" width="136" height="52" rx="9" fill={tone} />
          <rect
            x="72"
            y="132"
            width="136"
            height="16"
            rx="8"
            fill="#FFF"
            opacity="0.22"
            stroke="none"
          />
          {Array.from({ length: 14 }, (_, i) => (
            <circle
              key={i}
              cx={86 + (i % 7) * 20}
              cy={i < 7 ? 150 : 170}
              r={i % 3 === 0 ? 4 : 2.8}
              fill="#F6E7C6"
              opacity="0.75"
              stroke="none"
            />
          ))}
        </g>
      )}

      {kind === "nuts" && (
        <g>
          {Array.from({ length: 11 }, (_, i) => {
            const cx = 92 + (i % 4) * 32 + (i > 7 ? 16 : 0);
            const cy = 146 + Math.floor(i / 4) * 26;
            return (
              <g key={i} transform={`rotate(${(i * 37) % 60} ${cx} ${cy})`}>
                <ellipse
                  cx={cx}
                  cy={cy}
                  rx="15"
                  ry="13"
                  fill="#C98B44"
                  stroke="#14100B"
                  strokeWidth="1"
                />
                <path
                  d={`M ${cx - 9} ${cy} Q ${cx} ${cy - 6} ${cx + 9} ${cy}`}
                  stroke="#8A5623"
                  strokeWidth="1.4"
                  fill="none"
                />
              </g>
            );
          })}
        </g>
      )}
    </svg>
  );
}

/* ─────────────────────────────────────────────────────────────
   Bottle — water, soda
   ───────────────────────────────────────────────────────────── */

export function BottleDrink({
  tone = "water",
  size = "100%",
  sparkling = false,
}: {
  tone?: string;
  size?: number | string;
  sparkling?: boolean;
}) {
  const l = liquid(tone);
  const id = `bd-${tone}`;
  return (
    <svg
      viewBox="0 0 220 320"
      style={{ width: size, height: size }}
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={l.from} />
          <stop offset="1" stopColor={l.to} />
        </linearGradient>
      </defs>

      <ellipse cx="110" cy="294" rx="52" ry="5" fill="#000" opacity="0.16" />

      <path
        d="M 96 34 L 124 34 L 124 68 Q 152 88 152 128 L 152 274 Q 152 288 138 288 L 82 288 Q 68 288 68 274 L 68 128 Q 68 88 96 68 Z"
        fill="rgba(255,255,255,0.12)"
        stroke="#14100B"
        strokeWidth="1.4"
      />
      <path
        d="M 70 132 L 150 132 L 150 272 Q 150 286 137 286 L 83 286 Q 70 286 70 272 Z"
        fill={`url(#${id})`}
      />
      <rect
        x="92"
        y="24"
        width="36"
        height="16"
        rx="4"
        fill="#14100B"
        opacity="0.8"
      />
      {/* Label band */}
      <rect
        x="70"
        y="168"
        width="80"
        height="52"
        fill="#F6EEDF"
        opacity="0.92"
      />
      <line
        x1="82"
        y1="184"
        x2="138"
        y2="184"
        stroke="#8A7A6C"
        strokeWidth="2.4"
        opacity="0.5"
      />
      <line
        x1="82"
        y1="196"
        x2="122"
        y2="196"
        stroke="#8A7A6C"
        strokeWidth="2"
        opacity="0.35"
      />

      {sparkling &&
        Array.from({ length: 12 }, (_, i) => (
          <circle
            key={i}
            cx={82 + (i % 4) * 18 + (i % 2) * 5}
            cy={144 + Math.floor(i / 4) * 34}
            r={i % 3 === 0 ? 3 : 2}
            fill="#FFF"
            opacity="0.55"
          />
        ))}

      <line
        x1="80"
        y1="140"
        x2="80"
        y2="268"
        stroke="#FFF"
        strokeWidth="1.6"
        opacity="0.4"
      />
    </svg>
  );
}

/* ─────────────────────────────────────────────────────────────
   Extras — syrup pump, extra shot, alternative milk
   ───────────────────────────────────────────────────────────── */

export function ExtraItem({
  kind = "syrup",
  size = "100%",
}: {
  kind?: "syrup" | "shot" | "milk";
  size?: number | string;
}) {
  return (
    <svg
      viewBox="0 0 280 260"
      style={{ width: size, height: size }}
      aria-hidden="true"
      focusable="false"
    >
      <ellipse cx="140" cy="232" rx="86" ry="11" fill="#000" opacity="0.16" />

      {kind === "syrup" && (
        <g stroke="#14100B" strokeWidth="1.3">
          <rect x="102" y="96" width="76" height="126" rx="10" fill="#C98B44" />
          <rect
            x="102"
            y="132"
            width="76"
            height="52"
            fill="#F6EEDF"
            opacity="0.92"
            stroke="none"
          />
          <line
            x1="114"
            y1="150"
            x2="166"
            y2="150"
            stroke="#8A7A6C"
            strokeWidth="2.4"
            opacity="0.5"
          />
          <line
            x1="114"
            y1="164"
            x2="150"
            y2="164"
            stroke="#8A7A6C"
            strokeWidth="2"
            opacity="0.35"
          />
          <rect x="126" y="76" width="28" height="22" rx="4" fill="#DFCBA6" />
          <path
            d="M 140 76 L 140 52 L 186 52 L 186 74"
            fill="none"
            strokeWidth="7"
            stroke="#DFCBA6"
            strokeLinecap="round"
          />
          <circle cx="186" cy="82" r="4" fill="#8A5623" stroke="none" />
        </g>
      )}

      {kind === "shot" && (
        <g stroke="#14100B" strokeWidth="1.3">
          <path
            d="M 106 132 L 174 132 L 166 214 Q 140 222 114 214 Z"
            fill="rgba(255,255,255,0.14)"
          />
          <path
            d="M 110 156 L 170 156 L 164 212 Q 140 219 116 212 Z"
            fill="#3A2418"
          />
          <ellipse cx="140" cy="156" rx="30" ry="5" fill="#A06A32" />
          <ellipse
            cx="130"
            cy="155"
            rx="9"
            ry="2.4"
            fill="#E9B872"
            opacity="0.7"
            stroke="none"
          />
          <g
            stroke="#14100B"
            strokeWidth="2"
            fill="none"
            opacity="0.22"
            strokeLinecap="round"
          >
            <path d="M 126 118 Q 118 102 126 86" />
            <path d="M 156 118 Q 164 102 156 86" />
          </g>
        </g>
      )}

      {kind === "milk" && (
        <g stroke="#14100B" strokeWidth="1.3">
          <path
            d="M 96 106 L 178 106 L 172 216 Q 138 226 102 216 Z"
            fill="#FBF3DF"
          />
          <path
            d="M 178 128 Q 212 132 210 162 Q 208 188 176 186"
            fill="none"
            strokeWidth="8"
            stroke="#EFE0C0"
          />
          <ellipse cx="137" cy="106" rx="41" ry="8" fill="#FFF" />
          <ellipse cx="137" cy="106" rx="34" ry="5.5" fill="#F2E6CE" />
          <path d="M 96 118 L 78 104 Q 88 96 100 104 Z" fill="#FBF3DF" />
          <line
            x1="110"
            y1="126"
            x2="108"
            y2="206"
            stroke="#E4D3B4"
            strokeWidth="2.4"
          />
        </g>
      )}
    </svg>
  );
}
