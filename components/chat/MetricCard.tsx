"use client";

import { memo } from "react";
import { Activity, AlertTriangle, CheckCircle2, Info, Sparkles } from "lucide-react";
import type { MetricItem, MetricStatus } from "@/lib/rich-response";
import { cn } from "@/lib/utils";

// All statuses use neutral muted-foreground — no semantic colors.
const STATUS_STYLE: Record<MetricStatus, { icon: typeof Info }> = {
  neutral:   { icon: Activity },
  info:      { icon: Info },
  success:   { icon: CheckCircle2 },
  warning:   { icon: AlertTriangle },
  highlight: { icon: Sparkles },
};

export const MetricCard = memo(function MetricCard({ item }: { item: MetricItem }) {
  const status: MetricStatus = item.status ?? "neutral";
  const { icon: Icon } = STATUS_STYLE[status];
  return (
    <div className="rounded-xl border border-border bg-card p-3.5 transition-colors hover:border-foreground/20">
      <div className="flex items-center gap-1.5">
        <Icon className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
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
