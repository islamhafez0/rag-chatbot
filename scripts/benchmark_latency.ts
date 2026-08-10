import "dotenv/config";
import OpenAI from "openai";
import { getContext } from "../lib/astra";
import { rewriteRetrievalQuery } from "../lib/query-rewrite";

const groq = new OpenAI({
  apiKey: process.env.GROQ_API_KEY,
  baseURL: "https://api.groq.com/openai/v1",
});

const QUERIES = [
  "What projects has Islam built?",
  "Tell me about the RAG Career Chatbot",
  "What skills does Islam have?",
  "TaqaTechno",
  "Which companies has Islam worked at?",
];

const REWRITE_CONVERSATION = [
  { role: "user", content: "Tell me about the RAG Career Chatbot project" },
  {
    role: "assistant",
    content: "It is a RAG-powered career chatbot built with Next.js and LangChain.",
  },
  { role: "user", content: "tell me more about the tech stack" },
];

async function time(fn: () => Promise<unknown>): Promise<number> {
  const start = performance.now();
  await fn();
  return performance.now() - start;
}

function median(nums: number[]): number {
  const sorted = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

async function main() {
  console.log("Warming up retrieval pipeline...");
  await getContext(QUERIES[0]);

  console.log("\n=== getContext latency (embed + hybrid + rerank + fallback) ===\n");
  const rows: { query: string; runs: number[]; medianMs: number }[] = [];

  for (const query of QUERIES) {
    const runs: number[] = [];
    for (let i = 0; i < 3; i++) {
      runs.push(await time(() => getContext(query)));
    }
    rows.push({ query, runs, medianMs: median(runs) });
  }

  for (const row of rows) {
    console.log(
      `- "${row.query}"\n    runs: ${row.runs.map((r) => `${r.toFixed(0)}ms`).join(", ")}   median: ${row.medianMs.toFixed(0)}ms`
    );
  }

  const allRuns = rows.flatMap((r) => r.runs).sort((a, b) => a - b);
  const p50 = median(allRuns);
  const p95 = allRuns[Math.ceil(0.95 * allRuns.length) - 1];
  console.log(
    `\nOverall (${allRuns.length} samples) -> p50: ${p50.toFixed(0)}ms   p95: ${p95.toFixed(0)}ms`
  );

  console.log("\n=== Query rewrite LLM latency (follow-up scenario) ===\n");
  const rewriteRuns: number[] = [];
  for (let i = 0; i < 3; i++) {
    rewriteRuns.push(
      await time(() => rewriteRetrievalQuery(REWRITE_CONVERSATION, groq))
    );
  }
  console.log(
    `runs: ${rewriteRuns.map((r) => `${r.toFixed(0)}ms`).join(", ")}   median: ${median(rewriteRuns).toFixed(0)}ms`
  );

  console.log("\n=== Full turn estimate (rewrite + getContext) ===\n");
  const turnMs = median(rewriteRuns) + p50;
  console.log(`median rewrite (${median(rewriteRuns).toFixed(0)}ms) + retrieval p50 (${p50.toFixed(0)}ms) = ${turnMs.toFixed(0)}ms before the LLM streams a reply`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
