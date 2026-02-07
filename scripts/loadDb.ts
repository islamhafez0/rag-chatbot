import "dotenv/config";
import { scrapeUrl } from "./scrape";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { GoogleGenerativeAIEmbeddings } from "@langchain/google-genai";
import { AstraDBVectorStore } from "@langchain/community/vectorstores/astradb";

const {
  ASTRA_DB_API_ENDPOINT,
  ASTRA_DB_APPLICATION_TOKEN,
  ASTRA_DB_COLLECTION,
  GOOGLE_API_KEY,
} = process.env;

if (!ASTRA_DB_API_ENDPOINT || !ASTRA_DB_APPLICATION_TOKEN || !GOOGLE_API_KEY) {
  throw new Error("Missing environment variables (ASTRA_* or GOOGLE_API_KEY)");
}

export async function ingestUrl(url: string) {
  console.log(`Processing ${url}...`);

  // 1. Scrape
  const content = await scrapeUrl(url);
  if (!content) {
    console.error(`No content found for ${url}`);
    return;
  }

  // 2. Split
  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: 1000,
    chunkOverlap: 200,
  });
  const chunks = await splitter.createDocuments([content], [{ source: url }]);
  console.log(`Split into ${chunks.length} chunks.`);

  // 3. Embed & Store
  console.log("Connecting to Astra DB...");
  const embeddings = new GoogleGenerativeAIEmbeddings({
    apiKey: process.env.GOOGLE_API_KEY,
    modelName: "gemini-embedding-001",
  });

  const vectorStore = await AstraDBVectorStore.fromExistingIndex(embeddings, {
    token: ASTRA_DB_APPLICATION_TOKEN as string,
    endpoint: ASTRA_DB_API_ENDPOINT as string,
    collection: ASTRA_DB_COLLECTION || "career_vectors",
    collectionOptions: {
      vector: {
        dimension: 768,
        metric: "cosine",
      },
    },
  });

  // Connect and add documents
  await vectorStore.addDocuments(chunks);

  console.log(`Successfully ingested ${url}`);
}

const url = process.argv[2];
if (url) {
  ingestUrl(url).catch(console.error);
} else {
  console.log("Please provide a URL as an argument.");
}
