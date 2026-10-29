"use client";

import { memo } from "react";
import type { StepsBlock } from "@/lib/rich-response";
import { AutolinkedText } from "./Autolink";

/**
 * Steps — ordered procedures and troubleshooting instructions rendered as a
 * vertical numbered sequence. Styling mirrors the Timeline's connection-line
 * pattern; data is validated plain text (no markdown execution needed).
 */
export const StepsList = memo(function StepsList({ block }: { block: StepsBlock }) {
  return (
    <section aria-label={block.title ?? "Steps"} className="w-full rounded-xl border border-border bg-card p-4 shadow-sm">
      {block.title && <h4 className="mb-3 text-sm font-semibold text-foreground">{block.title}</h4>}
      <ol className="relative ml-1.5 space-y-4 border-l border-border pl-6">
        {block.steps.map((s, i) => (
          <li key={`${i}-${s.title}`} className="relative">
            <span
              aria-hidden
              className="absolute top-0.5 -left-[31px] flex h-5 w-5 items-center justify-center rounded-full border border-border bg-primary/10 font-mono text-[10px] font-semibold text-primary"
            >
              {i + 1}
            </span>
            <p className="text-sm font-medium text-foreground">{s.title}</p>
            {s.description && (
              <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                <AutolinkedText text={s.description} />
              </p>
            )}
          </li>
        ))}
      </ol>
    </section>
  );
});
