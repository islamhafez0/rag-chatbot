import { buildRetrievalQuery, type ChatMessage } from "./query";
import { getContext } from "../database/pgvector";

export interface PipelineResult {
  query: string;
  merged: boolean;
  category: string | null;
  context: { text: string; sources: string[] };
  timings: { prepMs: number; retrieveMs: number };
}

export interface PipelineOptions {
  requestedCategory?: string;
  limit?: number;
}

export async function runPipeline(
  messages: ChatMessage[],
  options: PipelineOptions = {}
): Promise<PipelineResult> {
  const t0 = performance.now();
  const prepared = buildRetrievalQuery(messages);
  const prepMs = performance.now() - t0;

  // No automatic routing: retrieval runs unfiltered unless the caller
  // passes an explicit category (e.g. a UI facet).
  const category: string | null = options.requestedCategory ?? null;

  const t1 = performance.now();
  const context = await getContext(prepared.query, {
    category: category ?? undefined,
    limit: options.limit,
  });
  const retrieveMs = performance.now() - t1;

  return {
    query: prepared.query,
    merged: prepared.merged,
    category,
    context,
    timings: { prepMs, retrieveMs },
  };
}
