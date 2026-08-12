"use client";

import { useChat } from "ai/react";
import { Send, Bot, User, AlertTriangle, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";

import { ThemeToggle } from "@/components/theme-toggle";
import Image from "next/image";

export default function Home() {
  const emptyRetriesRef = useRef(0);
  const { messages, input, handleInputChange, handleSubmit, isLoading, reload, error } =
    useChat({
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
    <div className="flex h-screen bg-background text-foreground overflow-hidden">
      <main className="flex-1 flex flex-col h-full relative overflow-hidden">
        <header className="p-4 border-b border-border flex items-center justify-between sticky top-0 bg-background/80 backdrop-blur-md z-10 w-full">
          <div className="w-25 h-15 flex items-center justify-center shrink-0">
            <Image src="/images/logo-light.png" alt="Logo" width={100} height={100} className="w-full h-full object-contain dark:hidden" />
            <Image src="/images/logo-dark.png" alt="Logo" width={100} height={100} className="hidden w-full h-full object-contain dark:block" />
          </div>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            {/* <div className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded-full">
              Beta v0.2
            </div> */}
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-6 no-scrollbar">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center space-y-4 opacity-50">
              <Bot className="w-12 h-12 mb-4" />
              <h2 className="text-2xl font-semibold">Ready to assist.</h2>
              <p className="max-w-md text-sm text-muted-foreground">
                Ask about Islam’s experience, projects, technical decisions, or the thinking behind what he builds.
              </p>
            </div>
          ) : (
            messages.map((m) => (
              <div
                key={m.id}
                className={cn(
                  "flex w-full max-w-3xl mx-auto gap-4",
                  m.role === "user" ? "justify-end" : "justify-start",
                )}
              >
                {m.role !== "user" && (
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <Bot className="w-5 h-5 text-primary" />
                  </div>
                )}

                <div className="flex flex-col gap-2 max-w-[80%]">
                  <div
                    className={cn(
                      "p-4 rounded-xl shadow-sm",
                      m.role === "user"
                        ? "bg-primary text-primary-foreground rounded-br-none"
                        : "bg-muted text-foreground rounded-bl-none",
                    )}
                  >
                    {m.role === "user" ? (
                      <p className="text-sm leading-relaxed whitespace-pre-wrap wrap-break-word text-primary-foreground opacity-90">
                        {m.content}
                      </p>
                    ) : (
                      <div className="markdown text-sm leading-relaxed">
                        <ReactMarkdown
                          remarkPlugins={[remarkGfm]}
                          components={{
                            a: ({ href, children }) => (
                              <a
                                href={href}
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                {children}
                              </a>
                            ),
                          }}
                        >
                          {m.content}
                        </ReactMarkdown>
                      </div>
                    )}
                  </div>
                </div>

                {m.role === "user" && (
                  <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center shrink-0">
                    <User className="w-5 h-5 text-secondary-foreground" />
                  </div>
                )}
              </div>
            ))
          )}

          {isLoading && (
            <div className="flex w-full max-w-3xl mx-auto gap-4 justify-start">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <Bot className="w-5 h-5 text-primary" />
              </div>
              <span className="inline-flex text-xl text-muted-foreground tracking-widest">
                <span className="animate-[pulse_1s_ease-in-out_infinite] w-2 h-2">
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
            <div className="flex w-full max-w-3xl mx-auto gap-4 justify-start">
              <div className="w-8 h-8 rounded-full bg-destructive/10 flex items-center justify-center shrink-0">
                <Bot className="w-5 h-5 text-destructive" />
              </div>
              <div className="flex flex-col gap-2 max-w-[80%]">
                <div className="flex items-start gap-2 p-4 rounded-xl shadow-sm bg-destructive/10 text-destructive rounded-bl-none border border-destructive/30">
                  <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
                  <div className="flex-1 space-y-1">
                    <p className="text-sm font-medium">
                      Something went wrong with that request.
                    </p>
                    {errorMessage && (
                      <p className="text-xs text-destructive/80 wrap-break-word">
                        {errorMessage}
                      </p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => setErrorDismissed(true)}
                    className="shrink-0 rounded-md p-1 hover:bg-destructive/20 transition-colors"
                    aria-label="Dismiss error"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        <div className="p-4 bg-background border-t border-border sticky bottom-0 w-full">
          <form
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
            className="max-w-3xl mx-auto relative flex items-center gap-2"
          >
            <textarea
              autoFocus
              className="field-sizing-content resize-none no-scrollbar max-h-36 flex-1 p-3 pl-4 pr-12 rounded-xl border border-input bg-muted/50 focus:bg-background focus:ring-2 focus:ring-primary/20 focus:outline-none transition-all placeholder:text-muted-foreground/70"
              value={input}
              onChange={handleInputChange}
              placeholder="Ask a question..."
              name="chat-input-area"
            />
            <button
              type="submit"
              disabled={isLoading || !input.trim()}
              className="absolute right-2 p-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 disabled:opacity-50 transition-all shadow-md"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
          <div className="text-center mt-2">
            <p className="text-[10px] text-muted-foreground">
              Powered by RAG + Your Experience
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
