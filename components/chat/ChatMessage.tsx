"use client";

import Image from "next/image";
import { memo, useCallback, useState } from "react";
import { Check, Copy, RotateCcw, Square } from "lucide-react";
import { parseRichContent } from "@/lib/rich-response";
import { cn } from "@/lib/utils";
import { PROFILE } from "@/components/portfolio/profile";
import { RichAnswer } from "./RichAnswer";
import { ThinkingLoader } from "./ThinkingLoader";

export function AssistantAvatar({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "relative inline-flex h-8 w-8 shrink-0 overflow-hidden rounded-full ring-2 ring-primary/20",
        className,
      )}
    >
      <Image src={PROFILE.avatar} alt="" width={32} height={32} className="h-full w-full object-cover" />
    </span>
  );
}

function ActionButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="inline-flex h-8 items-center gap-1.5 rounded-full px-2.5 text-xs font-medium text-muted-foreground transition-[background-color,color,scale] duration-200 hover:bg-muted hover:text-foreground active:scale-95"
    >
      {children}
    </button>
  );
}

export const UserMessage = memo(function UserMessage({ content }: { content: string }) {
  return (
    <div className="flex animate-rise justify-end">
      <p className="max-w-[85%] rounded-3xl rounded-br-lg bg-primary px-4 py-2.5 text-[0.9375rem] leading-relaxed whitespace-pre-wrap text-primary-foreground shadow-soft [overflow-wrap:anywhere] sm:max-w-[75%]">
        {content}
      </p>
    </div>
  );
});

export const AssistantMessage = memo(function AssistantMessage({
  content,
  streaming,
  waiting,
  stopped,
  canRetry,
  onRetry,
}: {
  content: string;
  /** Tokens are arriving for this message. */
  streaming: boolean;
  /** Request in flight, nothing streamed yet. */
  waiting: boolean;
  stopped: boolean;
  canRetry: boolean;
  onRetry: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const empty = !content.trim();
  const busy = streaming || waiting;

  const copy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(parseRichContent(content).text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      // Clipboard blocked (insecure context / permissions): nothing to do.
    }
  }, [content]);

  return (
    <article aria-label="Answer from Islam" className="group/msg flex animate-rise gap-3 sm:gap-4">
      <AssistantAvatar className="mt-0.5 hidden sm:inline-flex" />
      <div className="min-w-0 flex-1">
        <p className="mb-1.5 flex items-center gap-2 text-xs font-semibold text-muted-foreground">
          <AssistantAvatar className="h-5 w-5 sm:hidden" />
          {PROFILE.name}
        </p>
        {waiting && empty ? (
          <ThinkingLoader />
        ) : empty && !busy ? (
          <p className="text-[0.9375rem] text-muted-foreground">
            {stopped ? "Stopped before an answer came back." : "No answer came back that time."}
          </p>
        ) : (
          <RichAnswer content={content} streaming={streaming} />
        )}

        {!busy && (
          <div
            className={cn(
              "mt-2 -ml-2 flex items-center gap-0.5 transition-opacity duration-200",
              empty ? "opacity-100" : "opacity-100 sm:opacity-0 sm:group-hover/msg:opacity-100 sm:group-focus-within/msg:opacity-100",
            )}
          >
            {stopped && !empty && (
              <span className="mr-1 inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                <Square className="h-2.5 w-2.5 fill-current" aria-hidden /> Stopped
              </span>
            )}
            {!empty && (
              <ActionButton label={copied ? "Copied" : "Copy answer"} onClick={copy}>
                {copied ? <Check className="h-3.5 w-3.5 text-success" aria-hidden /> : <Copy className="h-3.5 w-3.5" aria-hidden />}
                <span className="hidden sm:inline">{copied ? "Copied" : "Copy"}</span>
              </ActionButton>
            )}
            {canRetry && (
              <ActionButton label="Regenerate answer" onClick={onRetry}>
                <RotateCcw className="h-3.5 w-3.5" aria-hidden />
                <span className={cn(!empty && "hidden sm:inline")}>{empty ? "Try again" : "Retry"}</span>
              </ActionButton>
            )}
          </div>
        )}
      </div>
    </article>
  );
});
