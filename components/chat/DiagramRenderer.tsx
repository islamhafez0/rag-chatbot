"use client";

import { memo, useId, useMemo, useState } from "react";
import { Workflow } from "lucide-react";
import type { DiagramBlock } from "@/lib/rich-response";
import { cn } from "@/lib/utils";
import { layoutDiagram } from "./diagram-layout";

/**
 * DiagramRenderer — a real layered DAG drawn as inline SVG from validated
 * node/edge data (never Mermaid/DOT execution). Labels, not ids; one path
 * per actual edge; edge labels on the curve; hover/focus highlights a node's
 * neighbourhood. Scales down to phone width, scrolls only if it must.
 */
export const DiagramRenderer = memo(function DiagramRenderer({ block }: { block: DiagramBlock }) {
  const uid = useId().replace(/:/g, "");
  const layout = useMemo(() => layoutDiagram(block.nodes, block.edges ?? []), [block]);
  const [active, setActive] = useState<string | null>(null);
  const labelOf = useMemo(() => new Map(block.nodes.map((n) => [n.id, n.label])), [block.nodes]);

  const touches = (e: { from: string; to: string }) => active !== null && (e.from === active || e.to === active);
  const neighbours = useMemo(() => {
    if (!active) return null;
    const s = new Set([active]);
    for (const e of layout.edges) {
      if (e.from === active) s.add(e.to);
      if (e.to === active) s.add(e.from);
    }
    return s;
  }, [active, layout.edges]);

  const title = block.title ?? "Diagram";

  return (
    <figure className="w-full overflow-hidden rounded-2xl border border-border bg-card shadow-soft">
      <figcaption className="flex items-center gap-2 border-b border-border px-4 py-2.5 text-sm font-semibold">
        <Workflow className="h-4 w-4 text-primary" aria-hidden />
        {title}
      </figcaption>
      <div className="table-shell overflow-x-auto px-2 py-3 sm:px-4">
        <svg
          role="img"
          aria-labelledby={`${uid}-t ${uid}-d`}
          viewBox={`0 0 ${layout.width} ${layout.height}`}
          className="mx-auto block h-auto"
          style={{ width: "100%", maxWidth: layout.width, minWidth: Math.min(layout.width, 300) * 0.98 }}
        >
          <title id={`${uid}-t`}>{title}</title>
          <desc id={`${uid}-d`}>
            {layout.edges.length
              ? layout.edges
                  .map((e) => `${labelOf.get(e.from)} to ${labelOf.get(e.to)}${e.label ? ` (${e.label})` : ""}`)
                  .join("; ")
              : block.nodes.map((n) => n.label).join(", ")}
          </desc>
          <defs>
            <marker
              id={`${uid}-arrow`}
              viewBox="0 0 10 10"
              refX="7"
              refY="5"
              markerWidth="7"
              markerHeight="7"
              orient="auto-start-reverse"
            >
              <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--muted-foreground)" />
            </marker>
            <marker
              id={`${uid}-arrow-on`}
              viewBox="0 0 10 10"
              refX="7"
              refY="5"
              markerWidth="7"
              markerHeight="7"
              orient="auto-start-reverse"
            >
              <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--primary)" />
            </marker>
            <linearGradient id={`${uid}-src`} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="var(--brand-1)" />
              <stop offset="100%" stopColor="var(--brand-2)" />
            </linearGradient>
          </defs>

          <g fill="none" strokeLinecap="round">
            {layout.edges.map((e, i) => {
              const on = touches(e);
              return (
                <path
                  key={`${e.from}-${e.to}-${i}`}
                  d={e.path}
                  stroke={on ? "var(--primary)" : "var(--muted-foreground)"}
                  strokeOpacity={active && !on ? 0.18 : on ? 1 : 0.55}
                  strokeWidth={on ? 2 : 1.4}
                  strokeDasharray={e.back ? "5 4" : undefined}
                  markerEnd={`url(#${uid}-${on ? "arrow-on" : "arrow"})`}
                  className="animate-fade transition-[stroke-opacity] duration-200"
                  style={{ animationDelay: `${120 + i * 40}ms` }}
                />
              );
            })}
          </g>

          {layout.edges.map((e, i) =>
            e.label ? (
              <g
                key={`l-${e.from}-${e.to}-${i}`}
                className="animate-fade transition-opacity duration-200"
                style={{ animationDelay: `${200 + i * 40}ms`, opacity: active && !touches(e) ? 0.25 : 1 }}
              >
                <rect
                  x={e.lx - Math.min(e.label.length, 30) * 3.1 - 7}
                  y={e.ly - 9}
                  width={Math.min(e.label.length, 30) * 6.2 + 14}
                  height={18}
                  rx={9}
                  fill="var(--card)"
                  stroke="var(--border)"
                />
                <text
                  x={e.lx}
                  y={e.ly + 3.8}
                  textAnchor="middle"
                  fontSize="10.5"
                  fill="var(--muted-foreground)"
                  fontWeight={500}
                >
                  {e.label.length > 30 ? `${e.label.slice(0, 29)}…` : e.label}
                </text>
              </g>
            ) : null,
          )}

          {layout.nodes.map((n) => {
            const source = n.layer === 0 && layout.layers > 1;
            const dim = neighbours !== null && !neighbours.has(n.id);
            const on = active === n.id;
            return (
              <g
                key={n.id}
                tabIndex={0}
                role="button"
                aria-label={n.detail ? `${n.label}: ${n.detail}` : n.label}
                onMouseEnter={() => setActive(n.id)}
                onMouseLeave={() => setActive(null)}
                onFocus={() => setActive(n.id)}
                onBlur={() => setActive(null)}
                className="animate-pop cursor-default outline-none transition-opacity duration-200"
                style={{
                  animationDelay: `${n.layer * 90}ms`,
                  transformOrigin: `${n.x + n.w / 2}px ${n.y + n.h / 2}px`,
                  transformBox: "view-box",
                  opacity: dim ? 0.35 : 1,
                }}
              >
                {n.detail && <title>{n.detail}</title>}
                <rect
                  x={n.x}
                  y={n.y}
                  width={n.w}
                  height={n.h}
                  rx={12}
                  fill={on ? "var(--accent)" : "var(--card)"}
                  stroke={source || on ? `url(#${uid}-src)` : "var(--border)"}
                  strokeWidth={source || on ? 1.8 : 1.2}
                />
                <text
                  x={n.x + n.w / 2}
                  textAnchor="middle"
                  fontSize="12.5"
                  fontWeight={600}
                  fill="var(--foreground)"
                >
                  {n.lines.map((line, li) => (
                    <tspan key={li} x={n.x + n.w / 2} y={n.y + 13 + 12 + li * 16}>
                      {line}
                    </tspan>
                  ))}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
      {block.nodes.some((n) => n.detail) && (
        <dl className={cn("grid gap-x-4 gap-y-1.5 border-t border-border px-4 py-3 text-xs sm:grid-cols-2")}>
          {block.nodes
            .filter((n) => n.detail)
            .map((n) => (
              <div key={n.id} className="min-w-0">
                <dt className="inline font-semibold text-foreground">{n.label}: </dt>
                <dd className="inline text-muted-foreground">{n.detail}</dd>
              </div>
            ))}
        </dl>
      )}
    </figure>
  );
});
