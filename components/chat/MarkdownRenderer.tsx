"use client";

import { memo, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ExternalLink, FileDown } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * SmoothImage — response images fade in over a shimmer placeholder instead
 * of popping into layout. Fixed frame preserves space (no layout shift);
 * `loading="lazy"` + `decoding="async"` keep it off the critical path.
 */
const SmoothImage = memo(function SmoothImage({ src, alt }: { src?: string; alt?: string }) {
  const [loaded, setLoaded] = useState(false);
  if (!src) return null;
  return (
    <span className="relative block h-70 w-45 shrink-0 overflow-hidden rounded-lg border border-border bg-muted shadow-sm">
      {!loaded && <span aria-hidden className="absolute inset-0 animate-pulse bg-muted" />}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        loading="lazy"
        decoding="async"
        onLoad={() => setLoaded(true)}
        className={cn(
          "h-full w-full object-cover transition-opacity duration-500",
          loaded ? "opacity-100" : "opacity-0",
        )}
      />
    </span>
  );
});

/**
 * MarkdownRenderer — single Markdown entry point for assistant text.
 * Text-only answers render exactly as before; rich blocks are rendered
 * separately by ResponseBlockRenderer. No raw HTML execution beyond the
 * pre-existing rehype-raw behavior (no new risk introduced).
 */
export const MarkdownRenderer = memo(function MarkdownRenderer({
  content,
}: {
  content: string;
}) {
  if (!content.trim()) return null;
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        a: ({ href, children }) => {
          if (href?.toLowerCase().endsWith(".pdf")) {
            return (
              <span className="my-2 inline-flex items-center gap-1.5">
                <a
                  href={href}
                  download
                  className="inline-flex items-center gap-2 rounded-lg border border-border bg-muted px-4 py-2.5 text-sm font-medium text-foreground no-underline shadow-sm transition-colors hover:bg-accent"
                >
                  <span className="inline-flex items-center rounded bg-red-600 px-1.5 py-px text-[10px] font-bold leading-4 text-white">
                    PDF
                  </span>
                  <span>{children}</span>
                  <FileDown className="h-4 w-4 text-muted-foreground" />
                </a>
                <a
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  title="Open in browser"
                  className="inline-flex items-center rounded-lg border border-border bg-muted p-2.5 text-muted-foreground shadow-sm transition-colors hover:bg-accent hover:text-foreground"
                >
                  <ExternalLink className="h-4 w-4" />
                </a>
              </span>
            );
          }
          return (
            <a href={href} target="_blank" rel="noopener noreferrer">
              {children}
            </a>
          );
        },
        img: ({ src, alt }) => (
          <SmoothImage src={typeof src === "string" ? src : undefined} alt={alt} />
        ),
        table: ({ children }) => (
          <div className="table-shell my-2 flex w-full max-w-3xl overflow-x-auto rounded-lg border border-border">
            <table className="w-max min-w-full shrink-0 text-sm">{children}</table>
          </div>
        ),
        p: ({ children }) => (
          <p className="has-[img]:flex has-[img]:flex-wrap has-[img]:gap-2">{children}</p>
        ),
      }}
    >
      {content}
    </ReactMarkdown>
  );
});
