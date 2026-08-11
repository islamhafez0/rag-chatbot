import "dotenv/config";
import { embedText, getContext } from "../lib/astra";
import { buildRetrievalQuery } from "../lib/query";
import { buildSystemPrompt, createAnswerStream, type ChatTurn } from "../lib/generate";

const QUERIES = [
  "What projects has Islam built?",
  "Tell me about the RAG Career Chatbot",
  "What skills does Islam have?",
  "Which companies has Islam worked at?",
];

const FOLLOW_UP_CONVERSATION: ChatTurn[] = [
  { role: "user", content: "Tell me about the RAG Career Chatbot project" },
  {
    role: "assistant",
    content: "It is a RAG-powered career chatbot built with Next.js and LangChain.",
  },
  { role: "user", content: "tell me more about the tech stack" },
];

function median(nums: number[]): number {
  const sorted = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

async function time(fn: () => Promise<unknown>): Promise<number> {
  const start = performance.now();
  await fn();
  return performance.now() - start;
}

interface Row {
  label: string;
  prepMs: number;
  embedMs: number;
  searchMs: number;
  ttftMs: number;
  llmMs: number;
}

async function drainStream(stream: ReadableStream<Uint8Array>): Promise<void> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    decoder.decode(value, { stream: true });
  }
}

async function measure(label: string, turns: ChatTurn[]): Promise<Row> {
  const t0 = performance.now();
  const prepared = buildRetrievalQuery(turns);
  const prepMs = performance.now() - t0;
  const query = prepared.query;

  const t1 = performance.now();
  const vector = await embedText(query);
  const embedMs = performance.now() - t1;

  const t2 = performance.now();
  const context = await getContext(query, { vector });
  const searchMs = performance.now() - t2;

  let ttftMs = 0;
  const t3 = performance.now();
  const stream = await createAnswerStream({
    systemPrompt: buildSystemPrompt(context.text),
    turns,
    onFirstToken: (ms) => {
      ttftMs = ms;
    },
  });
  await drainStream(stream);
  const llmMs = performance.now() - t3;

  return { label, prepMs, embedMs, searchMs, ttftMs, llmMs };
}

async function main() {
  console.log("Warming up pipeline (embed + retrieval)...");
  const warm = await embedText(QUERIES[0]);
  await getContext(QUERIES[0], { vector: warm });
  console.log("Warmup complete.\n");

  const rows: Row[] = [];
  for (const query of QUERIES) {
    rows.push(await measure(`"${query}"`, [{ role: "user", content: query }]));
    console.log(`  measured: ${rows[rows.length - 1].label}`);
  }
  rows.push(await measure('follow-up: "tell me more about the tech stack"', FOLLOW_UP_CONVERSATION));
  console.log(`  measured: ${rows[rows.length - 1].label}`);

  console.log("\n=== Latency breakdown per turn ===\n");
  for (const r of rows) {
    const total = r.prepMs + r.embedMs + r.searchMs + r.llmMs;
    console.log(r.label);
    console.log(`  query:             ${r.prepMs.toFixed(0).padStart(5)}ms`);
    console.log(`  embedding:         ${r.embedMs.toFixed(0).padStart(5)}ms`);
    console.log(`  vector search:     ${r.searchMs.toFixed(0).padStart(5)}ms`);
    console.log(`  LLM first token:   ${r.ttftMs.toFixed(0).padStart(5)}ms`);
    console.log(`  LLM generation:    ${(r.llmMs - r.ttftMs).toFixed(0).padStart(5)}ms`);
    console.log(`  LLM total:         ${r.llmMs.toFixed(0).padStart(5)}ms`);
    console.log(`  ${"-".repeat(20)}`);
    console.log(`  TOTAL:             ${total.toFixed(0).padStart(5)}ms`);
    console.log("");
  }

  const stages: [string, (r: Row) => number][] = [
    ["query", (r) => r.prepMs],
    ["embedding", (r) => r.embedMs],
    ["vector search", (r) => r.searchMs],
    ["LLM first token", (r) => r.ttftMs],
    ["LLM total", (r) => r.llmMs],
  ];

  console.log("=== Stage medians across all turns ===\n");
  for (const [name, get] of stages) {
    console.log(`  ${name.padEnd(14)} ${median(rows.map(get)).toFixed(0).padStart(5)}ms`);
  }
  const medTotal = median(rows.map((r) => r.prepMs + r.embedMs + r.searchMs + r.llmMs));
  console.log(`  ${"-".repeat(20)}`);
  console.log(`  ${"TOTAL".padEnd(14)} ${medTotal.toFixed(0).padStart(5)}ms`);
  console.log("");

  console.log("=== Search strategy latency (vector-only vs hybrid+rerank) ===\n");
  const searchRows: { query: string; vectorMs: number[]; hybridMs: number[] }[] = [];
  for (const query of QUERIES) {
    const vectorMs: number[] = [];
    const hybridMs: number[] = [];
    const vector = await embedText(query);
    for (let i = 0; i < 3; i++) {
      vectorMs.push(await time(() => getContext(query, { vector, search: "vector" })));
      hybridMs.push(await time(() => getContext(query, { vector, search: "hybrid" })));
    }
    searchRows.push({ query, vectorMs, hybridMs });
    console.log(`  "${query}"`);
    console.log(
      `    vector-only:  ${vectorMs.map((m) => `${m.toFixed(0)}ms`).join(", ")}   median: ${median(vectorMs).toFixed(0)}ms`
    );
    console.log(
      `    hybrid+rerank: ${hybridMs.map((m) => `${m.toFixed(0)}ms`).join(", ")}   median: ${median(hybridMs).toFixed(0)}ms`
    );
  }
  const allVector = searchRows.flatMap((r) => r.vectorMs);
  const allHybrid = searchRows.flatMap((r) => r.hybridMs);
  console.log(
    `\n  vector-only p50: ${median(allVector).toFixed(0)}ms    hybrid+rerank p50: ${median(allHybrid).toFixed(0)}ms`
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
