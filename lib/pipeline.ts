import { buildRetrievalQuery, routeByVectors, type ChatMessage, type RouteResult } from "./query";
import { embedText, getContext, getCategoryVectors } from "./astra";
import { envRouter } from "./env";

export type RouterMode = "vector" | "none";

export interface PipelineResult {
  query: string;
  merged: boolean;
  category: string | null;
  routeScore: number;
  routeRunnerUp: number;
  context: { text: string; sources: string[] };
  timings: { prepMs: number; routeMs: number; retrieveMs: number };
}

export interface PipelineOptions {
  requestedCategory?: string;
  router?: RouterMode;
  routeThreshold?: number;
  routeMargin?: number;
  limit?: number;
}

const DEFAULT_ROUTER: RouterMode = envRouter();

export async function runPipeline(
  messages: ChatMessage[],
  options: PipelineOptions = {}
): Promise<PipelineResult> {
  const t0 = performance.now();
  const prepared = buildRetrievalQuery(messages);
  const prepMs = performance.now() - t0;

  let category: string | null = options.requestedCategory ?? null;
  let routeScore = 0;
  let routeRunnerUp = 0;
  let queryVector: number[] | undefined;

  const t1 = performance.now();
  if (!category && (options.router ?? DEFAULT_ROUTER) === "vector") {
    queryVector = await embedText(prepared.query);
    const categories = await getCategoryVectors();
    const route: RouteResult = routeByVectors(queryVector, categories, {
      threshold: options.routeThreshold,
      margin: options.routeMargin,
    });
    category = route.category;
    routeScore = route.score;
    routeRunnerUp = route.runnerUp;
  }
  const routeMs = performance.now() - t1;

  const t2 = performance.now();
  const context = await getContext(prepared.query, {
    category: category ?? undefined,
    vector: queryVector,
    limit: options.limit,
  });
  const retrieveMs = performance.now() - t2;

  return {
    query: prepared.query,
    merged: prepared.merged,
    category,
    routeScore,
    routeRunnerUp,
    context,
    timings: { prepMs, routeMs, retrieveMs },
  };
}
