import { Pool } from "pg";
import { GoogleGenerativeAIEmbeddings } from "@langchain/google-genai";
import type { CategoryVectors } from "../lib/query";
import { envNumber, envString, validateEnv } from "../lib/env";

validateEnv();

const collectionName = envString("ASTRA_DB_COLLECTION");
const defaultLimit = envNumber("RETRIEVAL_LIMIT");

const pool = new Pool({ connectionString: envString("DATABASE_URL") });

const VECTOR_DIM = 3072;

function parseVector(raw: unknown): number[] {
  if (Array.isArray(raw)) return raw as number[];
  if (typeof raw === "string") return raw.slice(1, -1).split(",").map(Number);
  return [];
}

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
  // ivfflat requires at least some rows to build; skip index creation on empty table
  const { rows } = await pool.query<{ cnt: string }>(
    `SELECT count(*)::text AS cnt FROM ${collectionName}`,
  );
  if (Number(rows[0].cnt) >= 100) {
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_${collectionName}_embedding
        ON ${collectionName} USING ivfflat (embedding vector_cosine_ops)
        WITH (lists = 100);
    `);
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

  const params: unknown[] = [JSON.stringify(queryVector), limit];
  let where = "";
  if (category) {
    params.push(category);
    where = `WHERE category = $${params.length}`;
  }

  let sql: string;

  if (search === "hybrid") {
    // combine cosine similarity with lexical rank (rrf — reciprocal rank fusion)
    params.push(query);
    const tsIdx = params.length;
    sql = `
      WITH vector_rank AS (
        SELECT id, text, source,
               row_number() OVER (ORDER BY embedding <=> $1::vector) AS rn
        FROM ${collectionName}
        ${where}
        ORDER BY embedding <=> $1::vector
        LIMIT $2
      ),
      lexical_rank AS (
        SELECT id, text, source,
               row_number() OVER (ORDER BY ts_rank_cd(lexical, plainto_tsquery('english', $${tsIdx})) DESC) AS rn
        FROM ${collectionName}
        ${where}
        ORDER BY ts_rank_cd(lexical, plainto_tsquery('english', $${tsIdx})) DESC
        LIMIT $2
      )
      SELECT COALESCE(v.text, l.text) AS text,
             COALESCE(v.source, l.source) AS source
      FROM (
        SELECT id, text, source, 1.0 / (60 + rn) AS rrf FROM vector_rank
        UNION ALL
        SELECT id, text, source, 1.0 / (60 + rn) AS rrf FROM lexical_rank
      ) combined
      LEFT JOIN vector_rank v ON combined.id = v.id
      LEFT JOIN lexical_rank l ON combined.id = l.id
      GROUP BY COALESCE(v.text, l.text), COALESCE(v.source, l.source)
      ORDER BY sum(combined.rrf) DESC
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

  const { rows } = await pool.query<StoredDoc>(sql, params);

  return {
    text: rows.map((r) => r.text).join("\n\n"),
    sources: Array.from(new Set(rows.map((r) => r.source).filter(Boolean))) as string[],
  };
}

let categoryVectorsPromise: Promise<CategoryVectors[]> | null = null;

export function getCategoryVectors(): Promise<CategoryVectors[]> {
  if (!categoryVectorsPromise) {
    categoryVectorsPromise = ensureTable()
      .then(() =>
        pool.query<{ category: string; embedding: unknown }>(
          `SELECT category, embedding::text AS embedding
           FROM ${collectionName}
           WHERE category IS NOT NULL`,
        ),
      )
      .then(({ rows }) => {
        const byCategory = new Map<string, number[][]>();
        for (const row of rows) {
          const vec = parseVector(row.embedding);
          if (vec.length === 0) continue;
          const vectors = byCategory.get(row.category) ?? [];
          vectors.push(vec);
          byCategory.set(row.category, vectors);
        }
        return Array.from(byCategory, ([category, vectors]) => ({
          category,
          vectors,
        }));
      })
      .catch((error) => {
        categoryVectorsPromise = null;
        throw error;
      });
  }
  return categoryVectorsPromise;
}
