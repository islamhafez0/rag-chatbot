import "dotenv/config";
import fs from "fs";
import path from "path";
import yaml from "js-yaml";
import { Pool } from "pg";
import { GoogleGenerativeAIEmbeddings } from "@langchain/google-genai";
import { chunkYamlDoc } from "./yaml-chunks";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";

const VECTOR_DIM = 3072;
const COLLECTION = process.env.ASTRA_DB_COLLECTION || "documents";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function main() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL not set");
  if (!process.env.GOOGLE_API_KEY) throw new Error("GOOGLE_API_KEY not set");

  const embeddings = new GoogleGenerativeAIEmbeddings({
    apiKey: process.env.GOOGLE_API_KEY,
    modelName: process.env.EMBEDDING_MODEL || "gemini-embedding-001",
  });

  // recreate table with full schema
  await pool.query(`CREATE EXTENSION IF NOT EXISTS vector;`);
  await pool.query(`DROP TABLE IF EXISTS ${COLLECTION};`);
  await pool.query(`
    CREATE TABLE ${COLLECTION} (
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
    CREATE INDEX idx_${COLLECTION}_lexical
      ON ${COLLECTION} USING gin (lexical);
  `);

  // read career_brain YAML files
  const careerBrainDir = path.join(process.cwd(), "career_brain");
  const docs: { raw: string; source: string; category: string; type: string; title: string }[] = [];

  function walk(dir: string) {
    for (const file of fs.readdirSync(dir)) {
      const full = path.join(dir, file);
      if (fs.statSync(full).isDirectory()) {
        walk(full);
      } else if (file.endsWith(".yml") || file.endsWith(".yaml")) {
        // POSIX separators: source paths must compare equal across OSes
        // (eval expected-sets, category derivation, UI display).
        const source = path.relative(careerBrainDir, full).split(path.sep).join("/");
        docs.push({
          raw: fs.readFileSync(full, "utf8"),
          source,
          category: source.split("/")[0],
          type: path.extname(file) === ".yaml" ? "yaml" : "text",
          title: path.basename(file, path.extname(file)),
        });
      }
    }
  }
  walk(careerBrainDir);
  console.log(`Found ${docs.length} YAML files.`);

  // chunk by logical YAML entry (one role / project / photo / answer per
  // chunk, field labels preserved). The character splitter below is only a
  // safety net for entries larger than CHUNK_SIZE.
  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: Number(process.env.CHUNK_SIZE) || 1000,
    chunkOverlap: Number(process.env.CHUNK_OVERLAP) || 200,
  });

  const chunks: { text: string; source: string; category: string; type: string; title: string }[] = [];
  for (const doc of docs) {
    const content = yaml.load(doc.raw);
    for (const entry of chunkYamlDoc(content, doc)) {
      if (entry.text.length <= (Number(process.env.CHUNK_SIZE) || 1000)) {
        chunks.push(entry);
      } else {
        // Oversized entry: split, keeping the entry label on every piece
        // so follow-up pieces stay attributable.
        const label = entry.text.split("\n")[0];
        const pieces = await splitter.splitText(entry.text);
        for (const piece of pieces) {
          chunks.push({ ...entry, text: piece.startsWith(label) ? piece : `${label}\n${piece}` });
        }
      }
    }
  }
  console.log(`Split into ${chunks.length} entry chunks.`);

  // embed & insert
  let inserted = 0;
  for (const chunk of chunks) {
    const vector = await embeddings.embedQuery(chunk.text);
    await pool.query(
      `INSERT INTO ${COLLECTION} (text, source, category, type, title, embedding)
       VALUES ($1, $2, $3, $4, $5, $6::vector)`,
      [chunk.text, chunk.source, chunk.category, chunk.type, chunk.title, JSON.stringify(vector)],
    );
    inserted++;
    process.stdout.write(`\rIngested ${inserted}/${chunks.length}`);
  }

  // NOTE: no ANN index on purpose — stock pgvector ivfflat/hnsw cap at
  // 2000 dims, this column is vector(3072). DROP TABLE above already
  // removed any legacy index; retrieval uses exact sequential scan.
  // Revisit with halfvec + HNSW past a few thousand chunks.

  console.log("Done.");
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
