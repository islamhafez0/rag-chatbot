"use client";

import { useChat } from "ai/react";
// import { UIMessage } from "ai"; // Removed to avoid confusion

interface Message {
  id: string;
  role: string;
  content: string;
}
import { Send, Bot, User, Sparkles } from "lucide-react";
import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

export default function Home() {
  const { messages, input, handleInputChange, handleSubmit, isLoading } =
    useChat() as any;
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  return (
    <main className="flex flex-col h-screen bg-background text-foreground">
      {/* Header */}
      <header className="p-4 border-b border-border flex items-center justify-between sticky top-0 bg-background/80 backdrop-blur-md z-10">
        <div className="flex items-center gap-2">
          <div className="bg-primary/10 p-2 rounded-lg">
            <Sparkles className="w-5 h-5 text-primary" />
          </div>
          <h1 className="font-bold text-lg tracking-tight">
            Personal Intelligence App
          </h1>
        </div>
        <div className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded-full">
          Beta v0.1
        </div>
      </header>

      {/* Chat Area */}
      <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-6 scroll-smooth">
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
          messages.map((m: any) => (
            <div
              key={m.id}
              className={cn(
                "flex w-full max-w-3xl mx-auto gap-4",
                m.role === "user" ? "justify-end" : "justify-start",
              )}
            >
              {m.role !== "user" && (
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Bot className="w-5 h-5 text-primary" />
                </div>
              )}

              <div
                className={cn(
                  "p-4 rounded-xl max-w-[80%]",
                  m.role === "user"
                    ? "bg-primary text-primary-foreground rounded-br-none"
                    : "bg-muted text-foreground rounded-bl-none",
                )}
              >
                <div className="prose dark:prose-invert text-sm sm:text-base leading-relaxed break-words">
                  {/* Basic Markdown rendering could allow bolding, code blocks etc */}
                  {m.content.split("\n").map((line: string, i: number) => (
                    <p key={i} className="min-h-[1rem]">
                      {line}
                    </p>
                  ))}
                </div>
              </div>

              {m.role === "user" && (
                <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center flex-shrink-0">
                  <User className="w-5 h-5 text-secondary-foreground" />
                </div>
              )}
            </div>
          ))
        )}
        {isLoading && (
          <div className="flex w-full max-w-3xl mx-auto gap-4 justify-start">
            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
              <Bot className="w-5 h-5 text-primary" />
            </div>
            <div className="bg-muted p-4 rounded-xl rounded-bl-none">
              <div className="flex space-x-2">
                <div className="w-2 h-2 bg-foreground/30 rounded-full animate-bounce" />
                <div className="w-2 h-2 bg-foreground/30 rounded-full animate-bounce [animation-delay:0.2s]" />
                <div className="w-2 h-2 bg-foreground/30 rounded-full animate-bounce [animation-delay:0.4s]" />
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-4 bg-background border-t border-border sticky bottom-0">
        <form
          onSubmit={handleSubmit}
          className="max-w-3xl mx-auto relative flex items-center gap-2"
        >
          <input
            className="flex-1 p-3 pl-4 pr-12 rounded-xl border border-input bg-muted/50 focus:bg-background focus:ring-2 focus:ring-ring focus:outline-none transition-all placeholder:text-muted-foreground/70"
            value={input}
            onChange={handleInputChange}
            placeholder="Ask a question..."
          />
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            className="absolute right-2 p-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 disabled:opacity-50 transition-all"
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
  );
}
