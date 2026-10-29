"use client";

import { forwardRef } from "react";
import { ArrowUp, Square } from "lucide-react";
import { cn } from "@/lib/utils";

export const MAX_INPUT_CHARS = 2000;

/**
 * Message composer. Enter sends, Shift+Enter breaks a line, IME composition
 * is respected, and sending is impossible while a request is in flight (the
 * button becomes Stop). The parent owns state; this is presentational.
 */
export const Composer = forwardRef<
  HTMLTextAreaElement,
  {
    value: string;
    onChange: (v: string) => void;
    onSend: () => void;
    onStop: () => void;
    loading: boolean;
  }
>(function Composer({ value, onChange, onSend, onStop, loading }, ref) {
  const canSend = !loading && value.trim().length > 0;
  const nearLimit = value.length > MAX_INPUT_CHARS * 0.85;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (canSend) onSend();
      }}
      className="ring-gradient relative flex items-end gap-2 rounded-[1.6rem] border border-border bg-card/85 p-1.5 pl-4 shadow-lift backdrop-blur-xl transition-shadow focus-within:shadow-[0_0_0_4px_color-mix(in_oklch,var(--ring)_18%,transparent)]"
    >
      <label htmlFor="chat-input" className="sr-only">
        Ask Islam a question
      </label>
      <textarea
        ref={ref}
        id="chat-input"
        name="chat-input"
        rows={1}
        value={value}
        maxLength={MAX_INPUT_CHARS}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
            e.preventDefault();
            if (canSend) onSend();
          }
        }}
        placeholder="Ask me anything about my work…"
        enterKeyHint="send"
        autoComplete="off"
        className="no-scrollbar field-sizing-content max-h-40 min-h-[2.75rem] flex-1 resize-none bg-transparent py-2.5 text-base leading-relaxed text-foreground outline-none placeholder:text-muted-foreground focus-visible:outline-none sm:text-[0.9375rem]"
      />
      {nearLimit && (
        <span className="self-center text-[11px] text-muted-foreground tabular-nums" aria-live="polite">
          {value.length}/{MAX_INPUT_CHARS}
        </span>
      )}
      {loading ? (
        <button
          type="button"
          onClick={onStop}
          aria-label="Stop generating"
          title="Stop generating"
          className="inline-flex h-11 w-11 shrink-0 animate-pop items-center justify-center rounded-full bg-foreground text-background transition-[scale,opacity] duration-200 hover:opacity-90 active:scale-90"
        >
          <Square className="h-3.5 w-3.5 fill-current" aria-hidden />
        </button>
      ) : (
        <button
          type="submit"
          disabled={!canSend}
          aria-label="Send message"
          title="Send (Enter)"
          className={cn(
            "inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition-[scale,background-color,opacity,box-shadow] duration-200 active:scale-90",
            canSend
              ? "bg-primary text-primary-foreground shadow-soft hover:shadow-lift"
              : "bg-muted text-muted-foreground",
          )}
        >
          <ArrowUp className="h-[1.15rem] w-[1.15rem]" aria-hidden />
        </button>
      )}
    </form>
  );
});
