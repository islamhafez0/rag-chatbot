"use client";

import { memo } from "react";
import type { PendingVisual } from "@/lib/rich-response";
import { cn } from "@/lib/utils";

function Bar({ className }: { className?: string }) {
  return <span aria-hidden className={cn("block h-2.5 rounded-full skeleton", className)} />;
}

function ProjectSkeleton() {
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 shadow-soft">
      <div className="flex items-center gap-3">
        <span aria-hidden className="h-10 w-10 shrink-0 rounded-xl skeleton" />
        <div className="flex-1 space-y-2">
          <Bar className="h-3 w-2/3" />
          <Bar className="w-11/12" />
        </div>
      </div>
      <div className="flex gap-1.5">
        {[14, 18, 12, 16].map((w) => (
          <span key={w} aria-hidden className="h-5 rounded-full skeleton" style={{ width: `${w * 4}px` }} />
        ))}
      </div>
      <Bar className="w-5/6" />
      <Bar className="w-3/4" />
    </div>
  );
}

function TimelineSkeleton() {
  return (
    <div className="space-y-4 rounded-2xl border border-border bg-card p-4 shadow-soft">
      {[0, 1, 2].map((i) => (
        <div key={i} className="flex gap-3">
          <span aria-hidden className="mt-0.5 h-3 w-3 shrink-0 rounded-full skeleton" />
          <div className="flex-1 space-y-2">
            <Bar className="h-3 w-1/2" />
            <Bar className="w-5/6" />
          </div>
        </div>
      ))}
    </div>
  );
}

function DiagramSkeleton() {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-border bg-card p-5 shadow-soft">
      <span aria-hidden className="h-10 w-36 rounded-xl skeleton" />
      <span aria-hidden className="h-5 w-px bg-border" />
      <div className="flex gap-4">
        <span aria-hidden className="h-10 w-28 rounded-xl skeleton" />
        <span aria-hidden className="h-10 w-28 rounded-xl skeleton" />
      </div>
      <span aria-hidden className="h-5 w-px bg-border" />
      <span aria-hidden className="h-10 w-36 rounded-xl skeleton" />
    </div>
  );
}

function TableSkeleton() {
  return (
    <div className="space-y-2.5 rounded-2xl border border-border bg-card p-4 shadow-soft">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="grid grid-cols-3 gap-3">
          <Bar className={i === 0 ? "h-3" : ""} />
          <Bar />
          <Bar />
        </div>
      ))}
    </div>
  );
}

function ChipsSkeleton() {
  return (
    <div className="flex flex-wrap gap-1.5 rounded-2xl border border-border bg-card p-4 shadow-soft">
      {[16, 12, 20, 14, 18, 11, 15].map((w, i) => (
        <span key={i} aria-hidden className="h-6 rounded-full skeleton" style={{ width: `${w * 4}px` }} />
      ))}
    </div>
  );
}

/** Animated placeholder shaped like the visual that is still streaming. */
export const BlockSkeleton = memo(function BlockSkeleton({ pending }: { pending: PendingVisual }) {
  const label = pending.type ? `Preparing ${pending.type} visual` : "Preparing visual";
  let body: React.ReactNode;
  switch (pending.type) {
    case "project":
      body = (
        <div className="grid gap-3 sm:grid-cols-2">
          <ProjectSkeleton />
          {pending.count > 1 && <ProjectSkeleton />}
        </div>
      );
      break;
    case "timeline":
      body = <TimelineSkeleton />;
      break;
    case "diagram":
      body = <DiagramSkeleton />;
      break;
    case "comparison":
    case "metrics":
    case "chart":
      body = <TableSkeleton />;
      break;
    case "tech":
      body = <ChipsSkeleton />;
      break;
    default:
      body = (
        <div className="space-y-2.5 rounded-2xl border border-border bg-card p-4 shadow-soft">
          <Bar className="h-3 w-1/3" />
          <Bar className="w-5/6" />
          <Bar className="w-2/3" />
        </div>
      );
  }
  return (
    <div role="status" aria-label={label} className="animate-fade">
      {body}
    </div>
  );
});
