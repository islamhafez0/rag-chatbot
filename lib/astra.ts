import { DataAPIClient } from "@datastax/astra-db-ts";
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

export async function getContext(latestMessage: string) {
  try {
    const collections = await db.listCollections();
    const exists = collections.some((c: any) => c.name === collectionName);
    if (!exists) {
      return { text: "", sources: [] };
    }

    const embeddings = new GoogleGenerativeAIEmbeddings({
      apiKey: process.env.GOOGLE_API_KEY,
      modelName: "text-embedding-004",
    });

    const vector = await embeddings.embedQuery(latestMessage);

    const collection = await db.collection(collectionName);
    const cursor = await collection.find(
      {},
      {
        sort: { $vector: vector },
        limit: 5,
        includeSimilarity: true,
      }
    );

    const documents = await cursor.toArray();

    return {
      text: documents.map((doc: any) => doc.text).join("\n\n"),
      sources: Array.from(new Set(documents.map((doc: any) => doc.source))).filter(Boolean) as string[]
    };
  } catch (error) {
    console.error("Error fetching context:", error);
    return { text: "", sources: [] };
  }
}
