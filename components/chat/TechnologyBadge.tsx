"use client";

import { memo } from "react";
import { cn } from "@/lib/utils";

/** Semantic tech colors — stable per technology, not random per render. */
function techColor(name: string): string {
  const t = name.toLowerCase();
  if (/(react|next\.?js|typescript|javascript)/.test(t))
    return "bg-sky-500/10 text-sky-600 border-sky-500/25 dark:text-sky-300";
  if (/(node|express|odoo|python|fastapi)/.test(t))
    return "bg-emerald-500/10 text-emerald-700 border-emerald-500/25 dark:text-emerald-300";
  if (/(postgres|pgvector|redis|mongo|sql|prisma|drizzle)/.test(t))
    return "bg-indigo-500/10 text-indigo-700 border-indigo-500/25 dark:text-indigo-300";
  if (/(tailwind|css|framer|shadcn)/.test(t))
    return "bg-violet-500/10 text-violet-700 border-violet-500/25 dark:text-violet-300";
  if (/(openai|gemini|langchain|rag|ai|llm|embed)/.test(t))
    return "bg-amber-500/10 text-amber-700 border-amber-500/25 dark:text-amber-300";
  if (/(docker|vercel|aws|git|stripe|telegram)/.test(t))
    return "bg-rose-500/10 text-rose-700 border-rose-500/25 dark:text-rose-300";
  return "bg-muted text-muted-foreground border-border";
}

export const TechnologyBadge = memo(function TechnologyBadge({ name }: { name: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium whitespace-nowrap",
        techColor(name),
      )}
    >
      {name}
    </span>
  );
});

export const TechnologyBadgeGroup = memo(function TechnologyBadgeGroup({
  technologies,
  label,
}: {
  technologies: string[];
  label?: string;
}) {
  if (technologies.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-1.5" aria-label={label ?? "Technologies"}>
      {technologies.map((t) => (
        <TechnologyBadge key={t} name={t} />
      ))}
    </div>
  );
});
