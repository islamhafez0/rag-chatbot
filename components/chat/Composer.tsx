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
    placeholder?: string;
  }
>(function Composer({ value, onChange, onSend, onStop, loading, placeholder }, ref) {
  const canSend = !loading && value.trim().length > 0;
  const nearLimit = value.length > MAX_INPUT_CHARS * 0.85;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (canSend) onSend();
      }}
      className="relative flex items-end gap-2 rounded-2xl border border-border bg-input px-4 py-2.5 transition-shadow focus-within:shadow-[0_0_0_1.5px_var(--ring)]"
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
        placeholder={placeholder ?? "Ask me anything..."}
        enterKeyHint="send"
        autoComplete="off"
        className="no-scrollbar field-sizing-content max-h-40 min-h-[2.5rem] flex-1 resize-none bg-transparent py-1 text-base leading-relaxed text-foreground outline-none placeholder:text-muted-foreground focus-visible:outline-none sm:text-[0.9375rem]"
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
          className="inline-flex h-9 w-9 shrink-0 animate-pop items-center justify-center rounded-xl border border-border bg-background text-foreground transition-[scale,opacity] duration-200 hover:bg-accent active:scale-90"
        >
          <Square className="h-3 w-3 fill-current" aria-hidden />
        </button>
      ) : (
        <button
          type="submit"
          disabled={!canSend}
          aria-label="Send message"
          title="Send (Enter)"
          className={cn(
            "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border transition-[scale,background-color,opacity] duration-200 active:scale-90",
            canSend
              ? "border-foreground bg-foreground text-background hover:opacity-85"
              : "border-border bg-transparent text-muted-foreground",
          )}
        >
          <ArrowUp className="h-[1.05rem] w-[1.05rem]" aria-hidden />
        </button>
      )}
    </form>
  );
});
