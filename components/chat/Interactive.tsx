"use client";

import { memo } from "react";
import { ArrowRight, ChevronDown, Code2, Copy, Check, FileCode2 } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

export const FollowUpChips = memo(function FollowUpChips({
  questions,
  onSelect,
}: {
  questions: string[];
  onSelect: (q: string) => void;
}) {
  if (questions.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1.5" aria-label="Suggested follow-up questions">
      {questions.map((q) => (
        <button
          key={q}
          type="button"
          onClick={() => onSelect(q)}
          className="group inline-flex max-w-full items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground shadow-sm transition-all hover:border-primary/40 hover:text-foreground"
        >
          <span className="truncate">{q}</span>
          <ArrowRight className="h-3 w-3 shrink-0 transition-transform group-hover:translate-x-0.5" />
        </button>
      ))}
    </div>
  );
});

export function EvidencePanel({
  title,
  children,
  defaultOpen = false,
}: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card/50">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-2 px-3.5 py-2.5 text-left text-xs font-semibold tracking-wide text-muted-foreground uppercase transition-colors hover:text-foreground"
      >
        <span className="truncate">{title}</span>
        <ChevronDown
          className={cn("h-4 w-4 shrink-0 transition-transform", open && "rotate-180")}
        />
      </button>
      {open && <div className="border-t border-border px-3.5 py-3">{children}</div>}
    </div>
  );
}

const COLLAPSE_AT = 14; // lines

export function CodeBlock({
  language,
  filename,
  code,
}: {
  language: string;
  filename?: string;
  code: string;
}) {
  const [copied, setCopied] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const lines = code.split("\n");
  const long = lines.length > COLLAPSE_AT;
  const visible = expanded || !long ? code : lines.slice(0, COLLAPSE_AT).join("\n");

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      // clipboard unavailable — no-op, button still present
    }
  };

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-[#0d1117] shadow-sm">
      <div className="flex items-center justify-between gap-2 border-b border-white/10 px-3.5 py-2">
        <span className="inline-flex min-w-0 items-center gap-1.5 text-xs text-white/70">
          <FileCode2 className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate font-mono">
            {filename || `${language} snippet`}
          </span>
          <span className="shrink-0 rounded bg-white/10 px-1.5 py-px font-mono text-[10px] text-white/60">
            {language}
          </span>
        </span>
        <span className="flex shrink-0 items-center gap-1">
          {long && (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="rounded-md px-2 py-1 text-xs text-white/60 transition-colors hover:bg-white/10 hover:text-white"
            >
              {expanded ? "Collapse" : `Expand (${lines.length} lines)`}
            </button>
          )}
          <button
            type="button"
            onClick={copy}
            aria-label="Copy code"
            className="rounded-md p-1.5 text-white/60 transition-colors hover:bg-white/10 hover:text-white"
          >
            {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
          </button>
        </span>
      </div>
      <pre className="max-h-[480px] overflow-auto p-3.5 font-mono text-[12.5px] leading-relaxed text-[#e6edf3]">
        <code className="flex gap-3">
          <span aria-hidden className="shrink-0 text-right text-white/25 select-none">
            {visible.split("\n").map((_, i) => (
              <span key={i} className="block">
                {i + 1}
              </span>
            ))}
          </span>
          <span className="min-w-0 flex-1 whitespace-pre">{visible}</span>
        </code>
      </pre>
      {!expanded && long && (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="flex w-full items-center justify-center gap-1.5 border-t border-white/10 py-2 text-xs text-white/60 transition-colors hover:text-white"
        >
          <Code2 className="h-3.5 w-3.5" /> Show {lines.length - COLLAPSE_AT} more lines
        </button>
      )}
    </div>
  );
}
