export interface ChatMessage {
  role?: string;
  content?: unknown;
}

export function userContents(messages: ChatMessage[]): string[] {
  return messages
    .filter((m) => m.role === "user")
    .map((m) => String(m.content ?? "").trim())
    .filter(Boolean);
}

export function lastUserContent(messages: ChatMessage[]): string {
  return userContents(messages).at(-1) ?? "";
}

const BARE_FOLLOW_UPS = new Set([
  "and",
  "and then",
  "then",
  "so",
  "more",
  "tell me more",
  "what about it",
  "what else",
  "go on",
  "continue",
  "ok",
  "okay",
  "yes",
  "yeah",
  "again",
  "also",
  "hmm",
  "um",
]);

export function isDegenerateFollowUp(content: string): boolean {
  const trimmed = content.trim().toLowerCase();
  const tokens = trimmed.split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return false;
  if (tokens.length <= 2) return true;
  if (BARE_FOLLOW_UPS.has(trimmed)) return true;
  if (/^(?:the|what about the) .+\b(one|app|project|site|thing)\b[?.!]*$/i.test(trimmed))
    return true;
  return false;
}

export interface PreparedQuery {
  query: string;
  routeText: string;
  merged: boolean;
}

export function buildRetrievalQuery(messages: ChatMessage[]): PreparedQuery {
  const users = userContents(messages);
  const last = users.at(-1) ?? "";
  const prev = users.length >= 2 ? users[users.length - 2] : null;

  if (!last) return { query: "", routeText: "", merged: false };

  if (prev && isDegenerateFollowUp(last)) {
    return { query: `${prev} ${last}`, routeText: last, merged: true };
  }

  return { query: last, routeText: last, merged: false };
}

export function cosine(a: number[], b: number[]): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

export interface CategoryVectors {
  category: string;
  vectors: number[][];
}

export interface RouteResult {
  category: string | null;
  score: number;
  runnerUp: number;
}

import { envNumber, validateEnv } from "./env";

validateEnv();

const DEFAULT_ROUTE_THRESHOLD = envNumber("ROUTE_THRESHOLD");
const DEFAULT_ROUTE_MARGIN = envNumber("ROUTE_MARGIN");

export function routeByVectors(
  queryVector: number[],
  categories: CategoryVectors[],
  opts: { threshold?: number; margin?: number } = {}
): RouteResult {
  const { threshold = DEFAULT_ROUTE_THRESHOLD, margin = DEFAULT_ROUTE_MARGIN } = opts;

  let best: { category: string; score: number } | null = null;
  let runnerUp = 0;

  for (const { category, vectors } of categories) {
    if (vectors.length === 0) continue;
    const score =
      vectors.reduce((sum, v) => sum + cosine(queryVector, v), 0) / vectors.length;
    if (best === null || score > best.score) {
      runnerUp = best ? best.score : 0;
      best = { category, score };
    } else if (score > runnerUp) {
      runnerUp = score;
    }
  }

  if (!best) return { category: null, score: 0, runnerUp: 0 };
  if (best.score >= threshold && best.score - runnerUp >= margin) {
    return { category: best.category, score: best.score, runnerUp };
  }
  return { category: null, score: best.score, runnerUp };
}
