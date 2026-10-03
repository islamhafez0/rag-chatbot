"use client";

import { memo, useMemo } from "react";
import { parseRichContent, type ResponseBlock } from "@/lib/rich-response";
import { MarkdownRenderer } from "./MarkdownRenderer";
import { ResponseBlockRenderer } from "./ResponseBlockRenderer";
import { FollowUpChips } from "./Interactive";

type BlockGroup =
  | { kind: "single"; block: ResponseBlock; key: string }
  | { kind: "projects"; blocks: ResponseBlock[]; key: string };

/**
 * Groups consecutive project blocks so a multi-project answer renders as a
 * responsive grid instead of a tall stack. A lone project stays full-width.
 * Blocks have no stable ids; index keys are correct because the list only
 * ever grows/shrinks as a whole per message update and is never reordered.
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

export const RichAnswer = memo(function RichAnswer({
  content,
  onFollowUp,
}: {
  content: string;
  onFollowUp: (q: string) => void;
}) {
  const parsed = useMemo(() => parseRichContent(content), [content]);
  const { text, blocks, followUps } = parsed;
  const groups = useMemo(() => groupBlocks(blocks), [blocks]);

  return (
    <div className="flex min-w-0 flex-col gap-3">
      {text.trim() ? (
        <div className="markdown text-sm leading-relaxed">
          <MarkdownRenderer content={text} />
        </div>
      ) : blocks.length > 0 ? null : (
        <p className="text-sm text-muted-foreground">…</p>
      )}
      {groups.map((g) =>
        g.kind === "projects" ? (
          <div
            key={g.key}
            role="list"
            aria-label="Projects"
            className="grid min-w-0 auto-rows-fr grid-cols-1 gap-3 sm:grid-cols-2"
          >
            {g.blocks.map((b, j) => (
              <div key={`${g.key}-${j}`} role="listitem" className="min-w-0">
                <ResponseBlockRenderer block={b} />
              </div>
            ))}
          </div>
        ) : (
          <ResponseBlockRenderer key={g.key} block={g.block} />
        ),
      )}
      <FollowUpChips questions={followUps} onSelect={onFollowUp} />
    </div>
  );
});

/** Loading skeleton shown while the first tokens stream in. */
export function RichAnswerSkeleton() {
  return (
    <div className="flex w-full flex-col gap-2" aria-label="Loading answer">
      <div className="h-3.5 w-11/12 animate-pulse rounded bg-muted" />
      <div className="h-3.5 w-4/5 animate-pulse rounded bg-muted" />
      <div className="h-3.5 w-3/5 animate-pulse rounded bg-muted" />
    </div>
  );
}
