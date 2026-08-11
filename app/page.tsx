"use client";

import { useChat } from "ai/react";
import { Send, Bot, User } from "lucide-react";
import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

import { ThemeToggle } from "@/components/theme-toggle";
import Image from "next/image";

export default function Home() {
  const { messages, input, handleInputChange, handleSubmit, isLoading } =
    useChat();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

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

        <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-6 scroll-smooth no-scrollbar">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center space-y-4 opacity-50">
              <Bot className="w-12 h-12 mb-4" />
              <h2 className="text-2xl font-semibold">Ready to assist.</h2>
              <p className="max-w-md text-sm text-muted-foreground">
                Ask me about my professional experience, specific projects, or
                decision-making philosophy - Islam Hafez.
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
                    <p
                      className={cn(
                        "text-sm leading-relaxed whitespace-pre-wrap wrap-break-word",
                        m.role === "user"
                          ? "text-primary-foreground opacity-90"
                          : "",
                      )}
                    >
                      {m.content}
                    </p>
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
          <div ref={messagesEndRef} />
        </div>

        <div className="p-4 bg-background border-t border-border sticky bottom-0 w-full">
          <form
            onSubmit={handleSubmit}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
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
