import "dotenv/config";
import fs from "fs";
import path from "path";
import { buildRetrievalQuery } from "../../lib/query";
import { embedText, getContext, getCategoryVectors } from "../../lib/astra";
import { buildSystemPrompt, generateAnswer, type ChatTurn } from "../../lib/generate";
import { SCENARIOS, type Scenario } from "./scenarios";

const CACHE_DIR = path.join(process.cwd(), "scripts", "eval", ".cache");
const SCORES_CACHE = path.join(CACHE_DIR, "scores.json");
const ANSWERS_CACHE = path.join(CACHE_DIR, "answers.json");

interface CachedScenario {
  query: string;
  merged: boolean;
  vector: number[];
  topSources: string[];
}

type Scores = Record<string, number>;

function categoryOfSource(source: string): string {
  return source.split(/[\\/]/)[0];
}

function meanCosine(queryVector: number[], vectors: number[][]): number {
  let sum = 0;
  for (const v of vectors) {
    let dot = 0;
    let na = 0;
    let nb = 0;
    for (let i = 0; i < queryVector.length; i++) {
      dot += queryVector[i] * v[i];
      na += queryVector[i] * queryVector[i];
      nb += v[i] * v[i];
    }
    if (na === 0 || nb === 0) continue;
    sum += dot / (Math.sqrt(na) * Math.sqrt(nb));
  }
  return vectors.length ? sum / vectors.length : 0;
}

async function collect(scenario: Scenario): Promise<CachedScenario & { scores: Scores }> {
  const prepared = buildRetrievalQuery(scenario.messages);
  const cacheKey = scenario.id;

  const cached = fs.existsSync(SCORES_CACHE)
    ? (JSON.parse(fs.readFileSync(SCORES_CACHE, "utf8")) as Record<string, CachedScenario>)
    : {};
  if (cached[cacheKey]) {
    const { query, merged, vector, topSources } = cached[cacheKey];
    return { query, merged, vector, topSources, scores: await computeScores(vector) };
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
  return { ...entry, scores: await computeScores(vector) };
}

let catsPromise: Promise<{ category: string; vectors: number[][] }[]> | null = null;
function getCats() {
  if (!catsPromise) catsPromise = getCategoryVectors();
  return catsPromise;
}

async function computeScores(vector: number[]): Promise<Scores> {
  const cats = await getCats();
  const scores: Scores = {};
  for (const c of cats) scores[c.category] = meanCosine(vector, c.vectors);
  return scores;
}

function applyPolicy(scores: Scores, policy: Policy): string | null {
  const entries = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  if (entries.length === 0) return null;
  const [bestCat, bestScore] = entries[0];
  const runnerUp = entries[1]?.[1] ?? 0;

  if (policy.kind === "none") return null;
  if (policy.kind === "best") return bestCat;
  if (policy.kind === "vector") {
    if (bestScore < policy.threshold) return null;
    const margin =
      policy.marginKind === "absolute" ? policy.margin : bestScore * policy.margin;
    if (bestScore - runnerUp < margin) return null;
    return bestCat;
  }
  if (policy.kind === "topSource") {
    return policy.sourceCategories.length ? categoryOfSource(policy.sourceCategories[0]) : null;
  }
  if (policy.kind === "dominance") {
    const counts = new Map<string, number>();
    for (const src of policy.sourceCategories) {
      const cat = categoryOfSource(src);
      counts.set(cat, (counts.get(cat) ?? 0) + 1);
    }
    let best: string | null = null;
    let bestCount = 0;
    for (const [cat, count] of counts) {
      if (count > bestCount) {
        best = cat;
        bestCount = count;
      }
    }
    const total = policy.sourceCategories.length;
    return best && total > 0 && bestCount / total >= policy.minShare ? best : null;
  }
  return null;
}

type Policy =
  | { kind: "none" }
  | { kind: "best" }
  | { kind: "vector"; threshold: number; margin: number; marginKind: "absolute" | "relative" }
  | { kind: "topSource"; sourceCategories: string[] }
  | { kind: "dominance"; sourceCategories: string[]; minShare: number };

const POLICIES: { name: string; make: (sc: CachedScenario) => Policy }[] = [
  { name: "none", make: () => ({ kind: "none" }) },
  { name: "best", make: () => ({ kind: "best" }) },
  { name: "vector abs0.002", make: () => ({ kind: "vector", threshold: 0.35, margin: 0.002, marginKind: "absolute" }) },
  { name: "vector abs0.005", make: () => ({ kind: "vector", threshold: 0.35, margin: 0.005, marginKind: "absolute" }) },
  { name: "vector abs0.01", make: () => ({ kind: "vector", threshold: 0.35, margin: 0.01, marginKind: "absolute" }) },
  { name: "vector abs0.02", make: () => ({ kind: "vector", threshold: 0.35, margin: 0.02, marginKind: "absolute" }) },
  { name: "vector rel0.99", make: () => ({ kind: "vector", threshold: 0.35, margin: 0.01, marginKind: "relative" }) },
  { name: "vector rel0.97", make: () => ({ kind: "vector", threshold: 0.35, margin: 0.03, marginKind: "relative" }) },
  { name: "vector rel0.95", make: () => ({ kind: "vector", threshold: 0.35, margin: 0.05, marginKind: "relative" }) },
  { name: "topSource", make: (sc) => ({ kind: "topSource", sourceCategories: sc.topSources }) },
  { name: "dominance>=50%", make: (sc) => ({ kind: "dominance", sourceCategories: sc.topSources, minShare: 0.5 }) },
  { name: "dominance>=60%", make: (sc) => ({ kind: "dominance", sourceCategories: sc.topSources, minShare: 0.6 }) },
];

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
  const answerPolicies = [
    { name: "none", policy: () => ({ kind: "none" }) as Policy },
    { name: "vector abs0.005", policy: () =>
      ({ kind: "vector", threshold: 0.35, margin: 0.005, marginKind: "absolute" }) as Policy },
  ];

  const answerCache = fs.existsSync(ANSWERS_CACHE)
    ? (JSON.parse(fs.readFileSync(ANSWERS_CACHE, "utf8")) as Record<string, string>)
    : {};

  const searchMode = process.env.EVAL_SEARCH === "vector" ? "vector" : "hybrid";
  const modelName = process.env.LLM_MODEL || "default";
  console.log(`Answer-phase evaluation (key-fact / decline checks via ${modelName}, search=${searchMode}):\n`);
  const summary: { name: string; pass: number; total: number; latencies: number[]; fails: string[] }[] = [];

  for (const ap of answerPolicies) {
    let pass = 0;
    const latencies: number[] = [];
    const fails: string[] = [];
    for (const scenario of SCENARIOS) {
      const row = rows.find((r) => r.id === scenario.id);
      if (!row) continue;
      const category = applyPolicy(row.scores, ap.policy());
      const cacheKey = `${scenario.id}::${ap.name}${searchMode === "hybrid" ? "" : `::${searchMode}`}`;

      let answer = answerCache[cacheKey];
      if (!answer) {
        const start = performance.now();
        const context = await getContext(row.query, {
          vector: row.vector,
          category: category ?? undefined,
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
        console.log(`  [${ap.name}] ${scenario.id} done`);
      }

      const result = evaluateAnswer(scenario, answer);
      if (result.pass) {
        pass++;
      } else {
        fails.push(`${scenario.id}(${category ?? "null"}) ${result.detail}`);
      }
    }
    summary.push({ name: ap.name, pass, total: SCENARIOS.length, latencies, fails });
  }

  summary.sort((a, b) => b.pass - a.pass);
  for (const s of summary) {
    const pct = ((s.pass / s.total) * 100).toFixed(1);
    const p50 = s.latencies.length
      ? Math.round([...s.latencies].sort((a, b) => a - b)[Math.floor(s.latencies.length / 2)])
      : 0;
    console.log(`- ${s.name.padEnd(20)} ${s.pass}/${s.total} (${pct}%)  avgGenMs~${p50}`);
    for (const f of s.fails) console.log(`    FAIL: ${f}`);
  }
}

async function loadRows(): Promise<(CachedScenario & { scores: Scores; id: string; expected: string | null })[]> {
  const cats = await getCats();
  const cached = fs.existsSync(SCORES_CACHE)
    ? (JSON.parse(fs.readFileSync(SCORES_CACHE, "utf8")) as Record<string, CachedScenario>)
    : {};
  const rows: (CachedScenario & { scores: Scores; id: string; expected: string | null })[] = [];
  for (const scenario of SCENARIOS) {
    const entry = cached[scenario.id];
    if (!entry) throw new Error(`Missing cached scores for ${scenario.id}; run retrieve phase first`);
    const scores: Scores = {};
    for (const c of cats) scores[c.category] = meanCosine(entry.vector, c.vectors);
    rows.push({ ...entry, scores, id: scenario.id, expected: scenario.expectedCategory });
  }
  return rows;
}

async function runRetrievePhase() {
  const cats = await getCats();
  console.log(`Categories in store: ${cats.map((c) => `${c.category}(${c.vectors.length})`).join(", ")}\n`);

  const rows: (CachedScenario & { scores: Scores; id: string; expected: string | null })[] = [];
  for (const scenario of SCENARIOS) {
    const data = await collect(scenario);
    rows.push({ ...data, id: scenario.id, expected: scenario.expectedCategory });
  }

  console.log("Per-scenario top-3 category scores + top source:\n");
  for (const row of rows) {
    const top = Object.entries(row.scores)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([c, s]) => `${c}=${s.toFixed(3)}`)
      .join("  ");
    const topSourceCat = row.topSources.length ? categoryOfSource(row.topSources[0]) : "(none)";
    console.log(
      `${row.id.padEnd(24)} exp=${(row.expected ?? "null").padEnd(9)} topSrcCat=${topSourceCat.padEnd(9)} merged=${row.merged}  ${top}`
    );
  }

  console.log("\nTop sources per scenario (unfiltered retrieval, limit 8):\n");
  for (const row of rows) {
    console.log(`- ${row.id}: ${row.topSources.join(", ")}`);
  }

  console.log("\nRouting policy evaluation (route === expected category):\n");
  const results: { name: string; correct: number; total: number; misses: string[] }[] = [];

  for (const policyDef of POLICIES) {
    let correct = 0;
    const misses: string[] = [];
    for (const row of rows) {
      const routed = applyPolicy(row.scores, policyDef.make(row));
      if (routed === row.expected) {
        correct++;
      } else {
        misses.push(`${row.id}(${routed ?? "null"}!=${row.expected ?? "null"})`);
      }
    }
    results.push({ name: policyDef.name, correct, total: rows.length, misses });
  }

  results.sort((a, b) => b.correct - a.correct);
  for (const r of results) {
    const pct = ((r.correct / r.total) * 100).toFixed(1);
    console.log(`- ${r.name.padEnd(20)} ${r.correct}/${r.total} (${pct}%)`);
    if (r.correct !== r.total) console.log(`    misses: ${r.misses.join(", ")}`);
  }

  const bestPolicy = results[0];
  console.log(`\nBest policy: ${bestPolicy.name} (${bestPolicy.correct}/${bestPolicy.total})`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
