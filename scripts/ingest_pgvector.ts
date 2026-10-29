import "dotenv/config";
import path from "path";
import { Pool } from "pg";
import { GoogleGenerativeAIEmbeddings } from "@langchain/google-genai";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { loadKnowledgeBase } from "./kb-load";
import type { EntryChunk } from "./yaml-chunks";
import { assertValidIdentifier } from "../lib/env";

const VECTOR_DIM = 3072;
const COLLECTION = process.env.ASTRA_DB_COLLECTION || "documents";
assertValidIdentifier("table name (ASTRA_DB_COLLECTION)", COLLECTION);
const STAGING = `${COLLECTION}_staging`;
const RETIRED = `${COLLECTION}_retired`;
const DRY_RUN = process.argv.includes("--dry-run");
// Entries are kept whole up to ~2000 chars (one role / project per chunk);
// gemini-embedding-001 accepts far more, and splitting a role into pieces
// let the per-source cap drop some of them.
const CHUNK_SIZE = Number(process.env.CHUNK_SIZE) || 2000;
const MIN_CHUNKS = Number(process.env.INGEST_MIN_CHUNKS) || 10;

const tableDdl = (name: string) => `
  CREATE TABLE ${name} (
    id        SERIAL PRIMARY KEY,
    text      TEXT NOT NULL,
    source    TEXT,
    category  TEXT,
    type      TEXT,
    title     TEXT,
    embedding vector(${VECTOR_DIM}),
    lexical   tsvector GENERATED ALWAYS AS (to_tsvector('english', text)) STORED
  );`;

async function splitOversized(chunks: EntryChunk[]): Promise<EntryChunk[]> {
  // Entry chunks are the norm; the character splitter is only a safety net
  // for entries larger than CHUNK_SIZE. Every piece keeps the entry label so
  // follow-up pieces stay attributable.
  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: CHUNK_SIZE,
    chunkOverlap: Number(process.env.CHUNK_OVERLAP) || 200,
  });
  const out: EntryChunk[] = [];
  for (const entry of chunks) {
    if (entry.text.length <= CHUNK_SIZE) {
      out.push(entry);
      continue;
    }
    const label = entry.text.split("\n")[0];
    for (const piece of await splitter.splitText(entry.text)) {
      out.push({ ...entry, text: piece.startsWith(label) ? piece : `${label}\n${piece}` });
    }
  }
  return out;
}

async function main() {
  // 1. Load + validate the whole knowledge base. Nothing touches the DB yet.
  const careerBrainDir = path.join(process.cwd(), "career_brain");
  const kb = loadKnowledgeBase(careerBrainDir, { minChunks: MIN_CHUNKS });
  console.log(`Found ${kb.files.length + kb.errors.length} YAML files.`);
  if (kb.errors.length > 0) {
    console.error("Refusing to ingest; the live table was NOT touched:");
    for (const e of kb.errors) console.error(`  - ${e}`);
    process.exit(1);
  }
  const chunks = await splitOversized(kb.chunks);
  console.log(`Split into ${chunks.length} entry chunks.`);
  if (DRY_RUN) {
    for (const c of chunks) console.log(`  ${c.source.padEnd(40)} ${c.text.split("\n")[0]}`);
    console.log("Dry run: no embeddings, no database writes.");
    return;
  }

  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL not set");
  if (!process.env.GOOGLE_API_KEY) throw new Error("GOOGLE_API_KEY not set");

  // 2. Embed everything up front: a quota or network failure aborts here,
  //    still before any database write.
  const embeddings = new GoogleGenerativeAIEmbeddings({
    apiKey: process.env.GOOGLE_API_KEY,
    modelName: process.env.EMBEDDING_MODEL || "gemini-embedding-001",
  });
  const vectors: number[][] = [];
  for (const chunk of chunks) {
    const vector = await embeddings.embedQuery(chunk.text);
    if (vector.length !== VECTOR_DIM) {
      throw new Error(`embedding for ${chunk.source} has ${vector.length} dims, expected ${VECTOR_DIM}`);
    }
    vectors.push(vector);
    process.stdout.write(`\rEmbedded ${vectors.length}/${chunks.length}`);
  }
  process.stdout.write("\n");

  // 3. Build a staging table, then swap it in atomically. Readers see either
  //    the old table or the complete new one, never an empty/partial table.
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();
  try {
    await client.query(`CREATE EXTENSION IF NOT EXISTS vector;`);
    await client.query(`DROP TABLE IF EXISTS ${STAGING};`);
    await client.query(tableDdl(STAGING));
    for (let i = 0; i < chunks.length; i++) {
      const c = chunks[i];
      await client.query(
        `INSERT INTO ${STAGING} (text, source, category, type, title, embedding)
         VALUES ($1, $2, $3, $4, $5, $6::vector)`,
        [c.text, c.source, c.category, c.type, c.title, JSON.stringify(vectors[i])],
      );
    }
    const { rows } = await client.query<{ n: string }>(`SELECT count(*) AS n FROM ${STAGING}`);
    if (Number(rows[0].n) !== chunks.length) {
      throw new Error(`staging has ${rows[0].n} rows, expected ${chunks.length}`);
    }

    await client.query("BEGIN");
    await client.query(`DROP TABLE IF EXISTS ${RETIRED};`);
    await client.query(`ALTER TABLE IF EXISTS ${COLLECTION} RENAME TO ${RETIRED};`);
    await client.query(`ALTER INDEX IF EXISTS idx_${COLLECTION}_lexical RENAME TO idx_${RETIRED}_lexical;`);
    await client.query(`ALTER TABLE ${STAGING} RENAME TO ${COLLECTION};`);
    await client.query(`CREATE INDEX idx_${COLLECTION}_lexical ON ${COLLECTION} USING gin (lexical);`);
    await client.query(`DROP TABLE IF EXISTS ${RETIRED};`);
    await client.query("COMMIT");
    console.log(`Swapped in ${chunks.length} chunks.`);
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    await client.query(`DROP TABLE IF EXISTS ${STAGING};`).catch(() => {});
    throw err;
  } finally {
    client.release();
    await pool.end();
  }

  // NOTE: no ANN index on purpose — stock pgvector ivfflat/hnsw cap at
  // 2000 dims, this column is vector(3072). Retrieval uses exact sequential
  // scan. Revisit with halfvec + HNSW past a few thousand chunks.
  console.log("Done.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
