"use client";

import { memo, useId, useState } from "react";
import {
  ArrowUpRight,
  ChevronDown,
  FileText,
  Github,
  Globe,
  Store,
  Sparkle,
} from "lucide-react";
import type { ComparisonBlock, ProjectBlock, TimelineBlock } from "@/lib/rich-response";
import { cn } from "@/lib/utils";
import { MetricGrid } from "./MetricCard";
import { TechnologyBadge } from "./TechnologyBadge";
import { AutolinkedText } from "./Autolink";
import { projectLinks, type CardLink } from "./project-links";

// ------------------------------------------------------------------ links

const LINK_ICON = { github: Github, store: Store, doc: FileText, live: Globe } as const;

function LinkButton({ link, primary }: { link: CardLink; primary: boolean }) {
  const Icon = LINK_ICON[link.kind];
  const external = !link.url.startsWith("/");
  return (
    <a
      href={link.url}
      {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
      className={cn(
        "group/link inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-xs font-semibold transition-[background-color,scale] duration-200 active:scale-95",
        primary
          ? "bg-foreground text-background hover:opacity-85"
          : "border border-border bg-transparent text-foreground hover:bg-accent",
      )}
    >
      <Icon className="h-3.5 w-3.5" aria-hidden />
      <span className="max-w-[10rem] truncate">{link.label}</span>
      {external && (
        <ArrowUpRight
          className="h-3 w-3 opacity-50 transition-transform duration-200 group-hover/link:translate-x-0.5 group-hover/link:-translate-y-0.5"
          aria-hidden
        />
      )}
      {external && <span className="sr-only">(opens in a new tab)</span>}
    </a>
  );
}

// ------------------------------------------------------------ project card

const MAX_TECHS = 8;
const SHOWN_HIGHLIGHTS = 3;

export const ProjectCard = memo(function ProjectCard({ block }: { block: ProjectBlock }) {
  const [open, setOpen] = useState(false);
  const regionId = useId();
  const links = projectLinks(block);
  const techs = [...new Set(block.technologies)];
  const extraTechs = techs.length - MAX_TECHS;
  const canExpand = block.highlights.length > SHOWN_HIGHLIGHTS || block.description.length > 180;
  const highlights = open ? block.highlights : block.highlights.slice(0, SHOWN_HIGHLIGHTS);
  const initials = block.title
    .split(/\s+/)
    .filter((w) => /^[A-Za-z0-9]/.test(w))
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");

  return (
    <article
      aria-label={block.title}
      className="group relative flex h-full min-w-0 flex-col overflow-hidden rounded-xl border border-border bg-card transition-[border-color] duration-200 hover:border-foreground/20"
    >
      <div className="flex flex-1 flex-col gap-3.5 p-4 sm:p-5">
        <header className="flex items-start gap-3">
          <span
            aria-hidden
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border bg-muted text-sm font-bold text-muted-foreground"
          >
            {initials || <Sparkle className="h-4 w-4" />}
          </span>
          <div className="min-w-0 flex-1">
            <h3 className="text-[0.95rem] leading-snug font-semibold tracking-tight text-foreground">
              {block.title}
            </h3>
            <p
              className={cn(
                "mt-1 text-[0.8125rem] leading-relaxed text-muted-foreground",
                !open && "line-clamp-3",
              )}
            >
              <AutolinkedText text={block.description} />
            </p>
          </div>
        </header>

        <ul className="flex flex-wrap gap-1.5" aria-label={`${block.title} technologies`}>
          {techs.slice(0, open ? techs.length : MAX_TECHS).map((t) => (
            <li key={t}>
              <TechnologyBadge name={t} />
            </li>
          ))}
          {!open && extraTechs > 0 && (
            <li className="self-center text-xs font-medium text-muted-foreground">+{extraTechs}</li>
          )}
        </ul>

        {highlights.length > 0 && (
          <ul id={regionId} className="space-y-1.5">
            {highlights.map((h, i) => (
              <li
                key={`${i}-${h.slice(0, 24)}`}
                className={cn(
                  "flex items-start gap-2 text-[0.8125rem] leading-relaxed text-foreground/80",
                  i >= SHOWN_HIGHLIGHTS && "animate-rise",
                )}
              >
                <span
                  aria-hidden
                  className="mt-[0.6em] h-1 w-1 shrink-0 rounded-full bg-muted-foreground/50"
                />
                <span className="min-w-0">
                  <AutolinkedText text={h} />
                </span>
              </li>
            ))}
          </ul>
        )}

        {block.metrics && block.metrics.length > 0 && <MetricGrid items={block.metrics} />}

        {(links.length > 0 || canExpand) && (
          <footer className="mt-auto flex flex-wrap items-center gap-2 pt-1">
            {links.map((l, i) => (
              <LinkButton key={l.url} link={l} primary={i === 0} />
            ))}
            {canExpand && (
              <button
                type="button"
                onClick={() => setOpen((v) => !v)}
                aria-expanded={open}
                aria-controls={regionId}
                className="ml-auto inline-flex h-8 items-center gap-1 rounded-lg px-2.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                {open
                  ? "Show less"
                  : block.highlights.length > SHOWN_HIGHLIGHTS
                    ? `${block.highlights.length - SHOWN_HIGHLIGHTS} more`
                    : "More"}
                <ChevronDown
                  aria-hidden
                  className={cn("h-3.5 w-3.5 transition-transform duration-300", open && "rotate-180")}
                />
              </button>
            )}
          </footer>
        )}
      </div>
    </article>
  );
});

// ---------------------------------------------------------------- timeline

export const Timeline = memo(function Timeline({ block }: { block: TimelineBlock }) {
  return (
    <section
      aria-label={block.title ?? "Timeline"}
      className="w-full rounded-xl border border-border bg-card p-4 sm:p-5"
    >
      {block.title && <h3 className="mb-4 text-sm font-semibold text-foreground">{block.title}</h3>}
      <div className="relative">
        {/* Vertical rule */}
        <span
          aria-hidden
          className="absolute top-2 bottom-2 left-[5px] w-px bg-border"
        />
        <ol className="space-y-5 stagger">
          {block.events.map((e, i) => (
            <li
              key={`${i}-${e.title}`}
              className="relative pl-7"
              style={{ "--i": Math.min(i, 10) } as React.CSSProperties}
            >
              <span
                aria-hidden
                className={cn(
                  "absolute top-[0.35rem] left-0 h-[11px] w-[11px] rounded-full border-2 border-card",
                  i === 0 ? "bg-foreground" : "bg-border",
                )}
              />
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <p className="text-sm font-semibold text-foreground">{e.title}</p>
                {e.date && (
                  <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px] font-medium text-muted-foreground">
                    {e.date}
                  </span>
                )}
                {e.tag && (
                  <span className="inline-flex items-center gap-1 rounded bg-muted px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground">
                    {e.tag}
                  </span>
                )}
              </div>
              {e.description && (
                <p className="mt-1 text-[0.8125rem] leading-relaxed text-muted-foreground">
                  <AutolinkedText text={e.description} />
                </p>
              )}
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
});

// -------------------------------------------------------------- comparison

export const ComparisonTable = memo(function ComparisonTable({ block }: { block: ComparisonBlock }) {
  return (
    <section
      aria-label={block.title ?? "Comparison"}
      className="w-full overflow-hidden rounded-xl border border-border bg-card"
    >
      {block.title && (
        <h3 className="border-b border-border px-4 py-2.5 text-sm font-semibold text-foreground">
          {block.title}
        </h3>
      )}
      <div className="table-shell overflow-x-auto">
        <table className="w-full border-collapse text-[0.8125rem]">
          <thead>
            <tr>
              {block.columns.map((c, i) => (
                <th
                  key={`${i}-${c}`}
                  scope="col"
                  className={cn(
                    "border-b border-border bg-muted px-3.5 py-2.5 text-left text-xs font-semibold tracking-wide text-muted-foreground",
                    i === 0 && "sticky left-0 z-10",
                  )}
                >
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {block.rows.map((r, ri) => (
              <tr key={`${ri}-${r.label}`} className="transition-colors hover:bg-accent">
                <th
                  scope="row"
                  className="sticky left-0 z-10 min-w-[7rem] border-b border-border bg-card px-3.5 py-2.5 text-left align-top font-medium text-foreground"
                >
                  {r.label}
                </th>
                {r.values.map((v, i) => (
                  <td
                    key={i}
                    className="min-w-[9rem] border-b border-border px-3.5 py-2.5 align-top text-muted-foreground"
                  >
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
