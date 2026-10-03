import { buildRetrievalQuery, type ChatMessage } from "./query";
import { classifyIntent, type QueryIntent } from "./intent";
import { getContext } from "../database/pgvector";
import type { CoverageInfo } from "./coverage";
import { envOptionalNumber } from "./env";

const EXPANDED_LIMIT = envOptionalNumber("RETRIEVAL_LIMIT_EXPANDED", 12);

export interface PipelineResult {
  query: string;
  merged: boolean;
  category: string | null;
  intent: QueryIntent;
  context: { text: string; sources: string[]; coverage: CoverageInfo };
  timings: { prepMs: number; retrieveMs: number; assemblyMs: number };
}

export interface PipelineOptions {
  requestedCategory?: string;
  limit?: number;
  search?: "hybrid" | "vector";
  /** Pre-computed query embedding (skips one embed call when available). */
  vector?: number[];
}

export async function runPipeline(
  messages: ChatMessage[],
  options: PipelineOptions = {}
): Promise<PipelineResult> {
  const t0 = performance.now();
  const prepared = buildRetrievalQuery(messages);
  const prepMs = performance.now() - t0;

  // Adaptive context mode from deterministic intent classification.
  // An explicit caller-provided category wins over classification.
  const intent = classifyIntent(prepared.query);
  const category: string | null = options.requestedCategory ?? intent.category;
  const mode = options.requestedCategory ? "complete" : intent.mode;
  const sources = options.requestedCategory ? null : intent.sources;
  const limit =
    options.limit ?? (mode === "expanded" ? EXPANDED_LIMIT : undefined);

  const t1 = performance.now();
  const context = await getContext(prepared.query, {
    category: category ?? undefined,
    sources: sources ?? undefined,
    limit,
    search: options.search,
    mode,
    vector: options.vector,
  });
  const retrieveMs = performance.now() - t1;

  return {
    query: prepared.query,
    merged: prepared.merged,
    category,
    intent: { ...intent, mode, category, sources },
    context,
    timings: { prepMs, retrieveMs, assemblyMs: context.assemblyMs },
  };
}
