import { formatTRY } from "./forms";

interface Bucket {
  bucket: string;
  label: string;
  revenueMinor: number;
  orderCount: number;
}

/**
 * Tiny SVG line + area chart. No external deps. Renders into a 100%-width
 * viewBox so it scales with the container.
 */
export function RevenueChart({ data }: { data: Bucket[] }) {
  const W = 800;
  const H = 240;
  const padL = 56;
  const padR = 16;
  const padT = 12;
  const padB = 28;

  const innerW = W - padL - padR;
  const innerH = H - padT - padB;

  const max = Math.max(1, ...data.map((d) => d.revenueMinor));
  const n = Math.max(1, data.length);

  const xAt = (i: number) =>
    padL + (n === 1 ? innerW / 2 : (i * innerW) / (n - 1));
  const yAt = (v: number) => padT + innerH - (v / max) * innerH;

  const points = data.map((d, i) => `${xAt(i)},${yAt(d.revenueMinor)}`);
  const line = points.join(" ");
  const area = `M${xAt(0)},${padT + innerH} L${points.join(" L")} L${xAt(data.length - 1)},${padT + innerH} Z`;

  // 4 horizontal gridlines + labels
  const gridSteps = 4;
  const gridLines = Array.from({ length: gridSteps + 1 }, (_, i) => {
    const v = (max * (gridSteps - i)) / gridSteps;
    const y = yAt(v);
    return { y, v };
  });

  // Show every Nth x-axis label so they don't overlap
  const labelEvery = Math.max(1, Math.ceil(n / 8));

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      role="img"
      aria-label="Ciro grafiği"
      style={{ width: "100%", height: "auto", display: "block" }}
    >
      <defs>
        <linearGradient id="revArea" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgba(23,23,23,0.18)" />
          <stop offset="100%" stopColor="rgba(23,23,23,0)" />
        </linearGradient>
      </defs>

      {/* Gridlines */}
      {gridLines.map((g, i) => (
        <g key={i}>
          <line
            x1={padL}
            x2={W - padR}
            y1={g.y}
            y2={g.y}
            stroke="rgba(0,0,0,0.06)"
            strokeWidth={1}
          />
          <text
            x={padL - 8}
            y={g.y}
            textAnchor="end"
            dominantBaseline="central"
            fontSize="10"
            fill="rgba(0,0,0,0.5)"
            fontFamily="var(--mono, monospace)"
          >
            {formatTRY(g.v)}
          </text>
        </g>
      ))}

      {data.length > 0 && (
        <>
          {/* Area fill */}
          <path d={area} fill="url(#revArea)" />
          {/* Line */}
          <polyline
            points={line}
            fill="none"
            stroke="#171717"
            strokeWidth={1.6}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
          {/* Points + tooltip on hover */}
          {data.map((d, i) => (
            <g key={d.bucket}>
              <circle
                cx={xAt(i)}
                cy={yAt(d.revenueMinor)}
                r={3}
                fill="#171717"
              />
              <title>
                {`${d.label}: ${formatTRY(d.revenueMinor)} (${d.orderCount} sipariş)`}
              </title>
            </g>
          ))}
          {/* X-axis labels */}
          {data.map((d, i) =>
            i % labelEvery === 0 || i === data.length - 1 ? (
              <text
                key={`x-${d.bucket}`}
                x={xAt(i)}
                y={H - 8}
                textAnchor="middle"
                fontSize="10"
                fill="rgba(0,0,0,0.55)"
                fontFamily="var(--mono, monospace)"
              >
                {d.label}
              </text>
            ) : null,
          )}
        </>
      )}
    </svg>
  );
}
