import "dotenv/config";
import fs from "fs";
import path from "path";
import { buildRetrievalQuery } from "../../lib/query";
import { embedText, getContext } from "../../database/pgvector";
import { buildSystemPrompt, generateAnswer, type ChatTurn } from "../../lib/generate";
import { SCENARIOS, recallAtK, type Scenario } from "./scenarios";

const CACHE_DIR = path.join(process.cwd(), "scripts", "eval", ".cache");
const SCORES_CACHE = path.join(CACHE_DIR, "scores.json");
const ANSWERS_CACHE = path.join(CACHE_DIR, "answers.json");

interface CachedScenario {
  query: string;
  merged: boolean;
  vector: number[];
  topSources: string[];
}

// NOTE: centroid category routing was removed (issue #9). Retrieval runs
// unfiltered; this harness measures unfiltered retrieval + answers.
// Retrieval-level recall/precision metrics live in issue #10.

async function collect(scenario: Scenario): Promise<CachedScenario> {
  const prepared = buildRetrievalQuery(scenario.messages);
  const cacheKey = scenario.id;

  const cached = fs.existsSync(SCORES_CACHE)
    ? (JSON.parse(fs.readFileSync(SCORES_CACHE, "utf8")) as Record<string, CachedScenario>)
    : {};
  if (cached[cacheKey]) {
    const { query, merged, vector, topSources } = cached[cacheKey];
    return { query, merged, vector, topSources };
  }

  const vector = await embedText(prepared.query);
  const context = await getContext(prepared.query, { vector, limit: 8 });
  const entry: CachedScenario = {
    query: prepared.query,
    merged: prepared.merged,
    vector,
    topSources: context.sources,
  };
  cached[cacheKey] = entry;
  fs.mkdirSync(CACHE_DIR, { recursive: true });
  fs.writeFileSync(SCORES_CACHE, JSON.stringify(cached, null, 2));
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
  /don'?t have|knowledge base|no information|not available|unable|no data|doesn'?t (have|cover)|no such/i;

function evaluateAnswer(scenario: Scenario, answer: string): { pass: boolean; detail: string } {
  const lower = answer.toLowerCase();
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
  const rows = await loadRows();

  const answerCache = fs.existsSync(ANSWERS_CACHE)
    ? (JSON.parse(fs.readFileSync(ANSWERS_CACHE, "utf8")) as Record<string, string>)
    : {};

  const searchMode = process.env.EVAL_SEARCH === "vector" ? "vector" : "hybrid";
  const modelName = process.env.LLM_MODEL || "default";
  console.log(`Answer-phase evaluation (key-fact / decline checks via ${modelName}, search=${searchMode}, unfiltered):\n`);

  let pass = 0;
  const latencies: number[] = [];
  const fails: string[] = [];
  for (const scenario of SCENARIOS) {
    const row = rows.find((r) => r.id === scenario.id);
    if (!row) continue;
    const cacheKey = `${scenario.id}::unfiltered${searchMode === "hybrid" ? "" : `::${searchMode}`}`;

    let answer = answerCache[cacheKey];
    if (!answer) {
      const start = performance.now();
      const context = await getContext(row.query, {
        vector: row.vector,
        limit: 8,
        search: searchMode,
      });
      answer = await generateAnswer({
        systemPrompt: buildSystemPrompt(context.text),
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
  console.log(`\n- unfiltered          ${pass}/${SCENARIOS.length} (${pct}%)  avgGenMs~${p50}`);
  for (const f of fails) console.log(`    FAIL: ${f}`);
}

async function loadRows(): Promise<(CachedScenario & { id: string })[]> {
  const cached = fs.existsSync(SCORES_CACHE)
    ? (JSON.parse(fs.readFileSync(SCORES_CACHE, "utf8")) as Record<string, CachedScenario>)
    : {};
  const rows: (CachedScenario & { id: string })[] = [];
  for (const scenario of SCENARIOS) {
    const entry = cached[scenario.id];
    if (!entry) throw new Error(`Missing cached entry for ${scenario.id}; run retrieve phase first`);
    rows.push({ ...entry, id: scenario.id });
  }
  return rows;
}

async function runRetrievePhase() {
  const rows: (CachedScenario & { id: string })[] = [];
  for (const scenario of SCENARIOS) {
    const data = await collect(scenario);
    rows.push({ ...data, id: scenario.id });
  }

  console.log("Retrieval metrics (unfiltered, limit 8, file-level sources):\n");
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
