import "dotenv/config";
import fs from "fs";
import path from "path";
import yaml from "js-yaml";
import { GoogleGenerativeAIEmbeddings } from "@langchain/google-genai";
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
  const documents: { text: string; source: string }[] = [];

  function walk(dir: string) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
      const fullPath = path.join(dir, file);
      if (fs.statSync(fullPath).isDirectory()) {
        walk(fullPath);
      } else if (file.endsWith(".yml") || file.endsWith(".yaml")) {
        const content = yaml.load(fs.readFileSync(fullPath, "utf8"));
        documents.push({
          text: JSON.stringify(content, null, 2),
          source: path.relative(careerBrainDir, fullPath)
        });
      }
    }
  }

  walk(careerBrainDir);
  console.log(`Found ${documents.length} YAML files.`);

  for (const doc of documents) {
    console.log(`Ingesting: ${doc.source}`);
    const vector = await embeddings.embedQuery(doc.text);
    const res = await collection.insertOne({
      text: doc.text,
      source: doc.source,
      $vector: vector
    });
    console.log(`✔ Ingested ${doc.source} (ID: ${res.insertedId})`);
  }

  console.log("Ingestion complete!");
}

main().catch(console.error);
