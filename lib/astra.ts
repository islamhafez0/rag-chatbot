import { DataAPIClient, type Collection } from "@datastax/astra-db-ts";
import { GoogleGenerativeAIEmbeddings } from "@langchain/google-genai";
import type { CategoryVectors } from "./query";
import { envNumber, envString, validateEnv } from "./env";

validateEnv();

const endpoint = envString("ASTRA_DB_API_ENDPOINT");
const token = envString("ASTRA_DB_APPLICATION_TOKEN");
const keyspace = envString("ASTRA_DB_NAMESPACE");
const collectionName = envString("ASTRA_DB_COLLECTION");
const defaultLimit = envNumber("RETRIEVAL_LIMIT");

const client = new DataAPIClient(token);
export const db = client.db(endpoint, { keyspace });

const embeddings = new GoogleGenerativeAIEmbeddings({
  apiKey: envString("GOOGLE_API_KEY"),
  modelName: envString("EMBEDDING_MODEL"),
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
  options: RetrievalOptions & { vector?: number[] } = {}
): Promise<RetrievalResult> {
  const { category, limit = defaultLimit, vector, search: searchMode = "vector" } = options;

  const exists = await collectionExists();
  if (!exists) {
    return { text: "", sources: [] };
  }

  const queryVector = vector ?? (await embeddings.embedQuery(query));
  const collection = getCollection();

  const searchVector = async (filter: Record<string, unknown>): Promise<StoredDoc[]> => {
    return (await collection
      .find(filter, {
        sort: { $vector: queryVector },
        limit,
        includeSimilarity: true,
      })
      .toArray()) as StoredDoc[];
  };

  const searchHybrid = async (filter: Record<string, unknown>): Promise<StoredDoc[]> => {
    try {
      const results = await collection
        .findAndRerank(filter, {
          sort: { $hybrid: { $vector: queryVector, $lexical: query } },
          limit,
          includeScores: true,
          rerankOn: "$lexical",
          rerankQuery: query,
        })
        .toArray();
      return results.map((result) => result.document as StoredDoc);
    } catch (error) {
      console.warn(
        "Hybrid + rerank unavailable, falling back to vector-only:",
        error instanceof Error ? error.message : error
      );
      return searchVector(filter);
    }
  };

  const search = searchMode === "vector" ? searchVector : searchHybrid;

  let documents = await search(category ? { category } : {});

  if (category && documents.length < 2) {
    documents = await search({});
  }

  return {
    text: documents.map((doc) => doc.text).join("\n\n"),
    sources: Array.from(new Set(documents.map((doc) => doc.source).filter(Boolean))) as string[],
  };
}

let categoryVectorsPromise: Promise<CategoryVectors[]> | null = null;

export function getCategoryVectors(): Promise<CategoryVectors[]> {
  if (!categoryVectorsPromise) {
    categoryVectorsPromise = (async () => {
      const collection = getCollection();
      const docs = await collection
        .find({}, { projection: { category: 1, $vector: 1 } })
        .toArray();

      const byCategory = new Map<string, number[][]>();
      for (const doc of docs) {
        const category = doc.category as string | undefined;
        const raw = doc.$vector as
          | number[]
          | { asArray?: () => number[] }
          | undefined;
        const vec =
          typeof raw === "number"
            ? [raw]
            : Array.isArray(raw)
              ? raw
              : raw && typeof raw.asArray === "function"
                ? raw.asArray()
                : [];
        if (!category || vec.length === 0) continue;
        const vectors = byCategory.get(category) ?? [];
        vectors.push(vec);
        byCategory.set(category, vectors);
      }

      return Array.from(byCategory, ([category, vectors]) => ({ category, vectors }));
    })().catch((error) => {
      categoryVectorsPromise = null;
      throw error;
    });
  }
  return categoryVectorsPromise;
}
