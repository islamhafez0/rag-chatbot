import { DataAPIClient, type Collection } from "@datastax/astra-db-ts";
import { GoogleGenerativeAIEmbeddings } from "@langchain/google-genai";

const endpoint = process.env.ASTRA_DB_API_ENDPOINT || "";
const token = process.env.ASTRA_DB_APPLICATION_TOKEN || "";
const keyspace = process.env.ASTRA_DB_NAMESPACE || "default_keyspace";
const collectionName = process.env.ASTRA_DB_COLLECTION || "career_vectors";

if (!endpoint || !token) {
  throw new Error("Missing Astra DB environment variables.");
}

const client = new DataAPIClient(token);
export const db = client.db(endpoint, { keyspace });

const embeddings = new GoogleGenerativeAIEmbeddings({
  apiKey: process.env.GOOGLE_API_KEY,
  modelName: "gemini-embedding-001",
});

let cachedCollection: Collection | null = null;
let existsPromise: Promise<boolean> | null = null;

function getCollection(): Collection {
  if (!cachedCollection) {
    cachedCollection = db.collection(collectionName);
  }
  return cachedCollection;
}

function collectionExists(): Promise<boolean> {
  if (existsPromise === null) {
    existsPromise = db
      .listCollections({ nameOnly: true })
      .then((names) => {
        const found = names.includes(collectionName);
        if (!found) existsPromise = null;
        return found;
      })
      .catch((error) => {
        existsPromise = null;
        throw error;
      });
  }
  return existsPromise;
}

interface StoredDoc {
  _id?: unknown;
  text: string;
  source?: string;
}

export interface RetrievalOptions {
  category?: string;
  limit?: number;
}

export interface RetrievalResult {
  text: string;
  sources: string[];
}

export async function getContext(
  query: string,
  options: RetrievalOptions = {}
): Promise<RetrievalResult> {
  const { category, limit = 5 } = options;
  const filter: Record<string, unknown> = category ? { category } : {};

  const exists = await collectionExists();
  if (!exists) {
    return { text: "", sources: [] };
  }

  const vector = await embeddings.embedQuery(query);
  const collection = getCollection();

  let documents: StoredDoc[] = [];
  try {
    const results = await collection
      .findAndRerank(filter, {
        sort: { $hybrid: { $vector: vector, $lexical: query } },
        limit,
        includeScores: true,
        rerankOn: "$lexical",
        rerankQuery: query,
      })
      .toArray();
    documents = results.map((result) => result.document as StoredDoc);
  } catch (error) {
    console.warn(
      "Hybrid + rerank unavailable, falling back to vector-only:",
      error instanceof Error ? error.message : error
    );
    documents = (await collection
      .find(filter, {
        sort: { $vector: vector },
        limit,
        includeSimilarity: true,
      })
      .toArray()) as StoredDoc[];
  }

  return {
    text: documents.map((doc) => doc.text).join("\n\n"),
    sources: Array.from(new Set(documents.map((doc) => doc.source).filter(Boolean))) as string[],
  };
}
