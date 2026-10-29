"use client";

import { useChat } from "ai/react";
import { AlertTriangle, ArrowDown, RotateCcw, SquarePen } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toRequestMessages } from "@/lib/rich-response";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "@/components/theme-toggle";
import { AssistantAvatar, AssistantMessage, UserMessage } from "@/components/chat/ChatMessage";
import { Composer } from "@/components/chat/Composer";
import { useStickToBottom } from "@/components/chat/useStickToBottom";
import { Hero } from "@/components/portfolio/Hero";
import { PROFILE } from "@/components/portfolio/profile";

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
      if (!q || isLoading) return; // double-submit guard (button, Enter, chips)
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
    stop(); // aborts the fetch; the partial answer stays in `messages`
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
    fetch("/api/warmup", { cache: "no-store" }).catch(() => {});
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
      <div className="ambient" aria-hidden>
        <div className="ambient-grid" />
      </div>

      <header className="pt-safe relative z-20 border-b border-transparent">
        <div className="mx-auto flex h-14 w-full max-w-4xl items-center justify-between gap-3 px-4 sm:h-16 sm:px-6">
          <button
            type="button"
            onClick={started ? newChat : undefined}
            tabIndex={started ? 0 : -1}
            aria-label={started ? "Back to start (new chat)" : undefined}
            className={cn(
              "flex min-w-0 items-center gap-2.5 rounded-full pr-2 text-left transition-opacity duration-500",
              started ? "opacity-100" : "pointer-events-none opacity-0",
            )}
          >
            <AssistantAvatar />
            <span className="min-w-0 leading-tight">
              <span className="block truncate text-sm font-semibold">{PROFILE.name}</span>
              <span className="block truncate text-[11px] text-muted-foreground">
                Frontend &amp; Odoo developer
              </span>
            </span>
          </button>
          <div className="flex shrink-0 items-center gap-1.5">
            {started && (
              <button
                type="button"
                onClick={newChat}
                className="inline-flex h-9 animate-fade items-center gap-1.5 rounded-full border border-border bg-card/70 px-3 text-xs font-semibold text-foreground backdrop-blur transition-[background-color,scale] duration-200 hover:bg-accent active:scale-95"
              >
                <SquarePen className="h-3.5 w-3.5" aria-hidden />
                New chat
              </button>
            )}
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="relative z-10 flex min-h-0 flex-1 flex-col">
        <div
          ref={scrollRef}
          className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain [scrollbar-gutter:stable]"
        >
          <div
            ref={contentRef}
            className="mx-auto flex w-full max-w-3xl flex-col gap-7 px-4 pt-2 pb-8 sm:px-6"
          >
            {!started ? (
              <Hero onPick={send} disabled={isLoading} />
            ) : (
              <div role="log" aria-label="Conversation" aria-busy={isLoading} className="flex flex-col gap-7 pt-4">
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
                    className="flex animate-rise items-start gap-3 rounded-2xl border border-destructive/30 bg-destructive/8 p-4"
                  >
                    <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" aria-hidden />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-foreground">That request didn&apos;t go through.</p>
                      <p className="mt-0.5 text-sm [overflow-wrap:anywhere] text-muted-foreground">
                        {readableError(error)}
                      </p>
                      <div className="mt-3 flex gap-2">
                        <button
                          type="button"
                          onClick={retry}
                          className="inline-flex h-8 items-center gap-1.5 rounded-full bg-foreground px-3 text-xs font-semibold text-background transition-[scale] active:scale-95"
                        >
                          <RotateCcw className="h-3.5 w-3.5" aria-hidden /> Try again
                        </button>
                        <button
                          type="button"
                          onClick={() => setDismissedError(error)}
                          className="inline-flex h-8 items-center rounded-full px-3 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
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

        <div className="pb-safe relative px-3 sm:px-6">
          <button
            type="button"
            onClick={() => scrollToBottom("smooth")}
            aria-label="Jump to latest message"
            tabIndex={atBottom || !started ? -1 : 0}
            className={cn(
              "absolute -top-14 left-1/2 inline-flex h-9 -translate-x-1/2 items-center gap-1.5 rounded-full border border-border bg-card/90 px-3.5 text-xs font-semibold text-foreground shadow-lift backdrop-blur transition-[opacity,translate] duration-300 ease-out-expo",
              atBottom || !started ? "pointer-events-none translate-y-2 opacity-0" : "translate-y-0 opacity-100",
            )}
          >
            <ArrowDown className="h-3.5 w-3.5" aria-hidden />
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
            />
            <p className="mt-2 text-center text-[11px] text-muted-foreground">
              Answers come from my CV, projects and code
              <span className="hidden sm:inline"> · Enter to send, Shift+Enter for a new line</span>
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
