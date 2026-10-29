"use client";

import { memo } from "react";
import { cn } from "@/lib/utils";
import { techColor } from "./tech-color";

export { techColor };

export const TechnologyBadge = memo(function TechnologyBadge({
  name,
  className,
}: {
  name: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium whitespace-nowrap transition-transform duration-200 hover:-translate-y-px",
        techColor(name),
        className,
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
  const unique = [...new Set(technologies)];
  return (
    <ul className="flex flex-wrap items-center gap-1.5 stagger" aria-label={label ?? "Technologies"}>
      {unique.map((t, i) => (
        <li key={t} style={{ "--i": Math.min(i, 12) } as React.CSSProperties}>
          <TechnologyBadge name={t} />
        </li>
      ))}
    </ul>
  );
});
