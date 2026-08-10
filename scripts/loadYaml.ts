import "dotenv/config";
import fs from "fs";
import path from "path";
import yaml from "js-yaml";
import { GoogleGenerativeAIEmbeddings } from "@langchain/google-genai";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { DataAPIClient } from "@datastax/astra-db-ts";

const {
  ASTRA_DB_API_ENDPOINT,
  ASTRA_DB_APPLICATION_TOKEN,
  ASTRA_DB_COLLECTION,
  GOOGLE_API_KEY,
} = process.env;

async function main() {
  const embeddings = new GoogleGenerativeAIEmbeddings({
    apiKey: GOOGLE_API_KEY,
    modelName: "gemini-embedding-001",
  });

  const client = new DataAPIClient(ASTRA_DB_APPLICATION_TOKEN as string);
  const db = client.db(ASTRA_DB_API_ENDPOINT as string);
  const collection = db.collection(ASTRA_DB_COLLECTION || "career_vectors");

  const careerBrainDir = path.join(process.cwd(), "career_brain");
  const documents: { text: string; source: string; category: string }[] = [];

  function walk(dir: string) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
      const fullPath = path.join(dir, file);
      if (fs.statSync(fullPath).isDirectory()) {
        walk(fullPath);
      } else if (file.endsWith(".yml") || file.endsWith(".yaml")) {
        const content = yaml.load(fs.readFileSync(fullPath, "utf8"));
        const source = path.relative(careerBrainDir, fullPath);
        documents.push({
          text: JSON.stringify(content, null, 2),
          source,
          category: source.split(path.sep)[0]
        });
      }
    }
  }

  walk(careerBrainDir);
  console.log(`Found ${documents.length} YAML files.`);

  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: 1000,
    chunkOverlap: 200,
  });

  const chunks = await splitter.createDocuments(
    documents.map((d) => d.text),
    documents.map((d) => ({ source: d.source, category: d.category }))
  );
  console.log(`Split into ${chunks.length} chunks.`);

  const chunksBySource = new Map<string, typeof chunks>();
  for (const chunk of chunks) {
    const source = chunk.metadata.source;
    if (!chunksBySource.has(source)) chunksBySource.set(source, []);
    chunksBySource.get(source)!.push(chunk);
  }

  let inserted = 0;
  for (const [source, sourceChunks] of chunksBySource) {
    const deleted = await collection.deleteMany({ source });
    if (deleted.deletedCount > 0) {
      console.log(`Removed ${deleted.deletedCount} existing chunk(s) for ${source}`);
    }

    for (let i = 0; i < sourceChunks.length; i++) {
      const chunk = sourceChunks[i];
      console.log(`Ingesting: ${source} (chunk ${i + 1}/${sourceChunks.length})`);
      const vector = await embeddings.embedQuery(chunk.pageContent);
      await collection.insertOne({
        text: chunk.pageContent,
        source,
        category: chunk.metadata.category,
        $lexical: chunk.pageContent,
        $vector: vector
      });
      inserted++;
    }
  }

  console.log(`Ingestion complete! ${inserted} chunks inserted.`);
}

main().catch(console.error);
