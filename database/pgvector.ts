import { Pool } from "pg";
import { GoogleGenerativeAIEmbeddings } from "@langchain/google-genai";
import { envNumber, envOptionalNumber, envString, assertValidIdentifier, validateEnv } from "../lib/env";
import { assembleContext, coverageFromAssembly, type CoverageInfo } from "../lib/coverage";
import type { ContextMode } from "../lib/intent";

validateEnv();

const collectionName = envString("ASTRA_DB_COLLECTION");
assertValidIdentifier("table name (ASTRA_DB_COLLECTION)", collectionName);
const defaultLimit = envNumber("RETRIEVAL_LIMIT");
const contextBudget = envOptionalNumber("CONTEXT_BUDGET_CHARS", 12000);

const pool = new Pool({ connectionString: envString("DATABASE_URL") });

const VECTOR_DIM = 3072;

const embeddings = new GoogleGenerativeAIEmbeddings({
  apiKey: envString("GOOGLE_API_KEY"),
  modelName: envString("EMBEDDING_MODEL"),
});

let initialised = false;

async function ensureTable(): Promise<void> {
  if (initialised) return;
  await pool.query(`CREATE EXTENSION IF NOT EXISTS vector;`);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS ${collectionName} (
      id        SERIAL PRIMARY KEY,
      text      TEXT NOT NULL,
      source    TEXT,
      category  TEXT,
      type      TEXT,
      title     TEXT,
      embedding vector(${VECTOR_DIM}),
      lexical   tsvector GENERATED ALWAYS AS (to_tsvector('english', text)) STORED
    );
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_${collectionName}_lexical
      ON ${collectionName} USING gin (lexical);
  `);
  // NOTE: stock pgvector ANN indexes (ivfflat, hnsw) hard-cap at 2000
  // dimensions (IVFFLAT_MAX_DIM / HNSW_MAX_DIM in pgvector source), but
  // gemini-embedding-001 emits 3072. Verified on the installed stack
  // (PostgreSQL 17.4, pgvector 0.8.6): vector(3072) stores fine, but both
  // `USING ivfflat` and `USING hnsw` fail with "column cannot have more
  // than 2000 dimensions". So retrieval uses exact sequential scan — which
  // is also faster and exact at this corpus size (EXPLAIN shows Seq Scan).
  // Revisit with halfvec + HNSW (up to 4000 dims) if the corpus ever grows
  // past a few thousand chunks; that needs a quality comparison first.
  // Migration: drop the legacy ivfflat index from earlier revisions.
  const { rows: existing } = await pool.query<{ indexdef: string }>(
    `SELECT indexdef FROM pg_indexes WHERE indexname = 'idx_${collectionName}_embedding'`,
  );
  if (existing.length > 0 && (existing[0].indexdef ?? "").includes("ivfflat")) {
    await pool.query(`DROP INDEX idx_${collectionName}_embedding;`);
  }
  initialised = true;
}

interface StoredDoc {
  text: string;
  source?: string;
}

export interface RetrievalOptions {
  category?: string;
  /** Exact source paths to include in complete mode (e.g. ["facts/skills.yml"]). */
  sources?: string[];
  limit?: number;
  search?: "hybrid" | "vector";
  /** Adaptive mode from intent classification (default "focused"). */
  mode?: ContextMode;
  budgetChars?: number;
}

export interface RetrievalResult {
  text: string;
  sources: string[];
  coverage: CoverageInfo;
  /** Time spent merging/deduping/budgeting (excludes embedding + search). */
  assemblyMs: number;
}

export async function embedText(text: string): Promise<number[]> {
  return embeddings.embedQuery(text);
}

/**
 * Deterministic category pull for complete mode: every record of the
 * category (optionally restricted to exact sources), in stable storage
 * order. No embedding, no ranking, no top-K — completeness by construction.
 */
export async function getCategoryRecords(
  category: string | null,
  sources?: string[],
  orderVector?: number[],
): Promise<StoredDoc[]> {
  await ensureTable();
  const params: unknown[] = [];
  const clauses: string[] = [];
  if (category) {
    params.push(category);
    clauses.push(`category = $${params.length}`);
  }
  if (sources && sources.length > 0) {
    params.push(sources);
    clauses.push(`source = ANY($${params.length})`);
  }
  const where = clauses.length > 0 ? `WHERE ${clauses.join(" AND ")}` : "";
  // Relevance-ranked when an embedding is available (specific follow-ups
  // float up) — still ALL records, never top-K discarded. Stable id order
  // otherwise (deterministic for eval).
  let order = `ORDER BY id ASC`;
  if (orderVector) {
    params.push(JSON.stringify(orderVector));
    order = `ORDER BY embedding <=> $${params.length}::vector`;
  }
  const { rows } = await pool.query<StoredDoc>(
    `SELECT text, source FROM ${collectionName} ${where} ${order}`,
    params,
  );
  return rows;
}

export async function getContext(
  query: string,
  options: RetrievalOptions & { vector?: number[] } = {},
): Promise<RetrievalResult> {
  const {
    category,
    sources,
    limit = defaultLimit,
    vector,
    search = "vector",
    mode = "focused",
    budgetChars = contextBudget,
  } = options;

  await ensureTable();

  const queryVector = vector ?? (await embeddings.embedQuery(query));

  // Diversity guard: a file with many chunks (photos, long projects) must
  // not crowd single-chunk files out of the top-k. We fetch 3x candidates
  // and keep at most MAX_PER_SOURCE chunks per source, preserving rank
  // order. Measured on the 23-scenario eval: mean R@8 0.804 -> 0.904 and
  // every KB-backed scenario retrieves >= 1 relevant doc (issue #10).
  const MAX_PER_SOURCE = 3;
  const fetchLimit = limit * 3;

  const applyCap = (candidates: StoredDoc[]): StoredDoc[] => {
    const perSource = new Map<string, number>();
    const picked: StoredDoc[] = [];
    for (const doc of candidates) {
      if (picked.length >= limit) break;
      const key = doc.source ?? "";
      const used = perSource.get(key) ?? 0;
      if (used >= MAX_PER_SOURCE) continue;
      perSource.set(key, used + 1);
      picked.push(doc);
    }
    return picked;
  };

  const buildQuery = (
    vectorParam: unknown,
    fetchN: number,
    categoryFilter?: string,
  ): { sql: string; params: unknown[] } => {
    const params: unknown[] = [vectorParam, fetchN];
    let where = "";
    if (categoryFilter) {
      params.push(categoryFilter);
      where = `WHERE category = $${params.length}`;
    }

    let sql: string;

    if (search === "hybrid") {
      // RRF fusion of vector + lexical rankings. Semantics of $2
      // (fetchLimit): each retriever contributes up to `fetchLimit`
      // candidates; the fused list is trimmed to `limit` in code with the
      // per-source diversity cap. FULL OUTER JOIN on id yields exactly one
      // row per document (no UNION ALL duplication, no score inflation);
      // the id tiebreak keeps ordering deterministic.
      params.push(query);
      const tsIdx = params.length;
      sql = `
      WITH vector_rank AS (
        SELECT id, (1.0 / (60 + row_number() OVER (ORDER BY embedding <=> $1::vector))) AS rrf
        FROM ${collectionName}
        ${where}
        ORDER BY embedding <=> $1::vector
        LIMIT $2
      ),
      lexical_rank AS (
        SELECT id, (1.0 / (60 + row_number() OVER (ORDER BY ts_rank_cd(lexical, plainto_tsquery('english', $${tsIdx})) DESC))) AS rrf
        FROM ${collectionName}
        ${where}
        ORDER BY ts_rank_cd(lexical, plainto_tsquery('english', $${tsIdx})) DESC
        LIMIT $2
      ),
      combined AS (
        SELECT id, COALESCE(v.rrf, 0) + COALESCE(l.rrf, 0) AS score
        FROM vector_rank v FULL OUTER JOIN lexical_rank l USING (id)
      )
      SELECT t.text, t.source
      FROM combined JOIN ${collectionName} t ON t.id = combined.id
      ORDER BY combined.score DESC, combined.id ASC
      LIMIT $2
    `;
    } else {
      sql = `
      SELECT text, source
      FROM ${collectionName}
      ${where}
      ORDER BY embedding <=> $1::vector
      LIMIT $2
    `;
    }
    return { sql, params };
  };

  const runCapped = async (
    categoryFilter?: string
  ): Promise<StoredDoc[]> => {
    const { sql, params } = buildQuery(JSON.stringify(queryVector), fetchLimit, categoryFilter);
    const { rows } = await pool.query<StoredDoc>(sql, params);
    return applyCap(rows);
  };

  if (mode === "complete" && (category || (sources && sources.length > 0))) {
    return completeContext({
      category: category ?? null,
      sources,
      budgetChars,
      orderVector: queryVector,
      runCapped,
    });
  }

  let rows = await runCapped(category);

  // Parity with the retired Astra path: a category filter that yields
  // too few docs retries unfiltered rather than starving the LLM.
  if (category && rows.length < 2) {
    rows = await runCapped(undefined);
  }

  const text = rows.map((r) => r.text).join("\n\n");
  return {
    text,
    sources: Array.from(new Set(rows.map((r) => r.source).filter(Boolean))) as string[],
    coverage: {
      mode,
      requestedCategory: category ?? null,
      retrievedChunks: rows.length,
      expectedChunks: null,
      coverage: null,
      truncated: false,
      budgetChars,
      contextChars: text.length,
    },
    assemblyMs: 0,
  };
}

/**
 * Complete mode: deterministic category records (stable storage order)
 * merged with unfiltered semantic top-K extras for surrounding context.
 * Category records are never silently discarded by top-K; the char budget
 * is the only trim, and it is reported via coverage so the model cannot
 * claim false exhaustiveness.
 */
async function completeContext(options: {
  category: string | null;
  sources?: string[];
  budgetChars: number;
  orderVector: number[];
  runCapped: (categoryFilter?: string) => Promise<StoredDoc[]>;
}): Promise<RetrievalResult> {
  const { category, sources, budgetChars, orderVector, runCapped } = options;

  const [categoryRows, semanticRows] = await Promise.all([
    getCategoryRecords(category, sources, orderVector),
    runCapped(undefined),
  ]);

  const toChunk = (r: StoredDoc) => ({ text: r.text, source: r.source ?? "" });
  const t0 = performance.now();
  const assembled = assembleContext(categoryRows.map(toChunk), semanticRows.map(toChunk), budgetChars);
  const assemblyMs = performance.now() - t0;

  return {
    text: assembled.text,
    sources: assembled.sources,
    coverage: coverageFromAssembly(
      "complete",
      category,
      categoryRows.length,
      assembled,
      budgetChars,
    ),
    assemblyMs,
  };
}
