import { Pool } from "pg";
import { GoogleGenerativeAIEmbeddings } from "@langchain/google-genai";
import { envNumber, envString, validateEnv } from "../lib/env";

validateEnv();

const collectionName = envString("ASTRA_DB_COLLECTION");
const defaultLimit = envNumber("RETRIEVAL_LIMIT");

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
  limit?: number;
  search?: "hybrid" | "vector";
}

export interface RetrievalResult {
  text: string;
  sources: string[];
}

export async function embedText(text: string): Promise<number[]> {
  return embeddings.embedQuery(text);
}

export async function getContext(
  query: string,
  options: RetrievalOptions & { vector?: number[] } = {},
): Promise<RetrievalResult> {
  const { category, limit = defaultLimit, vector, search = "vector" } = options;

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

  const buildQuery = (categoryFilter?: string): { sql: string; params: unknown[] } => {
    const params: unknown[] = [JSON.stringify(queryVector), fetchLimit];
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
    const { sql, params } = buildQuery(categoryFilter);
    const { rows } = await pool.query<StoredDoc>(sql, params);
    return applyCap(rows);
  };

  let rows = await runCapped(category);

  // Parity with the retired Astra path: a category filter that yields
  // too few docs retries unfiltered rather than starving the LLM.
  if (category && rows.length < 2) {
    rows = await runCapped(undefined);
  }

  return {
    text: rows.map((r) => r.text).join("\n\n"),
    sources: Array.from(new Set(rows.map((r) => r.source).filter(Boolean))) as string[],
  };
}
