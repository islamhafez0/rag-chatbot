"use client";

import { memo, useMemo } from "react";
import { parseRichContent, type ResponseBlock } from "@/lib/rich-response";
import { cn } from "@/lib/utils";
import { BlockSkeleton } from "./BlockSkeleton";
import { MarkdownRenderer } from "./MarkdownRenderer";
import { ResponseBlockRenderer } from "./ResponseBlockRenderer";

type BlockGroup =
  | { kind: "single"; block: ResponseBlock; key: string }
  | { kind: "projects"; blocks: ResponseBlock[]; key: string };

/**
 * Consecutive project blocks become a responsive grid; a lone project stays
 * full width. Index keys are stable: blocks only appear once the payload is
 * complete and are never reordered.
 */
function groupBlocks(blocks: ResponseBlock[]): BlockGroup[] {
  const groups: BlockGroup[] = [];
  let i = 0;
  while (i < blocks.length) {
    if (blocks[i].type === "project") {
      const start = i;
      const run: ResponseBlock[] = [];
      while (i < blocks.length && blocks[i].type === "project") run.push(blocks[i++]);
      groups.push(
        run.length > 1
          ? { kind: "projects", blocks: run, key: `projects-${start}` }
          : { kind: "single", block: run[0], key: `project-${start}` },
      );
    } else {
      groups.push({ kind: "single", block: blocks[i], key: `${blocks[i].type}-${i}` });
      i++;
    }
  }
  return groups;
}

/**
 * RichAnswer — prose first (always rendered, streamed live with a caret),
 * then the optional visual: a typed skeleton while its fence is open, the
 * validated blocks (staggered in) once complete. A broken visual simply
 * renders nothing; the prose answer always stands.
 */
export const RichAnswer = memo(function RichAnswer({
  content,
  streaming = false,
}: {
  content: string;
  streaming?: boolean;
}) {
  const parsed = useMemo(() => parseRichContent(content), [content]);
  const { text, blocks, pending } = parsed;
  const groups = useMemo(() => groupBlocks(blocks), [blocks]);
  const showCaret = streaming && !pending;

  return (
    <div className="flex min-w-0 flex-col gap-4">
      {text.trim() ? (
        <MarkdownRenderer content={text} className={cn(showCaret && "is-streaming")} />
      ) : (
        showCaret && <div className="prose prose-chat is-streaming" aria-hidden />
      )}

      {pending && streaming && <BlockSkeleton pending={pending} />}

      {groups.length > 0 && (
        <div className="flex min-w-0 flex-col gap-3 stagger">
          {groups.map((g, gi) =>
            g.kind === "projects" ? (
              <ul
                key={g.key}
                aria-label="Projects"
                className="grid min-w-0 grid-cols-1 gap-3 stagger sm:grid-cols-2"
                style={{ "--i": gi } as React.CSSProperties}
              >
                {g.blocks.map((b, j) => (
                  <li key={`${g.key}-${j}`} className="min-w-0" style={{ "--i": j } as React.CSSProperties}>
                    <ResponseBlockRenderer block={b} />
                  </li>
                ))}
              </ul>
            ) : (
              <div key={g.key} className="min-w-0" style={{ "--i": gi } as React.CSSProperties}>
                <ResponseBlockRenderer block={g.block} />
              </div>
            ),
          )}
        </div>
      )}
    </div>
  );
});
