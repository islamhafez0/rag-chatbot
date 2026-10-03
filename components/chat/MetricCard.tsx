"use client";

import { memo } from "react";
import { Activity, AlertTriangle, CheckCircle2, Info, Sparkles } from "lucide-react";
import type { MetricItem, MetricStatus } from "@/lib/rich-response";
import { cn } from "@/lib/utils";

const STATUS_STYLE: Record<MetricStatus, { icon: typeof Info; classes: string }> = {
  neutral: { icon: Activity, classes: "text-muted-foreground" },
  info: { icon: Info, classes: "text-sky-600 dark:text-sky-300" },
  success: { icon: CheckCircle2, classes: "text-emerald-600 dark:text-emerald-300" },
  warning: { icon: AlertTriangle, classes: "text-amber-600 dark:text-amber-300" },
  highlight: { icon: Sparkles, classes: "text-violet-600 dark:text-violet-300" },
};

export const MetricCard = memo(function MetricCard({ item }: { item: MetricItem }) {
  const status: MetricStatus = item.status ?? "neutral";
  const { icon: Icon, classes } = STATUS_STYLE[status];
  return (
    <div className="rounded-xl border border-border bg-card p-3.5 shadow-sm transition-colors hover:border-muted-foreground/30">
      <div className="flex items-center gap-1.5">
        <Icon className={cn("h-3.5 w-3.5", classes)} aria-hidden />
        <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
          {item.label}
        </p>
      </div>
      <p className="mt-1.5 text-xl font-semibold tracking-tight text-foreground">
        {item.value}
        {item.unit && (
          <span className="ml-1 text-xs font-normal text-muted-foreground">{item.unit}</span>
        )}
      </p>
      {item.description && (
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{item.description}</p>
      )}
    </div>
  );
});

export const MetricGrid = memo(function MetricGrid({
  title,
  items,
}: {
  title?: string;
  items: MetricItem[];
}) {
  if (items.length === 0) return null;
  return (
    <section aria-label={title ?? "Key metrics"} className="w-full">
      {title && (
        <h4 className="mb-2 text-xs font-semibold tracking-wider text-muted-foreground uppercase">
          {title}
        </h4>
      )}
      <div
        className={cn(
          "grid gap-2.5",
          items.length === 1 && "grid-cols-1",
          items.length === 2 && "grid-cols-1 sm:grid-cols-2",
          items.length >= 3 && "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
        )}
      >
        {items.map((m) => (
          <MetricCard key={`${m.label}-${m.value}`} item={m} />
        ))}
      </div>
    </section>
  );
});
