"use client";

import { ChevronDown, Code2, Copy, Check, FileCode2 } from "lucide-react";
import { useId, useState } from "react";
import { cn } from "@/lib/utils";

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
  const id = useId();
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-soft">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={id}
        className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left text-sm font-semibold text-foreground transition-colors hover:bg-muted/60"
      >
        <span className="truncate">{title}</span>
        <ChevronDown
          aria-hidden
          className={cn("h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-300", open && "rotate-180")}
        />
      </button>
      <div
        id={id}
        className={cn(
          "grid transition-[grid-template-rows] duration-300 ease-out-expo",
          open ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
        )}
      >
        <div className="min-h-0 overflow-hidden" inert={!open}>
          <div className="border-t border-border px-4 py-3">{children}</div>
        </div>
      </div>
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
