"use client";

import { memo } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Info,
  OctagonX,
  type LucideIcon,
} from "lucide-react";
import type { CalloutBlock, CalloutSeverity } from "@/lib/rich-response";
import { MarkdownRenderer } from "./MarkdownRenderer";

/**
 * Callout — a restrained highlight band for important insights, decisions,
 * warnings, or caveats. Content renders through MarkdownRenderer, so it
 * never executes anything the markdown pipeline would not.
 */
const SEVERITY_STYLE: Record<
  CalloutSeverity,
  { icon: LucideIcon; border: string; fg: string; label: string }
> = {
  info: {
    icon: Info,
    border: "border-l-sky-500",
    fg: "text-sky-700 dark:text-sky-300",
    label: "Note",
  },
  success: {
    icon: CheckCircle2,
    border: "border-l-emerald-500",
    fg: "text-emerald-700 dark:text-emerald-300",
    label: "Good to know",
  },
  warning: {
    icon: AlertTriangle,
    border: "border-l-amber-500",
    fg: "text-amber-700 dark:text-amber-300",
    label: "Caution",
  },
  danger: {
    icon: OctagonX,
    border: "border-l-red-500",
    fg: "text-red-700 dark:text-red-300",
    label: "Important",
  },
};

export const Callout = memo(function Callout({ block }: { block: CalloutBlock }) {
  const severity: CalloutSeverity = block.severity ?? "info";
  const style = SEVERITY_STYLE[severity];
  const Icon = style.icon;
  return (
    <aside
      role="note"
      aria-label={block.title ?? style.label}
      className={`rounded-xl border border-l-4 border-border bg-muted/40 p-3.5 shadow-sm ${style.border}`}
    >
      <div className={`mb-1 flex items-center gap-1.5 text-xs font-semibold ${style.fg}`}>
        <Icon className="h-4 w-4 shrink-0" aria-hidden />
        <span>{block.title ?? style.label}</span>
      </div>
      <div className="markdown text-sm leading-relaxed text-foreground/90">
        <MarkdownRenderer content={block.content} />
      </div>
    </aside>
  );
});
