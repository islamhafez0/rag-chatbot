import "dotenv/config";
import fs from "fs";
import path from "path";
import yaml from "js-yaml";
import { Pool } from "pg";
import { GoogleGenerativeAIEmbeddings } from "@langchain/google-genai";
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
  const docs: { text: string; source: string; category: string; type: string; title: string }[] = [];

  function walk(dir: string) {
    for (const file of fs.readdirSync(dir)) {
      const full = path.join(dir, file);
      if (fs.statSync(full).isDirectory()) {
        walk(full);
      } else if (file.endsWith(".yml") || file.endsWith(".yaml")) {
        const content = yaml.load(fs.readFileSync(full, "utf8"));
        const source = path.relative(careerBrainDir, full);
        docs.push({
          text: JSON.stringify(content, null, 2),
          source,
          category: source.split(path.sep)[0],
          type: path.extname(file) === ".yaml" ? "yaml" : "text",
          title: path.basename(file, path.extname(file)),
        });
      }
    }
  }
  walk(careerBrainDir);
  console.log(`Found ${docs.length} YAML files.`);

  // chunk
  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: Number(process.env.CHUNK_SIZE) || 1000,
    chunkOverlap: Number(process.env.CHUNK_OVERLAP) || 200,
  });

  const chunks = await splitter.createDocuments(
    docs.map((d) => d.text),
    docs.map((d) => ({ source: d.source, category: d.category, type: d.type, title: d.title })),
  );
  console.log(`Split into ${chunks.length} chunks.`);

  // embed & insert
  let inserted = 0;
  for (const chunk of chunks) {
    const vector = await embeddings.embedQuery(chunk.pageContent);
    await pool.query(
      `INSERT INTO ${COLLECTION} (text, source, category, type, title, embedding)
       VALUES ($1, $2, $3, $4, $5, $6::vector)`,
      [chunk.pageContent, chunk.metadata.source, chunk.metadata.category, chunk.metadata.type, chunk.metadata.title, JSON.stringify(vector)],
    );
    inserted++;
    process.stdout.write(`\rIngested ${inserted}/${chunks.length}`);
  }

  // build index after data is loaded
  console.log("\nBuilding ivfflat index...");
  try {
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_${COLLECTION}_embedding
        ON ${COLLECTION} USING ivfflat (embedding vector_cosine_ops)
        WITH (lists = 100);
    `);
  } catch {
    console.log("Index build skipped (need ≥100 rows for ivfflat). Using sequential scan.");
  }

  console.log("Done.");
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
