"use client";

import { useEffect, type ReactElement } from "react";

/* ─────────────────────────────────────────────────────────────
   Reveal observer hook
   ───────────────────────────────────────────────────────────── */
export function useReveal() {
  useEffect(() => {
    const els = document.querySelectorAll(".reveal");
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add("in");
            io.unobserve(e.target);
          }
        });
      },
      { threshold: 0.1, rootMargin: "0px 0px -6% 0px" },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);
}

/* ─────────────────────────────────────────────────────────────
   Photo placeholder — refined gradient surface with subtle grain
   ───────────────────────────────────────────────────────────── */

export const HUES: Record<string, { from: string; to: string; ink: string }> = {
  cream: { from: "#F5E6D3", to: "#E0CDB0", ink: "#5A4030" },
  warm: { from: "#FAF2E5", to: "#EBDCC4", ink: "#5A4030" },
  stone: { from: "#EDE5D7", to: "#D2C5AE", ink: "#3A2F22" },
  caramel: { from: "#D4A266", to: "#8E5F2E", ink: "#FFF" },
  espresso: { from: "#3E2614", to: "#14100B", ink: "#E6D4B0" },
  matcha: { from: "#B8CFA1", to: "#6A8A4A", ink: "#FFF" },
  pistachio: { from: "#D5E2A6", to: "#94B25E", ink: "#3A4220" },
  rose: { from: "#F2B3C0", to: "#C5435A", ink: "#FFF" },
  bougainvillea: { from: "#E55F7E", to: "#8E2A45", ink: "#FFF" },
  gold: { from: "#E0BC75", to: "#B88A4A", ink: "#FFF" },
  sky: { from: "#E0C9A2", to: "#B88243", ink: "#FFF" },
  dawn: { from: "#F2C7A0", to: "#D67F4A", ink: "#FFF" },
};

interface PhotoSurfaceProps {
  hue?: string;
  children?: React.ReactNode;
  dotLabel?: string;
  dotPos?: string;
  vignette?: boolean;
}

export function PhotoSurface({
  hue = "warm",
  children,
  dotLabel,
  dotPos = "br",
  vignette = false,
}: PhotoSurfaceProps) {
  const h = HUES[hue] || HUES.warm;
  const posStyle: React.CSSProperties = {};
  if (dotPos.includes("t")) posStyle.top = 16;
  else posStyle.bottom = 16;
  if (dotPos.includes("l")) posStyle.left = 16;
  else posStyle.right = 16;

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        position: "relative",
        background: `linear-gradient(160deg, ${h.from} 0%, ${h.to} 100%)`,
        overflow: "hidden",
        borderRadius: "inherit",
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          background:
            "radial-gradient(ellipse at 30% 20%, rgba(255,255,255,0.25), transparent 60%), radial-gradient(ellipse at 80% 80%, rgba(0,0,0,0.15), transparent 60%)",
        }}
      />
      {vignette && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            pointerEvents: "none",
            background:
              "radial-gradient(ellipse at center, transparent 50%, rgba(0,0,0,0.18) 100%)",
          }}
        />
      )}
      <div style={{ position: "relative", width: "100%", height: "100%" }}>
        {children}
      </div>
      {dotLabel && (
        <div
          style={{
            position: "absolute",
            ...posStyle,
            padding: "6px 12px",
            background: "rgba(255, 255, 255, 0.92)",
            backdropFilter: "blur(10px)",
            borderRadius: 999,
            fontFamily: "var(--mono)",
            fontSize: 10,
            letterSpacing: "0.2em",
            textTransform: "uppercase",
            color: "var(--ink)",
          }}
        >
          {dotLabel}
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   Cup Emblem — circular brand sticker
   ───────────────────────────────────────────────────────────── */

export function CupEmblem({
  size = 220,
  color = "#14100B",
  bg = "#F5E6D3",
  ringColor,
  className,
}: {
  size?: number;
  color?: string;
  bg?: string;
  ringColor?: string;
  className?: string;
}) {
  const rc = ringColor || color;
  return (
    <svg
      viewBox="0 0 240 240"
      width={className ? undefined : size}
      height={className ? undefined : size}
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <path id="ce-top" d="M 28 120 A 92 92 0 0 1 212 120" fill="none" />
        <path id="ce-bot" d="M 28 120 A 92 92 0 0 0 212 120" fill="none" />
      </defs>
      <circle cx="120" cy="120" r="116" fill={bg} />
      <circle
        cx="120"
        cy="120"
        r="112"
        fill="none"
        stroke={rc}
        strokeWidth="0.5"
        opacity="0.4"
      />
      <circle
        cx="120"
        cy="120"
        r="100"
        fill="none"
        stroke={rc}
        strokeWidth="1.5"
      />
      <text
        fontFamily="'JetBrains Mono', monospace"
        fontSize="9"
        letterSpacing="5"
        fill={color}
      >
        <textPath href="#ce-top" startOffset="50%" textAnchor="middle">
          DRINK IT · EAT THE CUP · DRINK IT · EAT
        </textPath>
      </text>
      <text
        fontFamily="'JetBrains Mono', monospace"
        fontSize="9"
        letterSpacing="5"
        fill={color}
        opacity="0.7"
      >
        <textPath href="#ce-bot" startOffset="50%" textAnchor="middle">
          L'AFFOGATO · MCMLXXXVII · ISTANBUL · MMXXVI
        </textPath>
      </text>
      <text
        x="120"
        y="116"
        textAnchor="middle"
        fontFamily="'Playfair Display', serif"
        fontStyle="italic"
        fontWeight="500"
        fontSize="34"
        fill={color}
        letterSpacing="-0.5"
      >
        L
        <tspan dy="-2" dx="-2" fontSize="22">
          ’
        </tspan>
        <tspan dy="2" dx="-2">
          Affogato
        </tspan>
      </text>
      <circle cx="160" cy="92" r="2.5" fill={color} />
      <g transform="translate(120 136)">
        <circle cx="-14" cy="0" r="2.2" fill="#C5435A" />
        <circle cx="0" cy="0" r="2.2" fill={color} />
        <circle cx="14" cy="0" r="2.2" fill="#6A8A4A" />
      </g>
      <text
        x="120"
        y="162"
        textAnchor="middle"
        fontFamily="'Pinyon Script', cursive"
        fontSize="22"
        fill={color}
      >
        caffè · gelato
      </text>
      <text
        x="120"
        y="186"
        textAnchor="middle"
        fontFamily="'JetBrains Mono', monospace"
        fontSize="8"
        letterSpacing="3.5"
        fill={color}
        opacity="0.55"
      >
        DAL · 1987
      </text>
    </svg>
  );
}

/* ─────────────────────────────────────────────────────────────
   Edible cup hero
   ───────────────────────────────────────────────────────────── */

export function EdibleCupHero({
  scoop = "cream",
  topping = "wafer",
  size,
}: {
  scoop?: string;
  topping?: string;
  size?: number | string;
}) {
  const colorMap: Record<string, [string, string]> = {
    cream: ["#FBF3DF", "#E9D6AC"],
    pistachio: ["#D8E5A9", "#A8C46E"],
    matcha: ["#C8DCA8", "#8AAE60"],
    strawberry: ["#F5C6CF", "#D6647A"],
    cioccolato: ["#6B4628", "#3A2110"],
    nocciola: ["#D8B888", "#9A6F44"],
  };
  const scoopColor = colorMap[scoop] || colorMap.cream;

  return (
    <svg
      viewBox="0 0 360 440"
      style={{ width: size || "100%", height: size || "100%" }}
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <linearGradient id={`ec-waffle-${scoop}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#D4A275" />
          <stop offset="1" stopColor="#8A5A2A" />
        </linearGradient>
        <pattern
          id={`ec-pat-${scoop}`}
          patternUnits="userSpaceOnUse"
          width="12"
          height="12"
          patternTransform="rotate(45)"
        >
          <rect width="12" height="12" fill={`url(#ec-waffle-${scoop})`} />
          <line
            x1="0"
            y1="0"
            x2="12"
            y2="0"
            stroke="#3A2410"
            strokeOpacity="0.4"
            strokeWidth="0.7"
          />
          <line
            x1="0"
            y1="6"
            x2="12"
            y2="6"
            stroke="#3A2410"
            strokeOpacity="0.3"
            strokeWidth="0.7"
          />
        </pattern>
        <linearGradient id={`ec-scoop-${scoop}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={scoopColor[0]} />
          <stop offset="1" stopColor={scoopColor[1]} />
        </linearGradient>
        <clipPath id={`ec-clip-${scoop}`}>
          <path d="M 90 200 L 270 200 L 252 400 L 108 400 Z" />
        </clipPath>
      </defs>

      <path
        d="M 90 200 L 270 200 L 252 400 L 108 400 Z"
        fill={`url(#ec-pat-${scoop})`}
      />
      <path
        d="M 90 200 L 270 200 L 252 400 L 108 400 Z"
        fill="none"
        stroke="#2A1808"
        strokeWidth="2"
      />
      <ellipse cx="180" cy="200" rx="90" ry="10" fill="#7A4A1F" />
      <ellipse cx="180" cy="200" rx="85" ry="6" fill="#3A2410" />

      <g>
        <rect x="96" y="252" width="168" height="86" fill="#F5E6D3" />
        <circle cx="116" cy="266" r="4" fill="#C5435A" />
        <circle cx="128" cy="266" r="3" fill="#6A8A4A" />
        <circle cx="216" cy="266" r="3" fill="#6A8A4A" />
        <circle cx="230" cy="266" r="4" fill="#C5435A" />
        <circle cx="240" cy="276" r="2" fill="#B88A4A" />
        <circle cx="106" cy="276" r="2" fill="#B88A4A" />
        <text
          x="180"
          y="298"
          textAnchor="middle"
          fontFamily="'Playfair Display', serif"
          fontStyle="italic"
          fontWeight="500"
          fontSize="26"
          fill="#14100B"
        >
          L’Affogato
        </text>
        <line
          x1="138"
          y1="306"
          x2="222"
          y2="306"
          stroke="#14100B"
          strokeWidth="0.5"
        />
        <text
          x="180"
          y="322"
          textAnchor="middle"
          fontFamily="'JetBrains Mono', monospace"
          fontSize="7"
          letterSpacing="3"
          fill="#14100B"
        >
          DRINK IT · EAT THE CUP
        </text>
      </g>

      <g clipPath={`url(#ec-clip-${scoop})`}>
        <ellipse
          cx="180"
          cy="190"
          rx="86"
          ry="50"
          fill={`url(#ec-scoop-${scoop})`}
        />
      </g>
      <path
        d="M 100 200 Q 120 142 152 188 Q 168 142 180 184 Q 200 142 220 192 Q 240 142 260 200"
        fill={`url(#ec-scoop-${scoop})`}
        stroke={scoopColor[1]}
        strokeWidth="1"
      />
      <ellipse cx="148" cy="170" rx="24" ry="10" fill="#FFF" opacity="0.5" />

      {topping === "wafer" && (
        <g transform="rotate(-15 168 154)">
          <rect x="162" y="100" width="10" height="64" rx="5" fill="#C89460" />
          <line
            x1="166"
            y1="108"
            x2="166"
            y2="158"
            stroke="#8A5A2A"
            strokeWidth="0.6"
          />
          <line
            x1="170"
            y1="108"
            x2="170"
            y2="158"
            stroke="#8A5A2A"
            strokeWidth="0.6"
          />
        </g>
      )}
      {topping === "strawberry" && (
        <g>
          <path
            d="M 196 152 Q 210 144 220 156 Q 216 170 204 168 Q 194 164 196 152 Z"
            fill="#D6647A"
          />
          <circle cx="206" cy="158" r="1" fill="#FFF" />
          <circle cx="212" cy="162" r="1" fill="#FFF" />
        </g>
      )}

      <ellipse cx="180" cy="418" rx="106" ry="6" fill="#000" opacity="0.16" />
    </svg>
  );
}

/* ─────────────────────────────────────────────────────────────
   Espresso doppio cup
   ───────────────────────────────────────────────────────────── */

export function EspressoCup({ size = "100%" }: { size?: number | string }) {
  return (
    <svg
      viewBox="0 0 280 260"
      style={{ width: size, height: size }}
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <radialGradient id="ec-cup-fill" cx="0.5" cy="0.4" r="0.6">
          <stop offset="0" stopColor="#FAF5EC" />
          <stop offset="1" stopColor="#E0CCA8" />
        </radialGradient>
        <radialGradient id="ec-crema" cx="0.5" cy="0.4" r="0.7">
          <stop offset="0" stopColor="#E9B872" />
          <stop offset="0.6" stopColor="#A06A32" />
          <stop offset="1" stopColor="#5A3818" />
        </radialGradient>
      </defs>
      <ellipse cx="140" cy="230" rx="120" ry="14" fill="#000" opacity="0.16" />
      <ellipse cx="140" cy="220" rx="116" ry="16" fill="url(#ec-cup-fill)" />
      <ellipse cx="140" cy="218" rx="100" ry="12" fill="#E0CCA8" />
      <path
        d="M 80 150 Q 80 218 140 218 Q 200 218 200 150 Z"
        fill="url(#ec-cup-fill)"
      />
      <ellipse cx="140" cy="150" rx="60" ry="9" fill="#14100B" />
      <ellipse cx="140" cy="150" rx="54" ry="6" fill="url(#ec-crema)" />
      <ellipse cx="124" cy="148" rx="14" ry="3" fill="#FBE5A0" opacity="0.6" />
      <path
        d="M 200 165 Q 232 165 232 192 Q 232 218 200 215"
        fill="none"
        stroke="#E0CCA8"
        strokeWidth="6"
      />
      <text
        x="140"
        y="195"
        textAnchor="middle"
        fontFamily="Playfair Display"
        fontStyle="italic"
        fontSize="14"
        fill="#14100B"
        opacity="0.5"
      >
        L’A
      </text>
    </svg>
  );
}

/* ─────────────────────────────────────────────────────────────
   Matcha latte glass
   ───────────────────────────────────────────────────────────── */

export function MatchaGlass({
  size = "100%",
  strawberry = false,
}: {
  size?: number | string;
  strawberry?: boolean;
}) {
  return (
    <svg
      viewBox="0 0 220 320"
      style={{ width: size, height: size }}
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <linearGradient id="mg-matcha" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#A8C980" />
          <stop offset="1" stopColor="#6A8A4A" />
        </linearGradient>
        <linearGradient id="mg-milk" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#FBF3DF" />
          <stop offset="1" stopColor="#F0E0BC" />
        </linearGradient>
        <linearGradient id="mg-straw" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#E9647A" />
          <stop offset="1" stopColor="#C5435A" />
        </linearGradient>
      </defs>
      <ellipse cx="110" cy="296" rx="68" ry="5" fill="#000" opacity="0.16" />
      <path
        d="M 56 70 L 164 70 L 156 290 L 64 290 Z"
        fill="rgba(255,255,255,0.1)"
        stroke="#14100B"
        strokeWidth="1.4"
      />
      {strawberry ? (
        <>
          <path
            d="M 60 240 L 160 240 L 156 290 L 64 290 Z"
            fill="url(#mg-straw)"
          />
          <path
            d="M 59 160 L 161 160 L 160 240 L 60 240 Z"
            fill="url(#mg-milk)"
          />
          <path
            d="M 58 90 L 162 90 L 161 160 L 59 160 Z"
            fill="url(#mg-matcha)"
          />
          <ellipse cx="110" cy="90" rx="52" ry="5" fill="#5A7A3A" />
          <g transform="translate(110 76)">
            <path
              d="M -14 -6 Q 0 -16 14 -6 Q 10 8 0 8 Q -10 6 -14 -6 Z"
              fill="#D6647A"
            />
            <circle cx="-4" cy="-2" r="1" fill="#FFF" />
            <circle cx="4" cy="2" r="1" fill="#FFF" />
            <circle cx="2" cy="-4" r="1" fill="#FFF" />
          </g>
        </>
      ) : (
        <>
          <path
            d="M 59 110 L 161 110 L 156 290 L 64 290 Z"
            fill="url(#mg-matcha)"
          />
          <ellipse
            cx="110"
            cy="110"
            rx="51"
            ry="6"
            fill="#FBF3DF"
            opacity="0.6"
          />
          <path
            d="M 110 102 Q 92 122 110 144 Q 128 122 110 102"
            fill="#FBF3DF"
            opacity="0.85"
          />
        </>
      )}
      <line
        x1="68"
        y1="86"
        x2="68"
        y2="270"
        stroke="#FFF"
        strokeWidth="1.6"
        opacity="0.45"
      />
      <rect
        x="138"
        y="40"
        width="4"
        height="80"
        fill="#14100B"
        transform="rotate(8 140 80)"
      />
      {strawberry &&
        [0, 1, 2, 3].map((i) => (
          <circle
            key={i}
            cx={70 + i * 24}
            cy={200 + (i % 2) * 20}
            r="2"
            fill="#FFF"
            opacity="0.5"
          />
        ))}
    </svg>
  );
}

/* ─────────────────────────────────────────────────────────────
   Gelato scoop in glass
   ───────────────────────────────────────────────────────────── */

export function GelatoScoop({
  size = "100%",
  flavor = "cream",
}: {
  size?: number | string;
  flavor?: string;
}) {
  const colors: Record<string, [string, string]> = {
    cream: ["#FBF3DF", "#E9D6AC"],
    pistachio: ["#D8E5A9", "#A8C46E"],
    strawberry: ["#F5C6CF", "#D6647A"],
    cioccolato: ["#6B4628", "#3A2110"],
    nocciola: ["#D8B888", "#9A6F44"],
    matcha: ["#C8DCA8", "#8AAE60"],
  };
  const [c1, c2] = colors[flavor] || colors.cream;
  return (
    <svg
      viewBox="0 0 240 260"
      style={{ width: size, height: size }}
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <linearGradient id={`gs2-${flavor}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={c1} />
          <stop offset="1" stopColor={c2} />
        </linearGradient>
      </defs>
      <ellipse cx="120" cy="248" rx="80" ry="6" fill="#000" opacity="0.16" />
      <path
        d="M 70 120 L 170 120 L 158 240 L 82 240 Z"
        fill="rgba(255,255,255,0.16)"
        stroke="#14100B"
        strokeWidth="1.4"
      />
      <path
        d="M 73 145 L 167 145 L 158 240 L 82 240 Z"
        fill="#FBF3DF"
        opacity="0.4"
      />
      <circle cx="120" cy="110" r="42" fill={`url(#gs2-${flavor})`} />
      <circle cx="95" cy="92" r="24" fill={`url(#gs2-${flavor})`} />
      <circle cx="148" cy="92" r="22" fill={`url(#gs2-${flavor})`} />
      <ellipse cx="108" cy="90" rx="14" ry="6" fill="#FFF" opacity="0.55" />
      <ellipse cx="135" cy="78" rx="8" ry="4" fill="#FFF" opacity="0.55" />
      <circle cx="100" cy="118" r="2" fill="#3A2110" opacity="0.55" />
      <circle cx="140" cy="112" r="1.5" fill="#3A2110" opacity="0.55" />
      <circle cx="125" cy="128" r="1.5" fill="#3A2110" opacity="0.55" />
    </svg>
  );
}

/* ─────────────────────────────────────────────────────────────
   Bean illustration
   ───────────────────────────────────────────────────────────── */

export function BeanIllo({
  size = "100%",
  dark = false,
}: {
  size?: number | string;
  dark?: boolean;
}) {
  return (
    <svg
      viewBox="0 0 220 220"
      style={{ width: size, height: size }}
      aria-hidden="true"
      focusable="false"
    >
      {Array.from({ length: 14 }).map((_, i) => {
        const r = Math.floor(i / 4);
        const c = i % 4;
        const x = 36 + c * 50 + (r % 2) * 24;
        const y = 36 + r * 50;
        const rot = (i * 37) % 360;
        return (
          <g key={i} transform={`translate(${x} ${y}) rotate(${rot})`}>
            <ellipse rx="22" ry="14" fill={dark ? "#1A0F08" : "#3A2410"} />
            <ellipse
              rx="22"
              ry="14"
              fill="none"
              stroke={dark ? "#3A2410" : "#1A0F08"}
              strokeWidth="0.6"
              opacity="0.5"
            />
            <path
              d="M -22 0 Q 0 0 22 0"
              stroke={dark ? "#0E0905" : "#14100B"}
              strokeWidth="2"
              fill="none"
            />
            <ellipse rx="6" ry="3" fill={dark ? "#0E0905" : "#14100B"} cy="0" />
          </g>
        );
      })}
    </svg>
  );
}

/* ─────────────────────────────────────────────────────────────
   Bag of coffee
   ───────────────────────────────────────────────────────────── */

export function CoffeeBag({
  size = "100%",
  label = "Sirena",
  sub = "Espresso Blend · 250g",
  tone = "dark",
}: {
  size?: number | string;
  label?: string;
  sub?: string;
  tone?: string;
}) {
  const bg =
    tone === "dark" ? "#14100B" : tone === "gold" ? "#B88A4A" : "#FAF5EC";
  const ink =
    tone === "dark" ? "#F5E6D3" : tone === "gold" ? "#FFF" : "#14100B";
  const accent =
    tone === "dark" ? "#B88A4A" : tone === "gold" ? "#FFF" : "#B88A4A";
  return (
    <svg
      viewBox="0 0 240 320"
      style={{ width: size, height: size }}
      aria-hidden="true"
      focusable="false"
    >
      <ellipse cx="120" cy="306" rx="86" ry="6" fill="#000" opacity="0.18" />
      <path
        d="M 60 60 Q 56 50 64 46 L 176 46 Q 184 50 180 60 L 192 300 L 48 300 Z"
        fill={bg}
      />
      <path
        d="M 56 60 L 184 60"
        stroke={ink}
        strokeOpacity="0.2"
        strokeWidth="1"
      />
      <rect
        x="100"
        y="38"
        width="40"
        height="12"
        fill={bg}
        stroke={ink}
        strokeOpacity="0.4"
        strokeWidth="0.6"
      />
      <rect
        x="76"
        y="120"
        width="88"
        height="124"
        fill="none"
        stroke={accent}
        strokeOpacity="0.4"
        strokeWidth="0.6"
      />
      <text
        x="120"
        y="146"
        textAnchor="middle"
        fontFamily="JetBrains Mono"
        fontSize="7"
        letterSpacing="3"
        fill={accent}
        opacity="0.7"
      >
        L’AFFOGATO ITALIA
      </text>
      <line
        x1="92"
        y1="155"
        x2="148"
        y2="155"
        stroke={ink}
        strokeOpacity="0.4"
      />
      <text
        x="120"
        y="186"
        textAnchor="middle"
        fontFamily="Playfair Display"
        fontStyle="italic"
        fontSize="26"
        fill={ink}
      >
        {label}
      </text>
      <text
        x="120"
        y="206"
        textAnchor="middle"
        fontFamily="JetBrains Mono"
        fontSize="7"
        letterSpacing="2"
        fill={ink}
        opacity="0.7"
      >
        {sub}
      </text>
      <line
        x1="92"
        y1="218"
        x2="148"
        y2="218"
        stroke={ink}
        strokeOpacity="0.4"
      />
      <text
        x="120"
        y="234"
        textAnchor="middle"
        fontFamily="Pinyon Script"
        fontSize="14"
        fill={accent}
      >
        since 1987
      </text>
    </svg>
  );
}

/* ─────────────────────────────────────────────────────────────
   Reel scenes
   ───────────────────────────────────────────────────────────── */

export function ReelScene({ variant = 0 }: { variant?: number }) {
  const variants: Array<() => ReactElement> = [
    () => (
      <svg
        viewBox="0 0 220 392"
        style={{ width: "100%", height: "100%" }}
        preserveAspectRatio="xMidYMid slice"
        aria-hidden="true"
        focusable="false"
      >
        <rect width="220" height="392" fill="url(#rg0)" />
        <defs>
          <linearGradient id="rg0" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#2A1B0F" />
            <stop offset="1" stopColor="#0E0905" />
          </linearGradient>
        </defs>
        <ellipse cx="110" cy="280" rx="80" ry="10" fill="#0E0905" />
        <rect x="50" y="170" width="120" height="110" fill="#1A0F08" rx="6" />
        <ellipse cx="110" cy="180" rx="52" ry="6" fill="#B88A4A" />
        <rect
          x="106"
          y="40"
          width="8"
          height="130"
          fill="#14100B"
        />
        <circle cx="180" cy="80" r="3" fill="#E9B872" opacity="0.65" />
      </svg>
    ),
    () => (
      <svg
        viewBox="0 0 220 392"
        style={{ width: "100%", height: "100%" }}
        preserveAspectRatio="xMidYMid slice"
        aria-hidden="true"
        focusable="false"
      >
        <rect width="220" height="392" fill="url(#rg1)" />
        <defs>
          <linearGradient id="rg1" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#F2B3C0" />
            <stop offset="1" stopColor="#C5435A" />
          </linearGradient>
        </defs>
        <g transform="translate(110 196)">
          <MatchaGlassInline strawberry size={280} />
        </g>
      </svg>
    ),
    () => (
      <svg
        viewBox="0 0 220 392"
        style={{ width: "100%", height: "100%" }}
        preserveAspectRatio="xMidYMid slice"
        aria-hidden="true"
        focusable="false"
      >
        <rect width="220" height="392" fill="#F5E6D3" />
        <g transform="translate(110 196)">
          <CupHeroInline />
        </g>
      </svg>
    ),
    () => (
      <svg
        viewBox="0 0 220 392"
        style={{ width: "100%", height: "100%" }}
        preserveAspectRatio="xMidYMid slice"
        aria-hidden="true"
        focusable="false"
      >
        <rect width="220" height="392" fill="#8AAE60" />
        {Array.from({ length: 18 }).map((_, i) => (
          <ellipse
            key={i}
            cx={15 + ((i * 23) % 200)}
            cy={25 + ((i * 47) % 360)}
            rx="13"
            ry="9"
            fill={i % 2 ? "#D5E2A6" : "#94B25E"}
            transform={`rotate(${(i * 51) % 360} ${15 + ((i * 23) % 200)} ${25 + ((i * 47) % 360)})`}
          />
        ))}
      </svg>
    ),
    () => (
      <svg
        viewBox="0 0 220 392"
        style={{ width: "100%", height: "100%" }}
        preserveAspectRatio="xMidYMid slice"
        aria-hidden="true"
        focusable="false"
      >
        <rect width="220" height="392" fill="url(#rg4)" />
        <defs>
          <linearGradient id="rg4" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#3A2410" />
            <stop offset="1" stopColor="#0E0905" />
          </linearGradient>
        </defs>
        <rect x="60" y="140" width="100" height="20" fill="#0a0604" rx="3" />
        <rect x="20" y="146" width="50" height="10" fill="#3A2410" rx="2" />
        <ellipse cx="148" cy="152" rx="22" ry="14" fill="#5A3A20" />
        <rect
          x="142"
          y="166"
          width="3"
          height="120"
          fill="#3A2410"
        />
        <rect
          x="150"
          y="166"
          width="3"
          height="120"
          fill="#3A2410"
        />
      </svg>
    ),
    () => (
      <svg
        viewBox="0 0 220 392"
        style={{ width: "100%", height: "100%" }}
        preserveAspectRatio="xMidYMid slice"
        aria-hidden="true"
        focusable="false"
      >
        <defs>
          <linearGradient id="rg5" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#E9B872" />
            <stop offset="0.6" stopColor="#B88243" />
            <stop offset="1" stopColor="#3A2410" />
          </linearGradient>
        </defs>
        <rect width="220" height="392" fill="url(#rg5)" />
        <rect
          x="0"
          y="240"
          width="220"
          height="152"
          fill="#1A0F08"
          opacity="0.7"
        />
        <circle cx="50" cy="180" r="14" fill="#0E0905" />
        <rect x="70" y="170" width="14" height="46" fill="#0E0905" />
        <rect x="100" y="158" width="18" height="58" fill="#0E0905" />
        <circle cx="150" cy="178" r="12" fill="#0E0905" />
        <rect x="170" y="178" width="22" height="40" fill="#0E0905" />
        <circle cx="55" cy="160" r="4" fill="#FBE5A0" />
        <circle cx="155" cy="160" r="4" fill="#FBE5A0" />
      </svg>
    ),
    () => (
      <svg
        viewBox="0 0 220 392"
        style={{ width: "100%", height: "100%" }}
        preserveAspectRatio="xMidYMid slice"
        aria-hidden="true"
        focusable="false"
      >
        <rect width="220" height="392" fill="#FBF3DF" />
        <g transform="translate(110 196)">
          <ellipse rx="90" ry="68" fill="#F5E6D3" />
          <path
            d="M -88 0 Q -60 -80 0 0 Q 60 80 90 0"
            stroke="#E9D6AC"
            strokeWidth="22"
            fill="none"
            strokeLinecap="round"
          />
          <circle r="88" fill="none" stroke="#B88A4A" strokeWidth="2" />
        </g>
      </svg>
    ),
    () => (
      <svg
        viewBox="0 0 220 392"
        style={{ width: "100%", height: "100%" }}
        preserveAspectRatio="xMidYMid slice"
        aria-hidden="true"
        focusable="false"
      >
        <defs>
          <linearGradient id="rg7" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#1A0F08" />
            <stop offset="1" stopColor="#3a1818" />
          </linearGradient>
        </defs>
        <rect width="220" height="392" fill="url(#rg7)" />
        <rect
          x="70"
          y="150"
          width="80"
          height="160"
          fill="none"
          stroke="#E9B872"
          strokeWidth="1.5"
        />
        <rect x="72" y="200" width="76" height="108" fill="#C5435A" />
        <rect
          x="92"
          y="216"
          width="22"
          height="22"
          fill="#E9B872"
          opacity="0.55"
        />
        <path
          d="M 130 200 Q 160 170 144 134"
          stroke="#E9B872"
          strokeWidth="4"
          fill="none"
        />
      </svg>
    ),
  ];
  const idx = variant % variants.length;
  return variants[idx]();
}

function MatchaGlassInline({
  strawberry,
  size = 200,
}: {
  strawberry?: boolean;
  size?: number;
}) {
  return (
    <g transform={`scale(${size / 200}) translate(-110 -160)`}>
      <MatchaGlass size={200} strawberry={strawberry} />
    </g>
  );
}

function CupHeroInline() {
  return (
    <g transform="scale(0.5) translate(-180 -220)">
      <EdibleCupHero scoop="strawberry" topping="strawberry" />
    </g>
  );
}

/* ─────────────────────────────────────────────────────────────
   Bar render scene
   ───────────────────────────────────────────────────────────── */

export function BarRenderScene({ time = "golden" }: { time?: string } = {}) {
  void time;
  return (
    <svg
      viewBox="0 0 1200 700"
      style={{ width: "100%", height: "100%", display: "block" }}
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <linearGradient id="brs-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#F2C7A0" />
          <stop offset="0.5" stopColor="#D6914E" />
          <stop offset="1" stopColor="#6E3A1C" />
        </linearGradient>
        <linearGradient id="brs-bar" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#6E4220" />
          <stop offset="1" stopColor="#3A2410" />
        </linearGradient>
        <radialGradient id="brs-glow" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#FFE7A6" stopOpacity="0.95" />
          <stop offset="1" stopColor="#FFE7A6" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="brs-counter" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#F8EFD8" />
          <stop offset="1" stopColor="#E0D2B0" />
        </linearGradient>
      </defs>

      <rect width="1200" height="700" fill="url(#brs-sky)" />

      {[60, 200, 360, 540, 720, 880, 1020].map((x, i) => (
        <g key={x}>
          <rect
            x={x}
            y={180 + (i % 3) * 20}
            width={90 + (i % 2) * 40}
            height={240 - (i % 3) * 20}
            fill="#7A5230"
            opacity={0.6 - (i % 3) * 0.12}
          />
          {Array.from({ length: 8 }).map((_, w) => (
            <rect
              key={w}
              x={x + 10 + (w % 3) * 22}
              y={210 + Math.floor(w / 3) * 28}
              width="6"
              height="10"
              fill="#FFE7A6"
              opacity={0.4 + (w % 3) * 0.15}
            />
          ))}
        </g>
      ))}

      <path
        d="M 0 110 Q 300 134 600 110 T 1200 124"
        stroke="#3A2410"
        strokeWidth="1"
        fill="none"
        opacity="0.5"
      />
      {Array.from({ length: 30 }).map((_, i) => {
        const x = 20 + i * 40;
        const y = 110 + Math.sin(i / 2.5) * 8;
        return (
          <g key={i}>
            <circle cx={x} cy={y + 28} r="20" fill="url(#brs-glow)" />
            <line
              x1={x}
              y1={y}
              x2={x}
              y2={y + 22}
              stroke="#3A2410"
              strokeWidth="0.6"
            />
            <circle cx={x} cy={y + 28} r="4" fill="#FFE7A6" />
          </g>
        );
      })}

      <g>
        <rect
          x="80"
          y="160"
          width="500"
          height="180"
          fill="#2F4220"
          opacity="0.4"
        />
        {Array.from({ length: 140 }).map((_, i) => {
          const x = 60 + ((i * 31) % 500);
          const y = 130 + ((i * 17) % 210);
          const r = 3 + (i % 5);
          const colors = [
            "#C5435A",
            "#E5708A",
            "#A2294A",
            "#F08AA8",
            "#D94F70",
          ];
          return (
            <circle
              key={i}
              cx={x}
              cy={y}
              r={r}
              fill={colors[i % 5]}
              opacity="0.88"
            />
          );
        })}
        {Array.from({ length: 30 }).map((_, i) => {
          const x = 70 + ((i * 23) % 500);
          const y = 150 + ((i * 19) % 180);
          return (
            <ellipse
              key={`l${i}`}
              cx={x}
              cy={y}
              rx="8"
              ry="3"
              fill="#2F4220"
              transform={`rotate(${(i * 30) % 180} ${x} ${y})`}
            />
          );
        })}
      </g>

      <rect x="120" y="330" width="560" height="270" fill="url(#brs-bar)" />
      <rect x="120" y="330" width="560" height="14" fill="#7A4A1F" />
      <rect x="146" y="296" width="508" height="76" fill="#0E0905" />
      <rect
        x="146"
        y="296"
        width="508"
        height="76"
        fill="url(#brs-glow)"
        opacity="0.7"
      />
      <text
        x="400"
        y="338"
        textAnchor="middle"
        fontFamily="'Playfair Display', serif"
        fontStyle="italic"
        fontWeight="500"
        fontSize="42"
        fill="#FFE7A6"
      >
        L’Affogato
      </text>
      <text
        x="400"
        y="362"
        textAnchor="middle"
        fontFamily="'JetBrains Mono', monospace"
        fontSize="11"
        letterSpacing="8"
        fill="#FFE7A6"
      >
        COFFEE &amp; DESSERT
      </text>

      <rect x="350" y="380" width="320" height="180" fill="#1A0F08" />
      <rect
        x="350"
        y="382"
        width="320"
        height="6"
        fill="#FFE7A6"
        opacity="0.6"
      />
      <rect
        x="350"
        y="420"
        width="320"
        height="2"
        fill="#FFE7A6"
        opacity="0.45"
      />
      <rect
        x="350"
        y="448"
        width="320"
        height="2"
        fill="#FFE7A6"
        opacity="0.45"
      />
      {Array.from({ length: 10 }).map((_, i) => (
        <rect
          key={i}
          x={360 + i * 30}
          y={394}
          width="14"
          height="24"
          fill="#3A2410"
          rx="2"
        />
      ))}
      <rect x="420" y="478" width="180" height="68" fill="#0a0604" rx="4" />
      <rect x="436" y="494" width="32" height="24" fill="#3A2410" />
      <rect x="500" y="494" width="32" height="24" fill="#3A2410" />
      <text
        x="510"
        y="466"
        textAnchor="middle"
        fontFamily="Playfair Display"
        fontStyle="italic"
        fontSize="14"
        fill="#B88A4A"
      >
        L’Affogato
      </text>
      <rect x="476" y="522" width="68" height="12" fill="#1A0F08" />

      <rect
        x="160"
        y="390"
        width="170"
        height="200"
        fill="#0E0905"
        stroke="#3A2410"
        strokeWidth="2"
      />
      <text
        x="245"
        y="416"
        textAnchor="middle"
        fontFamily="Playfair Display"
        fontSize="14"
        fill="#FFE7A6"
      >
        COFFEE
      </text>
      {[
        ["ESPRESSO", "80"],
        ["AMERICANO", "90"],
        ["CAPPUCCINO", "110"],
        ["LATTE", "120"],
        ["AFFOGATO", "130"],
        ["MOCHA", "140"],
        ["MATCHA", "120"],
        ["STRAW. MATCHA", "140"],
        ["COLD BREW", "120"],
      ].map(([n, p], i) => (
        <g key={n}>
          <text
            x="172"
            y={436 + i * 14}
            fontFamily="JetBrains Mono"
            fontSize="8"
            fill="#E9D6AC"
          >
            {n}
          </text>
          <text
            x="318"
            y={436 + i * 14}
            textAnchor="end"
            fontFamily="JetBrains Mono"
            fontSize="8"
            fill="#FFE7A6"
          >
            {p}
          </text>
        </g>
      ))}
      <text
        x="245"
        y="582"
        textAnchor="middle"
        fontFamily="Pinyon Script"
        fontSize="18"
        fill="#FFE7A6"
      >
        Life is better with
      </text>

      <g
        transform="translate(780 410)"
        style={{ filter: "drop-shadow(0 0 8px #FFE7A6)" }}
      >
        <text fontFamily="Pinyon Script" fontSize="32" fill="#FFE7A6">
          But first,
        </text>
        <text y="40" fontFamily="Pinyon Script" fontSize="32" fill="#FFE7A6">
          Affogato
        </text>
      </g>

      <rect x="120" y="560" width="560" height="32" fill="url(#brs-counter)" />
      <rect x="120" y="560" width="560" height="4" fill="#E9D6AC" />

      {[170, 248, 326, 404, 482, 560, 638].map((x) => (
        <g key={x}>
          <ellipse cx={x} cy={596} rx="20" ry="6" fill="#5A3A20" />
          <rect x={x - 3} y={596} width="6" height="44" fill="#1A0F08" />
          <rect x={x - 12} y={640} width="24" height="3" fill="#B88A4A" />
          <rect x={x - 20} y={644} width="40" height="3" fill="#B88A4A" />
        </g>
      ))}

      {[760, 920].map((x) => (
        <g key={x} transform={`translate(${x} 540)`}>
          <ellipse cx="60" cy="60" rx="50" ry="14" fill="#F0E2C4" />
          <rect x="50" y="60" width="22" height="80" fill="#9A6F44" />
          <ellipse cx="60" cy="68" rx="32" ry="6" fill="#E0CCA8" />
          <rect x="56" y="38" width="8" height="22" fill="#3A2410" />
          <circle
            cx="60"
            cy="36"
            r="4"
            fill="#FFE7A6"
            style={{ filter: "drop-shadow(0 0 6px #FFE7A6)" }}
          />
        </g>
      ))}

      <g>
        <rect
          x="1080"
          y="0"
          width="120"
          height="700"
          fill="#2F4220"
          opacity="0.28"
        />
        {Array.from({ length: 50 }).map((_, i) => {
          const y = (i * 17) % 700;
          return (
            <ellipse
              key={i}
              cx={1100 + (i % 5) * 20}
              cy={y}
              rx="6"
              ry="18"
              fill="#2F4220"
              transform={`rotate(${((i * 17) % 60) - 30} ${1100 + (i % 5) * 20} ${y})`}
            />
          );
        })}
      </g>

      <rect x="0" y="640" width="1200" height="60" fill="#D8C8A8" />
      {Array.from({ length: 24 }).map((_, i) => (
        <line
          key={i}
          x1={i * 50}
          y1="640"
          x2={i * 50 + 12}
          y2="700"
          stroke="#A8956C"
          strokeWidth="0.6"
        />
      ))}
    </svg>
  );
}

/* ─────────────────────────────────────────────────────────────
   Map placeholder
   ───────────────────────────────────────────────────────────── */

export function MapPlaceholder() {
  return (
    <svg
      viewBox="0 0 800 600"
      style={{ width: "100%", height: "100%" }}
      aria-hidden="true"
      focusable="false"
    >
      <rect width="800" height="600" fill="#F4EFE7" />
      <path
        d="M 0 420 Q 260 410, 540 450 T 800 470 L 800 600 L 0 600 Z"
        fill="#C2D2DC"
        opacity="0.7"
      />
      <path
        d="M 0 420 Q 260 410, 540 450 T 800 470"
        stroke="#7A96A8"
        strokeWidth="1"
        fill="none"
      />
      <text
        x="640"
        y="530"
        fontFamily="Playfair Display"
        fontStyle="italic"
        fontSize="18"
        fill="#5A7A8A"
      >
        Marmara
      </text>

      {Array.from({ length: 7 }).map((_, i) => (
        <line
          key={`h${i}`}
          x1="0"
          y1={60 + i * 50}
          x2="800"
          y2={80 + i * 50}
          stroke="#D8C8A8"
          strokeWidth="1.5"
          opacity="0.5"
        />
      ))}
      {Array.from({ length: 10 }).map((_, i) => (
        <line
          key={`v${i}`}
          x1={80 + i * 75}
          y1="0"
          x2={50 + i * 75}
          y2="420"
          stroke="#D8C8A8"
          strokeWidth="1.5"
          opacity="0.5"
        />
      ))}

      <path
        d="M 0 260 Q 260 254, 540 280 T 800 296"
        stroke="#FFF"
        strokeWidth="10"
        fill="none"
      />
      <path
        d="M 0 260 Q 260 254, 540 280 T 800 296"
        stroke="#B88A4A"
        strokeWidth="1.2"
        strokeDasharray="6 6"
        fill="none"
      />
      <text
        x="70"
        y="254"
        fontFamily="JetBrains Mono"
        fontSize="11"
        letterSpacing="3"
        fill="#5A3818"
      >
        E-5 / D100
      </text>

      <path
        d="M 100 360 Q 320 350, 540 360 T 800 372"
        stroke="#C5435A"
        strokeWidth="3"
        fill="none"
      />
      <text
        x="70"
        y="356"
        fontFamily="JetBrains Mono"
        fontSize="10"
        letterSpacing="2"
        fill="#C5435A"
      >
        MARMARAY · TUZLA
      </text>

      <rect
        x="340"
        y="288"
        width="160"
        height="78"
        fill="#E0CCA8"
        stroke="#3A2410"
        strokeWidth="1.2"
      />
      <text
        x="420"
        y="328"
        textAnchor="middle"
        fontFamily="Playfair Display"
        fontStyle="italic"
        fontSize="18"
        fill="#3A2410"
      >
        Tuzla
      </text>
      <text
        x="420"
        y="346"
        textAnchor="middle"
        fontFamily="JetBrains Mono"
        fontSize="8"
        letterSpacing="2.5"
        fill="#5A3818"
      >
        POSTANE MAH.
      </text>

      <g transform="translate(430 296)">
        <circle r="28" fill="#14100B" opacity="0.18" />
        <path
          d="M 0 -22 C -12 -22 -20 -12 -20 -2 C -20 10 0 28 0 28 C 0 28 20 10 20 -2 C 20 -12 12 -22 0 -22 Z"
          fill="#14100B"
        />
        <circle cx="0" cy="-4" r="7" fill="#B88A4A" />
        <text
          x="28"
          y="-2"
          fontFamily="Playfair Display"
          fontStyle="italic"
          fontSize="24"
          fill="#14100B"
        >
          L’Affogato
        </text>
        <text
          x="28"
          y="18"
          fontFamily="JetBrains Mono"
          fontSize="10"
          letterSpacing="2"
          fill="#5A3818"
        >
          TARİHİ KÖŞK · CEVİZLİ
        </text>
      </g>

      <g transform="translate(720 80)">
        <circle r="28" fill="#FFF" stroke="#3A2410" strokeWidth="1.2" />
        <path d="M 0 -16 L 5 0 L 0 5 L -5 0 Z" fill="#3A2410" />
        <text
          x="0"
          y="-32"
          textAnchor="middle"
          fontFamily="JetBrains Mono"
          fontSize="11"
          fill="#3A2410"
        >
          N
        </text>
      </g>

      {[
        [140, 160],
        [240, 100],
        [560, 120],
        [640, 200],
        [120, 320],
        [620, 320],
      ].map(([x, y], i) => (
        <rect
          key={i}
          x={x}
          y={y}
          width={50 + (i % 3) * 18}
          height={36 + (i % 2) * 14}
          fill="#E0CCA8"
          opacity="0.7"
        />
      ))}
    </svg>
  );
}

/* ─────────────────────────────────────────────────────────────
   Auto plate — picks scene by item name
   ───────────────────────────────────────────────────────────── */

export function MenuPlate({
  hue = "cream",
  name = "",
}: {
  hue?: string;
  name?: string;
}) {
  const lower = name.toLowerCase();
  const isAffogato = /affogato/.test(lower);
  const isStraw = /strawberry|çilek/.test(lower);
  const isMatcha = /matcha|hojicha/.test(lower);
  const isCold = /iced|cold brew|shakerato|tonic/.test(lower);
  const isEspresso =
    /espresso|americano|cappuccino|latte|macchiato|mocha|cortado|flat white|doppio|filter/.test(
      lower,
    );
  const isGelato = /scoop|cannolo|tiramisù|bombolone|cantucci/.test(lower);

  const surfaceHue = isStraw
    ? "rose"
    : isMatcha
      ? "matcha"
      : isAffogato
        ? "caramel"
        : isCold
          ? "stone"
          : isGelato
            ? "warm"
            : isEspresso
              ? "espresso"
              : hue;

  let scoop = "cream";
  if (/cioccolato|fondente|mocha|chocolate/.test(lower)) scoop = "cioccolato";
  if (/nocciola|hazelnut|fındık/.test(lower)) scoop = "nocciola";
  if (/pistacchio|pistachio/.test(lower)) scoop = "pistachio";
  if (/matcha/.test(lower)) scoop = "matcha";
  if (/strawberry|çilek/.test(lower)) scoop = "strawberry";

  return (
    <PhotoSurface hue={surfaceHue}>
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "grid",
          placeItems: "center",
          padding: 24,
        }}
      >
        {isAffogato ? (
          <EdibleCupHero
            scoop={scoop}
            topping={scoop === "strawberry" ? "strawberry" : "wafer"}
          />
        ) : isStraw && isMatcha ? (
          <MatchaGlass strawberry />
        ) : isStraw ? (
          <MatchaGlass strawberry />
        ) : isMatcha ? (
          <MatchaGlass />
        ) : isCold && /matcha/.test(lower) ? (
          <MatchaGlass />
        ) : isGelato ? (
          <GelatoScoop flavor={scoop} />
        ) : (
          <EspressoCup />
        )}
      </div>
    </PhotoSurface>
  );
}

/* ─────────────────────────────────────────────────────────────
   Product surface — for shop cards
   ───────────────────────────────────────────────────────────── */

export function ProductSurface({
  cat = "beans",
  tone = "cream",
  label,
  sub,
  images,
  priority = false,
}: {
  cat?: string;
  tone?: string;
  label?: string;
  sub?: string;
  /** Admin-uploaded image URLs; when present the first is shown instead of SVG. */
  images?: string[];
  /** Set for above-the-fold (LCP) images — eager + high fetch priority. */
  priority?: boolean;
}) {
  const surface =
    cat === "beans"
      ? "espresso"
      : cat === "gift"
        ? "cream"
        : cat === "gear"
          ? "stone"
          : cat === "merch"
            ? "warm"
            : cat === "pantry"
              ? "pistachio"
              : "warm";

  const cover = images?.find((u) => typeof u === "string" && u.length > 0);
  if (cover) {
    // eslint-disable-next-line @next/next/no-img-element
    return (
      <img
        src={cover}
        alt={label ?? "Ürün görseli"}
        loading={priority ? "eager" : "lazy"}
        fetchPriority={priority ? "high" : "auto"}
        decoding="async"
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
          display: "block",
        }}
      />
    );
  }

  return (
    <PhotoSurface hue={surface}>
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "grid",
          placeItems: "center",
          padding: 32,
        }}
      >
        {cat === "beans" ? (
          <CoffeeBag
            label={label}
            sub={sub}
            tone={tone === "gold" ? "gold" : "dark"}
          />
        ) : cat === "gift" ? (
          <EdibleCupHero scoop="cream" topping="wafer" />
        ) : cat === "gear" ? (
          <EspressoCup />
        ) : cat === "merch" ? (
          <CoffeeBag label={label} sub={sub} tone="cream" />
        ) : (
          <CoffeeBag label={label} sub={sub} tone={tone || "cream"} />
        )}
      </div>
    </PhotoSurface>
  );
}

/* ─────────────────────────────────────────────────────────────
   Founder portrait
   ───────────────────────────────────────────────────────────── */

export function FounderPortrait() {
  return (
    <svg
      viewBox="0 0 320 400"
      style={{ width: "78%", height: "78%" }}
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <linearGradient id="fp-bg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#F5E6D3" />
          <stop offset="1" stopColor="#D8C2A0" />
        </linearGradient>
      </defs>
      <rect width="320" height="400" fill="url(#fp-bg)" rx="8" />
      <ellipse cx="160" cy="360" rx="120" ry="40" fill="#3A2410" />
      <path
        d="M 80 360 L 80 220 Q 80 180 130 170 L 130 130 Q 130 80 160 80 Q 190 80 190 130 L 190 170 Q 240 180 240 220 L 240 360 Z"
        fill="#3A2410"
      />
      <circle cx="160" cy="130" r="48" fill="#E0CCA8" />
      <path
        d="M 112 110 Q 130 90 160 90 Q 190 90 208 110 Q 208 86 188 78 Q 160 70 132 78 Q 112 86 112 110 Z"
        fill="#1A0F08"
      />
      <circle cx="146" cy="138" r="3" fill="#1A0F08" />
      <circle cx="174" cy="138" r="3" fill="#1A0F08" />
      <path
        d="M 150 158 Q 160 162 170 158"
        stroke="#1A0F08"
        strokeWidth="1.6"
        fill="none"
        strokeLinecap="round"
      />
      <text
        x="160"
        y="232"
        textAnchor="middle"
        fontFamily="JetBrains Mono"
        fontSize="9"
        letterSpacing="3"
        fill="#E9D6AC"
      >
        L’AFFOGATO
      </text>
      <text
        x="160"
        y="260"
        textAnchor="middle"
        fontFamily="Pinyon Script"
        fontSize="32"
        fill="#B88A4A"
      >
        eda
      </text>
    </svg>
  );
}
