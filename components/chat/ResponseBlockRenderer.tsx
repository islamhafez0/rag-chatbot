"use client";

import { memo } from "react";
import type { ResponseBlock } from "@/lib/rich-response";
import { ChartRenderer } from "./ChartRenderer";
import { CodeBlock, EvidencePanel } from "./Interactive";
import { DiagramRenderer } from "./DiagramRenderer";
import { MarkdownRenderer } from "./MarkdownRenderer";
import { MetricGrid } from "./MetricCard";
import { ComparisonTable, ProjectCard, Timeline } from "./Showcase";
import { TechnologyBadgeGroup } from "./TechnologyBadge";

/**
 * ResponseBlockRenderer — the controlled component registry.
 * The model may only pick a `type` + data; every pixel is owned here.
 * Unknown types never reach this switch (dropped by Zod validation).
 */
export const ResponseBlockRenderer = memo(function ResponseBlockRenderer({
  block,
}: {
  block: ResponseBlock;
}) {
  switch (block.type) {
    case "metrics":
      return <MetricGrid title={block.title ?? undefined} items={block.items} />;
    case "chart":
      return <ChartRenderer block={block} />;
    case "project":
      return <ProjectCard block={block} />;
    case "timeline":
      return <Timeline block={block} />;
    case "comparison":
      return <ComparisonTable block={block} />;
    case "code":
      return <CodeBlock language={block.language} filename={block.filename ?? undefined} code={block.code} />;
    case "diagram":
      return <DiagramRenderer block={block} />;
    case "tech":
      return (
        <section
          aria-label={block.title ?? "Technologies"}
          className="rounded-2xl border border-border bg-card p-4 shadow-soft"
        >
          {block.title && (
            <h3 className="mb-2.5 text-xs font-semibold tracking-wider text-muted-foreground uppercase">
              {block.title}
            </h3>
          )}
          <TechnologyBadgeGroup technologies={block.technologies} label={block.title ?? undefined} />
        </section>
      );
    case "details":
      return (
        <EvidencePanel title={block.title}>
          <MarkdownRenderer content={block.content} />
        </EvidencePanel>
      );
    default:
      return null;
  }
});
