"use client";

import { useChat } from "ai/react";
import { AlertTriangle, ArrowDown, RotateCcw, SquarePen } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toRequestMessages } from "@/lib/rich-response";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "@/components/theme-toggle";
import { AssistantMessage, UserMessage } from "@/components/chat/ChatMessage";
import { Composer } from "@/components/chat/Composer";
import { useStickToBottom } from "@/components/chat/useStickToBottom";
import { Hero } from "@/components/portfolio/Hero";
import { Logo } from "@/components/portfolio/Logo";

function readableError(error: unknown): string {
  if (!(error instanceof Error)) return "Something went wrong with that request.";
  try {
    const parsed = JSON.parse(error.message);
    if (parsed && typeof parsed.error === "string") return parsed.error;
  } catch {
    // not JSON: fall through
  }
  return error.message || "Something went wrong with that request.";
}

export default function Home() {
  const {
    messages,
    input,
    setInput,
    append,
    reload,
    stop,
    isLoading,
    error,
    setMessages,
  } = useChat({
    keepLastMessageOnError: true,
    experimental_throttle: 50,
    // History goes back as prose only (+ "[visual: …]" note): the fenced
    // JSON never round-trips, so long rich answers can't trip size limits.
    experimental_prepareRequestBody: ({ messages: all }) => ({
      messages: toRequestMessages(all),
    }),
  });

  const { scrollRef, contentRef, atBottom, scrollToBottom } = useStickToBottom(messages.length > 0);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [stoppedIds, setStoppedIds] = useState<ReadonlySet<string>>(() => new Set());
  const [dismissedError, setDismissedError] = useState<unknown>(null);

  const last = messages[messages.length - 1];
  const streamingId = isLoading && last?.role === "assistant" ? last.id : null;
  const waitingForFirstToken = isLoading && (last?.role !== "assistant" || !last.content);
  const lastAssistantId = useMemo(
    () => [...messages].reverse().find((m) => m.role === "assistant")?.id ?? null,
    [messages],
  );
  const showError = !!error && dismissedError !== error && !isLoading;
  const started = messages.length > 0;

  const send = useCallback(
    (text: string) => {
      const q = text.trim();
      if (!q || isLoading) return;
      setDismissedError(null);
      setInput("");
      scrollToBottom();
      void append({ role: "user", content: q });
    },
    [append, isLoading, scrollToBottom, setInput],
  );

  const retry = useCallback(() => {
    if (isLoading) return;
    setDismissedError(null);
    if (last?.role === "assistant") {
      setStoppedIds((s) => {
        const n = new Set(s);
        n.delete(last.id);
        return n;
      });
    }
    scrollToBottom();
    void reload();
  }, [isLoading, last, reload, scrollToBottom]);

  const stopNow = useCallback(() => {
    if (last?.role === "assistant") setStoppedIds((s) => new Set(s).add(last.id));
    stop();
    inputRef.current?.focus();
  }, [last, stop]);

  const newChat = useCallback(() => {
    stop();
    setMessages([]);
    setInput("");
    setStoppedIds(new Set());
    setDismissedError(error ?? null);
    scrollRef.current?.scrollTo({ top: 0 });
    inputRef.current?.focus();
  }, [error, scrollRef, setInput, setMessages, stop]);

  useEffect(() => {
    // Warm the DB pool / embeddings on load so the first chat is faster.
    fetch("/api/warmup", { cache: "no-store" }).catch(() => { });
  }, []);

  // Escape stops a running answer from anywhere on the page.
  useEffect(() => {
    if (!isLoading) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") stopNow();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isLoading, stopNow]);

  const status = isLoading
    ? waitingForFirstToken
      ? "Islam is thinking"
      : "Islam is answering"
    : started && last?.role === "assistant"
      ? "Answer ready"
      : "";

  return (
    <div className="relative flex h-dvh flex-col overflow-hidden bg-background text-foreground">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <header className="pt-safe relative z-20 border-b border-transparent">
        <div className="mx-auto flex h-12 w-full max-w-3xl items-center justify-between px-4 sm:h-14 sm:px-6">
          {/* Home logo — visible only in chat state */}
          <button
            type="button"
            onClick={started ? newChat : undefined}
            tabIndex={started ? 0 : -1}
            aria-label={started ? "Back to home" : undefined}
            className={cn(
              "transition-[opacity] duration-300 hover:opacity-70",
              started ? "opacity-100" : "pointer-events-none opacity-0",
            )}
          >
            <Logo className="h-6 w-auto text-foreground" />
          </button>

          <div className="flex shrink-0 items-center gap-2">
            {/* New chat button — visible only in chat state */}
            <button
              type="button"
              onClick={newChat}
              aria-label="Start a new chat"
              title="New chat"
              className={cn(
                "inline-flex h-8 items-center gap-1.5 rounded-md border border-border px-2.5 text-xs font-medium text-muted-foreground transition-[opacity,background-color,color] duration-300 hover:bg-accent hover:text-foreground",
                started ? "animate-fade opacity-100" : "pointer-events-none opacity-0",
              )}
            >
              <SquarePen className="h-3.5 w-3.5" aria-hidden />
              New chat
            </button>
            <ThemeToggle />
          </div>
        </div>
      </header>

      {/* ── Main scroll area ────────────────────────────────────────────── */}
      <main className="relative z-10 flex min-h-0 flex-1 flex-col">
        <div
          ref={scrollRef}
          className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain [scrollbar-gutter:stable]"
        >
          <div
            ref={contentRef}
            className={cn(
              "mx-auto flex w-full max-w-3xl flex-col px-4 sm:px-6",
              // Home state: vertically center the hero within the available scroll area
              !started && "min-h-[calc(100dvh-14rem)] justify-center pb-4 pt-8",
              // Chat state: top-aligned messages with breathing room
              started && "gap-8 pt-6 pb-8",
            )}
          >
            {!started ? (
              <Hero onPick={send} disabled={isLoading} />
            ) : (
              <div role="log" aria-label="Conversation" aria-busy={isLoading} className="flex flex-col gap-8">
                {messages.map((m) =>
                  m.role === "user" ? (
                    <UserMessage key={m.id} content={m.content} />
                  ) : m.role === "assistant" ? (
                    <AssistantMessage
                      key={m.id}
                      content={m.content}
                      streaming={m.id === streamingId && !!m.content}
                      waiting={m.id === streamingId && !m.content}
                      stopped={stoppedIds.has(m.id)}
                      canRetry={m.id === lastAssistantId && !isLoading && last?.id === m.id}
                      onRetry={retry}
                    />
                  ) : null,
                )}

                {isLoading && last?.role === "user" && (
                  <AssistantMessage
                    content=""
                    streaming={false}
                    waiting
                    stopped={false}
                    canRetry={false}
                    onRetry={retry}
                  />
                )}

                {showError && (
                  <div
                    role="alert"
                    className="flex animate-rise items-start gap-3 rounded-xl border border-destructive/30 bg-destructive/8 p-4"
                  >
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" aria-hidden />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-foreground">
                        That request didn&apos;t go through.
                      </p>
                      <p className="mt-0.5 text-sm [overflow-wrap:anywhere] text-muted-foreground">
                        {readableError(error)}
                      </p>
                      <div className="mt-3 flex gap-2">
                        <button
                          type="button"
                          onClick={retry}
                          className="inline-flex h-7 items-center gap-1.5 rounded-md border border-foreground bg-foreground px-3 text-xs font-semibold text-background transition-[scale] active:scale-95"
                        >
                          <RotateCcw className="h-3 w-3" aria-hidden /> Try again
                        </button>
                        <button
                          type="button"
                          onClick={() => setDismissedError(error)}
                          className="inline-flex h-7 items-center rounded-md px-3 text-xs font-medium text-muted-foreground hover:bg-accent hover:text-foreground"
                        >
                          Dismiss
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ── Composer area ─────────────────────────────────────────────── */}
        <div className="pb-safe relative px-4 sm:px-6">
          {/* Jump-to-bottom pill */}
          <button
            type="button"
            onClick={() => scrollToBottom("smooth")}
            aria-label="Jump to latest message"
            tabIndex={atBottom || !started ? -1 : 0}
            className={cn(
              "absolute -top-11 left-1/2 inline-flex h-8 -translate-x-1/2 items-center gap-1.5 rounded-full border border-border bg-card px-3 text-xs font-medium text-muted-foreground transition-[opacity,translate] duration-300",
              atBottom || !started
                ? "pointer-events-none translate-y-2 opacity-0"
                : "translate-y-0 opacity-100",
            )}
          >
            <ArrowDown className="h-3 w-3" aria-hidden />
            {isLoading ? "Follow answer" : "Jump to latest"}
          </button>

          <div className="mx-auto w-full max-w-3xl">
            <Composer
              ref={inputRef}
              value={input}
              onChange={setInput}
              onSend={() => send(input)}
              onStop={stopNow}
              loading={isLoading}
              placeholder="Ask me anything..."
            />
            <p className="mt-2 text-center text-[11px] text-muted-foreground">
              Answers based on my actual work
              <span className="hidden sm:inline"> · Enter to send</span>
            </p>
          </div>
        </div>
      </main>

      <p className="sr-only" role="status" aria-live="polite">
        {status}
      </p>
    </div>
  );
}
