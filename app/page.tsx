"use client";

import { useChat } from "ai/react";
import type { Message } from "ai";
import { Send, Bot, User, AlertTriangle, X } from "lucide-react";
import { memo, useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

import { ThemeToggle } from "@/components/theme-toggle";
import { RichAnswer } from "@/components/chat/RichAnswer";
import Image from "next/image";

const ChatMessage = memo(function ChatMessage({
  m,
  onFollowUp,
}: {
  m: Message;
  onFollowUp: (q: string) => void;
}) {
  const isUser = m.role === "user";
  return (
    <div
      className={cn(
        "mx-auto flex w-full max-w-4xl gap-4",
        isUser ? "justify-end" : "justify-start",
      )}
    >
      {!isUser && (
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10">
          <Bot className="h-5 w-5 text-primary" />
        </div>
      )}

      <div
        className={cn(
          "flex min-w-0 flex-col gap-2",
          isUser ? "max-w-[80%]" : "w-full flex-1",
        )}
      >
        <div
          className={cn(
            "rounded-xl p-4 shadow-sm",
            isUser
              ? "rounded-br-none bg-primary text-primary-foreground"
              : "rounded-bl-none bg-muted text-foreground",
          )}
        >
          {isUser ? (
            <p className="text-sm leading-relaxed whitespace-pre-wrap wrap-break-word text-primary-foreground opacity-90">
              {m.content}
            </p>
          ) : (
            <RichAnswer content={m.content} onFollowUp={onFollowUp} />
          )}
        </div>
      </div>

      {isUser && (
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-secondary">
          <User className="h-5 w-5 text-secondary-foreground" />
        </div>
      )}
    </div>
  );
});

export default function Home() {
  const emptyRetriesRef = useRef(0);
  const formRef = useRef<HTMLFormElement>(null);
  const {
    messages,
    input,
    handleInputChange,
    handleSubmit,
    isLoading,
    reload,
    error,
    append,
    setInput,
  } = useChat({
    keepLastMessageOnError: true,
    onFinish: (message) => {
      if (message.role === "assistant" && !message.content.trim()) {
        if (emptyRetriesRef.current < 2) {
          emptyRetriesRef.current += 1;
          reload();
        } else {
          emptyRetriesRef.current = 0;
        }
      } else {
        emptyRetriesRef.current = 0;
      }
    },
  });
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [errorDismissed, setErrorDismissed] = useState(false);

  const errorMessage =
    error instanceof Error
      ? (() => {
          try {
            const parsed = JSON.parse(error.message);
            if (parsed && typeof parsed.error === "string") return parsed.error;
          } catch {
            // fall through to raw message
          }
          return error.message || "Something went wrong with that request.";
        })()
      : "Something went wrong with that request.";

  /** Follow-up chips + starter prompts submit through the same chat flow. */
  const submitQuestion = useCallback(
    (q: string) => {
      const question = q.trim();
      if (!question || isLoading) return;
      setErrorDismissed(false);
      try {
        const maybeAppend = append as unknown as
          | ((msg: { role: "user"; content: string }) => void)
          | undefined;
        if (typeof maybeAppend === "function") {
          void maybeAppend({ role: "user", content: question });
          return;
        }
      } catch {
        // fall through to input-based submit
      }
      try {
        const maybeSetInput = setInput as unknown as ((v: string) => void) | undefined;
        if (typeof maybeSetInput === "function" && formRef.current) {
          maybeSetInput(question);
          requestAnimationFrame(() => {
            formRef.current?.requestSubmit();
          });
          return;
        }
      } catch {
        // no-op: input remains user-controlled
      }
    },
    [append, isLoading, setInput],
  );

  const scrollToBottom = useCallback(() => {
    requestAnimationFrame(() => {
      messagesEndRef.current?.scrollIntoView({
        behavior: isLoading ? "auto" : "smooth",
      });
    });
  }, [isLoading]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading, scrollToBottom]);

  return (
    <div className="flex h-screen overflow-hidden bg-background text-foreground">
      <main className="relative flex h-full flex-1 flex-col overflow-hidden">
        <header className="sticky top-0 z-10 flex w-full items-center justify-between border-b border-border bg-background/80 p-4 backdrop-blur-md">
          <div className="flex h-15 w-25 shrink-0 items-center justify-center">
            <Image src="/images/logo-light.png" alt="Logo" width={100} height={100} className="h-full w-full object-contain dark:hidden" />
            <Image src="/images/logo-dark.png" alt="Logo" width={100} height={100} className="hidden h-full w-full object-contain dark:block" />
          </div>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            {/* <div className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded-full">
              Beta v0.2
            </div> */}
          </div>
        </header>

        <div className="flex-1 space-y-6 overflow-x-hidden overflow-y-auto p-4 no-scrollbar md:p-8">
          {messages.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center space-y-4 text-center opacity-100">
              <Bot className="mb-4 h-12 w-12 text-muted-foreground" />
              <h2 className="text-2xl font-semibold">Ready to assist.</h2>
              <p className="max-w-md text-sm text-muted-foreground">
                Ask about Islam’s experience, projects, technical decisions, or the thinking behind what he builds.
              </p>
            </div>
          ) : (
            messages.map((m) => <ChatMessage key={m.id} m={m} onFollowUp={submitQuestion} />)
          )}

          {isLoading && (
            <div className="mx-auto flex w-full max-w-4xl justify-start gap-4">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10">
                <Bot className="h-5 w-5 text-primary" />
              </div>
              <span className="inline-flex text-xl tracking-widest text-muted-foreground">
                <span className="h-2 w-2 animate-[pulse_1s_ease-in-out_infinite]">
                  .
                </span>
                <span className="animate-[pulse_1s_ease-in-out_0.2s_infinite]">
                  .
                </span>
                <span className="animate-[pulse_1s_ease-in-out_0.4s_infinite]">
                  .
                </span>
              </span>
            </div>
          )}

          {error && !errorDismissed && (
            <div className="mx-auto flex w-full max-w-4xl justify-start gap-4">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-destructive/10">
                <Bot className="h-5 w-5 text-destructive" />
              </div>
              <div className="flex max-w-[80%] flex-col gap-2">
                <div className="flex items-start gap-2 rounded-xl rounded-bl-none border border-destructive/30 bg-destructive/10 p-4 text-destructive shadow-sm">
                  <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
                  <div className="flex-1 space-y-1">
                    <p className="text-sm font-medium">
                      Something went wrong with that request.
                    </p>
                    {errorMessage && (
                      <p className="text-xs wrap-break-word text-destructive/80">
                        {errorMessage}
                      </p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => setErrorDismissed(true)}
                    className="shrink-0 rounded-md p-1 transition-colors hover:bg-destructive/20"
                    aria-label="Dismiss error"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        <div className="sticky bottom-0 w-full border-t border-border bg-background p-4">
          <form
            ref={formRef}
            onSubmit={(e) => {
              setErrorDismissed(false);
              handleSubmit(e);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                setErrorDismissed(false);
                handleSubmit(e);
              }
            }}
            className="relative mx-auto flex max-w-4xl items-center gap-2"
          >
            <textarea
              autoFocus
              className="max-h-36 flex-1 resize-none rounded-xl border border-input bg-muted/50 p-3 pr-12 pl-4 field-sizing-content no-scrollbar transition-all placeholder:text-muted-foreground/70 focus:bg-background focus:ring-2 focus:ring-primary/20 focus:outline-none"
              value={input}
              onChange={handleInputChange}
              placeholder="Ask a question..."
              name="chat-input-area"
            />
            <button
              type="submit"
              disabled={isLoading || !input.trim()}
              className="absolute right-2 rounded-lg bg-primary p-2 text-primary-foreground shadow-md transition-all hover:opacity-90 disabled:opacity-50"
            >
              <Send className="h-4 w-4" />
            </button>
          </form>
          <div className="mt-2 text-center">
            <p className="text-[10px] text-muted-foreground">
              Powered by RAG + Your Experience
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
