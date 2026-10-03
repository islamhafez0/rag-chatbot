"use client";

import { memo, useId, useState } from "react";
import type { ChartBlock } from "@/lib/rich-response";
import { cn } from "@/lib/utils";

const PALETTE = [
  "#38bdf8", "#34d399", "#a78bfa", "#fbbf24",
  "#fb7185", "#22d3ee", "#f472b6", "#a3e635",
  "#60a5fa", "#facc15", "#4ade80", "#c084fc",
];

function maxOf(values: number[]): number {
  return Math.max(1e-9, ...values.map((v) => Math.abs(v)));
}

/** Accessible data table fallback rendered inside <details>. */
function DataTable({ labels, values, unit }: { labels: string[]; values: number[]; unit?: string }) {
  return (
    <details className="mt-2 text-xs text-muted-foreground">
      <summary className="cursor-pointer hover:text-foreground">View data table</summary>
      <table className="mt-1.5 w-full border-collapse">
        <tbody>
          {labels.map((l, i) => (
            <tr key={l} className="border-t border-border">
              <td className="py-1 pr-2">{l}</td>
              <td className="py-1 text-right font-medium text-foreground">
                {values[i]}
                {unit ? ` ${unit}` : ""}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </details>
  );
}

const BarView = memo(function BarView({ block }: { block: ChartBlock }) {
  const [hover, setHover] = useState<number | null>(null);
  const max = maxOf(block.values);
  return (
    <div className="flex flex-col gap-1.5" role="list">
      {block.labels.map((label, i) => {
        const pct = Math.max(2, (Math.abs(block.values[i]) / max) * 100);
        return (
          <div
            key={label}
            role="listitem"
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover(null)}
            className={cn(
              "group flex cursor-default items-center gap-2.5 rounded-lg px-2 py-1 transition-colors",
              hover === i && "bg-accent/60",
            )}
            title={`${label}: ${block.values[i]}${block.unit ? ` ${block.unit}` : ""}`}
          >
            <span className="w-28 shrink-0 truncate text-xs text-muted-foreground sm:w-36">
              {label}
            </span>
            <span className="h-5 min-w-0 flex-1 overflow-hidden rounded-md bg-muted">
              <span
                className="block h-full rounded-md transition-[width] duration-500"
                style={{
                  width: `${pct}%`,
                  backgroundColor: PALETTE[i % PALETTE.length],
                  opacity: hover === null || hover === i ? 1 : 0.45,
                }}
              />
            </span>
            <span className="w-16 shrink-0 text-right font-mono text-xs font-medium text-foreground">
              {block.values[i]}
              {block.unit ? <span className="text-muted-foreground"> {block.unit}</span> : null}
            </span>
          </div>
        );
      })}
    </div>
  );
});

const LineView = memo(function LineView({ block }: { block: ChartBlock }) {
  const [hover, setHover] = useState<number | null>(null);
  const gid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const W = 560;
  const H = 190;
  const PAD = 28;
  const max = maxOf(block.values);
  const min = Math.min(0, ...block.values);
  const span = Math.max(1e-9, max - min);
  const xs = block.values.map((_, i) =>
    block.values.length === 1 ? W / 2 : PAD + (i / (block.values.length - 1)) * (W - PAD * 2),
  );
  const ys = block.values.map((v) => PAD + (1 - (v - min) / span) * (H - PAD * 2));
  const points = xs.map((x, i) => `${x},${ys[i]}`).join(" ");
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={block.title}>
        <defs>
          <linearGradient id={`g-${gid}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#38bdf8" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0.25, 0.5, 0.75].map((f) => (
          <line
            key={f}
            x1={PAD}
            x2={W - PAD}
            y1={H * f}
            y2={H * f}
            stroke="currentColor"
            className="text-border"
            strokeDasharray="3 5"
          />
        ))}
        <polygon points={`${PAD},${H - PAD} ${points} ${W - PAD},${H - PAD}`} fill={`url(#g-${gid})`} />
        <polyline points={points} fill="none" stroke="#38bdf8" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
        {xs.map((x, i) => (
          <g key={block.labels[i]}>
            <circle
              cx={x}
              cy={ys[i]}
              r={hover === i ? 6 : 4}
              fill="#0b0f19"
              stroke="#38bdf8"
              strokeWidth="2.5"
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
              style={{ cursor: "pointer" }}
            >
              <title>{`${block.labels[i]}: ${block.values[i]}${block.unit ? ` ${block.unit}` : ""}`}</title>
            </circle>
            {hover === i && (
              <g>
                <rect x={Math.min(Math.max(x - 52, 4), W - 108)} y={Math.max(ys[i] - 34, 4)} width="104" height="24" rx="6" className="fill-popover stroke-border" />
                <text x={Math.min(Math.max(x, 56), W - 56)} y={Math.max(ys[i] - 17, 21)} textAnchor="middle" className="fill-foreground" fontSize="11" fontWeight="600">
                  {block.values[i]}{block.unit ? ` ${block.unit}` : ""}
                </text>
              </g>
            )}
          </g>
        ))}
        {block.labels.map((l, i) => (
          <text key={l} x={xs[i]} y={H - 8} textAnchor="middle" fontSize="10" className="fill-muted-foreground">
            {l.length > 12 ? `${l.slice(0, 11)}…` : l}
          </text>
        ))}
      </svg>
    </div>
  );
});

function pieSlices(values: number[]): { from: number; to: number }[] {
  const total = values.reduce((s, v) => s + Math.abs(v), 0) || 1;
  let acc = 0;
  return values.map((v) => {
    const from = acc / total;
    acc += Math.abs(v);
    return { from: from * Math.PI * 2, to: (acc / total) * Math.PI * 2 };
  });
}

function arcPath(cx: number, cy: number, r: number, from: number, to: number, inner = 0): string {
  const large = to - from > Math.PI ? 1 : 0;
  const x1 = cx + r * Math.cos(from);
  const y1 = cy + r * Math.sin(from);
  const x2 = cx + r * Math.cos(to);
  const y2 = cy + r * Math.sin(to);
  if (inner <= 0) return `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} Z`;
  const ix2 = cx + inner * Math.cos(to);
  const iy2 = cy + inner * Math.sin(to);
  const ix1 = cx + inner * Math.cos(from);
  const iy1 = cy + inner * Math.sin(from);
  return `M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} L ${ix2} ${iy2} A ${inner} ${inner} 0 ${large} 0 ${ix1} ${iy1} Z`;
}

const PieView = memo(function PieView({ block, donut }: { block: ChartBlock; donut: boolean }) {
  const [hover, setHover] = useState<number | null>(null);
  const slices = pieSlices(block.values);
  const total = block.values.reduce((s, v) => s + Math.abs(v), 0) || 1;
  const CX = 100;
  const CY = 100;
  const R = 84;
  return (
    <div className="flex flex-col items-center gap-3 sm:flex-row sm:gap-5">
      <svg viewBox="0 0 200 200" className="h-44 w-44 shrink-0" role="img" aria-label={block.title}>
        {slices.map((s, i) => (
          <path
            key={block.labels[i]}
            d={arcPath(CX, CY, hover === i ? R + 4 : R, s.from - Math.PI / 2, s.to - Math.PI / 2, donut ? 52 : 0)}
            fill={PALETTE[i % PALETTE.length]}
            opacity={hover === null || hover === i ? 1 : 0.4}
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover(null)}
            style={{ cursor: "pointer", transition: "opacity 150ms" }}
          >
            <title>{`${block.labels[i]}: ${block.values[i]} (${Math.round((Math.abs(block.values[i]) / total) * 100)}%)`}</title>
          </path>
        ))}
        {donut && (
          <text x={CX} y={CY} textAnchor="middle" dominantBaseline="central" fontSize="17" fontWeight="700" className="fill-foreground">
            {total}
          </text>
        )}
      </svg>
      <ul className="grid w-full min-w-0 flex-1 grid-cols-1 gap-1">
        {block.labels.map((l, i) => (
          <li
            key={l}
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover(null)}
            className={cn(
              "flex cursor-default items-center gap-2 rounded-md px-2 py-1 text-xs",
              hover === i && "bg-accent/60",
            )}
          >
            <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ backgroundColor: PALETTE[i % PALETTE.length] }} />
            <span className="min-w-0 flex-1 truncate text-muted-foreground">{l}</span>
            <span className="shrink-0 font-mono font-medium text-foreground">
              {block.values[i]} ({Math.round((Math.abs(block.values[i]) / total) * 100)}%)
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
});

/**
 * ChartRenderer — dependency-free SVG charts (no Recharts bundle cost).
 * Hover tooltips + data-table fallback included; pure presentation, all
 * styling owned by the frontend, never by the model.
 */
export const ChartRenderer = memo(function ChartRenderer({ block }: { block: ChartBlock }) {
  return (
    <section aria-label={block.title} className="w-full rounded-xl border border-border bg-card p-4 shadow-sm">
      <h4 className="mb-3 text-sm font-semibold text-foreground">{block.title}</h4>
      {block.chartType === "bar" && <BarView block={block} />}
      {block.chartType === "line" && <LineView block={block} />}
      {(block.chartType === "pie" || block.chartType === "donut") && (
        <PieView block={block} donut={block.chartType === "donut"} />
      )}
      <DataTable labels={block.labels} values={block.values} unit={block.unit ?? undefined} />
    </section>
  );
});
