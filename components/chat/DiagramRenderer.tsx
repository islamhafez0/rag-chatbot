"use client";

import { memo } from "react";
import { ArrowDown, Boxes } from "lucide-react";
import type { DiagramBlock } from "@/lib/rich-response";

/**
 * DiagramRenderer — renders the validated node/edge structure as a styled
 * vertical flow. Deliberately NOT a Mermaid/DOT executor: no LLM-provided
 * markup is ever parsed or executed, so malformed or hostile diagram input
 * degrades to labeled boxes instead of script errors.
 */
export const DiagramRenderer = memo(function DiagramRenderer({ block }: { block: DiagramBlock }) {
  const edges = block.edges ?? [];
  const childrenOf = (id: string) => edges.filter((e) => e.from === id);
  const roots = block.nodes.filter((n) => !edges.some((e) => e.to === n.id));
  const ordered = [...roots, ...block.nodes.filter((n) => !roots.includes(n))];

  return (
    <section
      aria-label={block.title ?? "Architecture diagram"}
      className="w-full rounded-xl border border-border bg-card p-4 shadow-sm"
    >
      <div className="mb-3 flex items-center gap-2">
        <Boxes className="h-4 w-4 text-muted-foreground" />
        <h4 className="text-sm font-semibold text-foreground">
          {block.title ?? "Architecture overview"}
        </h4>
      </div>
      <ol className="flex flex-col items-stretch">
        {ordered.map((node, index) => {
          const children = childrenOf(node.id);
          const isLast = index === ordered.length - 1;
          return (
            <li key={node.id} className="flex flex-col items-center">
              <div className="w-full max-w-md rounded-lg border border-border bg-muted/50 px-3.5 py-2.5 text-center shadow-sm">
                <p className="font-mono text-[11px] tracking-wider text-muted-foreground uppercase">
                  {node.id}
                </p>
                <p className="text-sm font-medium text-foreground">{node.label}</p>
                {node.detail && (
                  <p className="mt-0.5 text-xs text-muted-foreground">{node.detail}</p>
                )}
                {children.length > 0 && (
                  <p className="mt-1 font-mono text-[11px] text-muted-foreground">
                    → {children.map((c) => c.to).join(", ")}
                    {children[0]?.label ? ` (${children[0].label})` : ""}
                  </p>
                )}
              </div>
              {!isLast && (
                <span className="flex flex-col items-center py-1" aria-hidden>
                  <ArrowDown className="h-4 w-4 text-muted-foreground/60" />
                </span>
              )}
            </li>
          );
        })}
      </ol>
      {/* Textual fallback for screen readers / parse failures downstream */}
      <ul className="sr-only">
        {block.nodes.map((n) => (
          <li key={n.id}>{`${n.id}: ${n.label}${n.detail ? ` — ${n.detail}` : ""}`}</li>
        ))}
      </ul>
    </section>
  );
});
