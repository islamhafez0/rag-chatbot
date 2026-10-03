"use client";

import { memo } from "react";
import { ArrowUpRight, Briefcase, CheckCircle2, Globe } from "lucide-react";
import type { ComparisonBlock, ProjectBlock, TimelineBlock } from "@/lib/rich-response";
import { MetricGrid } from "./MetricCard";
import { TechnologyBadge } from "./TechnologyBadge";
import { AutolinkedText } from "./Autolink";

const ACCENTS = [
  "from-sky-500/25 via-sky-500/5 to-transparent",
  "from-emerald-500/25 via-emerald-500/5 to-transparent",
  "from-violet-500/25 via-violet-500/5 to-transparent",
  "from-amber-500/25 via-amber-500/5 to-transparent",
] as const;

function accentFor(title: string): (typeof ACCENTS)[number] {
  let h = 0;
  for (const c of title) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return ACCENTS[h % ACCENTS.length];
}

function hostOf(url?: string): string | null {
  if (!url) return null;
  try {
    return new URL(url).host;
  } catch {
    return null;
  }
}

/**
 * ProjectVisual — a frontend-owned preview panel so every project answer
 * ships with a visual. It is a stylized browser mockup derived ONLY from
 * validated block data (title, techs, real URL host) — never a screenshot
 * and never a fabricated image URL, since the KB has no project images.
 */
export const ProjectVisual = memo(function ProjectVisual({ block }: { block: ProjectBlock }) {
  const host = hostOf(block.url ?? undefined);
  const initial = block.title.trim().charAt(0).toUpperCase() || "P";
  return (
    <div
      role="img"
      aria-label={`${block.title} preview illustration`}
      className="border-b border-border"
    >
      <div className="flex items-center gap-2 bg-muted/70 px-3.5 py-2">
        <span className="flex gap-1.5" aria-hidden>
          <span className="h-2.5 w-2.5 rounded-full bg-rose-400/80" />
          <span className="h-2.5 w-2.5 rounded-full bg-amber-400/80" />
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/80" />
        </span>
        <span className="inline-flex min-w-0 flex-1 items-center justify-center gap-1.5 rounded-md bg-background px-3 py-1 font-mono text-[11px] text-muted-foreground">
          <Globe className="h-3 w-3 shrink-0" />
          <span className="truncate">{host ?? block.title}</span>
        </span>
      </div>
      <div className={`relative overflow-hidden bg-gradient-to-br to-card ${accentFor(block.title)}`}>
        <div className="flex items-center gap-3.5 px-4 py-5">
          <span
            aria-hidden
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-border bg-card text-xl font-bold text-foreground shadow-sm"
          >
            {initial}
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-foreground">{block.title}</p>
            <p className="mt-0.5 truncate text-xs text-muted-foreground">
              {block.technologies.slice(0, 3).join(" · ")}
              {block.technologies.length > 3 && ` · +${block.technologies.length - 3} more`}
            </p>
          </div>
        </div>
        <div className="space-y-1.5 px-4 pb-4" aria-hidden>
          <div className="h-1.5 w-11/12 rounded-full bg-foreground/10" />
          <div className="h-1.5 w-4/5 rounded-full bg-foreground/10" />
          <div className="h-1.5 w-3/5 rounded-full bg-foreground/10" />
        </div>
      </div>
    </div>
  );
});

const MAX_CARD_TECHS = 5;
const MAX_CARD_HIGHLIGHTS = 3;

export const ProjectCard = memo(function ProjectCard({ block }: { block: ProjectBlock }) {
  const extraTechs = block.technologies.length - MAX_CARD_TECHS;
  const extraHighlights = block.highlights.length - MAX_CARD_HIGHLIGHTS;
  return (
    <article aria-label={block.title} className="flex h-full w-full flex-col overflow-hidden rounded-xl border border-border bg-card shadow-sm">
      <ProjectVisual block={block} />
      <div className="border-b border-border bg-muted/50 px-4 py-3">
        <div className="flex items-start justify-between gap-2">
          <h4 className="line-clamp-2 text-sm leading-snug font-semibold text-foreground">{block.title}</h4>
          {block.url && (
            <a
              href={block.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex shrink-0 items-center gap-1 rounded-md border border-border bg-background px-2 py-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              View <ArrowUpRight className="h-3 w-3" />
            </a>
          )}
        </div>
        <p className="mt-1 line-clamp-3 text-xs leading-relaxed text-muted-foreground"><AutolinkedText text={block.description} /></p>
      </div>
      <div className="flex flex-1 flex-col space-y-3 px-4 py-3">
        <div className="flex flex-wrap items-center gap-1.5" aria-label={`${block.title} technologies`}>
          {block.technologies.slice(0, MAX_CARD_TECHS).map((t) => (
            <TechnologyBadge key={t} name={t} />
          ))}
          {extraTechs > 0 && (
            <span className="text-xs font-medium text-muted-foreground">+{extraTechs} more</span>
          )}
        </div>
        <ul className="space-y-1.5">
          {block.highlights.slice(0, MAX_CARD_HIGHLIGHTS).map((h) => (
            <li key={h} className="flex items-start gap-2 text-xs leading-relaxed text-foreground/90">
              <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
              <span className="line-clamp-2"><AutolinkedText text={h} /></span>
            </li>
          ))}
        </ul>
        {extraHighlights > 0 && (
          <p className="text-xs font-medium text-muted-foreground">+{extraHighlights} more highlights</p>
        )}
        {block.metrics && block.metrics.length > 0 && (
          <div className="mt-auto pt-1">
            <MetricGrid items={block.metrics} />
          </div>
        )}
      </div>
    </article>
  );
});

export const Timeline = memo(function Timeline({ block }: { block: TimelineBlock }) {
  return (
    <section aria-label={block.title ?? "Timeline"} className="w-full rounded-xl border border-border bg-card p-4 shadow-sm">
      {block.title && <h4 className="mb-3 text-sm font-semibold text-foreground">{block.title}</h4>}
      <ol className="relative ml-1.5 space-y-4 border-l border-border pl-5">
        {block.events.map((e) => (
          <li key={`${e.date ?? ""}-${e.title}`} className="relative">
            <span className="absolute top-1 -left-[27px] h-2.5 w-2.5 rounded-full border-2 border-background bg-primary ring-1 ring-border" aria-hidden />
            <div className="flex flex-wrap items-center gap-2">
              {e.date && (
                <span className="rounded-full bg-muted px-2 py-0.5 font-mono text-[11px] font-medium text-muted-foreground">
                  {e.date}
                </span>
              )}
              {e.tag && (
                <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
                  <Briefcase className="h-3 w-3" /> {e.tag}
                </span>
              )}
            </div>
            <p className="mt-1 text-sm font-medium text-foreground">{e.title}</p>
            {e.description && (
              <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground"><AutolinkedText text={e.description} /></p>
            )}
          </li>
        ))}
      </ol>
    </section>
  );
});

export const ComparisonTable = memo(function ComparisonTable({ block }: { block: ComparisonBlock }) {
  return (
    <section aria-label={block.title ?? "Comparison"} className="w-full overflow-hidden rounded-xl border border-border bg-card shadow-sm">
      {block.title && (
        <h4 className="border-b border-border bg-muted/50 px-4 py-2.5 text-sm font-semibold text-foreground">
          {block.title}
        </h4>
      )}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[480px] border-collapse text-xs">
          <thead>
            <tr>
              {block.columns.map((c) => (
                <th
                  key={c}
                  scope="col"
                  className="border-b border-border bg-muted/40 px-3.5 py-2.5 text-left font-semibold tracking-wide text-muted-foreground uppercase"
                >
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {block.rows.map((r) => (
              <tr key={r.label} className="transition-colors hover:bg-accent/40">
                <th scope="row" className="border-b border-border px-3.5 py-2.5 text-left font-medium text-foreground">
                  {r.label}
                </th>
                {r.values.map((v, i) => (
                  <td key={i} className="border-b border-border px-3.5 py-2.5 text-muted-foreground">
                    {v}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
});
