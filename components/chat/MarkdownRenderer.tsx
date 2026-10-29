"use client";

import { memo, useState } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { ArrowUpRight, Download } from "lucide-react";
import { cn } from "@/lib/utils";
import { replaceBreakTags } from "@/lib/markdown";

/** Links the renderer will make clickable: https, mailto, site-relative, in-page. */
export function isRenderableHref(href: string | undefined): href is string {
  if (!href) return false;
  const h = href.trim();
  if (h.startsWith("#")) return true;
  if (h.startsWith("/")) return !h.startsWith("//");
  return /^(https:\/\/|mailto:)/i.test(h);
}

function isRenderableImage(src: string | undefined): src is string {
  if (!src) return false;
  return (src.startsWith("/") && !src.startsWith("//")) || src.startsWith("https://");
}

/**
 * Photo tile: fixed aspect frame (no layout shift), shimmer until decoded,
 * soft zoom on hover. Opens the full image in a new tab.
 */
const GalleryImage = memo(function GalleryImage({ src, alt }: { src: string; alt?: string }) {
  const [loaded, setLoaded] = useState(false);
  return (
    <a
      href={src}
      target="_blank"
      rel="noopener noreferrer"
      className="group/img relative block aspect-[3/4] overflow-hidden rounded-2xl border border-border bg-muted shadow-soft"
    >
      {!loaded && <span aria-hidden className="absolute inset-0 skeleton" />}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt ?? ""}
        loading="lazy"
        decoding="async"
        onLoad={() => setLoaded(true)}
        className={cn(
          "h-full w-full object-cover transition-[opacity,scale] duration-700 ease-out-expo group-hover/img:scale-[1.04]",
          loaded ? "opacity-100" : "opacity-0",
        )}
      />
      {alt && (
        <span className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent px-3 pt-8 pb-2 text-xs font-medium text-white opacity-0 transition-opacity duration-300 group-hover/img:opacity-100 group-focus-visible/img:opacity-100">
          {alt}
        </span>
      )}
    </a>
  );
});

type HastNode = { type: string; tagName?: string; value?: string; children?: HastNode[] };

function imageOnlyParagraph(node: HastNode | undefined): number {
  const kids = node?.children ?? [];
  let imgs = 0;
  for (const k of kids) {
    if (k.type === "element" && k.tagName === "img") imgs++;
    else if (k.type === "text" && !k.value?.trim()) continue;
    else return 0;
  }
  return imgs;
}

function FileButton({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <span className="not-prose my-1.5 mr-2 inline-flex items-stretch overflow-hidden rounded-full border border-border bg-card shadow-soft">
      <a
        href={href}
        download
        className="btn-file inline-flex items-center gap-2 px-3.5 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-accent"
      >
        <Download className="h-4 w-4 text-primary" aria-hidden />
        <span>{children}</span>
        <span className="rounded bg-destructive/12 px-1.5 py-px text-[10px] font-bold text-destructive">PDF</span>
      </a>
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Open PDF in a new tab"
        className="btn-file inline-flex items-center border-l border-border px-2.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
      >
        <ArrowUpRight className="h-4 w-4" aria-hidden />
      </a>
    </span>
  );
}

const components: Components = {
  a: ({ href, children }) => {
    if (!isRenderableHref(href)) return <span>{children}</span>;
    if (/\.pdf($|[?#])/i.test(href)) return <FileButton href={href}>{children}</FileButton>;
    const external = /^https:/i.test(href);
    return (
      <a href={href} {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}>
        {children}
      </a>
    );
  },
  img: ({ src, alt }) =>
    typeof src === "string" && isRenderableImage(src) ? <GalleryImage src={src} alt={alt} /> : null,
  p: ({ node, children }) => {
    const imgs = imageOnlyParagraph(node as HastNode | undefined);
    if (imgs > 0) {
      return (
        <div
          role="group"
          aria-label="Photos"
          className={cn(
            "not-prose my-3 grid gap-2.5 stagger",
            imgs === 1 ? "max-w-[15rem] grid-cols-1" : imgs === 2 ? "max-w-md grid-cols-2" : "grid-cols-2 sm:grid-cols-3",
          )}
        >
          {children}
        </div>
      );
    }
    return <p>{children}</p>;
  },
  table: ({ children }) => (
    <div className="table-shell my-3 w-full overflow-x-auto rounded-xl border border-border">
      <table className="w-full min-w-max">{children}</table>
    </div>
  ),
};

/**
 * MarkdownRenderer — the single Markdown entry point for assistant prose,
 * styled by the typography plugin (`prose-chat` maps it to theme tokens).
 * No raw HTML pipeline; links/images are allow-listed.
 */
export const MarkdownRenderer = memo(function MarkdownRenderer({
  content,
  className,
}: {
  content: string;
  className?: string;
}) {
  const safe = replaceBreakTags(content);
  if (!safe.trim()) return null;
  return (
    <div className={cn("prose prose-chat", className)}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {safe}
      </ReactMarkdown>
    </div>
  );
});
