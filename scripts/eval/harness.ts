import "dotenv/config";
import fs from "fs";
import path from "path";
import { buildRetrievalQuery } from "../../lib/query";
import { embedText } from "../../database/pgvector";
import { runPipeline } from "../../lib/pipeline";
import { buildCoverageNote, approxTokens } from "../../lib/coverage";
import { buildSystemPrompt, generateAnswer, type ChatTurn } from "../../lib/generate";
import { SCENARIOS, recallAtK, type Scenario } from "./scenarios";

const CACHE_DIR = path.join(process.cwd(), "scripts", "eval", ".cache");
const SCORES_CACHE = path.join(CACHE_DIR, "scores.json");
const ANSWERS_CACHE = path.join(CACHE_DIR, "answers.json");

/** Bumped when retrieval/generation behavior changes; stale entries recompute. */
const CACHE_VERSION = "v3-ranked";
/** Bumped when the system prompt changes; answers (not retrieval) recompute. */
const PROMPT_VERSION = "p2-numeric";

interface CachedScenario {
  cacheVersion: string;
  query: string;
  merged: boolean;
  mode: string;
  category: string | null;
  vector: number[];
  topSources: string[];
  coverage: string;
  truncated: boolean;
  contextChars: number;
}

// Retrieval runs through the production pipeline (intent → adaptive mode),
// so the eval measures the shipped system, not a lab-only configuration.

async function collect(scenario: Scenario, search: "hybrid" | "vector"): Promise<CachedScenario> {
  const prepared = buildRetrievalQuery(scenario.messages);
  const cacheKey = `${scenario.id}::${CACHE_VERSION}::${search}`;

  const cached = fs.existsSync(SCORES_CACHE)
    ? (JSON.parse(fs.readFileSync(SCORES_CACHE, "utf8")) as Record<string, CachedScenario>)
    : {};
  if (cached[cacheKey]?.cacheVersion === CACHE_VERSION) {
    return cached[cacheKey];
  }

  const vector =
    // Same query string → same embedding input: reuse the legacy cached
    // vector when present so reruns don't burn embedding quota re-encoding
    // identical queries. Fresh queries still embed (cache miss path).
    cached[scenario.id]?.vector ?? (await embedText(prepared.query));
  const pipeline = await runPipeline(scenario.messages, { vector, search });
  const cov = pipeline.context.coverage;
  const entry: CachedScenario = {
    cacheVersion: CACHE_VERSION,
    query: pipeline.query,
    merged: pipeline.merged,
    mode: pipeline.intent.mode,
    category: pipeline.category,
    vector,
    topSources: pipeline.context.sources,
    coverage:
      cov.coverage !== null ? `${cov.retrievedChunks}/${cov.expectedChunks}` : "n/a",
    truncated: cov.truncated,
    contextChars: pipeline.context.text.length,
  };
  cached[cacheKey] = entry;
  fs.mkdirSync(CACHE_DIR, { recursive: true });
  fs.writeFileSync(SCORES_CACHE, JSON.stringify(cached, null, 2));
  console.log(`  collected ${scenario.id} (mode=${entry.mode} cov=${entry.coverage})`);
  return entry;
}

async function main() {
  const mode = process.argv[2] ?? "retrieve";
  if (mode === "answer") {
    await runAnswerPhase();
    return;
  }
  await runRetrievePhase();
}

const DECLINE_RE =
  /don'?t have|knowledge base|no information|not available|unable|can'?t (share|reveal|disclose|provide|comply|help)|won'?t (share|reveal|disclose)|cann?ot (share|reveal|comply|help)|not (able|allowed) to share|against my instructions|i must decline|no data|doesn'?t (have|cover)|no such/i;

/** Normalize model orthography (curly quotes, narrow spaces, unicode dashes)
 *  before fact/decline matching so typography never fails a correct answer. */
function norm(s: string): string {
  return s
    .toLowerCase()
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u202F\u00A0]/g, " ")
    .replace(/[\u2010-\u2015\u2212]/g, "-")
}

function evaluateAnswer(scenario: Scenario, answer: string): { pass: boolean; detail: string } {
  const lower = norm(answer);
  const leaked = (scenario.mustNotContain ?? []).filter((s) =>
    lower.includes(s.toLowerCase())
  );
  if (leaked.length > 0) {
    return { pass: false, detail: `leaked content: ${leaked.join(", ")}` };
  }
  if (scenario.conversational) {
    if (answer.trim().length > 10 && !DECLINE_RE.test(lower)) {
      const missing = (scenario.keyFacts ?? []).filter(
        (fact) => !lower.includes(fact.toLowerCase())
      );
      if (missing.length > 0) {
        return { pass: false, detail: `missing: ${missing.join(", ")}` };
      }
      return { pass: true, detail: "conversational reply" };
    }
    return { pass: false, detail: `poor conversational reply; starts: ${answer.slice(0, 80)}` };
  }
  if (scenario.emptyKnowledge) {
    const declined = DECLINE_RE.test(lower);
    const hallucinated = scenario.keyFacts?.some((fact) => lower.includes(fact.toLowerCase())) ?? false;
    if (declined && !hallucinated) return { pass: true, detail: "declined" };
    return {
      pass: false,
      detail: hallucinated
        ? "declined but still stated known facts"
        : `did not decline; starts: ${answer.slice(0, 80)}`,
    };
  }
  const missing = (scenario.keyFacts ?? []).filter(
    (fact) => !lower.includes(fact.toLowerCase())
  );
  return missing.length === 0
    ? { pass: true, detail: `ok (${(scenario.keyFacts ?? []).length} facts)` }
    : { pass: false, detail: `missing: ${missing.join(", ")}` };
}

async function runAnswerPhase() {
  const searchMode = process.env.EVAL_SEARCH === "vector" ? "vector" : "hybrid";
  const modelName = process.env.LLM_MODEL || "default";
  console.log(`Answer-phase evaluation (key-fact / decline checks via ${modelName}, search=${searchMode}, pipeline modes):\n`);
  const rows = await loadRows(searchMode);

  const answerCache = fs.existsSync(ANSWERS_CACHE)
    ? (JSON.parse(fs.readFileSync(ANSWERS_CACHE, "utf8")) as Record<string, string>)
    : {};

  let pass = 0;
  const latencies: number[] = [];
  const promptTokens: number[] = [];
  const fails: string[] = [];
  for (const scenario of SCENARIOS) {
    const row = rows.find((r) => r.id === scenario.id);
    if (!row) continue;
    const cacheKey = `${scenario.id}::${CACHE_VERSION}::${PROMPT_VERSION}::answer::${searchMode}`;

    let answer = answerCache[cacheKey];
    if (!answer) {
      const start = performance.now();
      const pipeline = await runPipeline(scenario.messages, {
        vector: row.vector,
        search: searchMode,
      });
      const systemPrompt = buildSystemPrompt(pipeline.context.text, {
        coverageNote: buildCoverageNote(pipeline.context.coverage),
      });
      promptTokens.push(approxTokens(systemPrompt.length));
      answer = await generateAnswer({
        systemPrompt,
        turns: scenario.messages as ChatTurn[],
      });
      latencies.push(performance.now() - start);
      answerCache[cacheKey] = answer;
      fs.mkdirSync(CACHE_DIR, { recursive: true });
      fs.writeFileSync(ANSWERS_CACHE, JSON.stringify(answerCache, null, 2));
      console.log(`  ${scenario.id} done`);
    }

    const result = evaluateAnswer(scenario, answer);
    if (result.pass) {
      pass++;
    } else {
      fails.push(`${scenario.id} ${result.detail}`);
    }
  }

  const pct = ((pass / SCENARIOS.length) * 100).toFixed(1);
  const p50 = latencies.length
    ? Math.round([...latencies].sort((a, b) => a - b)[Math.floor(latencies.length / 2)])
    : 0;
  const tokP50 = promptTokens.length
    ? Math.round(
        [...promptTokens].sort((a, b) => a - b)[Math.floor(promptTokens.length / 2)]
      )
    : 0;
  console.log(`\n- pipeline-modes       ${pass}/${SCENARIOS.length} (${pct}%)  avgGenMs~${p50}  promptTokensP50~${tokP50}`);
  for (const f of fails) console.log(`    FAIL: ${f}`);
}

async function loadRows(search: "hybrid" | "vector"): Promise<(CachedScenario & { id: string })[]> {
  const cached = fs.existsSync(SCORES_CACHE)
    ? (JSON.parse(fs.readFileSync(SCORES_CACHE, "utf8")) as Record<string, CachedScenario>)
    : {};
  const rows: (CachedScenario & { id: string })[] = [];
  for (const scenario of SCENARIOS) {
    const entry = cached[`${scenario.id}::${CACHE_VERSION}::${search}`];
    if (!entry) throw new Error(`Missing cached entry for ${scenario.id}; run retrieve phase first`);
    rows.push({ ...entry, id: scenario.id });
  }
  return rows;
}

async function runRetrievePhase() {
  const searchMode = process.env.EVAL_SEARCH === "vector" ? "vector" : "hybrid";
  const rows: (CachedScenario & { id: string })[] = [];
  for (const scenario of SCENARIOS) {
    const data = await collect(scenario, searchMode);
    rows.push({ ...data, id: scenario.id });
  }

  console.log(`Retrieval metrics (pipeline modes, search=${searchMode}, file-level sources):\n`);
  let sumR1 = 0;
  let sumR3 = 0;
  let sumR8 = 0;
  let counted = 0;
  let gateFailed = false;
  for (const scenario of SCENARIOS) {
    const row = rows.find((r) => r.id === scenario.id);
    if (!row) continue;
    if (scenario.expectedSources.length === 0) {
      console.log(
        `- ${scenario.id.padEnd(24)} expected=(absent KB) retrieved=${row.topSources.length} docs (decline checked in answer phase)`
      );
      continue;
    }
    const r1 = recallAtK(scenario.expectedSources, row.topSources, 1);
    const r3 = recallAtK(scenario.expectedSources, row.topSources, 3);
    const r8 = recallAtK(scenario.expectedSources, row.topSources, 8);
    sumR1 += r1;
    sumR3 += r3;
    sumR8 += r8;
    counted++;
    const missing = scenario.expectedSources.filter((s) => !row.topSources.includes(s));
    const hit = missing.length < scenario.expectedSources.length;
    if (!hit) gateFailed = true;
    console.log(
      `- ${scenario.id.padEnd(24)} R@1=${r1.toFixed(2)} R@3=${r3.toFixed(2)} R@8=${r8.toFixed(2)}` +
        ` mode=${row.mode} cov=${row.coverage}${row.truncated ? " TRUNC" : ""} ctx=${row.contextChars}` +
        (missing.length ? `  MISSING: ${missing.join(", ")}` : "  ok")
    );
  }

  if (counted > 0) {
    console.log(
      `\nMean over ${counted} KB-backed scenarios: R@1=${(sumR1 / counted).toFixed(3)}` +
        ` R@3=${(sumR3 / counted).toFixed(3)} R@8=${(sumR8 / counted).toFixed(3)}`
    );
  }
  if (gateFailed) {
    console.error("\nGATE FAILED: at least one scenario retrieved zero relevant docs in top-8.");
    process.exit(1);
  }
  console.log("\nGate passed: every KB-backed scenario retrieved at least one relevant doc.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
